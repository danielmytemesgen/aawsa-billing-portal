"use client";

import * as React from "react";
import { PlusCircle, Gauge, Search, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "@/app/admin/bulk-meters/bulk-meter-form-dialog";
import { BulkMeterTable } from "./bulk-meter-table";
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
  updateExistingBill,
  getCustomers
} from "@/lib/data-store";
import type { Branch } from "@/app/admin/branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from '@/hooks/use-current-user';
import type { StaffMember } from "@/app/admin/staff-management/staff-types";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import { calculateBillAction } from "@/lib/actions";
import { type CustomerType, type SewerageConnection, type PaymentStatus, type BillCalculationResult } from "@/lib/billing-calculations";

export default function StaffBulkMetersPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [authStatus, setAuthStatus] = React.useState<'loading' | 'unauthorized' | 'authorized'>('loading');
  const { currentUser, isStaff, isStaffManagement, branchId, branchName } = useCurrentUser();

  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedBulkMeter, setSelectedBulkMeter] = React.useState<BulkMeter | null>(null);
  const [bulkMeterToDelete, setBulkMeterToDelete] = React.useState<BulkMeter | null>(null);
  const [isBulkCycleDialogOpen, setIsBulkCycleDialogOpen] = React.useState(false);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Determine auth status based on current user
  React.useEffect(() => {
    if (!currentUser) {
      setAuthStatus('unauthorized');
      return;
    }
    if (isStaff || isStaffManagement) setAuthStatus('authorized');
    else setAuthStatus('unauthorized');
  }, [currentUser, isStaff, isStaffManagement]);

  // Second useEffect for data loading, dependent on auth status
  React.useEffect(() => {
    if (authStatus !== 'authorized') {
      if (authStatus !== 'loading') setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const initializeAndSubscribe = async () => {
      try {
        await Promise.all([initializeBranches(), initializeBulkMeters()]);
        if (isMounted) {
          setAllBranches(getBranches());
          setAllBulkMeters(getBulkMeters());
        }
      } catch (err) {
        console.error("Failed to initialize data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAndSubscribe();

    const unSubBranches = subscribeToBranches((data) => isMounted && setAllBranches(data));
    const unSubBulkMeters = subscribeToBulkMeters((data) => isMounted && setAllBulkMeters(data));

    return () => {
      isMounted = false;
      unSubBranches();
      unSubBulkMeters();
    };
  }, [authStatus]);


  // Declarative filtering with useMemo
  const branchFilteredBulkMeters = React.useMemo(() => {
    if (authStatus !== 'authorized') return [];

    // If the user is Staff Management enforce branch-only view regardless of permissions
    if (isStaffManagement && branchId) {
      return allBulkMeters.filter(bm => bm.branchId === branchId);
    }

    // Otherwise respect granular permissions
    if (hasPermission('bulk_meters_view_all')) return allBulkMeters;
    if (hasPermission('bulk_meters_view_branch') && branchId) {
      return allBulkMeters.filter(bm => bm.branchId === branchId);
    }
    return [];
  }, [authStatus, isStaffManagement, branchId, hasPermission, allBulkMeters]);


  const searchedBulkMeters = React.useMemo(() => {
    if (!searchTerm) {
      return branchFilteredBulkMeters;
    }
    return branchFilteredBulkMeters.filter(bm =>
      bm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bm.meterNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bm.subCity && bm.subCity.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (bm.woreda && bm.woreda.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, branchFilteredBulkMeters]);

  const paginatedBulkMeters = searchedBulkMeters.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

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
      const result = await updateBulkMeterInStore(selectedBulkMeter.customerKeyNumber, data);
      if (result.success) {
        toast({ title: "Bulk Meter Updated", description: `${data.name} has been updated.` });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message });
      }
    } else {
      const result = await addBulkMeterToStore(data, currentUser as StaffMember);
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
    const metersToProcess = branchFilteredBulkMeters.filter(bm =>
      !allBills.some(bill => bill.bulkMeterId === bm.customerKeyNumber && bill.monthYear === bm.month)
    );

    let successCount = 0;
    let skippedCount = branchFilteredBulkMeters.length - metersToProcess.length;

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

    if (differenceUsageForCycle === 0) {
      differenceUsageForCycle += 3;
    } else if (differenceUsageForCycle === 1) {
      differenceUsageForCycle += 2;
    } else if (differenceUsageForCycle === 2) {
      differenceUsageForCycle += 1;
    }

    const chargeGroup = bulkMeter.chargeGroup as CustomerType || 'Non-domestic';
    const sewerageConn = bulkMeter.sewerageConnection || 'No';
    const { data: billResult } = await calculateBillAction(differenceUsageForCycle, chargeGroup, sewerageConn, bulkMeter.meterSize, bulkMeter.month!);

    if (!billResult) {
      return { success: false, message: "Failed to calculate bill for cycle end." };
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

    const updatePayload: Partial<Omit<BulkMeter, 'customerKeyNumber'>> = {
      previousReading: bulkMeter.currentReading,
      outStandingbill: newOutstandingBalance,
      paymentStatus: carryBalance ? ('Unpaid' as const) : ('Paid' as const),
    };

    const updateResult = await updateBulkMeterInStore(bulkMeter.customerKeyNumber, updatePayload);
    if (updateResult.success && updateResult.data) {
      return { success: true };
    } else {
      await deleteBulkMeterFromStore(addBillResult.data.id);
      return { success: false, message: "Could not update the meter. The new bill has been rolled back." };
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
          Loading...
        </div>
      );
    }
    if (authStatus === 'unauthorized') {
      return (
        <div className="mt-4 p-4 border rounded-md bg-destructive/10 text-center text-destructive">
          Your user profile is not configured for a staff role or branch.
        </div>
      );
    }
    if (branchFilteredBulkMeters.length === 0 && !searchTerm) {
      return (
        <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
          No bulk meters found for branch: {branchName}. Click "Add New Bulk Meter" to get started. <Gauge className="inline-block ml-2 h-5 w-5" />
        </div>
      );
    }
    return (
      <BulkMeterTable
        data={paginatedBulkMeters}
        onEdit={handleEditBulkMeter}
        onDelete={handleDeleteBulkMeter}
        branches={allBranches}
        canEdit={hasPermission('bulk_meters_update')}
        canDelete={hasPermission('bulk_meters_delete')}
      />
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Bulk Meters {branchName ? `(${branchName})` : ''}</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search bulk meters..."
              className="pl-8 w-full md:w-[250px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={authStatus !== 'authorized'}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={() => setIsBulkCycleDialogOpen(true)}
            disabled={isLoading || authStatus !== 'authorized'}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Bulk Cycle Actions
          </Button>
          {hasPermission('bulk_meters_create') && (
            <Button onClick={handleAddBulkMeter} disabled={authStatus !== 'authorized'}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Bulk Meter
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Bulk Meter List for {branchName || "Your Area"}</CardTitle>
          <CardDescription>View, edit, and manage bulk meter information for your branch.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
        {searchedBulkMeters.length > 0 && authStatus === 'authorized' && (
          <TablePagination
            count={searchedBulkMeters.length}
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

      {(hasPermission('bulk_meters_create') || hasPermission('bulk_meters_update')) && (
        <BulkMeterFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmitBulkMeter}
          defaultValues={selectedBulkMeter}
          staffBranchName={currentUser?.branchName || undefined}
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
              Choose an action to apply to all eligible bulk meters in your branch. Meters that have already been billed for the current month will be skipped.
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