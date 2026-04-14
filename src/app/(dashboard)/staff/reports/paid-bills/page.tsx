
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { BillTable } from "../bill-table";
import {
  getCustomers, initializeCustomers, subscribeToCustomers,
  getBulkMeters, initializeBulkMeters, subscribeToBulkMeters
} from "@/lib/data-store";
import { getPaidBillsAction } from "@/lib/actions";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  branchId?: string;
  branchName?: string;
}

export default function StaffPaidBillsReportPage() {
  const { hasPermission } = usePermissions();

  const [bills, setBills] = React.useState<DomainBill[]>([]);
  const [totalBills, setTotalBills] = React.useState(0);
  const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);

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

  // Load initial static data
  React.useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) setCurrentUser(JSON.parse(user));

    const fetchStaticData = async () => {
      setIsLoading(true);
      await Promise.all([
        initializeCustomers(true),
        initializeBulkMeters(true),
      ]);
      setCustomers(getCustomers());
      setBulkMeters(getBulkMeters());
      setIsLoading(false);
    };
    fetchStaticData();

    const unsubCustomers = subscribeToCustomers(setCustomers);
    const unsubBms = subscribeToBulkMeters(setBulkMeters);

    return () => {
      unsubCustomers();
      unsubBms();
    };
  }, []);

  // Fetch paginated paid bills from server
  React.useEffect(() => {
    if (!currentUser) return;

    const fetchBills = async () => {
      setIsLoading(true);
      const result = await getPaidBillsAction({
        page,
        limit: rowsPerPage,
        searchTerm: debouncedSearch,
        branchId: currentUser.branchId // Staff always filtered by their branch
      });

      if (result.success) {
        setBills(result.bills || []);
        setTotalBills(result.total || 0);
      }
      setIsLoading(false);
    };

    fetchBills();
  }, [page, rowsPerPage, debouncedSearch, currentUser]);

  if (!hasPermission('reports_generate_all') && !hasPermission('reports_generate_branch')) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <CardDescription>You do not have permission to view reports.</CardDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>List of Paid Bills ({currentUser?.branchName || 'Your Branch'})</CardTitle>
                <CardDescription>A real-time list of all bills marked as paid for your branch.</CardDescription>
              </div>
            </div>
            <div className="relative w-full md:w-auto md:min-w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by Customer Key..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading paid bills...</div>
          ) : (
            <BillTable bills={bills} customers={customers} bulkMeters={bulkMeters} />
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
