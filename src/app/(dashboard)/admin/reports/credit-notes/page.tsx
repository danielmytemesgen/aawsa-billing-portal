"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { getAllBranchesAction } from "@/lib/actions";
import {
  getCreditNotesKPIsAction,
  getCreditNotesReportAction,
  getCreditMetersSummaryAction,
  type CreditNoteTransaction,
  type CreditNoteMeterSummary,
  type CreditNoteKPIs,
} from "@/lib/credit-notes-report-actions";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { format as formatDate, formatDistanceToNow } from "date-fns";
import {
  Wallet,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Eye,
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  Layers,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const REASON_LABELS: Record<string, string> = {
  duplicate_transaction: "Duplicate payment",
  bill_correction: "Bill correction",
  billing_cycle: "Billing cycle",
  manual: "Manual deposit",
  bill_removed: "Bill removed",
};

const EVENT_STYLES: Record<string, { label: string; className: string }> = {
  created: {
    label: "Created (Deposit)",
    className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  },
  applied: {
    label: "Applied (Offset)",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  voided: {
    label: "Voided (Reversed)",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  },
};

function formatETB(amount: number | null | undefined): string {
  if (amount == null) return "ETB 0.00";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 ml-1 text-muted-foreground hover:text-foreground"
      onClick={copy}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export default function CreditNoteReportPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"transactions" | "meters">("meters");
  const [branches, setBranches] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedEventType, setSelectedEventType] = useState<"all" | "created" | "applied" | "voided">("all");
  const [selectedReason, setSelectedReason] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Meters tab filters
  const [meterSearch, setMeterSearch] = useState("");
  const [meterBranchId, setMeterBranchId] = useState("all");

  // Data state
  const [kpis, setKpis] = useState<CreditNoteKPIs | null>(null);
  const [transactions, setTransactions] = useState<CreditNoteTransaction[]>([]);
  const [txTotalCount, setTxTotalCount] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [txRowsPerPage, setTxRowsPerPage] = useState(15);

  const [meters, setMeters] = useState<CreditNoteMeterSummary[]>([]);
  const [metersTotalCount, setMetersTotalCount] = useState(0);
  const [metersPage, setMetersPage] = useState(0);
  const [metersRowsPerPage, setMetersRowsPerPage] = useState(15);

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Transaction detail modal
  const [selectedTx, setSelectedTx] = useState<CreditNoteTransaction | null>(null);

  // Load Branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await getAllBranchesAction();
        if (res?.data) {
          setBranches(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch branches:", err);
      }
    }
    loadBranches();
  }, []);

  // Fetch KPIs
  const fetchKPIs = useCallback(async () => {
    try {
      const res = await getCreditNotesKPIsAction({
        branchId: selectedBranchId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (res.success && res.data) {
        setKpis(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch credit note KPIs:", err);
    }
  }, [selectedBranchId, startDate, endDate]);

  // Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getCreditNotesReportAction({
        search: search || undefined,
        branchId: selectedBranchId,
        eventType: selectedEventType,
        reason: selectedReason,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: txPage + 1,
        pageSize: txRowsPerPage,
      });
      if (res.success && res.data) {
        setTransactions(res.data.transactions);
        setTxTotalCount(res.data.totalCount);
      } else if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.message || "Failed to load transactions" });
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedBranchId, selectedEventType, selectedReason, startDate, endDate, txPage, txRowsPerPage, toast]);

  // Fetch Meters Summary
  const fetchMeters = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getCreditMetersSummaryAction({
        search: meterSearch || undefined,
        branchId: meterBranchId,
        page: metersPage + 1,
        pageSize: metersRowsPerPage,
      });
      if (res.success && res.data) {
        setMeters(res.data.meters);
        setMetersTotalCount(res.data.totalCount);
      } else if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.message || "Failed to load meters summary" });
    } finally {
      setIsLoading(false);
    }
  }, [meterSearch, meterBranchId, metersPage, metersRowsPerPage, toast]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    } else {
      fetchMeters();
    }
  }, [activeTab, fetchTransactions, fetchMeters]);

  const handleRefresh = () => {
    fetchKPIs();
    if (activeTab === "transactions") {
      fetchTransactions();
    } else {
      fetchMeters();
    }
  };

  const handleExport = async (formatType: "xlsx" | "csv") => {
    setIsExporting(true);
    try {
      if (activeTab === "transactions") {
        const res = await getCreditNotesReportAction({
          search: search || undefined,
          branchId: selectedBranchId,
          eventType: selectedEventType,
          reason: selectedReason,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page: 1,
          pageSize: 2000,
        });

        if (!res.success || !res.data) throw new Error(res.error || "Failed to fetch export data");

        const rows = res.data.transactions.map((tx) => ({
          "Transaction Date": formatDate(new Date(tx.createdAt), "yyyy-MM-dd HH:mm"),
          "Bulk Meter Key": tx.bulkMeterKey,
          "Customer Name": tx.customerName,
          "Meter Number": tx.meterNumber,
          "Branch": tx.branchName,
          "Event": tx.eventType.toUpperCase(),
          "Amount (ETB)": tx.amount,
          "Reason": REASON_LABELS[tx.reason || ""] || tx.reason || "—",
          "Source Bill Key": tx.sourceBillKey || "—",
          "Balance After (ETB)": tx.balanceAfter,
          "Recorded By": tx.createdByName || "—",
          "Notes": tx.notes || "—",
        }));

        if (rows.length === 0) {
          toast({ variant: "destructive", title: "No data to export", description: "No records found for current filters." });
          return;
        }

        const headers = Object.keys(rows[0]);
        const fileName = `credit-notes-report-${formatDate(new Date(), "yyyy-MM-dd")}`;
        if (formatType === "xlsx") {
          const blob = arrayToXlsxBlob(rows, headers, "Credit Notes");
          downloadFile(blob, `${fileName}.xlsx`);
        } else {
          const blob = arrayToCsvBlob(rows, headers);
          downloadFile(blob, `${fileName}.csv`);
        }
      } else {
        const res = await getCreditMetersSummaryAction({
          search: meterSearch || undefined,
          branchId: meterBranchId,
          page: 1,
          pageSize: 2000,
        });

        if (!res.success || !res.data) throw new Error(res.error || "Failed to fetch export data");

        const rows = res.data.meters.map((m) => ({
          "Bulk Meter Key": m.bulkMeterKey,
          "Customer Name": m.customerName,
          "Meter Number (METER_KEY)": m.meterNumber,
          "Branch": m.branchName,
          "Contract Number": m.contractNumber || "—",
          "Outstanding Bill (ETB)": m.outstandingBill,
          "Payment Status": m.paymentStatus || "—",
          "Current Deposit Balance (ETB)": m.creditBalance,
        }));

        if (rows.length === 0) {
          toast({ variant: "destructive", title: "No data to export", description: "No records found for current filters." });
          return;
        }

        const headers = Object.keys(rows[0]);
        const fileName = `credit-meters-summary-${formatDate(new Date(), "yyyy-MM-dd")}`;
        if (formatType === "xlsx") {
          const blob = arrayToXlsxBlob(rows, headers, "Meters Credit Deposit");
          downloadFile(blob, `${fileName}.xlsx`);
        } else {
          const blob = arrayToCsvBlob(rows, headers);
          downloadFile(blob, `${fileName}.csv`);
        }
      }

      toast({ title: "Export complete", description: `Downloaded ${formatType.toUpperCase()} file successfully.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export failed", description: e?.message || "Error generating export file" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Credit Note Report
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  Financial Audit
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overpayments, deposit credit notes, automatic bill offset reductions, and reversal voids.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 non-printable flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="h-9">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isExporting}>
                <Download className="h-4 w-4 mr-1.5" />
                {isExporting ? "Exporting…" : "Export Report"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("xlsx")} className="cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Export Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2 text-blue-600" /> Export CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Active Deposit Balance */}
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-transparent dark:to-emerald-950/10 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <span>Total Active Deposit Balance</span>
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">
              {formatETB(kpis?.totalActiveBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Live balance held as credit deposit across all bulk meters
            </p>
          </CardContent>
        </Card>

        {/* Meters with Active Balance */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-slate-50/60 via-white to-transparent dark:from-slate-900/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <span>Meters with Active Deposit</span>
              <Building2 className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-3 tabular-nums">
              {kpis?.metersWithActiveBalanceCount?.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Bulk meters currently holding a deposit credit balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tab Sections ── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md bg-slate-100 dark:bg-slate-900 border p-1 rounded-xl">
          <TabsTrigger value="transactions" className="gap-2 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" />
            Credit Ledger Journal
          </TabsTrigger>
          <TabsTrigger value="meters" className="gap-2 text-xs font-semibold">
            <Building2 className="h-3.5 w-3.5" />
            Active Deposit Meters
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: CREDIT LEDGER JOURNAL                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-700/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Note:</strong> The Credit Ledger Journal records all credit events processed <em>through this system</em> (deposits added, applied to bills, or reversed).
              Existing credit balances that were loaded via bulk import appear in the <strong>Active Deposit Meters</strong> tab but have no individual ledger entries here.
            </span>
          </div>
          {/* Filters Bar */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Search</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Meter key, customer, bill key, notes…"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setTxPage(0); }}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Branch */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Branch</label>
                  <Select value={selectedBranchId} onValueChange={(val) => { setSelectedBranchId(val); setTxPage(0); }}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Type */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Event Type</label>
                  <Select value={selectedEventType} onValueChange={(val: any) => { setSelectedEventType(val); setTxPage(0); }}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="All Events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="created">Created (Deposit)</SelectItem>
                      <SelectItem value="applied">Applied (Offset)</SelectItem>
                      <SelectItem value="voided">Voided (Reversed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Reason</label>
                  <Select value={selectedReason} onValueChange={(val) => { setSelectedReason(val); setTxPage(0); }}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="All Reasons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reasons</SelectItem>
                      <SelectItem value="duplicate_transaction">Duplicate payment</SelectItem>
                      <SelectItem value="bill_correction">Bill correction</SelectItem>
                      <SelectItem value="billing_cycle">Billing cycle</SelectItem>
                      <SelectItem value="manual">Manual deposit</SelectItem>
                      <SelectItem value="bill_removed">Bill removed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="flex gap-1.5 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">From</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setTxPage(0); }}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">To</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setTxPage(0); }}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/60">
                  <TableRow>
                    <TableHead className="w-40">Date &amp; Time</TableHead>
                    <TableHead>Bulk Meter</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right">Amount (ETB)</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Source Bill</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead className="w-16 text-center">Inspect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={10} className="py-4 text-center text-xs text-muted-foreground">
                          Loading credit transactions…
                        </TableCell>
                      </TableRow>
                    ))
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
                          <div className="h-12 w-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No ledger entries for this period</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              Credit balances were initially loaded via bulk import directly into meter accounts.
                              Ledger journal entries are recorded from when credits are first <strong>added</strong>, <strong>applied</strong>, or <strong>reversed</strong> through the system.
                            </p>
                          </div>
                          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => setActiveTab("meters")}>
                            <Building2 className="h-3.5 w-3.5" />
                            View Active Deposit Meters
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => {
                      const isCreated = tx.eventType === "created";
                      const signedAmount = isCreated ? tx.amount : -tx.amount;
                      const style = EVENT_STYLES[tx.eventType] || EVENT_STYLES.created;

                      return (
                        <TableRow
                          key={tx.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 cursor-pointer transition-colors"
                          onClick={() => setSelectedTx(tx)}
                        >
                          {/* Date */}
                          <TableCell className="whitespace-nowrap text-xs">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {formatDate(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                            </div>
                          </TableCell>

                          {/* Meter */}
                          <TableCell>
                            <div className="font-semibold text-xs text-blue-600 dark:text-blue-400">
                              {tx.bulkMeterKey}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {tx.customerName}
                            </div>
                          </TableCell>

                          {/* Branch */}
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-[11px]">
                              {tx.branchName}
                            </Badge>
                          </TableCell>

                          {/* Event */}
                          <TableCell>
                            <Badge variant="outline" className={`text-[11px] font-medium ${style.className}`}>
                              {style.label}
                            </Badge>
                          </TableCell>

                          {/* Amount */}
                          <TableCell className={`text-right tabular-nums font-semibold text-xs ${
                            isCreated ? "text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-400"
                          }`}>
                            {signedAmount > 0 ? "+" : "−"}ETB {Math.abs(signedAmount).toFixed(2)}
                          </TableCell>

                          {/* Reason */}
                          <TableCell className="text-xs text-muted-foreground">
                            {REASON_LABELS[tx.reason || ""] || tx.reason || "—"}
                          </TableCell>

                          {/* Source Bill */}
                          <TableCell className="text-xs">
                            {tx.sourceBillKey ? (
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                                {tx.sourceBillKey}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Balance After */}
                          <TableCell className="text-right text-xs font-semibold tabular-nums">
                            ETB {tx.balanceAfter.toFixed(2)}
                          </TableCell>

                          {/* Created By */}
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {tx.createdByName || "System"}
                          </TableCell>

                          {/* Inspect */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
                              onClick={() => setSelectedTx(tx)}
                              title="Inspect Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <TablePagination
              count={txTotalCount}
              page={txPage}
              rowsPerPage={txRowsPerPage}
              onPageChange={setTxPage}
              onRowsPerPageChange={(val) => { setTxRowsPerPage(val); setTxPage(0); }}
              rowsPerPageOptions={[10, 15, 25, 50, 100]}
            />
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: ACTIVE DEPOSIT METERS                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="meters" className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by meter key, customer name, meter #…"
                      value={meterSearch}
                      onChange={(e) => { setMeterSearch(e.target.value); setMetersPage(0); }}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                  <Select value={meterBranchId} onValueChange={(val) => { setMeterBranchId(val); setMetersPage(0); }}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/60">
                  <TableRow>
                    <TableHead>Bulk Meter Key</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Meter #</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Contract #</TableHead>
                    <TableHead className="text-right">Outstanding Bill</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead className="text-right">Current Deposit Balance</TableHead>
                    <TableHead className="w-24 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9} className="py-4 text-center text-xs text-muted-foreground">
                          Loading bulk meters credit summary…
                        </TableCell>
                      </TableRow>
                    ))
                  ) : meters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                        No bulk meters found matching your filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    meters.map((m) => (
                      <TableRow key={m.bulkMeterKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                        <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {m.bulkMeterKey}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[200px] truncate">
                          {m.customerName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {m.meterNumber}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {m.branchName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {m.contractNumber || '—'}
                        </TableCell>
                        <TableCell className={`text-right text-xs tabular-nums font-semibold ${
                          m.outstandingBill > 0.005 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                        }`}>
                          ETB {m.outstandingBill.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={`text-[11px] ${
                            m.paymentStatus === 'Paid'
                              ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border-green-300/60'
                              : m.paymentStatus === 'Unpaid'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-300/60'
                              : 'bg-slate-100 dark:bg-slate-800'
                          }`}>
                            {m.paymentStatus || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <span className="font-bold tabular-nums px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                            ETB {m.creditBalance.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button asChild variant="outline" size="sm" className="h-7 text-xs px-2 gap-1 text-emerald-700 hover:text-emerald-800 border-emerald-300 dark:border-emerald-700">
                            <Link href={`/admin/bulk-meters/${m.bulkMeterKey}`} title="Open Bulk Meter Details">
                              <span>View</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <TablePagination
              count={metersTotalCount}
              page={metersPage}
              rowsPerPage={metersRowsPerPage}
              onPageChange={setMetersPage}
              onRowsPerPageChange={(val) => { setMetersRowsPerPage(val); setMetersPage(0); }}
              rowsPerPageOptions={[10, 15, 25, 50, 100]}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Transaction Inspector Dialog ── */}
      <Dialog open={selectedTx !== null} onOpenChange={(open) => { if (!open) setSelectedTx(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              Credit Note Entry Details
            </DialogTitle>
            <DialogDescription>
              Complete audit ledger record for this credit note event.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 text-sm">
              {/* Event banner */}
              <div className="rounded-lg border p-3 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Event</div>
                  <Badge variant="outline" className={`mt-1 font-semibold ${EVENT_STYLES[selectedTx.eventType]?.className}`}>
                    {EVENT_STYLES[selectedTx.eventType]?.label}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className={`text-lg font-bold tabular-nums mt-0.5 ${
                    selectedTx.eventType === "created" ? "text-green-600 dark:text-green-400" : "text-slate-800 dark:text-slate-200"
                  }`}>
                    {selectedTx.eventType === "created" ? "+" : "−"}ETB {selectedTx.amount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Bulk Meter</div>
                  <div className="font-semibold text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                    {selectedTx.bulkMeterKey}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{selectedTx.customerName}</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Branch</div>
                  <div className="text-xs font-medium mt-0.5">{selectedTx.branchName}</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Date &amp; Time</div>
                  <div className="text-xs font-medium mt-0.5">{formatDate(new Date(selectedTx.createdAt), "MMM d, yyyy HH:mm:ss")}</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Reason</div>
                  <div className="text-xs font-medium mt-0.5">{REASON_LABELS[selectedTx.reason || ""] || selectedTx.reason || "—"}</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Balance After</div>
                  <div className="text-xs font-bold tabular-nums mt-0.5">ETB {selectedTx.balanceAfter.toFixed(2)}</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Recorded By</div>
                  <div className="text-xs font-medium mt-0.5 truncate">{selectedTx.createdByName || "System"}</div>
                </div>

                {selectedTx.sourceBillKey && (
                  <div className="col-span-2">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">Source Bill</div>
                    <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                      {selectedTx.sourceBillKey}
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Ledger Entry ID</div>
                  <div className="flex items-center mt-0.5">
                    <span className="font-mono text-xs break-all text-muted-foreground">{selectedTx.id}</span>
                    <CopyButton value={selectedTx.id} />
                  </div>
                </div>

                {selectedTx.voidedLedgerId && (
                  <div className="col-span-2">
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">Voids Ledger ID</div>
                    <div className="flex items-center mt-0.5">
                      <span className="font-mono text-xs break-all text-muted-foreground">{selectedTx.voidedLedgerId}</span>
                      <CopyButton value={selectedTx.voidedLedgerId} />
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Notes</div>
                  <div className="mt-0.5 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 border rounded-md p-2.5 min-h-[44px]">
                    {selectedTx.notes || "No notes recorded."}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTx(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
