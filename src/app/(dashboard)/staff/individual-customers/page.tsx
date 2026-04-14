

"use client";

import * as React from "react";
import { PlusCircle, User, Search, Users, Activity, UserMinus, UserCog, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "@/app/(dashboard)/admin/individual-customers/individual-customer-form-dialog";
import { IndividualCustomerTable } from "@/app/(dashboard)/admin/individual-customers/individual-customer-table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  getCustomers,
  addCustomer as addCustomerToStore,
  updateCustomer as updateCustomerInStore,
  deleteCustomer as deleteCustomerFromStore,
  subscribeToCustomers,
  initializeCustomers,
  getBulkMeters,
  subscribeToBulkMeters,
  initializeBulkMeters,
  getBranches,
  initializeBranches,
  subscribeToBranches
} from "@/lib/data-store";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";
import { useCurrentUser } from '@/hooks/use-current-user';
import { usePermissions } from "@/hooks/use-permissions";

export default function StaffIndividualCustomersPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { currentUser, branchId, branchName, isStaffManagement } = useCurrentUser();

  const [allCustomers, setAllCustomers] = React.useState<IndividualCustomer[]>([]);
  const [allBulkMeters, setAllBulkMeters] = React.useState<BulkMeter[]>([]);
  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<IndividualCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = React.useState<IndividualCustomer | null>(null);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // currentUser provided by useCurrentUser

  React.useEffect(() => {
    if (!branchId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const initializeData = async () => {
      try {
        await Promise.all([initializeBranches(true), initializeBulkMeters(true), initializeCustomers(true)]);
        if (isMounted) {
          setAllBranches(getBranches());
          setAllBulkMeters(getBulkMeters());
          setAllCustomers(getCustomers());
        }
      } catch (err) {
        console.error("Failed to initialize data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeData();

    const unSubBranches = subscribeToBranches((data) => isMounted && setAllBranches(data));
    const unSubBulkMeters = subscribeToBulkMeters((data) => isMounted && setAllBulkMeters(data));
    const unSubCustomers = subscribeToCustomers((data) => isMounted && setAllCustomers(data));

    return () => {
      isMounted = false;
      unSubBranches();
      unSubBulkMeters();
      unSubCustomers();
    };
  }, [currentUser]);

  // Declarative filtering with useMemo
  const branchFilteredData = React.useMemo(() => {
    // Staff Management role must only see its own branch
    if (isStaffManagement && branchId) {
      const branchBMs = allBulkMeters.filter(bm => bm.branchId === branchId);
      const branchBMKeys = new Set(branchBMs.map(bm => bm.customerKeyNumber));
      const branchCustomers = allCustomers.filter(customer =>
        customer.branchId === branchId ||
        (customer.assignedBulkMeterId && branchBMKeys.has(customer.assignedBulkMeterId))
      );
      return { customers: branchCustomers, bulkMeters: branchBMs.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })) };
    }

    // Users with global view permission see everything (unless staff management handled above)
    if (hasPermission('customers_view_all')) {
      return { customers: allCustomers, bulkMeters: allBulkMeters.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })) };
    }

    // Branch-scoped view for users who have that permission
    if (hasPermission('customers_view_branch') && branchId) {
      const branchBMs = allBulkMeters.filter(bm => bm.branchId === branchId);
      const branchBMKeys = new Set(branchBMs.map(bm => bm.customerKeyNumber));
      const branchCustomers = allCustomers.filter(customer =>
        customer.branchId === branchId ||
        (customer.assignedBulkMeterId && branchBMKeys.has(customer.assignedBulkMeterId))
      );
      return { customers: branchCustomers, bulkMeters: branchBMs.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })) };
    }

    return { customers: [], bulkMeters: [] };
  }, [isStaffManagement, branchId, hasPermission, allCustomers, allBulkMeters]);

  const searchedCustomers = React.useMemo(() => {
    if (!searchTerm) {
      return branchFilteredData.customers;
    }
    return branchFilteredData.customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.meterNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.subCity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.woreda.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.assignedBulkMeterId && allBulkMeters.find(bm => bm.customerKeyNumber === customer.assignedBulkMeterId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, branchFilteredData.customers, allBulkMeters]);

  const summary = React.useMemo(() => {
    const total = branchFilteredData.customers.length;
    const active = branchFilteredData.customers.filter(c => c.status === 'Active').length;
    return { total, active, inactive: total - active };
  }, [branchFilteredData.customers]);

  const paginatedCustomers = searchedCustomers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsFormOpen(true);
  };

  const handleEditCustomer = (customer: IndividualCustomer) => {
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDeleteCustomer = (customer: IndividualCustomer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (customerToDelete) {
      const result = await deleteCustomerFromStore(customerToDelete.customerKeyNumber);
      if (result.success) {
        toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been removed.` });
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: result.message || "Could not delete customer." });
      }
      setCustomerToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleSubmitCustomer = async (data: IndividualCustomerFormValues) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User information not found.' });
      return;
    }

    if (selectedCustomer) {
      const result = await updateCustomerInStore(selectedCustomer.customerKeyNumber, data);
      if (result.success) {
        toast({ title: "Customer Updated", description: `${data.name} has been updated.` });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.message || "Could not update customer." });
      }
    } else {
      const result = await addCustomerToStore(data);
      if (result.success && result.data) {
        toast({ title: "Customer Added", description: `${result.data.name} has been added.` });
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: result.message || "Could not add customer." });
      }
    }
    setIsFormOpen(false);
    setSelectedCustomer(null);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4 overflow-x-auto min-w-[1000px]">
          <TableSkeleton columns={7} rows={10} />
        </div>
      );
    }
    if (!branchId && !hasPermission('customers_view_all')) {
      return (
        <EmptyState 
          icon={UserMinus} 
          title="Profile Not Configured" 
          description="Your user profile is not configured for a staff role or branch. Please contact an administrator." 
        />
      );
    }
    if (branchFilteredData.customers.length === 0 && !searchTerm) {
      return (
        <EmptyState 
          icon={FileText} 
          title="No Customers Found" 
          description="No abstract or individual customers are registered for your branch." 
          action={
            hasPermission('customers_create') ? (
              <Button onClick={handleAddCustomer} variant="outline" className="mt-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Customer
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <div className="overflow-x-auto min-h-[400px]">
        <div className="min-w-[1000px]">
          <IndividualCustomerTable
            data={paginatedCustomers}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
            bulkMetersList={allBulkMeters.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }))}
            branches={allBranches}
            canEdit={hasPermission('customers_update')}
            canDelete={hasPermission('customers_delete')}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Individual Customers {branchName ? `(${branchName})` : ''}</h1>
          <p className="text-muted-foreground mt-1 text-base">Direct consumers attached to primary or bulk meters in your branch.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasPermission('customers_create') && (
            <Button onClick={handleAddCustomer} disabled={!branchId} className="flex-shrink-0 shadow-sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Customer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="group shadow-sm hover:shadow-xl border border-emerald-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f0fbf4' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <Users className="h-48 w-48 text-emerald-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Total Individual Customers</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-emerald-900 transition-colors">{summary.total}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-emerald-600 whitespace-nowrap">Total active individual accounts</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group shadow-sm hover:shadow-xl border border-blue-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#f4f7ff' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <Activity className="h-48 w-48 text-blue-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Active Accounts</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-blue-900 transition-colors">{summary.active}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-blue-600 whitespace-nowrap">Currently receiving services</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group shadow-sm hover:shadow-xl border border-amber-100 rounded-3xl relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ backgroundColor: '#fffbf0' }}>
          <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none -mb-6 -mr-6 group-hover:scale-110">
            <UserMinus className="h-48 w-48 text-amber-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-6 px-6 relative z-10">
            <CardTitle className="text-sm font-bold uppercase text-slate-600 tracking-wider">Inactive / Pending</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <UserMinus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 relative z-10">
            <div className="flex items-end gap-2 mb-1 mt-2">
              <div className="text-4xl lg:text-5xl font-black tracking-tight text-slate-800 group-hover:text-amber-900 transition-colors">{summary.inactive}</div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
               <span className="flex items-center gap-1 font-semibold text-amber-600 whitespace-nowrap">Requires review</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-slate-200/60 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Customer Database</CardTitle>
              <CardDescription>Manage individual consumer registry for {branchName || "your area"}.</CardDescription>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search by key, name..."
              className="pl-9 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!branchId}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {renderContent()}
        </CardContent>
        {searchedCustomers.length > 0 && branchId && (
          <TablePagination
            count={searchedCustomers.length}
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
      </Card>

      {(hasPermission('customers_create') || hasPermission('customers_update')) && (
        <IndividualCustomerFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmitCustomer}
          defaultValues={selectedCustomer}
          bulkMeters={branchFilteredData.bulkMeters}
          staffBranchName={currentUser?.branchName || undefined}
        />
      )}

      {hasPermission('customers_delete') && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the customer {customerToDelete?.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
