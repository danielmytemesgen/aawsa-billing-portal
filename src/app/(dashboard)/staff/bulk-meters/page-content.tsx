"use client";

import * as React from "react";
import { PlusCircle, Gauge, Search, RefreshCcw, MapIcon, Activity, CheckCircle2, AlertCircle, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-form-dialog";
import { BulkMeterTable } from "./bulk-meter-table";
import { BatchInvoiceDialog } from "@/app/(dashboard)/admin/bulk-meters/batch-invoice-dialog";
import dynamic from 'next/dynamic';

const BulkMeterMap = dynamic(() => import('@/components/maps/BulkMeterMap').then(mod => mod.BulkMeterMap), {
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
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from '@/hooks/use-current-user';
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";
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
    // Allow any user with a session; permissions will handle specific actions
    setAuthStatus('authorized');
  }, [currentUser]);

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
        <div className="p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
          <Gauge className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold">No Bulk Meters Found</h3>
          <p className="text-muted-foreground mt-1">No bulk meters assigned to: {branchName}. Click &quot;Add New&quot; to get started.</p>
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Meters {branchName ? `(${branchName})` : ''}</h1>
          <p className="text-muted-foreground mt-1 text-base">Monitor and organize high-volume water consumption points for your branch.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasPermission('bulk_meters_create') && (
            <Button onClick={handleAddBulkMeter} disabled={authStatus !== 'authorized'} className="flex-shrink-0 shadow-sm order-1 md:order-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Meter
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setViewMode(viewMode === 'table' ? 'map' : 'table')}
            disabled={authStatus !== 'authorized'}
            className="flex-shrink-0 shadow-sm border-slate-200 order-2 md:order-1"
          >
            <MapIcon className="mr-2 h-4 w-4" />
            {viewMode === 'table' ? 'View on Map' : 'Back to Table'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="group shadow-sm hover:shadow-xl border border-purple-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#faf5ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <Gauge className="h-48 w-48 text-purple-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Total Bulk Meters</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Gauge className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-purple-900 transition-colors">{branchFilteredBulkMeters.length}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-emerald-500" /> All established accounts</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group shadow-sm hover:shadow-xl border border-emerald-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f0fbf4' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <CheckCircle2 className="h-48 w-48 text-emerald-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Active Meters</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-emerald-900 transition-colors">{branchFilteredBulkMeters.filter(m => m.status === 'Active').length}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-bold text-emerald-600 whitespace-nowrap">
                {Math.round((branchFilteredBulkMeters.filter(m => m.status === 'Active').length / (branchFilteredBulkMeters.length || 1)) * 100)}% 
              </span>
              <span className="ml-1 italic whitespace-nowrap">of total meters functional</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group shadow-sm hover:shadow-xl border border-amber-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#fffbf0' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <AlertCircle className="h-48 w-48 text-amber-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Offline / Inactive</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-amber-900 transition-colors">{branchFilteredBulkMeters.filter(m => m.status !== 'Active').length}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-amber-600 whitespace-nowrap">Action required</span>
              <span className="ml-1 text-slate-400 whitespace-nowrap">for {branchFilteredBulkMeters.filter(m => m.status !== 'Active').length} accounts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by name, meter #, contract, or branch..."
            className="pl-12 h-14 w-full shadow-sm border-slate-200 focus-visible:ring-primary/20 text-lg font-medium placeholder:text-slate-400 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={authStatus !== 'authorized'}
          />
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

      <div className={viewMode === 'table' ? '' : 'hidden'}>
        <Card className="shadow-lg border-slate-200 overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-50/50 border-b py-6 px-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-5 w-5 text-primary animate-pulse" />
                  <CardTitle className="text-xl font-bold text-slate-800">Bulk Meter Database</CardTitle>
                </div>
                <CardDescription className="text-slate-500 font-medium italic">Directory of registered high-capacity consumption endpoints.</CardDescription>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-600">{searchedBulkMeters.length} <span className="text-slate-400 font-normal">Found</span></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderContent()}
          </CardContent>
          <div className="bg-slate-50/50 border-t py-4 px-6">
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
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
              />
            )}
          </div>
        </Card>
      </div>

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