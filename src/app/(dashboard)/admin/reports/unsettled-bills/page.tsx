
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
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

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
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileClock className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>List of Unsettled Bills</CardTitle>
                <CardDescription>A real-time list of all bills that have been sent but not yet paid.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Key or Name..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {hasPermission('reports_generate_all') && (
                <Select value={selectedBranchId || undefined} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
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
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading unsettled bills...</div>
          ) : (
            <BillTable bills={bills} customers={customers} bulkMeters={bulkMeters} branches={branches} />
          )}
        </CardContent>
        {totalBills > 0 && (
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
