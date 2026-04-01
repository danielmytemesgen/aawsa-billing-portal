
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { BillTable } from "../bill-table";
import {
  getCustomers, initializeCustomers, subscribeToCustomers,
  getBulkMeters, initializeBulkMeters, subscribeToBulkMeters,
  getBranches, initializeBranches, subscribeToBranches
} from "@/lib/data-store";
import { getUnsettledBillsAction } from "@/lib/actions";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { FileClock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function UnsettledBillsReportPage() {
  const { hasPermission } = usePermissions();

  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);

  const [bills, setBills] = React.useState<DomainBill[]>([]);
  const [totalBills, setTotalBills] = React.useState(0);
  const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("all");

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Debounce search term
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load initial static data (Customers might need to be paginated later too if needed for lookup)
  React.useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const parsedUser = JSON.parse(user);
      setCurrentUser(parsedUser);
      if (parsedUser.branchId) {
        setSelectedBranchId(parsedUser.branchId);
      }
    }

    const fetchStaticData = async () => {
      await Promise.all([
        initializeCustomers(true),
        initializeBulkMeters(true),
        initializeBranches(true),
      ]);
      setCustomers(getCustomers());
      setBulkMeters(getBulkMeters());
      setBranches(getBranches());
    };
    fetchStaticData();

    const unsubCustomers = subscribeToCustomers(setCustomers);
    const unsubBms = subscribeToBulkMeters(setBulkMeters);
    const unsubBranches = subscribeToBranches(setBranches);

    return () => {
      unsubCustomers();
      unsubBms();
      unsubBranches();
    };
  }, []);

  // Fetch paginated bills from server
  React.useEffect(() => {
    const fetchBills = async () => {
      setIsLoading(true);
      const branchIdToFilter = (currentUser && currentUser.branchId && !hasPermission('reports_generate_all'))
        ? currentUser.branchId
        : selectedBranchId;

      const result = await getUnsettledBillsAction({
        page,
        limit: rowsPerPage,
        searchTerm: debouncedSearch,
        branchId: branchIdToFilter
      });

      if (result.success) {
        setBills(result.bills || []);
        setTotalBills(result.total || 0);
      }
      setIsLoading(false);
    };

    fetchBills();
  }, [page, rowsPerPage, debouncedSearch, selectedBranchId, currentUser, hasPermission]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unsettled Bills Report</h1>
          <p className="text-muted-foreground mt-1 text-base">Track all bills that have been issued but are still awaiting payment.</p>
        </div>
      </div>

      <Card className="shadow-md border-slate-200/60 overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-50/50 border-b pb-6 pt-6 px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                <FileClock className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Pending Settlements</CardTitle>
                <CardDescription>Real-time list of unpaid billing records</CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-grow sm:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Key or Name..."
                  className="pl-10 h-11 bg-white rounded-xl border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {hasPermission('reports_generate_all') && (
                <Select value={selectedBranchId || undefined} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-full sm:w-[220px] h-11 bg-white rounded-xl border-slate-200 shadow-sm">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      branch?.id !== undefined && branch?.id !== null ? (
                        <SelectItem key={String(branch.id)} value={String(branch.id)}>
                          {branch.name}
                        </SelectItem>
                      ) : null
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[800px]">
            {isLoading ? (
              <TableSkeleton columns={7} rows={10} />
            ) : bills.length === 0 ? (
              <EmptyState 
                icon={FileClock} 
                title="No Unsettled Bills Found" 
                description="There are currently no unsettled bills matching your filters or search criteria." 
              />
            ) : (
              <BillTable bills={bills} customers={customers} bulkMeters={bulkMeters} branches={branches} />
            )}
          </div>
        </CardContent>
        {!isLoading && totalBills > 0 && (
          <TablePagination
            count={totalBills}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(value) => {
              setRowsPerPage(value);
              setPage(0);
            }}
          />
        )}
      </Card>
    </div>
  );
}
