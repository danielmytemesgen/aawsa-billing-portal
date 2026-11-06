"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import { useToast } from "@/hooks/use-toast";
import {
  getAllBranchesAction,
  getMonthlyBillExportAction,
  getAllMonthlyBillExportRecordsAction,
  getDeliverySummaryPeriodsAction,
} from "@/lib/actions";
import type { MonthlyBillExportRow, MonthlyBillExportTotals } from "@/lib/db-queries";
import {
  ALL_MONTHLY_BILL_COLUMNS,
  exportMonthlyBillsToCsv,
  exportMonthlyBillsToXlsx,
  getAvailableMonthYearOptions,
} from "@/lib/export-utils";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileSpreadsheet,
  Download,
  Search,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
  Coins,
  TrendingUp,
  FileText,
  Clock,
  Layers,
  Building2,
  Calendar,
  Columns3,
  CheckCheck,
  XCircle,
  Sparkles,
  ChevronDown,
  Info,
} from "lucide-react";

export default function AdminMonthlyBillExportPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [latestMonth, setLatestMonth] = useState<string>("");
  const [dbMonths, setDbMonths] = useState<string[]>([]);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>("");
  const [selectedChargeGroup, setSelectedChargeGroup] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // 16-Column Multi-select State (Default: all 16 columns selected)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(ALL_MONTHLY_BILL_COLUMNS.map((c) => c.id))
  );
  const [columnSearchTerm, setColumnSearchTerm] = useState<string>("");
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState<boolean>(false);

  const [rows, setRows] = useState<MonthlyBillExportRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totals, setTotals] = useState<MonthlyBillExportTotals>({
    totalBills: 0,
    totalAmount: 0,
    totalThisMonth: 0,
    totalOutstanding: 0,
    totalPenalty: 0,
    totalVat: 0,
  });

  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isPeriodsInitialized, setIsPeriodsInitialized] = useState<boolean>(false);

  // Check if current user is admin / has full report export permission
  const isAdmin = (
    hasPermission("*") ||
    hasPermission("admin") ||
    hasPermission("all") ||
    hasPermission(PERMISSIONS.REPORT_MONTHLY_BILL_EXPORT) ||
    hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL) ||
    hasPermission(PERMISSIONS.BILL_VIEW_ALL) ||
    hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL)
  );

  // Available Month-Year Options
  const monthOptions = useMemo(() => {
    const base = getAvailableMonthYearOptions();
    const existingValues = new Set(base.map((o) => o.value));
    const extras: { value: string; label: string }[] = [];
    dbMonths.forEach((m) => {
      if (!existingValues.has(m) && m !== "all") {
        const [yr, mo] = m.split("-").map(Number);
        const d = new Date(yr, (mo || 1) - 1, 1);
        const label = isNaN(d.getTime()) ? m : format(d, "MMMM yyyy");
        extras.push({ value: m, label });
      }
    });

    const combined = [...base, ...extras];
    return combined.map((opt) => {
      if (latestMonth && opt.value === latestMonth) {
        const cleanLabel = opt.label.replace(/\s*\(Latest\)$/i, "");
        return { ...opt, label: `${cleanLabel} (Latest)` };
      }
      return opt;
    });
  }, [dbMonths, latestMonth]);

  // Load branches and periods on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([getAllBranchesAction(), getDeliverySummaryPeriodsAction()])
      .then(([branchRes, periodRes]: [any, any]) => {
        if (!isMounted) return;
        const rawBranches = (branchRes?.data || branchRes?.branches || []) as any[];
        if (rawBranches.length > 0) {
          setBranches(rawBranches.map((b: any) => ({ id: b.id, name: b.name })));
        }
        if (periodRes?.success && periodRes.latestMonth) {
          setLatestMonth(periodRes.latestMonth);
          setSelectedMonthYear(periodRes.latestMonth);
          if (periodRes.availableMonths) {
            setDbMonths(periodRes.availableMonths);
          }
        } else {
          const fallback = format(new Date(), "yyyy-MM");
          setLatestMonth(fallback);
          setSelectedMonthYear(fallback);
        }
        setIsPeriodsInitialized(true);
      })
      .catch((err) => {
        console.error("Failed to load initial metadata for Monthly Bill Export:", err);
        if (!isMounted) return;
        const fallback = format(new Date(), "yyyy-MM");
        setLatestMonth(fallback);
        setSelectedMonthYear(fallback);
        setIsPeriodsInitialized(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Column Selection Handlers
  const handleSelectAllColumns = useCallback(() => {
    setSelectedColumns(new Set(ALL_MONTHLY_BILL_COLUMNS.map((c) => c.id)));
    toast({
      title: "All Columns Selected",
      description: "All 16 payment switch columns are now enabled for preview & export.",
    });
  }, [toast]);

  const handleUnselectAllColumns = useCallback(() => {
    setSelectedColumns(new Set());
    toast({
      title: "All Columns Unselected",
      description: "Pick any column from the column selector to display it in the table.",
    });
  }, [toast]);

  const handleToggleColumn = useCallback((columnId: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  const handleSelectPreset = useCallback((preset: "core" | "financial" | "readings") => {
    if (preset === "core") {
      setSelectedColumns(new Set(["BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERBRANCH", "REASON", "CONS", "THISMONTHBILLAMT", "TOTALBILLAMOUNT"]));
      toast({ title: "Core Preset Applied", description: "Selected 8 core billing and customer columns." });
    } else if (preset === "financial") {
      setSelectedColumns(new Set(["BILLKEY", "CUSTOMERNAME", "THISMONTHBILLAMT", "OUTSTANDINGAMT", "PENALTYAMT", "VAT_AMOUNT", "TOTALBILLAMOUNT", "DRACCTNO", "CRACCTNO"]));
      toast({ title: "Financial Preset Applied", description: "Selected 9 ledger, tax, and charge columns." });
    } else if (preset === "readings") {
      setSelectedColumns(new Set(["BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "PREVREAD", "CURRREAD", "CONS", "THISMONTHBILLAMT", "TOTALBILLAMOUNT"]));
      toast({ title: "Readings Preset Applied", description: "Selected 8 consumption and meter reading columns." });
    }
  }, [toast]);

  // Filter columns inside the picker
  const filteredColumnsList = useMemo(() => {
    if (!columnSearchTerm.trim()) return ALL_MONTHLY_BILL_COLUMNS;
    const term = columnSearchTerm.toLowerCase().trim();
    return ALL_MONTHLY_BILL_COLUMNS.filter(
      (c) => c.id.toLowerCase().includes(term) || c.label.toLowerCase().includes(term) || c.category.toLowerCase().includes(term)
    );
  }, [columnSearchTerm]);

  // Active columns ordered by official order
  const activeOrderedColumns = useMemo(() => {
    return ALL_MONTHLY_BILL_COLUMNS.filter((c) => selectedColumns.has(c.id));
  }, [selectedColumns]);

  // Fetch paginated data
  const fetchData = useCallback(async () => {
    if (!isAdmin || !isPeriodsInitialized) return;
    setIsLoading(true);
    try {
      const res = await getMonthlyBillExportAction({
        page,
        limit: pageSize,
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        chargeGroup: selectedChargeGroup === "all" ? undefined : selectedChargeGroup,
        searchTerm: debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
      });

      if (res?.success) {
        setRows(res.rows || []);
        setTotalCount(res.total || 0);
        if (res.totals) {
          setTotals(res.totals);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Fetch Data",
          description: (res as any)?.error || "Could not load monthly bill export records.",
        });
      }
    } catch (err: any) {
      console.error("Error fetching monthly bill export records:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "An unexpected error occurred while loading records.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, isPeriodsInitialized, page, pageSize, selectedBranchId, selectedMonthYear, selectedChargeGroup, debouncedSearch, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Full Export (CSV or XLSX) with only selected columns
  const handleExport = async (formatType: "csv" | "xlsx") => {
    if (selectedColumns.size === 0) {
      toast({
        variant: "destructive",
        title: "No Columns Selected",
        description: "Please select at least one column to export.",
      });
      return;
    }

    setIsExporting(true);
    const chosenHeaders = activeOrderedColumns.map((c) => c.id);
    toast({
      title: "Preparing Export",
      description: `Fetching records matching filters and formatting ${chosenHeaders.length} selected columns...`,
    });

    try {
      const res = await getAllMonthlyBillExportRecordsAction({
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        chargeGroup: selectedChargeGroup === "all" ? undefined : selectedChargeGroup,
        searchTerm: debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
      });

      const exportRows = res?.rows || [];
      if (exportRows.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "No monthly bill records match the current filter selection.",
        });
        return;
      }

      const prefix = `monthly_bill_export_${selectedMonthYear || "all"}`;
      if (formatType === "csv") {
        exportMonthlyBillsToCsv(exportRows, prefix, chosenHeaders);
      } else {
        exportMonthlyBillsToXlsx(exportRows, prefix, chosenHeaders);
      }

      toast({
        title: "Export Complete",
        description: `Successfully exported ${exportRows.length} bills (${chosenHeaders.length} columns) in ${formatType.toUpperCase()} format.`,
      });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message || "Failed to generate monthly bill export file.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to render cell value dynamically based on column ID
  const renderCellContent = (colId: string, row: MonthlyBillExportRow) => {
    switch (colId) {
      case "BILLKEY":
        return <span className="font-mono font-bold text-slate-900 text-xs">{row.BILLKEY}</span>;
      case "CUSTOMERKEY":
        return <span className="font-mono text-slate-600 text-[11px]">{row.CUSTOMERKEY}</span>;
      case "CUSTOMERNAME":
        return <span className="font-medium text-slate-800">{row.CUSTOMERNAME}</span>;
      case "CUSTOMERTIN":
        return <span className="font-mono text-slate-500 text-[11px]">{row.CUSTOMERTIN || "—"}</span>;
      case "CUSTOMERBRANCH":
        return (
          <Badge variant="outline" className="text-[10px] font-medium bg-slate-50 text-slate-700 border-slate-200">
            {row.CUSTOMERBRANCH}
          </Badge>
        );
      case "REASON":
        return (
          <Badge variant="secondary" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-none">
            {row.REASON}
          </Badge>
        );
      case "PREVREAD":
        return <span className="text-right font-mono text-slate-500 block">{Number(row.PREVREAD || 0).toLocaleString()}</span>;
      case "CURRREAD":
        return <span className="text-right font-mono text-slate-700 font-semibold block">{Number(row.CURRREAD || 0).toLocaleString()}</span>;
      case "CONS":
        return <span className="text-right font-mono font-bold text-indigo-700 block">{Number(row.CONS || 0).toLocaleString()}</span>;
      case "THISMONTHBILLAMT":
        return <span className="text-right font-mono text-slate-700 font-medium block">{formatNumber(row.THISMONTHBILLAMT)}</span>;
      case "OUTSTANDINGAMT":
        return (
          <span className="text-right font-mono text-amber-700 block">
            {row.OUTSTANDINGAMT > 0 ? formatNumber(row.OUTSTANDINGAMT) : "0.00"}
          </span>
        );
      case "PENALTYAMT":
        return (
          <span className="text-right font-mono text-destructive block">
            {row.PENALTYAMT > 0 ? formatNumber(row.PENALTYAMT) : "0.00"}
          </span>
        );
      case "VAT_AMOUNT":
        return (
          <span className="text-right font-mono text-slate-500 block">
            {row.VAT_AMOUNT > 0 ? formatNumber(row.VAT_AMOUNT) : "0.00"}
          </span>
        );
      case "TOTALBILLAMOUNT":
        return (
          <span className="text-right font-mono font-black text-emerald-800 bg-emerald-50/40 px-2 py-0.5 rounded block">
            {formatNumber(row.TOTALBILLAMOUNT)}
          </span>
        );
      case "DRACCTNO":
        return <span className="font-mono text-slate-400 text-[11px]">{row.DRACCTNO || "—"}</span>;
      case "CRACCTNO":
        return <span className="font-mono text-slate-400 text-[11px]">{row.CRACCTNO || "—"}</span>;
      default:
        return <span>{(row as any)[colId] ?? "—"}</span>;
    }
  };

  // Unauthorized guard
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center space-y-4 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Access Restricted</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            The Monthly Bill Export report contains sensitive ledger and banking integration records and is strictly restricted to system administrators.
          </p>
          <div className="pt-2">
            <Link href="/admin/reports">
              <Button variant="outline" className="rounded-xl border-slate-300">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin/reports" className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Reports Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-700">Monthly Bill Export</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Bill Export</h1>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-[10px] uppercase font-bold tracking-wider">
                  Admin Only
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardized monthly billing records for external payment gateways, CBE, Telebirr, and banking switch integration.
              </p>
            </div>
          </div>
        </div>

        {/* Export & Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading || isExporting}
            className="rounded-xl border-slate-200 hover:bg-slate-50 font-medium"
            title="Refresh latest data"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={isLoading || isExporting || totalCount === 0 || selectedColumns.size === 0}
            className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold"
          >
            <Download className="h-4 w-4 mr-2" />
            Export XLSX ({selectedColumns.size})
          </Button>

          <Button
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={isLoading || isExporting || totalCount === 0 || selectedColumns.size === 0}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md font-semibold"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting…" : `Export CSV (${selectedColumns.size} cols)`}
          </Button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Billed Records</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{totalCount.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Bills in active scope</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Bill Amount</p>
              <p className="text-2xl font-black text-emerald-800 mt-1 font-mono">
                {formatNumber(totals.totalAmount)} <span className="text-xs font-normal text-emerald-600">ETB</span>
              </p>
              <p className="text-[10px] text-emerald-600/80 mt-0.5">Including VAT &amp; Penalties</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-sm">
              <Coins className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-blue-200/80 shadow-sm bg-gradient-to-br from-blue-50/50 to-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Current Month Charges</p>
              <p className="text-2xl font-black text-blue-800 mt-1 font-mono">
                {formatNumber(totals.totalThisMonth)} <span className="text-xs font-normal text-blue-600">ETB</span>
              </p>
              <p className="text-[10px] text-blue-600/80 mt-0.5">New consumption delivered</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-200/80 shadow-sm bg-gradient-to-br from-amber-50/50 to-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Carry-forward Outstanding</p>
              <p className="text-2xl font-black text-amber-800 mt-1 font-mono">
                {formatNumber(totals.totalOutstanding)} <span className="text-xs font-normal text-amber-600">ETB</span>
              </p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">Historical unsettled balances</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-sm">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters Bar ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Branch Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" /> Branch
            </Label>
            <Select
              value={selectedBranchId}
              onValueChange={(val) => {
                setSelectedBranchId(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50/70 text-xs h-9">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Billing Period Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> Billing Period
            </Label>
            <Select
              value={selectedMonthYear}
              onValueChange={(val) => {
                setSelectedMonthYear(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50/70 text-xs h-9">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Charge Group Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400" /> Charge Group
            </Label>
            <Select
              value={selectedChargeGroup}
              onValueChange={(val) => {
                setSelectedChargeGroup(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50/70 text-xs h-9">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="Domestic">Domestic</SelectItem>
                <SelectItem value="Commercial">Commercial</SelectItem>
                <SelectItem value="Government">Government</SelectItem>
                <SelectItem value="Institutional">Institutional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Term */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" /> Search Records
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Bill Key, Customer, Meter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 rounded-xl border-slate-200 bg-slate-50/70 text-xs h-9"
              />
            </div>
          </div>

          {/* ── 16-Column Multi-Select Filter Popover ── */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Columns3 className="h-3.5 w-3.5 text-indigo-600" /> Filter Columns ({selectedColumns.size}/16)
            </Label>
            <Popover open={isColumnPickerOpen} onOpenChange={setIsColumnPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-slate-200 bg-slate-50/70 text-xs h-9 justify-between font-medium hover:bg-slate-100"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Columns3 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-800">{selectedColumns.size}</span>
                    <span className="text-slate-500">of 16 columns</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 shadow-xl rounded-2xl border-slate-200" align="end">
                {/* Popover Header & Select All / Unselect All Actions */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Columns3 className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">16 Export Columns</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSelectAllColumns}
                      className="h-6 px-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md"
                    >
                      <CheckCheck className="h-3 w-3 mr-1" /> All
                    </Button>
                    <span className="text-slate-300">|</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleUnselectAllColumns}
                      className="h-6 px-1.5 text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <XCircle className="h-3 w-3 mr-1" /> None
                    </Button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-slate-100 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400">Presets:</span>
                  <button
                    onClick={() => handleSelectPreset("core")}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-slate-600"
                  >
                    Core (8)
                  </button>
                  <button
                    onClick={() => handleSelectPreset("financial")}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-slate-600"
                  >
                    Finance (9)
                  </button>
                  <button
                    onClick={() => handleSelectPreset("readings")}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 transition-colors text-slate-600"
                  >
                    Readings (8)
                  </button>
                </div>

                {/* Column Search inside Popover */}
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search columns…"
                    value={columnSearchTerm}
                    onChange={(e) => setColumnSearchTerm(e.target.value)}
                    className="h-7 pl-7 text-xs rounded-lg border-slate-200 bg-slate-50"
                  />
                </div>

                {/* Checklist of Columns */}
                <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50">
                  {filteredColumnsList.map((col) => {
                    const isChecked = selectedColumns.has(col.id);
                    return (
                      <div
                        key={col.id}
                        onClick={() => handleToggleColumn(col.id)}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                          isChecked ? "bg-indigo-50/60 text-slate-900" : "hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleColumn(col.id)}
                            className="rounded data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                          <div>
                            <p className="font-semibold leading-none">{col.id}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{col.label}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-normal text-slate-400 border-slate-200">
                          {col.category}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── Active Column Pill Toggles ── */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Active Columns:</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSelectAllColumns}
            className="h-6 px-2 text-[10px] font-bold rounded-full border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
          >
            <CheckCheck className="h-3 w-3 mr-1" /> Select All (16)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleUnselectAllColumns}
            className="h-6 px-2 text-[10px] font-bold rounded-full border-slate-200 bg-slate-50 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          >
            <XCircle className="h-3 w-3 mr-1" /> Unselect All
          </Button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* Clickable Quick-Toggle Pills for all 16 Columns */}
          {ALL_MONTHLY_BILL_COLUMNS.map((col) => {
            const isActive = selectedColumns.has(col.id);
            return (
              <button
                key={col.id}
                onClick={() => handleToggleColumn(col.id)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition-all border ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-xs hover:bg-emerald-100"
                    : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-700"
                }`}
                title={`Click to ${isActive ? "hide" : "show"} ${col.label}`}
              >
                {isActive ? "✓ " : "+ "}
                {col.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Data Table / Zero Columns Alert ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Standardized Export Ledger Preview</h2>
            <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
              {selectedColumns.size} of 16 Columns Displayed
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Showing {rows.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
          </p>
        </div>

        {selectedColumns.size === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
              <Info className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Columns Selected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All 16 columns are currently unselected. Click the button below to enable all columns or choose specific ones from the column filter above.
            </p>
            <div className="pt-1">
              <Button onClick={handleSelectAllColumns} size="sm" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <CheckCheck className="h-4 w-4 mr-1.5" /> Select All 16 Columns
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={Math.min(selectedColumns.size, 10)} rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Monthly Bills Found"
              description="No bill records matched the selected branch, billing period, and search criteria."
              icon={FileSpreadsheet}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {activeOrderedColumns.map((col) => {
                    const isRight = ["PREVREAD", "CURRREAD", "CONS", "THISMONTHBILLAMT", "OUTSTANDINGAMT", "PENALTYAMT", "VAT_AMOUNT", "TOTALBILLAMOUNT"].includes(col.id);
                    const isCenter = col.id === "REASON";
                    return (
                      <TableHead
                        key={col.id}
                        className={`${isRight ? "text-right" : isCenter ? "text-center" : "text-left"} ${
                          col.id === "TOTALBILLAMOUNT" ? "text-emerald-800 font-black bg-emerald-50/50" : ""
                        }`}
                      >
                        {col.id}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs">
                {rows.map((row, idx) => (
                  <TableRow key={row.id || `${row.BILLKEY}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                    {activeOrderedColumns.map((col) => (
                      <TableCell key={col.id} className="py-2.5">
                        {renderCellContent(col.id, row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalCount > 0 && selectedColumns.size > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-end">
            <TablePagination
              page={page}
              count={totalCount}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onPageChange={setPage}
              onRowsPerPageChange={(newSize) => {
                setPageSize(newSize);
                setPage(0);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
