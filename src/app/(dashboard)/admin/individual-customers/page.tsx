
"use client";

import * as React from "react";
import { PlusCircle, User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { IndividualCustomer } from "./individual-customer-types";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "./individual-customer-form-dialog";
import { IndividualCustomerTable } from "./individual-customer-table";
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
  initializeTariffs
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
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

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
  }, [page, rowsPerPage, debouncedSearch, fetchData]);

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
        fetchData(page, rowsPerPage, debouncedSearch);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Individual Customers Management</h1>
        <div className="flex w-full flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full sm:w-auto flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {hasPermission('customers_create') && (
            <Button onClick={handleAddCustomer} className="w-full sm:w-auto flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>View, edit, and manage all individual customer information.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center text-muted-foreground">
              Loading customers...
            </div>
          ) : customers.length === 0 && !searchTerm ? (
            <div className="mt-4 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold">No Customers Found</h3>
              <p className="text-muted-foreground mt-1">Click &quot;Add New&quot; to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <IndividualCustomerTable
                data={customers}
                onEdit={handleEditCustomer}
                onDelete={handleDeleteCustomer}
                bulkMetersList={bulkMetersList}
                branches={branches}
                canEdit={hasPermission('customers_update')}
                canDelete={hasPermission('customers_delete')}
              />
            </div>
          )}
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
            rowsPerPageOptions={[10, 25, 50, 100]}
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
