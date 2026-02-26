"use client";

import * as React from "react";
import { PlusCircle, Gauge, Search, RefreshCcw, MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "@/app/admin/bulk-meters/bulk-meter-form-dialog";
import { BulkMeterTable } from "./bulk-meter-table";
import { BatchInvoiceDialog } from "@/app/admin/bulk-meters/batch-invoice-dialog";
import dynamic from 'next/dynamic';

const BulkMeterMap = dynamic(() => import('@/components/BulkMeterMap').then(mod => mod.BulkMeterMap), {
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
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from "@/lib/billing-config";

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

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [selectedMeters, setSelectedMeters] = React.useState<Set<string>>(new Set());
  const [isBatchInvoiceDialogOpen, setIsBatchInvoiceDialogOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'map'>('table');

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
        await Promise.all([initializeBranches(true), initializeBulkMeters(true)]);
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
      const result = await addBulkMeterToStore(data);
      if (result.success) {
        toast({ title: "Bulk Meter Added", description: `${data.name} has been added and is pending approval.` });
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: result.message });
      }
    }
    setIsFormOpen(false);
    setSelectedBulkMeter(null);
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
        selectedMeters={selectedMeters}
        onSelectionChange={setSelectedMeters}
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
            onClick={() => setViewMode(viewMode === 'table' ? 'map' : 'table')}
            disabled={authStatus !== 'authorized'}
          >
            <MapIcon className="mr-2 h-4 w-4" />
            {viewMode === 'table' ? 'Map View' : 'Table View'}
          </Button>
          {hasPermission('bulk_meters_create') && (
            <Button onClick={handleAddBulkMeter} disabled={authStatus !== 'authorized'}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Bulk Meter
            </Button>
          )}
        </div>
      </div>

      {selectedMeters.size > 0 && (hasPermission('bill:create') || hasPermission('reports_generate_all')) && (
        <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {selectedMeters.size} meter{selectedMeters.size !== 1 ? 's' : ''} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMeters(new Set())}
              className="h-7 text-xs"
            >
              Clear Selection
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsBatchInvoiceDialogOpen(true)}
              size="sm"
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Generate Invoices ({selectedMeters.size})
            </Button>
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="min-h-[600px] border rounded-lg overflow-hidden">
          <BulkMeterMap bulkMeters={branchFilteredBulkMeters.map(m => ({ ...m }))} branches={allBranches} />
        </div>
      )}

      <Card className={`shadow-lg ${viewMode === 'map' ? 'hidden' : ''}`}>
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

      <BatchInvoiceDialog
        open={isBatchInvoiceDialogOpen}
        onOpenChange={setIsBatchInvoiceDialogOpen}
        selectedMeterIds={selectedMeters}
        onComplete={() => {
          setSelectedMeters(new Set());
        }}
      />
    </div>
  );
}