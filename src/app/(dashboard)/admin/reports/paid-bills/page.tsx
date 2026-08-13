"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { PaidBillsTable } from "@/components/billing/PaidBillsTable";
import { PaymentCsvUploadDialog } from "@/components/billing/PaymentCsvUploadDialog";
import { Button } from "@/components/ui/button";
import {
  getCustomers, initializeCustomers, subscribeToCustomers,
  getBulkMeters, initializeBulkMeters, subscribeToBulkMeters,
  getBranches, initializeBranches, subscribeToBranches
} from "@/lib/data-store";
import { getPaidBillsAction } from "@/lib/actions";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { CheckCircle2, Search, Lock, FileSpreadsheet, Download, Loader2, Calendar, ChevronDown, FileText, Printer } from "lucide-react";
import { exportPaidBillsToCsv, exportPaidBillsToXlsx, getAvailableMonthYearOptions } from "@/lib/export-utils";
import { Input } from "@/components/ui/input";
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useToast } from "@/hooks/use-toast";
import { ReportPrintSummaryDialog } from "@/components/reports/ReportPrintSummaryDialog";

export default function PaidBillsReportPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

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
  const [selectedMonthYear, setSelectedMonthYear] = React.useState("all");
  const [openTrigger, setOpenTrigger] = React.useState(0);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPrintSummaryOpen, setIsPrintSummaryOpen] = React.useState(false);
  const [printBills, setPrintBills] = React.useState<DomainBill[]>([]);
  const [isFetchingPrintData, setIsFetchingPrintData] = React.useState(false);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const monthOptions = React.useMemo(() => getAvailableMonthYearOptions(), []);

  const handleExport = async (type: 'csv' | 'xlsx') => {
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Fetching matching paid bill records..." });
    try {
      const roleLower = (currentUser?.role || '').toLowerCase();
      const isBranchMgr = roleLower.includes('management') || roleLower.includes('manager');
      const branchIdToFilter = isBranchMgr ? currentUser?.branchId : selectedBranchId;
      const normalizedBranchId = branchIdToFilter === 'all' ? undefined : branchIdToFilter;
      const normalizedMonthYear = selectedMonthYear === 'all' ? undefined : selectedMonthYear;

      const result = await getPaidBillsAction({
        page: 0,
        limit: 10000,
        searchTerm: debouncedSearch,
        branchId: normalizedBranchId,
        monthYear: normalizedMonthYear
      });

      const exportBills = (result.success && result.bills && result.bills.length > 0) ? result.bills : bills;

      if (exportBills.length === 0) {
        toast({ title: "No Records", description: "No paid bills available matching your filters.", variant: "destructive" });
        setIsExporting(false);
        return;
      }

      if (type === 'csv') {
        exportPaidBillsToCsv(exportBills, customers, bulkMeters, branches, "paid_bills_report");
      } else {
        exportPaidBillsToXlsx(exportBills, customers, bulkMeters, branches, "paid_bills_report");
      }

      toast({
        title: "Export Complete",
        description: `Successfully exported ${exportBills.length} paid bill record(s) to ${type.toUpperCase()}.`
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Export Failed", description: "An error occurred during file generation.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPrintSummary = async () => {
    setIsFetchingPrintData(true);
    toast({ title: "Preparing Print Summary", description: "Loading all matching paid bill records across all pages..." });
    try {
      const roleLower = (currentUser?.role || '').toLowerCase();
      const isBranchMgr = roleLower.includes('management') || roleLower.includes('manager');
      const branchIdToFilter = isBranchMgr ? currentUser?.branchId : selectedBranchId;
      const normalizedBranchId = branchIdToFilter === 'all' ? undefined : branchIdToFilter;
      const normalizedMonthYear = selectedMonthYear === 'all' ? undefined : selectedMonthYear;

      const result = await getPaidBillsAction({
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
    const user = localStorage.getItem("user");
    if (user) {
      const parsedUser = JSON.parse(user);
      setCurrentUser(parsedUser);
      if ((parsedUser.role?.toLowerCase().includes('management') || parsedUser.role?.toLowerCase().includes('manager')) && parsedUser.branchId) {
        setSelectedBranchId(parsedUser.branchId);
      }
    }

    const fetchStaticData = async () => {
      await Promise.all([
        initializeCustomers(),
        initializeBulkMeters(),
        initializeBranches(),
      ]);
      setCustomers(getCustomers());
      setBulkMeters(getBulkMeters());
      setBranches(getBranches());
    };
    fetchStaticData();

    const unsubCustomers = subscribeToCustomers(setCustomers);
    const unsubBms = subscribeToBulkMeters(setBulkMeters);
    const unsubBranches = subscribeToBranches(setBranches);

    const handleUploadSuccess = () => {
      setPage(0);
      setRefreshTrigger((prev) => prev + 1);
    };

    window.addEventListener("payment-csv-upload-success", handleUploadSuccess);

    return () => {
      unsubCustomers();
      unsubBms();
      unsubBranches();
      window.removeEventListener("payment-csv-upload-success", handleUploadSuccess);
    };
  }, []);

  // Fetch paginated paid bills from server
  React.useEffect(() => {
    const fetchBills = async () => {
      setIsLoading(true);
      const roleLower = (currentUser?.role || '').toLowerCase();
      const isBranchMgr = roleLower.includes('management') || roleLower.includes('manager');
      const branchIdToFilter = isBranchMgr ? currentUser?.branchId : selectedBranchId;
      const normalizedBranchId = branchIdToFilter === 'all' ? undefined : branchIdToFilter;
      const normalizedMonthYear = selectedMonthYear === 'all' ? undefined : selectedMonthYear;

      const result = await getPaidBillsAction({
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
  }, [page, rowsPerPage, debouncedSearch, selectedBranchId, selectedMonthYear, currentUser, refreshTrigger]);

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
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paid Bills Report</h1>
          <p className="text-muted-foreground mt-1 text-base">View and manage all bills that have been successfully processed and paid.</p>
        </div>
        <Button
          onClick={() => setOpenTrigger((prev) => prev + 1)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl gap-2 shadow-sm"
        >
          <FileSpreadsheet className="h-4 w-4" /> Upload Payment CSV
        </Button>
      </div>

      <Card className="shadow-md border-slate-200/60 overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-50/50 border-b pb-6 pt-6 px-6">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Paid Transactions</CardTitle>
                <CardDescription>Real-time list of paid billing records</CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-grow sm:w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Customer Key..."
                  className="pl-10 h-11 bg-white rounded-xl border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={selectedMonthYear} onValueChange={(val) => { setSelectedMonthYear(val); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] h-11 bg-white rounded-xl border-slate-200 shadow-sm">
                  <Calendar className="h-4 w-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[300px]">
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasPermission('reports_generate_all') && (
                <Select value={selectedBranchId || undefined} onValueChange={(val) => { setSelectedBranchId(val); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-[180px] h-11 bg-white rounded-xl border-slate-200 shadow-sm">
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isExporting || isFetchingPrintData || isLoading}
                    className="h-11 rounded-xl bg-white border-slate-200 shadow-sm gap-2 text-slate-700 hover:bg-slate-50 font-semibold px-4"
                  >
                    {isExporting || isFetchingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-emerald-600" />}
                    <span>Export Report</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
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
        <CardContent className="overflow-x-auto p-4">
          <div>
            {isLoading ? (
              <TableSkeleton columns={13} rows={10} />
            ) : bills.length === 0 ? (
              <EmptyState 
                icon={CheckCircle2} 
                title="No Paid Bills Found" 
                description="There are currently no paid bills matching your filters or search criteria." 
              />
            ) : (
              <PaidBillsTable bills={bills} customers={customers} bulkMeters={bulkMeters} branches={branches} />
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

      <PaymentCsvUploadDialog
        openTrigger={openTrigger}
      />

      <ReportPrintSummaryDialog
        open={isPrintSummaryOpen}
        onOpenChange={setIsPrintSummaryOpen}
        type="paid"
        bills={printBills.length > 0 ? printBills : bills}
        customers={customers}
        bulkMeters={bulkMeters}
        branches={branches}
        branchFilterName={branches.find(b => String(b.id) === selectedBranchId)?.name || "All Branches"}
        monthYearFilter={monthOptions.find(m => m.value === selectedMonthYear)?.label || "All Months"}
        searchTerm={debouncedSearch}
      />
    </div>
  );
}
