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
  const [selectedMeters, setSelectedMeters] = React.useState<Set<string>>(new Set());
  const [isBatchInvoiceDialogOpen, setIsBatchInvoiceDialogOpen] = React.useState(false);


  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
    setIsLoading(true);
    Promise.all([
      initializeBulkMeters(true),
      initializeBranches(true)
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

  const metersForUser = React.useMemo(() => {
    let baseMeters = bulkMeters;
    if (currentUser?.role?.toLowerCase() === 'staff management' && currentUser.branchId) {
      baseMeters = bulkMeters.filter(meter => meter.branchId === currentUser.branchId);
    }
    return baseMeters.filter(meter => meter.status !== 'Pending Approval');
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
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Total Bulk Meters</p>
                <p className="text-4xl font-extrabold text-slate-900">{metersForUser.length}</p>
              </div>
              <div className="h-14 w-14 bg-blue-100/80 rounded-2xl flex items-center justify-center text-blue-600 rotate-3 group-hover:rotate-6 transition-transform">
                <Gauge className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-emerald-500" /> All established accounts</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Active Meters</p>
                <p className="text-4xl font-extrabold text-slate-900">{metersForUser.filter(m => m.status === 'Active').length}</p>
              </div>
              <div className="h-14 w-14 bg-emerald-100/80 rounded-2xl flex items-center justify-center text-emerald-600 -rotate-3 group-hover:rotate-0 transition-transform">
                <CheckCircle2 className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-bold text-emerald-600">
                {Math.round((metersForUser.filter(m => m.status === 'Active').length / (metersForUser.length || 1)) * 100)}% 
              </span>
              <span className="ml-1 italic">of total meters functional</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 shadow-sm transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Offline / Inactive</p>
                <p className="text-4xl font-extrabold text-slate-900">{metersForUser.filter(m => m.status !== 'Active').length}</p>
              </div>
              <div className="h-14 w-14 bg-amber-100/80 rounded-2xl flex items-center justify-center text-amber-600 rotate-6 transition-transform">
                <AlertCircle className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-amber-600">Action required</span>
              <span className="ml-1 text-slate-400">for {metersForUser.filter(m => m.status !== 'Active').length} accounts</span>
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
                <span className="text-sm font-bold text-slate-600">{filteredBulkMeters.length} <span className="text-slate-400 font-normal">Found</span></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                selectedMeters={selectedMeters}
                onSelectionChange={setSelectedMeters}
              />
            )}
          </CardContent>
          <div className="bg-slate-50/50 border-t py-4 px-6">
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
