
"use client";

import * as React from "react";
import { PlusCircle, User, Search, Users, Activity, UserMinus, UserCog, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { IndividualCustomer } from "./individual-customer-types";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "./individual-customer-form-dialog";
import { IndividualCustomerTable } from "./individual-customer-table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  getCustomers,
  addCustomer as addCustomerToStore,
  updateCustomer as updateCustomerInStore,
  deleteCustomer as deleteCustomerFromStore,
  fetchCustomersPaginated,
  getBulkMeters,
  subscribeToBulkMeters,
  initializeBulkMeters,
  getBranches,
  initializeBranches,
  subscribeToBranches,
  initializeTariffs,
  fetchCustomersSummary
} from "@/lib/data-store";
import type { Branch } from "../branches/branch-types";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import type { StaffMember } from "../staff-management/staff-types";

export default function IndividualCustomersPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
  const [bulkMetersList, setBulkMetersList] = React.useState<{ customerKeyNumber: string, name: string }[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<IndividualCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = React.useState<IndividualCustomer | null>(null);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);
  const [summary, setSummary] = React.useState({ total: 0, active: 0, inactive: 0 });
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const fetchSummaryStats = React.useCallback(async () => {
    const { data } = await fetchCustomersSummary();
    if (data) setSummary(data);
  }, []);

  const fetchData = React.useCallback(async (p: number, rpp: number, search: string) => {
    setIsLoading(true);
    const { customers: paginatedCustomers, totalCount: count, error } = await fetchCustomersPaginated(rpp, p * rpp, search);
    if (!error) {
      setCustomers(paginatedCustomers);
      setTotalCount(count);
    } else {
      toast({
        title: "Error",
        description: "Failed to fetch customers from server.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    fetchData(page, rowsPerPage, debouncedSearch);
    fetchSummaryStats();
  }, [page, rowsPerPage, debouncedSearch, fetchData, fetchSummaryStats]);

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }

    // Initialize secondary data
    Promise.all([
      initializeBulkMeters(true),
      initializeBranches(true),
      initializeTariffs(true)
    ]).then(() => {
      setBulkMetersList(getBulkMeters().filter(bm => bm.status === 'Active').map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })));
      setBranches(getBranches());
    });

    const unsubscribeBulkMeters = subscribeToBulkMeters((updatedBulkMeters) => {
      setBulkMetersList(updatedBulkMeters.filter(bm => bm.status === 'Active').map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })));
    });
    const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
      setBranches(updatedBranches);
    });

    return () => {
      unsubscribeBulkMeters();
      unsubscribeBranches();
    };
  }, []);

  const userBranchId = currentUser?.branchId;
  const isHeadOffice = !userBranchId || currentUser?.role?.toLowerCase().includes("head office");

  const handleAddCustomer = () => {
    setSelectedCustomer(isHeadOffice ? null : { branchId: userBranchId } as any);
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
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
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
      if (!hasPermission('customers_update')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to update customers.' }); return; }
      const result = await updateCustomerInStore(selectedCustomer.customerKeyNumber, data);
      if (result.success) {
        toast({ title: "Customer Updated", description: `${data.name} has been updated.` });
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: result.message || "Could not update the customer.",
        });
      }
    } else {
      if (!hasPermission('customers_create')) { toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to create customers.' }); return; }
      const result = await addCustomerToStore(data);
      if (result.success && result.data) {
        toast({ title: "Customer Added", description: `${result.data.name} has been added.` });
        fetchData(page, rowsPerPage, debouncedSearch);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: result.message || "Could not add customer." });
      }
    }
    setIsFormOpen(false);
    setSelectedCustomer(null);
  };

  const getBranchNameFromList = (branchId?: string, fallbackLocation?: string) => {
    if (branchId) {
      const branch = branches.find(b => b.id === branchId);
      if (branch) return branch.name;
    }
    return fallbackLocation || "";
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Individual Customers Management</h1>
          <p className="text-muted-foreground mt-1 text-base">Direct consumers attached to primary or bulk meters.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasPermission('customers_create') && (
            <Button onClick={handleAddCustomer} className="flex-shrink-0 shadow-sm">
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
              <CardDescription>Manage your individual consumer registry.</CardDescription>
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
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[1000px]">
            {isLoading ? (
              <div className="p-4">
                <TableSkeleton columns={7} rows={10} />
              </div>
            ) : customers.length === 0 ? (
              <EmptyState 
                icon={FileText} 
                title={searchTerm ? "No Results Found" : "No Customers Found"} 
                description={searchTerm ? "Try adjusting your search criteria." : "There are no individual customers registered based on your viewing permissions."} 
                className="m-4"
                action={
                  (!searchTerm && hasPermission('customers_create')) ? (
                    <Button onClick={handleAddCustomer} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add First Customer
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <IndividualCustomerTable
                data={customers}
                onEdit={handleEditCustomer}
                onDelete={handleDeleteCustomer}
                bulkMetersList={bulkMetersList}
                branches={branches}
                canEdit={hasPermission('customers_update')}
                canDelete={hasPermission('customers_delete')}
              />
            )}
          </div>
        </CardContent>
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
      </Card>

      {(hasPermission('customers_create') || hasPermission('customers_update')) && (
        <IndividualCustomerFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmitCustomer}
          defaultValues={selectedCustomer}
          bulkMeters={bulkMetersList}
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
