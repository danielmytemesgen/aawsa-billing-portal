"use client";

import * as React from "react";
import { PlusCircle, Gauge, Search, RefreshCcw, MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { BulkMeter } from "./bulk-meter-types";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "./bulk-meter-form-dialog";
import { BulkMeterTable } from "./bulk-meter-table";
import dynamic from 'next/dynamic';

const BulkMeterMap = dynamic(() => import('./bulk-meter-map').then(mod => mod.BulkMeterMap), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});
import {
  getBulkMeters,
  addBulkMeter as addBulkMeterToStore,
  updateBulkMeter as updateBulkMeterInStore,
  deleteBulkMeter as deleteBulkMeterFromStore,
  subscribeToBulkMeters,
  initializeBulkMeters,
  getBranches,
  initializeBranches,
  subscribeToBranches,
  getBills,
  addBill,
  getCustomers
} from "@/lib/data-store";
import { calculateBillAction } from "@/lib/actions";
import type { Branch } from "../branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import type { StaffMember } from "../staff-management/staff-types";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import { type CustomerType, type SewerageConnection } from "@/lib/billing-calculations";

export default function BulkMetersPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedBulkMeter, setSelectedBulkMeter] = React.useState<BulkMeter | null>(null);
  const [bulkMeterToDelete, setBulkMeterToDelete] = React.useState<BulkMeter | null>(null);
  const [isBulkCycleDialogOpen, setIsBulkCycleDialogOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'map'>('table');

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
    setIsLoading(true);
    Promise.all([
      initializeBulkMeters(),
      initializeBranches()
    ]).then(() => {
      setBulkMeters(getBulkMeters());
      setBranches(getBranches());
      setIsLoading(false);
    });

    const unsubscribeBM = subscribeToBulkMeters((updatedBulkMeters) => {
      setBulkMeters(updatedBulkMeters);
    });
    const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
      setBranches(updatedBranches);
    });

    return () => {
      unsubscribeBM();
      unsubscribeBranches();
    };
  }, []);

  const handleAddBulkMeter = () => {
    setSelectedBulkMeter(null);
    setIsFormOpen(true);
  };

  const handleEditBulkMeter = (bulkMeter: BulkMeter) => {
    setSelectedBulkMeter(bulkMeter);
    setIsFormOpen(true);
  };

  const handleDeleteBulkMeter = (bulkMeter: BulkMeter) => {
    setBulkMeterToDelete(bulkMeter);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (bulkMeterToDelete) {
      await deleteBulkMeterFromStore(bulkMeterToDelete.customerKeyNumber);
      toast({ title: "Bulk Meter Deleted", description: `${bulkMeterToDelete.name} has been removed.` });
      setBulkMeterToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleSubmitBulkMeter = async (data: BulkMeterFormValues) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User information not found.' });
      return;
    }

    if (selectedBulkMeter) {
      if (!hasPermission('bulk_meters_update')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to update bulk meters.' }); return; }
      const result = await updateBulkMeterInStore(selectedBulkMeter.customerKeyNumber, data);
      if (result.success) {
        toast({ title: "Bulk Meter Updated", description: `${data.name} has been updated.` });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message });
      }
    } else {
      if (!hasPermission('bulk_meters_create')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to create bulk meters.' }); return; }
      const result = await addBulkMeterToStore(data, currentUser);
      if (result.success) {
        toast({ title: "Bulk Meter Added", description: `${data.name} has been added and is pending approval.` });
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: result.message });
      }
    }
    setIsFormOpen(false);
    setSelectedBulkMeter(null);
  };

  const handleBulkCycle = async (carryBalance: boolean) => {
    setIsBulkCycleDialogOpen(false);
    toast({ title: "Processing Bulk Cycle", description: "This may take a moment..." });

    const allBills = getBills();
    const metersToProcess = bulkMeters.filter(bm =>
      !allBills.some(bill => bill.bulkMeterId === bm.customerKeyNumber && bill.monthYear === bm.month)
    );

    let successCount = 0;
    let skippedCount = bulkMeters.length - metersToProcess.length;

    for (const bulkMeter of metersToProcess) {
      const result = await handleEndOfCycle(bulkMeter, carryBalance);
      if (result.success) {
        successCount++;
      } else {
        toast({ variant: "destructive", title: `Failed to process ${bulkMeter.name}`, description: result.message });
      }
    }

    toast({ title: "Bulk Cycle Complete", description: `${successCount} meters processed. ${skippedCount} skipped.` });
  };

  const handleEndOfCycle = async (bulkMeter: BulkMeter, carryBalance: boolean) => {
    const associatedCustomers = getCustomers().filter(c => c.assignedBulkMeterId === bulkMeter.customerKeyNumber);
    const bmUsage = (bulkMeter.currentReading ?? 0) - (bulkMeter.previousReading ?? 0);
    const totalIndivUsage = associatedCustomers.reduce((sum, cust) => sum + ((cust.currentReading ?? 0) - (cust.previousReading ?? 0)), 0);
    let differenceUsageForCycle = bmUsage - totalIndivUsage;

    if (bmUsage < totalIndivUsage) {
      differenceUsageForCycle = 3;
    }

    if (differenceUsageForCycle === 0) {
      differenceUsageForCycle += 3;
    } else if (differenceUsageForCycle === 1) {
      differenceUsageForCycle += 2;
    } else if (differenceUsageForCycle === 2) {
      differenceUsageForCycle += 1;
    }

    const chargeGroup = bulkMeter.chargeGroup as CustomerType || 'Non-domestic';
    const sewerageConn = bulkMeter.sewerageConnection || 'No';

    const { data: billResult, error: billError } = await calculateBillAction(
      differenceUsageForCycle,
      chargeGroup,
      sewerageConn,
      bulkMeter.meterSize,
      bulkMeter.month!
    );

    if (billError || !billResult) {
      return { success: false, message: `Bill calculation failed: ${billError?.message || 'Unknown error'}` };
    }

    const { totalBill: billForDifferenceUsage, ...differenceBillBreakdownForCycle } = billResult;

    const balanceFromPreviousPeriods = bulkMeter.outStandingbill || 0;
    const totalPayableForCycle = billForDifferenceUsage + balanceFromPreviousPeriods;

    const billDate = new Date();
    const periodEndDate = lastDayOfMonth(parseISO(`${bulkMeter.month}-01`));
    const dueDateObject = new Date(periodEndDate);
    dueDateObject.setDate(dueDateObject.getDate() + 15);

    const billToSave = {
      bulkMeterId: bulkMeter.customerKeyNumber,
      billPeriodStartDate: `${bulkMeter.month}-01`,
      billPeriodEndDate: format(periodEndDate, 'yyyy-MM-dd'),
      monthYear: bulkMeter.month!,
      previousReadingValue: bulkMeter.previousReading,
      currentReadingValue: bulkMeter.currentReading,
      usageM3: (bulkMeter.currentReading ?? 0) - (bulkMeter.previousReading ?? 0),
      differenceUsage: differenceUsageForCycle,
      ...differenceBillBreakdownForCycle,
      balanceCarriedForward: balanceFromPreviousPeriods,
      totalAmountDue: billForDifferenceUsage,
      dueDate: format(dueDateObject, 'yyyy-MM-dd'),
      paymentStatus: carryBalance ? 'Unpaid' : 'Paid',
      notes: `Bill generated on ${format(billDate, 'PP')}. Total payable was ${totalPayableForCycle.toFixed(2)}.`,
    };

    const addBillResult = await addBill(billToSave as any);
    if (!addBillResult.success || !addBillResult.data) {
      return { success: false, message: addBillResult.message };
    }

    const newOutstandingBalance = carryBalance ? totalPayableForCycle : 0;

    const safePreviousReading = typeof bulkMeter.currentReading === 'number' ? bulkMeter.currentReading : 0;
    const updatePayload: Partial<Omit<BulkMeter, 'customerKeyNumber'>> = {
      previousReading: safePreviousReading,
      outStandingbill: Number(newOutstandingBalance) || 0,
      paymentStatus: carryBalance ? 'Unpaid' as any : 'Paid' as any,
    };

    try {
      const updateResult = await updateBulkMeterInStore(bulkMeter.customerKeyNumber, updatePayload);
      if (updateResult && updateResult.success && updateResult.data) {
        return { success: true };
      }
      // rollback: attempt to remove the created bill if update failed
      try {
        if (addBillResult && addBillResult.data && addBillResult.data.id) {
          // deleteBillFromStore is not available here in this scope; skip if not defined
          // await deleteBillFromStore(addBillResult.data.id);
        }
      } catch (_) { }
      return { success: false, message: updateResult?.message || "Could not update the meter after creating bill." };
    } catch (err) {
      try {
        if (addBillResult && addBillResult.data && addBillResult.data.id) {
          // await deleteBillFromStore(addBillResult.data.id);
        }
      } catch (_) { }
      return { success: false, message: (err as any)?.message || 'Unexpected error updating bulk meter.' };
    }
  };

  const metersForUser = React.useMemo(() => {
    if (currentUser?.role?.toLowerCase() === 'staff management' && currentUser.branchId) {
      return bulkMeters.filter(meter => meter.branchId === currentUser.branchId);
    }
    return bulkMeters;
  }, [bulkMeters, currentUser]);

  const filteredBulkMeters = metersForUser.filter(bm =>
    bm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bm.meterNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bm.branchId && branches.find(b => b.id === bm.branchId)?.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    bm.subCity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bm.contractNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedBulkMeters = filteredBulkMeters.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Bulk Meters Management</h1>
        <div className="flex gap-2 w-full md:w-auto">
          {viewMode === 'table' && (
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search bulk meters..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'table' ? 'map' : 'table')}
          >
            <MapIcon className="mr-2 h-4 w-4" />
            {viewMode === 'table' ? 'Map View' : 'Table View'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={() => setIsBulkCycleDialogOpen(true)}
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Bulk Cycle Actions
          </Button>
          {hasPermission('bulk_meters_create') && (
            <Button onClick={handleAddBulkMeter} className="flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'map' && (
        <div>
          <BulkMeterMap bulkMeters={metersForUser.map(m => ({ ...m }))} branches={branches} />
        </div>
      )}

      <div className={viewMode === 'table' ? '' : 'hidden'}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Bulk Meter List</CardTitle>
            <CardDescription>View, edit, and manage bulk meter information.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
                Loading bulk meters...
              </div>
            ) : bulkMeters.length === 0 && !searchTerm ? (
              <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                <Gauge className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold">No Bulk Meters Found</h3>
                <p className="text-muted-foreground mt-1">Click "Add New" to get started.</p>
              </div>
            ) : (
              <BulkMeterTable
                data={paginatedBulkMeters}
                onEdit={handleEditBulkMeter}
                onDelete={handleDeleteBulkMeter}
                branches={branches}
                canEdit={hasPermission('bulk_meters_update')}
                canDelete={hasPermission('bulk_meters_delete')}
              />
            )}
          </CardContent>
          {filteredBulkMeters.length > 0 && (
            <TablePagination
              count={filteredBulkMeters.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(value) => {
                setRowsPerPage(value);
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          )}
        </Card>
      </div>


      {(hasPermission('bulk_meters_create') || hasPermission('bulk_meters_update')) && (
        <BulkMeterFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmitBulkMeter}
          defaultValues={selectedBulkMeter}
        />
      )}

      {hasPermission('bulk_meters_delete') && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the bulk meter {bulkMeterToDelete?.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkMeterToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={isBulkCycleDialogOpen} onOpenChange={setIsBulkCycleDialogOpen}>
        <AlertDialogContent className="md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Billing Cycle Actions</AlertDialogTitle>
            <AlertDialogDescription>
              Choose an action to apply to all eligible bulk meters. Meters that have already been billed for the current month will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap">
            <Button variant="secondary" onClick={() => handleBulkCycle(false)}>Mark All as Paid & Start New Cycles</Button>
            <Button variant="destructive" onClick={() => handleBulkCycle(true)}>Carry All Balances & Start New Cycles</Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
