"use client";

import * as React from "react";
import { PlusCircle, User, Search, Users, Activity, UserMinus, UserCog, FileText, Download, ChevronDown, X, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { IndividualCustomer } from "./individual-customer-types";
import { IndividualCustomerFormDialog, type IndividualCustomerFormValues } from "./individual-customer-form-dialog";
import { IndividualCustomerTable } from "./individual-customer-table";
import { IndividualCustomerDetailsSheet } from "@/components/customers/IndividualCustomerDetailsSheet";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { individualCustomerStatuses, type IndividualCustomerStatus } from "./individual-customer-types";
import {
  getCustomers,
  addCustomer as addCustomerToStore,
  updateCustomer as updateCustomerInStore,
  deleteCustomer as deleteCustomerFromStore,
  fetchCustomersPaginated,
  approveCustomer as approveCustomerInStore,
  rejectCustomer as rejectCustomerInStore,
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

  // Details sheet state
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = React.useState<IndividualCustomer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);
  const [summary, setSummary] = React.useState({ total: 0, active: 0, inactive: 0 });
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<IndividualCustomerStatus | 'All'>('All');
  const [branchFilter, setBranchFilter] = React.useState<string>('All');
  const [isExporting, setIsExporting] = React.useState(false);

  const fetchSummaryStats = React.useCallback(async () => {
    const { data } = await fetchCustomersSummary();
    if (data) setSummary(data);
  }, []);

  const fetchData = React.useCallback(async (p: number, rpp: number, search: string, status?: string, branch?: string) => {
    setIsLoading(true);
    const { customers: paginatedCustomers, totalCount: count, error } = await fetchCustomersPaginated(
      rpp,
      p * rpp,
      search,
      branch && branch !== 'All' ? branch : undefined,
      status && status !== 'All' ? status : undefined,
    );
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
    fetchData(page, rowsPerPage, debouncedSearch, statusFilter, branchFilter);
    fetchSummaryStats();
  }, [page, rowsPerPage, debouncedSearch, statusFilter, branchFilter, fetchData, fetchSummaryStats]);

  React.useEffect(() => {
    // Initialize secondary data (use cache when available)
    Promise.all([
      initializeBulkMeters(),
      initializeBranches(),
      initializeTariffs()
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

  // Load current user and auto-lock branch for non-head-office
  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentUser(user);
      const branchId = user?.branchId;
      // If user is branch-scoped (not head office), lock them to their branch
      const isGlobal = !branchId || hasPermission('customers_view_all');
      if (!isGlobal && branchId) {
        setBranchFilter(branchId);
      }
    }
  }, [hasPermission]);

  const userBranchId = currentUser?.branchId;
  const isHeadOffice = !userBranchId || hasPermission('customers_view_all');

  const handleAddCustomer = () => {
    setSelectedCustomer(isHeadOffice ? null : { branchId: userBranchId } as any);
    setIsFormOpen(true);
  };

  const handleEditCustomer = (customer: IndividualCustomer) => {
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  const handleViewCustomerDetails = (customer: IndividualCustomer) => {
    setSelectedCustomerForDetails(customer);
    setIsDetailsOpen(true);
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
        fetchData(page, rowsPerPage, debouncedSearch, statusFilter, branchFilter);
        fetchSummaryStats();
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: result.message || "Could not delete customer." });
      }
      setCustomerToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleApproveCustomer = async (customer: IndividualCustomer) => {
    if (!currentUser) return;
    try {
      const result = await approveCustomerInStore(customer.customerKeyNumber, currentUser.id);
      if (result.success) {
        toast({ title: "Customer Approved", description: `${customer.name} is now Active.` });
        fetchData(page, rowsPerPage, debouncedSearch, statusFilter, branchFilter);
        fetchSummaryStats();
        if (selectedCustomerForDetails?.customerKeyNumber === customer.customerKeyNumber) {
          setSelectedCustomerForDetails(prev => prev ? { ...prev, status: 'Active' } : null);
        }
      } else {
        toast({ variant: "destructive", title: "Approval Failed", description: result.message || "Could not approve customer." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    }
  };

  const handleRejectCustomer = async (customer: IndividualCustomer) => {
    if (!currentUser) return;
    try {
      const result = await rejectCustomerInStore(customer.customerKeyNumber, currentUser.id);
      if (result.success) {
        toast({ title: "Customer Rejected", description: `${customer.name} has been marked as Rejected.` });
        fetchData(page, rowsPerPage, debouncedSearch, statusFilter, branchFilter);
        fetchSummaryStats();
        if (selectedCustomerForDetails?.customerKeyNumber === customer.customerKeyNumber) {
          setSelectedCustomerForDetails(prev => prev ? { ...prev, status: 'Rejected' } : null);
        }
      } else {
        toast({ variant: "destructive", title: "Rejection Failed", description: result.message || "Could not reject customer." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    }
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
        fetchData(page, rowsPerPage, debouncedSearch, statusFilter, branchFilter);
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
        fetchData(page, rowsPerPage, debouncedSearch, statusFilter, branchFilter);
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

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Fetching all matching records..." });
    try {
      const { customers: allCustomers } = await fetchCustomersPaginated(
        10000, 0, debouncedSearch,
        branchFilter !== 'All' ? branchFilter : undefined,
        statusFilter !== 'All' ? statusFilter : undefined,
      );

      if (!allCustomers || allCustomers.length === 0) {
        toast({ title: "No Data", description: "No customers match the current filters.", variant: "destructive" });
        return;
      }

      const rows = allCustomers.map(c => ({
        'Customer Key': c.customerKeyNumber || '',
        'Name': c.name || '',
        'Status': c.status || '',
        'Branch': getBranchNameFromList(c.branchId, '') || '',
        'Route Key': c.routeKey || '',
        'Meter Number': c.meterNumber || '',
        'Contract No': c.contractNumber || '',
        'Phone': c.phoneNumber || '',
        'Woreda': c.woreda || '',
        'Location': c.specificArea || '',
        'Current Reading': c.currentReading ?? '',
        'Previous Reading': c.previousReading ?? '',
        'Calculated Bill': c.calculatedBill ?? '',
        'Payment Status': c.paymentStatus || '',
      }));

      if (format === 'csv') {
        const headers = Object.keys(rows[0]).join(',');
        const lines = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        const csvContent = [headers, ...lines].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `individual_customers_${statusFilter}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        XLSX.writeFile(wb, `individual_customers_${statusFilter}_${new Date().toISOString().slice(0,10)}.xlsx`);
      }

      toast({ title: "Export Complete", description: `${allCustomers.length} records exported to ${format.toUpperCase()}.` });
    } catch (err) {
      console.error('Export error:', err);
      toast({ title: "Export Failed", description: "Could not generate file.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
        <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <UserCog className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Customer Database</CardTitle>
                <CardDescription>Manage your individual consumer registry.</CardDescription>
              </div>
            </div>
            {/* Search + Branch Filter + Export row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="relative flex-grow md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search by key, name..."
                  className="pl-9 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Branch Selector */}
              {isHeadOffice ? (
                <div className="w-full sm:w-48 flex-shrink-0">
                  <Select
                    value={branchFilter}
                    onValueChange={(val) => {
                      setBranchFilter(val);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="h-10 px-3 border-slate-200 shadow-sm rounded-xl font-medium bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-1.5 truncate text-sm">
                        <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <SelectValue placeholder="All Branches" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="All" className="font-semibold text-slate-800">
                        🏢 All Branches
                      </SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                /* Branch-scoped users: locked to their branch */
                <div className="w-full sm:w-48 flex-shrink-0">
                  <div className="h-10 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                    <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {branches.find(b => b.id === branchFilter)?.name || 'Your Branch'}
                    </span>
                    <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Locked</span>
                  </div>
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 px-4 flex-shrink-0 gap-2 border-slate-200 shadow-sm rounded-xl font-medium hover:bg-slate-50"
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    {isExporting ? 'Exporting...' : 'Export'}
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer">
                    <Download className="h-4 w-4" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('xlsx')} className="gap-2 cursor-pointer">
                    <Download className="h-4 w-4" /> Export Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Status filter pills & active tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filter:</span>
            {(['All', ...individualCustomerStatuses] as const).map((status) => {
              const active = statusFilter === status;
              const colors: Record<string, string> = {
                All: 'bg-slate-800 text-white border-slate-800',
                Active: 'bg-emerald-500 text-white border-emerald-500',
                Inactive: 'bg-slate-400 text-white border-slate-400',
                Suspended: 'bg-orange-500 text-white border-orange-500',
                'Pending Approval': 'bg-blue-500 text-white border-blue-500',
                Rejected: 'bg-red-500 text-white border-red-500',
              };
              const inactiveColors: Record<string, string> = {
                All: 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                Active: 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-400',
                Inactive: 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
                Suspended: 'bg-white text-orange-600 border-orange-200 hover:border-orange-400',
                'Pending Approval': 'bg-white text-blue-600 border-blue-200 hover:border-blue-400',
                Rejected: 'bg-white text-red-600 border-red-200 hover:border-red-400',
              };
              return (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(0); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 shadow-sm ${
                    active ? colors[status] : inactiveColors[status]
                  }`}
                >
                  {status}
                  {active && status !== 'All' && (
                    <X className="h-3 w-3 opacity-80" onClick={(e) => { e.stopPropagation(); setStatusFilter('All'); setPage(0); }} />
                  )}
                </button>
              );
            })}

            {/* Active Branch Chip */}
            {branchFilter !== 'All' && (
              <Badge
                variant="secondary"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer shadow-sm"
                onClick={() => { setBranchFilter('All'); setPage(0); }}
                title="Click to clear branch filter"
              >
                <Building2 className="h-3 w-3 text-blue-600" />
                Branch: {branches.find(b => b.id === branchFilter)?.name || branchFilter}
                <X className="h-3 w-3 ml-0.5 opacity-70 hover:opacity-100" />
              </Badge>
            )}

            {statusFilter !== 'All' ? (
              <span className="ml-1 text-xs text-slate-400 italic">
                Showing {totalCount} {statusFilter} customer{totalCount !== 1 ? 's' : ''}
              </span>
            ) : branchFilter !== 'All' ? (
              <span className="ml-1 text-xs text-slate-400 italic">
                Showing {totalCount} result{totalCount !== 1 ? 's' : ''}
              </span>
            ) : null}
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
                onViewDetails={handleViewCustomerDetails}
                onApprove={handleApproveCustomer}
                onReject={handleRejectCustomer}
                bulkMetersList={bulkMetersList}
                branches={branches}
                canEdit={hasPermission('customers_update')}
                canDelete={hasPermission('customers_delete')}
                canApprove={hasPermission('customers_approve')}
                isAdmin={true}
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

      {/* Slide-over Customer Details Sheet */}
      <IndividualCustomerDetailsSheet
        customer={selectedCustomerForDetails}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onEdit={handleEditCustomer}
        onApprove={handleApproveCustomer}
        onReject={handleRejectCustomer}
        branches={branches}
        bulkMetersList={bulkMetersList}
        isAdmin={true}
        canEdit={hasPermission('customers_update')}
        canApprove={hasPermission('customers_approve')}
      />

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
