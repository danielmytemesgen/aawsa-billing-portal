"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  FileEdit, Search, Download, RefreshCw, TrendingUp, TrendingDown, AlertCircle,
  FileSpreadsheet, Loader2, ArrowUpDown, CheckCircle2, Clock, FileDiff
} from "lucide-react";
import { getBranches, initializeBranches, subscribeToBranches } from "@/lib/data-store";
import { getCorrectedBillsAction, getCorrectedBillsKPIsAction } from "@/lib/actions";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/constants/auth";
import { getAvailableMonthYearOptions } from "@/lib/export-utils";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import type { BillCorrection } from "@/types/db";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format as formatDate } from "date-fns";

interface CorrectionKPIs {
  total_corrections: number;
  pending_drafts: number;
  posted_corrections: number;
  net_financial_adjustment: number;
  net_volume_adjustment: number;
  total_original_amount: number;
  total_new_amount: number;
}

function formatETB(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(amount);
}

function formatM3(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(2)} m³`;
}

function DeltaBadge({ value, unit = "ETB" }: { value: number | null; unit?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const isPos = value > 0;
  const isNeg = value < 0;
  const label = `${isPos ? "+" : ""}${unit === "ETB" ? formatETB(value) : formatM3(value)}`;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        isPos ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "",
        isNeg ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "",
        !isPos && !isNeg ? "bg-gray-100 text-gray-500" : "",
      ].join(" ")}
    >
      {isPos ? <TrendingUp className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : null}
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    Draft_Replacement: { label: "Draft Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
    Posted:           { label: "Posted",         className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    Reconciled:       { label: "Reconciled",     className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    Cancelled:        { label: "Cancelled",      className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.className}`}>{s.label}</span>;
}

function KPICard({ title, value, sub, icon: Icon, variant }: {
  title: string; value: string; sub?: string; icon: React.ElementType; variant?: "positive" | "negative" | "neutral" | "warning";
}) {
  const colors: Record<string, string> = {
    positive: "from-green-500/10 to-emerald-500/5 border-green-200 dark:border-green-800",
    negative: "from-red-500/10 to-rose-500/5 border-red-200 dark:border-red-800",
    warning:  "from-amber-500/10 to-yellow-500/5 border-amber-200 dark:border-amber-800",
    neutral:  "from-blue-500/10 to-indigo-500/5 border-blue-200 dark:border-blue-800",
  };
  const iconColors: Record<string, string> = {
    positive: "text-green-600", negative: "text-red-600", warning: "text-amber-600", neutral: "text-blue-600",
  };
  const v = variant ?? "neutral";
  return (
    <Card className={`bg-gradient-to-br ${colors[v]} border transition-all hover:shadow-md`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{title}</p>
            <p className="text-2xl font-bold mt-1 leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-background/60 ${iconColors[v]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CorrectedBillsReportPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [corrections, setCorrections] = React.useState<BillCorrection[]>([]);
  const [total, setTotal] = React.useState(0);
  const [kpis, setKpis] = React.useState<CorrectionKPIs | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("all");
  const [selectedMonthYear, setSelectedMonthYear] = React.useState("all");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const monthOptions = React.useMemo(() => getAvailableMonthYearOptions(), []);

  const canView = hasPermission(PERMISSIONS.REPORT_LIST_OF_CORRECTED_BILLS)
    || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_CORRECTED_BILLS)
    || hasPermission(PERMISSIONS.BILL_CORRECT_VIEW)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL)
    || hasPermission(PERMISSIONS.BILL_VIEW_BRANCH)
    || hasPermission("*");

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Load branches
  React.useEffect(() => {
    initializeBranches();
    setBranches(getBranches());
    const unsub = subscribeToBranches(setBranches);
    return unsub;
  }, []);

  // Load corrections + KPIs
  React.useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [corrRes, kpiRes] = await Promise.all([
          getCorrectedBillsAction({
            page, limit: rowsPerPage,
            searchTerm: debouncedSearch,
            branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
            monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
            status: selectedStatus === "all" ? undefined : selectedStatus,
          }),
          getCorrectedBillsKPIsAction({
            branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
            monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
          }),
        ]);
        if (!cancelled) {
          setCorrections((corrRes?.corrections as any) || []);
          setTotal(corrRes?.total || 0);
          setKpis((kpiRes?.kpis as any) || null);
        }
      } catch (e: any) {
        if (!cancelled) toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [canView, page, rowsPerPage, debouncedSearch, selectedBranchId, selectedMonthYear, selectedStatus, refreshTrigger]);

  const handleExport = async (type: "csv" | "xlsx") => {
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Fetching corrected bill records…" });
    try {
      const result = await getCorrectedBillsAction({
        page: 0, limit: 10000,
        searchTerm: debouncedSearch,
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        status: selectedStatus === "all" ? undefined : selectedStatus,
      });
      const rows = (result?.corrections as any[]) || [];
      if (!rows.length) {
        toast({ title: "No Records", description: "No corrected bills match your filters.", variant: "destructive" });
        return;
      }
      const data = rows.map((c: BillCorrection) => ({
        "Original Bill #": c.original_bill_number,
        "Replacement Bill #": c.replacement_bill_number ?? "—",
        "Bill Key": c.bill_key ?? "—",
        "Month/Year": c.month_year,
        "Customer Key": c.customer_key,
        "Customer Name": c.customer_name ?? "—",
        "Customer Type": c.customer_type,
        "Branch": c.branch_name ?? "—",
        "Original Prev Read": c.original_prev_read ?? "",
        "Original Curr Read": c.original_curr_read ?? "",
        "Original Consumption (m³)": c.original_consumption ?? "",
        "Original Bill Amount (ETB)": c.original_bill_amount,
        "New Prev Read": c.new_prev_read ?? "",
        "New Curr Read": c.new_curr_read ?? "",
        "New Consumption (m³)": c.new_consumption ?? "",
        "New Bill Amount (ETB)": c.new_bill_amount ?? "",
        "Consumption Δ (m³)": c.consumption_difference ?? "",
        "Amount Δ (ETB)": c.amount_difference ?? "",
        "Reason": c.reason,
        "Corrected By": c.corrected_by_name ?? "—",
        "Corrected At": c.corrected_at ? formatDate(new Date(c.corrected_at), "yyyy-MM-dd HH:mm") : "",
        "Status": c.status,
      }));
      const filename = `corrected_bills_${new Date().toISOString().slice(0, 10)}`;
      const headers = Object.keys(data[0] || {});
      if (type === "csv") {
        downloadFile(arrayToCsvBlob(data, headers), `${filename}.csv`);
      } else {
        downloadFile(arrayToXlsxBlob(data, headers), `${filename}.xlsx`);
      }
      toast({ title: "Export Complete", description: `${rows.length} records exported.` });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <p className="text-sm mt-1">You do not have permission to view corrected bills reports.</p>
        </Alert>
      </div>
    );
  }

  const netFinancial = Number(kpis?.net_financial_adjustment ?? 0);
  const netVolume = Number(kpis?.net_volume_adjustment ?? 0);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileDiff className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Corrected Bills Report</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Full audit trail of all bill corrections — before &amp; after state, financial impact, and staff accountability.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshTrigger(p => p + 1)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={isExporting || total === 0}>
                {isExporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading && !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Total Corrections"
            value={String(kpis.total_corrections)}
            sub={`${kpis.posted_corrections} posted · ${kpis.pending_drafts} pending`}
            icon={FileDiff}
            variant="neutral"
          />
          <KPICard
            title="Net Financial Impact"
            value={formatETB(netFinancial)}
            sub={netFinancial >= 0 ? "Additional billing ↑" : "Reduction to customers ↓"}
            icon={netFinancial >= 0 ? TrendingUp : TrendingDown}
            variant={netFinancial > 0 ? "negative" : netFinancial < 0 ? "positive" : "neutral"}
          />
          <KPICard
            title="Pending Draft Revisions"
            value={String(kpis.pending_drafts)}
            sub="Awaiting rebilling & posting"
            icon={Clock}
            variant={kpis.pending_drafts > 0 ? "warning" : "neutral"}
          />
          <KPICard
            title="Net Volume Adjustment"
            value={formatM3(netVolume)}
            sub={netVolume >= 0 ? "Net increase in m³" : "Net reduction in m³"}
            icon={ArrowUpDown}
            variant="neutral"
          />
        </div>
      ) : null}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="corrected-bills-search"
                placeholder="Search bill #, customer, reason…"
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedBranchId} onValueChange={v => { setSelectedBranchId(v); setPage(0); }}>
              <SelectTrigger id="corrected-bills-branch-filter" className="w-[160px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedMonthYear} onValueChange={v => { setSelectedMonthYear(v); setPage(0); }}>
              <SelectTrigger id="corrected-bills-month-filter" className="w-[150px]">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={v => { setSelectedStatus(v); setPage(0); }}>
              <SelectTrigger id="corrected-bills-status-filter" className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft_Replacement">Draft Pending</SelectItem>
                <SelectItem value="Posted">Posted</SelectItem>
                <SelectItem value="Reconciled">Reconciled</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileDiff className="w-4 h-4 text-primary" />
            Corrected Bills
            {!isLoading && <Badge variant="secondary" className="ml-1">{total.toLocaleString()}</Badge>}
          </CardTitle>
          <CardDescription>
            Each row shows the before-and-after state of a corrected bill with calculated financial deltas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : corrections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <FileDiff className="w-12 h-12 opacity-20" />
              <p className="font-medium">No corrected bills found</p>
              <p className="text-sm">Corrections appear here automatically when a posted bill is corrected.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="whitespace-nowrap">Original Bill</TableHead>
                    <TableHead className="whitespace-nowrap">Replacement Bill</TableHead>
                    <TableHead className="whitespace-nowrap">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Branch</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Orig. Amount</TableHead>
                    <TableHead className="whitespace-nowrap text-right">New Amount</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Amt Δ</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Vol Δ</TableHead>
                    <TableHead className="whitespace-nowrap">Reason</TableHead>
                    <TableHead className="whitespace-nowrap">Officer</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c: BillCorrection) => (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors text-sm">
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-primary">{c.original_bill_number}</div>
                        <div className="text-xs text-muted-foreground">{c.month_year}</div>
                      </TableCell>
                      <TableCell>
                        {c.replacement_bill_number
                          ? <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{c.replacement_bill_number}</div>
                          : <span className="text-xs text-muted-foreground italic">Not created</span>}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium max-w-[140px] truncate">{c.customer_name ?? c.customer_key}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.customer_key}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.branch_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatETB(c.original_bill_amount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.new_bill_amount != null ? formatETB(c.new_bill_amount) : <span className="italic text-muted-foreground">Pending</span>}</TableCell>
                      <TableCell className="text-center"><DeltaBadge value={c.amount_difference} unit="ETB" /></TableCell>
                      <TableCell className="text-center"><DeltaBadge value={c.consumption_difference} unit="m3" /></TableCell>
                      <TableCell>
                        <p className="max-w-[150px] truncate text-xs" title={c.reason}>{c.reason}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{c.corrected_by_name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {c.corrected_at ? formatDate(new Date(c.corrected_at), "dd/MM/yy HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-center"><StatusBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!isLoading && total > rowsPerPage && (
          <div className="border-t p-3">
            <TablePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(newPage: number) => setPage(newPage)}
              onRowsPerPageChange={(newRowsPerPage: number) => { setRowsPerPage(newRowsPerPage); setPage(0); }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
