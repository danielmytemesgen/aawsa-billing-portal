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
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { getAllSentBillsAction } from "@/lib/actions";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { Send, Search, Lock, Download, Loader2, Calendar, ChevronDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportSentBillsToCsv, exportSentBillsToXlsx, getAvailableMonthYearOptions } from "@/lib/export-utils";
import { usePermissions } from "@/hooks/use-permissions";
import { getEffectiveBranchId } from "@/lib/branch-permissions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ReportPrintSummaryDialog } from "@/components/reports/ReportPrintSummaryDialog";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  branchId?: string;
  branchName?: string;
}

export default function StaffSentBillsReportClient() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [bills, setBills] = React.useState<DomainBill[]>([]);
  const [totalBills, setTotalBills] = React.useState(0);
  const [customers, setCustomers] = React.useState<IndividualCustomer[]>([]);
  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedMonthYear, setSelectedMonthYear] = React.useState("all");
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrintSummaryOpen, setIsPrintSummaryOpen] = React.useState(false);
  const [printBills, setPrintBills] = React.useState<DomainBill[]>([]);
  const [isFetchingPrintData, setIsFetchingPrintData] = React.useState(false);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const monthOptions = React.useMemo(() => getAvailableMonthYearOptions(), []);

  const handleExport = async (type: 'csv' | 'xlsx') => {
    if (!currentUser) return;
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Fetching matching bill records..." });
    try {
      const normalizedBranchId = getEffectiveBranchId(hasPermission, 'reports', currentUser.branchId);
      const normalizedMonthYear = selectedMonthYear === 'all' ? undefined : selectedMonthYear;

      const result = await getAllSentBillsAction({
        page: 0,
        limit: 10000,
        searchTerm: debouncedSearch,
        branchId: normalizedBranchId,
        monthYear: normalizedMonthYear
      });

      const exportBills = (result.success && result.bills && result.bills.length > 0) ? result.bills : bills;

      if (exportBills.length === 0) {
        toast({ title: "No Records", description: "No sent bills available matching your filters.", variant: "destructive" });
        setIsExporting(false);
        return;
      }

      if (type === 'csv') {
        exportSentBillsToCsv(exportBills, customers, bulkMeters, branches, "staff_sent_bills_report");
      } else {
        exportSentBillsToXlsx(exportBills, customers, bulkMeters, branches, "staff_sent_bills_report");
      }

      toast({
        title: "Export Complete",
        description: `Successfully exported ${exportBills.length} sent bill record(s) to ${type.toUpperCase()}.`
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Export Failed", description: "An error occurred during file generation.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPrintSummary = async () => {
    if (!currentUser) return;
    setIsFetchingPrintData(true);
    toast({ title: "Preparing Print Summary", description: "Loading all matching records across all pages..." });
    try {
      const normalizedBranchId = getEffectiveBranchId(hasPermission, 'reports', currentUser.branchId);
      const normalizedMonthYear = selectedMonthYear === 'all' ? undefined : selectedMonthYear;

      const result = await getAllSentBillsAction({
        page: 0,
        limit: 10000,
        searchTerm: debouncedSearch,
        branchId: normalizedBranchId,
        monthYear: normalizedMonthYear
      });

      const allBills = (result.success && result.bills && result.bills.length > 0) ? result.bills : bills;
      setPrintBills(allBills);
      setIsPrintSummaryOpen(true);
    } catch (err) {
      console.error("Print summary error:", err);
      setPrintBills(bills);
      setIsPrintSummaryOpen(true);
    } finally {
      setIsFetchingPrintData(false);
    }
  };

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
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.email) {
          setCurrentUser(parsed as UserProfile);
        } else {
          console.warn('StaffSentBillsReportClient: cached user is malformed', parsed);
        }
      } catch (err) {
        console.warn('StaffSentBillsReportClient: failed to parse cached user', err);
      }
    }

    const fetchStaticData = async () => {
      setIsLoading(true);
      await Promise.all([
        initializeCustomers(),
        initializeBulkMeters(),
        initializeBranches(),
      ]);
      setCustomers(getCustomers());
      setBulkMeters(getBulkMeters());
      setBranches(getBranches());
      setIsLoading(false);
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

  // Fetch paginated sent bills from server
  React.useEffect(() => {
    if (!currentUser) return;

    const fetchBills = async () => {
      setIsLoading(true);
      const normalizedBranchId = getEffectiveBranchId(hasPermission, 'reports', currentUser.branchId);
      const normalizedMonthYear = selectedMonthYear === 'all' ? undefined : selectedMonthYear;

      const result = await getAllSentBillsAction({
        page,
        limit: rowsPerPage,
        searchTerm: debouncedSearch,
        branchId: normalizedBranchId,
        monthYear: normalizedMonthYear
      });

      if (result.success) {
        setBills(result.bills || []);
        setTotalBills(result.total || 0);
      }
      setIsLoading(false);
    };

    fetchBills();
  }, [page, rowsPerPage, debouncedSearch, selectedMonthYear, currentUser]);

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
              <Send className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>List of All Sent Bills ({currentUser?.branchName || 'Your Branch'})</CardTitle>
                <CardDescription>A list of all generated bills for your branch.</CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-auto md:min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Customer Key..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={selectedMonthYear} onValueChange={(val) => { setSelectedMonthYear(val); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[170px] h-10 bg-white rounded-lg border-slate-200">
                  <Calendar className="h-4 w-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent className="rounded-lg max-h-[300px]">
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isExporting || isFetchingPrintData || isLoading}
                    className="gap-2 font-semibold"
                  >
                    {isExporting || isFetchingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-blue-600" />}
                    <span>Export</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                  <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer gap-2 py-2.5 font-medium">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span>Export CSV (.csv)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('xlsx')} className="cursor-pointer gap-2 py-2.5 font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <span>Export Excel (.xlsx)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenPrintSummary} className="cursor-pointer gap-2 py-2.5 font-medium border-t">
                    <Printer className="h-4 w-4 text-blue-600" />
                    <span>Print Summary</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading all bills...</div>
          ) : (
            <BillTable bills={bills} customers={customers} bulkMeters={bulkMeters} branches={branches} showDebitColumns={true} />
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

      <ReportPrintSummaryDialog
        open={isPrintSummaryOpen}
        onOpenChange={setIsPrintSummaryOpen}
        type="sent"
        bills={printBills.length > 0 ? printBills : bills}
        customers={customers}
        bulkMeters={bulkMeters}
        branches={branches}
        branchFilterName={currentUser?.branchName || "Your Branch"}
        monthYearFilter={monthOptions.find(m => m.value === selectedMonthYear)?.label || "All Months"}
        searchTerm={debouncedSearch}
      />
    </div>
  );
}
