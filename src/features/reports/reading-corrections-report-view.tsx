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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileEdit,
  Search,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Clock,
  Printer,
  ExternalLink,
  Filter,
  CheckCircle2,
  Gauge,
  User,
  Calendar,
  Building2,
  HelpCircle,
  Activity
} from "lucide-react";
import { getBranches, initializeBranches, subscribeToBranches } from "@/lib/data-store";
import { getReadingCorrectionsAction, getReadingCorrectionKPIsAction } from "@/lib/actions";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/constants/auth";
import { getAvailableMonthYearOptions } from "@/lib/export-utils";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import type { ReadingCorrection, ReadingCorrectionKPIs } from "@/types/db";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format as formatDate } from "date-fns";
import { READING_CORRECTION_REASONS as REASON_CATEGORIES } from "@/types/db";

interface ReadingCorrectionsReportViewProps {
  isAdmin?: boolean;
  isEmbedded?: boolean;
  fullscreenUrl?: string;
}

function formatM3(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(2)} m³`;
}

function DeltaBadge({ value, unit = "m³" }: { value: number | null; unit?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const num = Number(value);
  const isPos = num > 0.001;
  const isNeg = num < -0.001;
  const formattedVal = `${isPos ? "+" : ""}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap",
        isPos ? "bg-rose-50 text-rose-700 border border-rose-200" : "",
        isNeg ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "",
        !isPos && !isNeg ? "bg-slate-100 text-slate-600 border border-slate-200" : "",
      ].join(" ")}
    >
      {isPos ? <TrendingUp className="w-3 h-3 text-rose-600 shrink-0" /> : isNeg ? <TrendingDown className="w-3 h-3 text-emerald-600 shrink-0" /> : null}
      <span>{formattedVal}</span>
    </span>
  );
}

function formatReasonCategory(cat: string): string {
  if (!cat) return "Other";
  const found = REASON_CATEGORIES.find((c) => c.value === cat);
  if (found) return found.label;
  return cat
    .split(/[_s]+/
    )
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function ReadingCorrectionsReportView({
  isAdmin = false,
  isEmbedded = false,
  fullscreenUrl = "/admin/reports/reading-corrections",
}: ReadingCorrectionsReportViewProps) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("all");
  const [selectedMonthYear, setSelectedMonthYear] = React.useState<string>("all");
  const [selectedMeterType, setSelectedMeterType] = React.useState<string>("all");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  const [corrections, setCorrections] = React.useState<ReadingCorrection[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [page, setPage] = React.useState<number>(0); // 0-based for TablePagination
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(20);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const [kpis, setKpis] = React.useState<ReadingCorrectionKPIs>({
    totalCorrections: 0,
    netConsumptionVariance: 0,
    increasedCount: 0,
    decreasedCount: 0,
    topReason: "N/A",
  });

  const [selectedRecord, setSelectedRecord] = React.useState<ReadingCorrection | null>(null);

  // Month options
  const monthOptions = React.useMemo(() => {
    return getAvailableMonthYearOptions();
  }, []);

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load branches
  React.useEffect(() => {
    initializeBranches();
    setBranches(getBranches());
    const unsub = subscribeToBranches((b) => setBranches(b));
    return () => unsub();
  }, []);

  // Load KPI metrics
  const fetchKPIs = React.useCallback(async () => {
    try {
      const result: any = await getReadingCorrectionKPIsAction({
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        meterType: selectedMeterType === "all" ? undefined : (selectedMeterType as any),
        reasonCategory: selectedCategory === "all" ? undefined : selectedCategory,
        searchTerm: debouncedSearch || undefined,
      });
      if (result?.data) {
        setKpis(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch Reading Correction KPIs:", err);
    }
  }, [selectedBranchId, selectedMonthYear, selectedMeterType, selectedCategory, debouncedSearch]);

  // Load corrections table
  const fetchCorrections = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result: any = await getReadingCorrectionsAction({
        page: page + 1,
        pageSize: rowsPerPage,
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        meterType: selectedMeterType === "all" ? undefined : (selectedMeterType as any),
        reasonCategory: selectedCategory === "all" ? undefined : selectedCategory,
        searchTerm: debouncedSearch || undefined,
      });

      if (result?.data) {
        setCorrections(result.data.rows || []);
        setTotalCount(result.data.totalCount || 0);
      } else {
        setCorrections([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load audit records",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, rowsPerPage, selectedBranchId, selectedMonthYear, selectedMeterType, selectedCategory, debouncedSearch, toast]);

  React.useEffect(() => {
    fetchCorrections();
    fetchKPIs();
  }, [fetchCorrections, fetchKPIs]);

  // Export handlers
  const handleExport = async (type: "csv" | "xlsx") => {
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Fetching reading correction audit records..." });
    try {
      const result: any = await getReadingCorrectionsAction({
        page: 1,
        pageSize: 10000,
        branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
        monthYear: selectedMonthYear === "all" ? undefined : selectedMonthYear,
        meterType: selectedMeterType === "all" ? undefined : (selectedMeterType as any),
        reasonCategory: selectedCategory === "all" ? undefined : selectedCategory,
        searchTerm: debouncedSearch || undefined,
      });

      const rows: ReadingCorrection[] = result?.data?.rows || [];
      if (!rows.length) {
        toast({ title: "No Records", description: "No records match your selected filters.", variant: "destructive" });
        return;
      }

      const data = rows.map((c) => ({
        "Corrected At": c.corrected_at ? formatDate(new Date(c.corrected_at), "yyyy-MM-dd HH:mm:ss") : "—",
        "Meter / Customer Key": c.customer_key,
        "Customer Name": c.customer_name || "—",
        "Meter Number": c.meter_number || "—",
        "Meter Type": c.meter_type === "bulk" ? "Bulk Meter" : "Individual Customer",
        "Branch": c.branch_name || "—",
        "Route": c.route_key || "—",
        "Billing Period": c.month_year,
        "Reading Date": c.reading_date ? formatDate(new Date(c.reading_date), "yyyy-MM-dd") : "—",
        "Old Previous Reading": c.old_previous_reading,
        "Old Current Reading": c.old_current_reading,
        "Old Consumption (m³)": c.old_consumption,
        "New Previous Reading": c.new_previous_reading,
        "New Current Reading": c.new_current_reading,
        "New Consumption (m³)": c.new_consumption,
        "Consumption Variance (m³)": c.consumption_difference,
        "Reading Difference": c.reading_difference,
        "Reason Category": formatReasonCategory(c.reason_category),
        "Correction Justification": c.reason,
        "Authorized By": c.corrected_by_name,
        "Audit Notes": c.notes || ""
      }));

      const headers = [
        "Audit ID",
        "Reading Type",
        "Customer / Meter Key",
        "Customer Name",
        "Branch",
        "Month/Year",
        "Reading Date",
        "Correction Date",
        "Old Previous Reading",
        "New Previous Reading",
        "Old Current Reading",
        "New Current Reading",
        "Old Consumption (m3)",
        "New Consumption (m3)",
        "Consumption Variance (m3)",
        "Reason Category",
        "Correction Justification",
        "Authorized By",
        "Audit Notes"
      ];

      const filename = `AAWSA_Reading_Corrections_${selectedMonthYear}_${formatDate(new Date(), "yyyyMMdd_HHmm")}`;
      if (type === "csv") {
        downloadFile(arrayToCsvBlob(data, headers), `${filename}.csv`);
      } else {
        downloadFile(arrayToXlsxBlob(data, headers, "Reading Corrections"), `${filename}.xlsx`);
      }
      toast({ title: "Export Complete", description: `Exported ${rows.length} reading correction records.` });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message || "Failed to generate export file.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="w-[95vw] max-w-[650px] max-h-[90vh] overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <FileEdit className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Reading Correction Audit Certificate
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Complete historical audit record linking previous field reading to verified correction.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 pt-2">
              {/* Header Info Banner */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Customer / Meter Key</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{selectedRecord.customer_key}</span>
                  {selectedRecord.customer_name && (
                    <span className="block text-slate-600 mt-0.5">{selectedRecord.customer_name}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Branch & Route</span>
                  <span className="font-bold text-slate-900">{selectedRecord.branch_name || "Unassigned"}</span>
                  <span className="block text-slate-500 mt-0.5">Route: {selectedRecord.route_key || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Billing Cycle</span>
                  <span className="font-bold text-slate-900">{selectedRecord.month_year}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Correction Date</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRecord.corrected_at ? formatDate(new Date(selectedRecord.corrected_at), "MMM d, yyyy HH:mm") : "—"}
                  </span>
                </div>
              </div>

              {/* Side-by-side Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-100/80">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-slate-700">Audit Parameter</TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 text-right">Original (Old)</TableHead>
                      <TableHead className="text-xs font-bold text-blue-700 text-right">Corrected (New)</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-right">Variance (Δ)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    <TableRow>
                      <TableCell className="font-semibold text-slate-700">Previous Reading</TableCell>
                      <TableCell className="text-right font-mono text-slate-700">{Number(selectedRecord.old_previous_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold font-mono text-blue-700">{Number(selectedRecord.new_previous_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono text-slate-600">
                        {(() => {
                          const diff = Number(selectedRecord.new_previous_reading) - Number(selectedRecord.old_previous_reading);
                          return `${diff > 0 ? "+" : ""}${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        })()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-slate-700">Current Reading</TableCell>
                      <TableCell className="text-right font-mono text-slate-700">{Number(selectedRecord.old_current_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold font-mono text-blue-700">{Number(selectedRecord.new_current_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono text-slate-600">
                        {(() => {
                          const diff = Number(selectedRecord.reading_difference);
                          return `${diff > 0 ? "+" : ""}${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        })()}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50/70 font-bold">
                      <TableCell className="text-slate-900">Consumption Volume</TableCell>
                      <TableCell className="text-right font-mono text-slate-800">{Number(selectedRecord.old_consumption).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</TableCell>
                      <TableCell className="text-right font-mono text-blue-800 font-black">{Number(selectedRecord.new_consumption).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</TableCell>
                      <TableCell className="text-right">
                        <DeltaBadge value={Number(selectedRecord.consumption_difference)} unit="m³" />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Reason & Staff Box */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">Reason Category</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {formatReasonCategory(selectedRecord.reason_category)}
                  </Badge>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Justification Provided:</span>
                  <p className="italic text-slate-800 bg-white p-2.5 rounded-lg border border-amber-100">
                    &quot;{selectedRecord.reason}&quot;
                  </p>
                </div>
                {selectedRecord.notes && (
                  <div>
                    <span className="font-semibold text-slate-600 block text-[11px]">Audit Notes:</span>
                    <p className="text-slate-700">{selectedRecord.notes}</p>
                  </div>
                )}
                <div className="pt-1 text-[11px] text-slate-600 flex justify-between items-center border-t border-amber-200/50">
                  <span>Authorized Staff: <strong className="text-slate-900">{selectedRecord.corrected_by_name}</strong></span>
                  <span className="text-[10px] text-slate-500">Record ID: {selectedRecord.id.substring(0, 8)}...</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                  Close Inspection
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Header (when not embedded) */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileEdit className="h-6 w-6 text-amber-600" />
              Reading Corrections Audit Report
            </h1>
            <p className="text-sm text-slate-500">
              Complete historical trail of meter reading adjustments, before/after values, and volume variance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 font-semibold">
              <Printer className="h-4 w-4" /> Print Report
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5" disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export Audit Trail
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2 text-xs font-semibold">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export as Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2 text-xs font-semibold">
                  <Download className="h-4 w-4 text-blue-600" /> Export as CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Corrections */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-wider">Total Corrections</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileEdit className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-800">{kpis.totalCorrections.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Audited reading adjustments</p>
          </CardContent>
        </Card>

        {/* Card 2: Net Consumption Variance */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-wider">Net Volume Variance</CardTitle>
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${kpis.netConsumptionVariance >= 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {kpis.netConsumptionVariance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-800">
              {kpis.netConsumptionVariance > 0 ? "+" : ""}{kpis.netConsumptionVariance.toFixed(2)} <span className="text-sm font-semibold text-slate-400">m³</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Total consumption volume delta</p>
          </CardContent>
        </Card>

        {/* Card 3: Impact Breakdown */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-wider">Variance Direction</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-3 text-xs font-bold pt-1">
              <div className="flex items-center gap-1 text-rose-700">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{kpis.increasedCount} Increased</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 text-emerald-700">
                <TrendingDown className="h-3.5 w-3.5" />
                <span>{kpis.decreasedCount} Decreased</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Reading adjustment distribution</p>
          </CardContent>
        </Card>

        {/* Card 4: Top Reason */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-wider">Top Correction Reason</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <HelpCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-sm font-bold text-slate-800 truncate" title={formatReasonCategory(kpis.topReason)}>
              {formatReasonCategory(kpis.topReason)}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Most common root cause</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search key, meter, staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            {/* Branch */}
            <div>
              <Select value={selectedBranchId} onValueChange={(val) => { setSelectedBranchId(val); setPage(0); }}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Branch (All)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Billing Month */}
            <div>
              <Select value={selectedMonthYear} onValueChange={(val) => { setSelectedMonthYear(val); setPage(0); }}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Period (All)" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Meter Type */}
            <div>
              <Select value={selectedMeterType} onValueChange={(val) => { setSelectedMeterType(val); setPage(0); }}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Meter Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Types</SelectItem>
                  <SelectItem value="individual" className="text-xs">Individual Customers</SelectItem>
                  <SelectItem value="bulk" className="text-xs">Bulk Meters</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason Category */}
            <div>
              <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setPage(0); }}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Reason Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Reasons</SelectItem>
                  {REASON_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action buttons inside embedded mode */}
          {isEmbedded && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                Showing {corrections.length} of {totalCount} audited corrections
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { fetchCorrections(); fetchKPIs(); }} className="h-8 gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-semibold" disabled={isExporting}>
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2 text-xs font-semibold">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2 text-xs font-semibold">
                      <Download className="h-4 w-4 text-blue-600" /> Export CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Table Card */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-bold text-xs">Date & Time</TableHead>
                  <TableHead className="font-bold text-xs">Customer / Meter</TableHead>
                  <TableHead className="font-bold text-xs">Branch & Route</TableHead>
                  <TableHead className="font-bold text-xs text-right">Original (Old)</TableHead>
                  <TableHead className="font-bold text-xs text-right text-blue-700">Corrected (New)</TableHead>
                  <TableHead className="font-bold text-xs text-right">Variance (Δ m³)</TableHead>
                  <TableHead className="font-bold text-xs">Reason Category</TableHead>
                  <TableHead className="font-bold text-xs">Authorized Staff</TableHead>
                  <TableHead className="font-bold text-xs text-right w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9} className="py-4">
                        <Skeleton className="h-5 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : corrections.length > 0 ? (
                  corrections.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/60 transition-colors text-xs">
                      {/* Date & Time */}
                      <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                        {row.corrected_at ? formatDate(new Date(row.corrected_at), "yyyy-MM-dd HH:mm") : "—"}
                      </TableCell>

                      {/* Customer / Meter */}
                      <TableCell>
                        <div className="font-bold font-mono text-slate-900">{row.customer_key}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant={row.meter_type === "bulk" ? "secondary" : "default"} className="text-[9px] h-4 px-1 uppercase font-bold">
                            {row.meter_type === "bulk" ? "Bulk" : "Indiv"}
                          </Badge>
                          {row.customer_name && (
                            <span className="text-slate-500 text-[11px] truncate max-w-[220px]" title={row.customer_name}>
                              {row.customer_name}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Branch & Route */}
                      <TableCell>
                        <div className="font-medium text-slate-800">{row.branch_name || "—"}</div>
                        {row.route_key && <div className="text-[10px] text-slate-400">R: {row.route_key}</div>}
                      </TableCell>

                      {/* Original (Old) */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-[11px]">
                          <span className="text-[10px] font-normal text-slate-400 mr-1">Curr:</span>
                          {Number(row.old_current_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>Prev: {Number(row.old_previous_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="mx-1 text-slate-300">|</span>
                          <span className="font-semibold text-slate-700">Usage: {Number(row.old_consumption).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</span>
                        </div>
                      </TableCell>

                      {/* Corrected (New) */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="font-bold text-blue-700 text-[11px]">
                          <span className="text-[10px] font-normal text-blue-400 mr-1">Curr:</span>
                          {Number(row.new_current_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                          <span>Prev: {Number(row.new_previous_reading).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="mx-1 text-blue-300">|</span>
                          <span className="font-semibold text-blue-800">Usage: {Number(row.new_consumption).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</span>
                        </div>
                      </TableCell>

                      {/* Variance */}
                      <TableCell className="text-right">
                        <DeltaBadge value={Number(row.consumption_difference)} unit="m3" />
                      </TableCell>

                      {/* Reason Category */}
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-700 border-slate-200">
                          {formatReasonCategory(row.reason_category)}
                        </Badge>
                        <div className="text-[11px] text-slate-500 italic truncate max-w-[140px] mt-0.5" title={row.reason}>
                          &quot;{row.reason}&quot;
                        </div>
                      </TableCell>

                      {/* Authorized Staff */}
                      <TableCell className="font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{row.corrected_by_name}</span>
                        </div>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                          onClick={() => setSelectedRecord(row)}
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground italic text-sm">
                      <FileEdit className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      No reading correction audit records found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <TablePagination
              count={totalCount}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(val) => {
                setRowsPerPage(val);
                setPage(0);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
