"use client";

import * as React from "react";
import { PlusCircle, Gauge, Search, MapIcon, Activity, CheckCircle2, AlertCircle, ListFilter, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { BulkMeter } from "./bulk-meter-types";
import { BulkMeterFormDialog, type BulkMeterFormValues } from "./bulk-meter-form-dialog";
import { BulkMeterTable } from "./bulk-meter-table";
import { BatchInvoiceDialog } from "./batch-invoice-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
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
  fetchBulkMetersPaginated,
  fetchBulkMetersSummary,
  approveBulkMeter as approveBulkMeterInStore,
  rejectBulkMeter as rejectBulkMeterInStore,
  getBranches,
  initializeBranches,
  subscribeToBranches,
} from "@/lib/data-store";
import type { Branch } from "../branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import type { StaffMember } from "../staff-management/staff-types";

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
  const [viewMode, setViewMode] = React.useState<'table' | 'map'>('table');

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);
  const [summary, setSummary] = React.useState({ total: 0, active: 0, inactive: 0 });
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedMeters, setSelectedMeters] = React.useState<Set<string>>(new Set());
  const [isBatchInvoiceDialogOpen, setIsBatchInvoiceDialogOpen] = React.useState(false);


  const fetchData = React.useCallback(async (p: number, rpp: number, search: string) => {
    setIsLoading(true);
    const { bulkMeters: paginatedBMs, totalCount: count, error } = await fetchBulkMetersPaginated(rpp, p * rpp, search);
    if (!error) {
      setBulkMeters(paginatedBMs);
      setTotalCount(count);
    } else {
      toast({ title: "Error", description: "Failed to fetch bulk meters.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  const fetchSummaryStats = React.useCallback(async () => {
    const { data } = await fetchBulkMetersSummary();
    if (data) setSummary(data);
  }, []);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    fetchData(page, rowsPerPage, debouncedSearch);
  }, [page, rowsPerPage, debouncedSearch, fetchData]);

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
    fetchSummaryStats();
    initializeBranches(true).then(() => {
      setBranches(getBranches());
    });

    const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
      setBranches(updatedBranches);
    });

    return () => {
      unsubscribeBranches();
    };
  }, [fetchSummaryStats]);

  const userBranchId = currentUser?.branchId;
  const isHeadOffice = !userBranchId || hasPermission('bulk_meters_view_all');

  const handleAddBulkMeter = () => {
    setSelectedBulkMeter(isHeadOffice ? null : { branchId: userBranchId } as any);
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
      const result = await deleteBulkMeterFromStore(bulkMeterToDelete.customerKeyNumber);
      if (result.success) {
        toast({ title: "Bulk Meter Deleted", description: `${bulkMeterToDelete.name} has been removed.` });
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: result.message });
      }
      setBulkMeterToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleApproveMeter = async (meter: BulkMeter) => {
    if (!currentUser) return;
    try {
      const result = await approveBulkMeterInStore(meter.customerKeyNumber, currentUser.id);
      if (result.success) {
        toast({ title: "Meter Approved", description: `${meter.name} is now Active.` });
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Approval Failed", description: result.message || "Could not approve meter." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    }
  };

  const handleRejectMeter = async (meter: BulkMeter) => {
    if (!currentUser) return;
    try {
      const result = await rejectBulkMeterInStore(meter.customerKeyNumber, currentUser.id);
      if (result.success) {
        toast({ title: "Meter Rejected", description: `${meter.name} has been marked as Rejected.` });
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Rejection Failed", description: result.message || "Could not reject meter." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    }
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
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message || "Could not update meter." });
      }
    } else {
      if (!hasPermission('bulk_meters_create')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to create bulk meters.' }); return; }
      const result = await addBulkMeterToStore(data);
      if (result.success) {
        toast({ title: "Bulk Meter Added", description: `${data.name} has been added and is pending approval.` });
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: result.message || "Could not add meter." });
      }
    }
    setIsFormOpen(false);
    setSelectedBulkMeter(null);
  };

  const metersForUser = React.useMemo(() => {
    return bulkMeters; // Branch filtering handled server side in getAllBulkMetersAction
  }, [bulkMeters]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Meters Management</h1>
          <p className="text-muted-foreground mt-1 text-base">Monitor and organize high-volume water consumption points across all branches.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasPermission('bulk_meters_create') && (
            <Button onClick={handleAddBulkMeter} className="flex-shrink-0 shadow-sm order-1 md:order-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Meter
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setViewMode(viewMode === 'table' ? 'map' : 'table')}
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
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-purple-900 transition-colors">{summary.total}</div>
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
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-emerald-900 transition-colors">{summary.active}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-bold text-emerald-600 whitespace-nowrap">
                {Math.round((summary.active / (summary.total || 1)) * 100)}% 
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
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-amber-900 transition-colors">{summary.inactive}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-amber-600 whitespace-nowrap">Action required</span>
              <span className="ml-1 text-slate-400 whitespace-nowrap">for {summary.inactive} accounts</span>
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
          <BulkMeterMap bulkMeters={metersForUser.map(m => ({ ...m }))} branches={branches} />
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
                <span className="text-sm font-bold text-slate-600">{totalCount} <span className="text-slate-400 font-normal">Found</span></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[1000px]">
              {isLoading ? (
                <div className="p-4">
                  <TableSkeleton columns={8} rows={10} />
                </div>
              ) : bulkMeters.length === 0 ? (
                <EmptyState 
                  icon={Gauge} 
                  title={searchTerm ? "No Results Found" : "No Bulk Meters Found"} 
                  description={searchTerm ? "Try adjusting your search criteria." : "Click 'Add New Meter' to register the first bulk meter."} 
                  className="m-4"
                  action={
                    (!searchTerm && hasPermission('bulk_meters_create')) ? (
                      <Button onClick={handleAddBulkMeter} variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Meter
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <BulkMeterTable
                  data={bulkMeters}
                  onEdit={handleEditBulkMeter}
                onDelete={handleDeleteBulkMeter}
                onApprove={handleApproveMeter}
                onReject={handleRejectMeter}
                branches={branches}
                canEdit={hasPermission('bulk_meters_update')}
                canDelete={hasPermission('bulk_meters_delete')}
                canApprove={hasPermission('bulk_meters_approve')}
                selectedMeters={selectedMeters}
                onSelectionChange={setSelectedMeters}
              />
            )}
            </div>
          </CardContent>
          <div className="bg-slate-50/50 border-t py-4 px-6">
            {totalCount > 0 && (
              <TablePagination
                count={totalCount}
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
