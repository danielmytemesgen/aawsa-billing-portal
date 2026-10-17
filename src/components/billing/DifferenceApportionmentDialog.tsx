"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Scale,
  PieChart,
  Users,
  Droplets,
  DollarSign,
  Printer,
  FileSpreadsheet,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  Layers,
  Info,
  CheckCircle2,
  Calendar,
  X,
  SlidersHorizontal,
  Save,
  CheckCheck,
} from "lucide-react";
import { calculateDifferenceApportionmentAction, saveDifferenceDistributionAction } from "@/lib/actions";
import * as XLSX from "xlsx";
import { format, parse } from "date-fns";

export interface DifferenceApportionmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkMeterKey: string;
  bulkMeterName?: string;
  initialMonthYear?: string;
  availablePeriods?: Array<{ monthYear: string; label: string }> | string[];
  isCustomerPortal?: boolean;
  customerSessionId?: string;
}

interface ApportionmentSummary {
  bulkMeterKey: string;
  monthYear: string;
  bulkUsage: number;
  totalSubmeterUsage: number;
  differenceUsage: number;
  differenceBillAmount: number;
  unitCount: number;
  distributionMethod: "proportional_usage" | "equal_split";
}

interface ApportionmentItem {
  customerKeyNumber: string;
  name: string;
  meterSize?: any;
  customerType?: string;
  ownUsage: number;
  shareRatio: number;
  sharePercentage: string;
  apportionedDifferenceBill: number;
  ownBillAmount: number;
  totalPayable: number;
}

export function DifferenceApportionmentDialog({
  open,
  onOpenChange,
  bulkMeterKey,
  bulkMeterName,
  initialMonthYear,
  availablePeriods = [],
  isCustomerPortal = false,
  customerSessionId,
}: DifferenceApportionmentDialogProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Periods formatting
  const normalizedPeriods = useMemo(() => {
    if (!availablePeriods || availablePeriods.length === 0) {
      if (initialMonthYear) {
        return [{ monthYear: initialMonthYear, label: initialMonthYear }];
      }
      return [];
    }
    return availablePeriods.map((p) => {
      if (typeof p === "string") {
        try {
          const d = parse(p, "yyyy-MM", new Date());
          return { monthYear: p, label: format(d, "MMMM yyyy") };
        } catch {
          return { monthYear: p, label: p };
        }
      }
      return p;
    });
  }, [availablePeriods, initialMonthYear]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    initialMonthYear || (normalizedPeriods[0]?.monthYear ?? "")
  );

  const [method, setMethod] = useState<"proportional_usage" | "equal_split">(
    "proportional_usage"
  );
  const [customBillInput, setCustomBillInput] = useState<string>("");
  const [isCustomBillEnabled, setIsCustomBillEnabled] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedInDb, setIsSavedInDb] = useState(false);
  const [summary, setSummary] = useState<ApportionmentSummary | null>(null);
  const [items, setItems] = useState<ApportionmentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination for large sets (e.g. 565 units)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sync initial period when opened
  useEffect(() => {
    if (open) {
      const targetPeriod =
        initialMonthYear || normalizedPeriods[0]?.monthYear || "";
      if (targetPeriod) {
        setSelectedPeriod(targetPeriod);
      }
    }
  }, [open, initialMonthYear, normalizedPeriods]);

  // Fetch apportionment data
  const fetchData = async () => {
    if (!open || !bulkMeterKey || !selectedPeriod) return;

    try {
      setIsLoading(true);

      let effectiveSessionId: string | undefined = customerSessionId;
      if (!effectiveSessionId && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("customer");
          if (raw) {
            const parsed = JSON.parse(raw);
            effectiveSessionId = parsed.sessionId || parsed.id;
          }
        } catch (e) {
          // ignore
        }
      }

      const customAmount =
        isCustomBillEnabled && customBillInput.trim() !== ""
          ? parseFloat(customBillInput)
          : undefined;

      const res = await calculateDifferenceApportionmentAction({
        bulkMeterKey,
        monthYear: selectedPeriod,
        distributionMethod: method,
        customTotalBillAmount: !isNaN(Number(customAmount)) ? customAmount : undefined,
        customerSessionId: effectiveSessionId,
      });

      if (res && res.summary) {
        setSummary(res.summary);
        setItems(res.items || []);
        setIsSavedInDb(Boolean(res.autoSaved || res.savedDistributionId));
        setCurrentPage(1);
      } else {
        setSummary(null);
        setItems([]);
        setIsSavedInDb(false);
      }
    } catch (error: any) {
      console.error("Error calculating difference apportionment:", error);
      toast({
        title: "Apportionment Calculation Failed",
        description: error?.message || "Failed to load difference bill allocation data.",
        variant: "destructive",
      });
      setSummary(null);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && selectedPeriod) {
      fetchData();
    }
  }, [open, selectedPeriod, method, isCustomBillEnabled]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.customerKeyNumber.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.customerType && it.customerType.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  // Calculated totals
  const totals = useMemo(() => {
    const totalUsage = items.reduce((sum, it) => sum + it.ownUsage, 0);
    const totalApportioned = items.reduce(
      (sum, it) => sum + it.apportionedDifferenceBill,
      0
    );
    const totalOwnBills = items.reduce((sum, it) => sum + it.ownBillAmount, 0);
    const totalPayable = items.reduce((sum, it) => sum + it.totalPayable, 0);

    return {
      totalUsage,
      totalApportioned,
      totalOwnBills,
      totalPayable,
    };
  }, [items]);

  // Save / Finalize Distribution to Database
  const handleSaveDistribution = async (targetStatus: 'Draft' | 'Finalized' = 'Finalized') => {
    try {
      setIsSaving(true);
      const customAmount =
        isCustomBillEnabled && customBillInput.trim() !== ""
          ? parseFloat(customBillInput)
          : undefined;

      const res = await saveDifferenceDistributionAction({
        bulkMeterKey,
        monthYear: selectedPeriod,
        distributionMethod: method,
        status: targetStatus,
        customTotalBillAmount: !isNaN(Number(customAmount)) ? customAmount : undefined,
      });

      if (res && res.success) {
        setIsSavedInDb(true);
        toast({
          title: "Distribution Saved to Database",
          description: `Successfully saved and finalized ${res.unitsCount} customer records in bulk_difference_distributions.`,
        });
      }
    } catch (e: any) {
      console.error("Save distribution error:", e);
      toast({
        title: "Save Failed",
        description: e?.message || "Failed to persist distribution records to database.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel
  const handleExportXlsx = () => {
    try {
      if (items.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no customer records for this period.",
          variant: "destructive",
        });
        return;
      }

      const rows = items.map((it, idx) => ({
        "No.": idx + 1,
        "Customer Key": it.customerKeyNumber,
        "Customer Name": it.name,
        "Meter Size": it.meterSize || "N/A",
        "Category": it.customerType || "N/A",
        "Own Usage (m³)": it.ownUsage,
        "Allocation Share (%)": it.sharePercentage,
        "Apportioned Diff Bill (ETB)": it.apportionedDifferenceBill,
        "Own Individual Bill (ETB)": it.ownBillAmount,
        "Total Combined Payable (ETB)": it.totalPayable,
      }));

      // Add summary total row
      rows.push({
        "No.": "TOTAL" as any,
        "Customer Key": `${items.length} Units`,
        "Customer Name": "",
        "Meter Size": "",
        "Category": "",
        "Own Usage (m³)": totals.totalUsage,
        "Allocation Share (%)": "100.00%",
        "Apportioned Diff Bill (ETB)": Number(totals.totalApportioned.toFixed(2)),
        "Own Individual Bill (ETB)": Number(totals.totalOwnBills.toFixed(2)),
        "Total Combined Payable (ETB)": Number(totals.totalPayable.toFixed(2)),
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      const colWidths = [
        { wch: 6 },
        { wch: 18 },
        { wch: 32 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 20 },
        { wch: 24 },
        { wch: 22 },
        { wch: 24 },
      ];
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Difference Apportionment");

      const filename = `AAWSA_Diff_Apportionment_${bulkMeterKey}_${selectedPeriod}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Excel Export Complete",
        description: `Exported ${items.length} records to ${filename}`,
      });
    } catch (e: any) {
      console.error("Export error:", e);
      toast({
        title: "Export Failed",
        description: e?.message || "Failed to generate Excel file.",
        variant: "destructive",
      });
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  const periodLabel = useMemo(() => {
    const match = normalizedPeriods.find((p) => p.monthYear === selectedPeriod);
    if (match) return match.label;
    try {
      const d = parse(selectedPeriod, "yyyy-MM", new Date());
      return format(d, "MMMM yyyy");
    } catch {
      return selectedPeriod;
    }
  }, [normalizedPeriods, selectedPeriod]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background text-foreground border shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <span>Bulk Meter Difference Apportionment</span>
                  <Badge variant="outline" className="text-xs bg-background/80 font-mono">
                    {bulkMeterKey}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Proportionally distribute bulk difference bill amount to assigned individual customer sub-meters based on verified consumption.
                </DialogDescription>
              </div>
            </div>

            {/* Controls: Period, Method, Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {normalizedPeriods.length > 0 && (
                <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1 text-xs shadow-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground font-medium text-[11px]">Period:</span>
                  <Select
                    value={selectedPeriod}
                    onValueChange={(val) => {
                      setSelectedPeriod(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none focus:ring-0 p-0 text-xs font-semibold max-w-[140px]">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      {normalizedPeriods.map((p) => (
                        <SelectItem key={p.monthYear} value={p.monthYear}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
                className="h-8 gap-1.5 text-xs shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportXlsx}
                disabled={items.length === 0}
                className="h-8 gap-1.5 text-xs hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Excel</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={items.length === 0}
                className="h-8 gap-1.5 text-xs shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </Button>

              {isSavedInDb ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Auto-saved to DB</span>
                </div>
              ) : !isCustomerPortal ? (
                <Button
                  size="sm"
                  onClick={() => handleSaveDistribution('Finalized')}
                  disabled={isSaving || items.length === 0}
                  className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Record</span>
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Method Selector & Custom Diff Bill Overrides (Staff/Admin) */}
          <div className="bg-muted/30 border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Apportionment Method:
              </span>
              <div className="inline-flex rounded-lg border bg-background p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setMethod("proportional_usage")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    method === "proportional_usage"
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Proportional to Usage (Cᵢ / ΣCₛᵤᵦ)
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("equal_split")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    method === "equal_split"
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Equal Distribution (1 / N)
                </button>
              </div>
            </div>

            {/* Custom Difference Bill simulation/override */}
            {!isCustomerPortal && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={isCustomBillEnabled}
                    onChange={(e) => {
                      setIsCustomBillEnabled(e.target.checked);
                      if (!e.target.checked) setCustomBillInput("");
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Simulate Bill (ETB):</span>
                </label>
                {isCustomBillEnabled && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5000"
                      value={customBillInput}
                      onChange={(e) => setCustomBillInput(e.target.value)}
                      className="h-7 w-28 text-xs font-mono"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={fetchData}
                      className="h-7 px-2 text-xs"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metric KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="shadow-sm border bg-gradient-to-br from-card to-muted/20">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Bulk Usage</span>
                    <Droplets className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {summary.bulkUsage.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">m³</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Master meter consumption</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border bg-gradient-to-br from-card to-muted/20">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Submeters Sum</span>
                    <Users className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {summary.totalSubmeterUsage.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">m³</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Total assigned individual usage</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border bg-gradient-to-br from-card to-muted/20">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Difference Vol</span>
                    <Layers className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                    {summary.differenceUsage.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">m³</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {summary.bulkUsage > 0
                      ? `${((summary.differenceUsage / summary.bulkUsage) * 100).toFixed(1)}% of bulk`
                      : "0% loss/diff"}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border bg-primary/5 border-primary/20">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-primary">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Diff Bill Total</span>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xl font-bold font-mono text-primary">
                    {summary.differenceBillAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-xs text-primary font-normal">ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">To be distributed across units</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border bg-gradient-to-br from-card to-muted/20 col-span-2 sm:col-span-1">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Assigned Units</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {summary.unitCount} <span className="text-xs text-muted-foreground font-normal">units</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {method === "proportional_usage" ? "Proportional share" : "Equal share each"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by customer key, name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 h-8 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
              <span>
                Showing <strong className="text-foreground">{filteredItems.length}</strong> of{" "}
                <strong className="text-foreground">{items.length}</strong> units
              </span>
              <div className="flex items-center gap-1.5">
                <span>Page size:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-16 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs">Calculating difference apportionment ratios...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">No Apportionment Data Available</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  No verified bulk difference bill or assigned individual customer readings found for period{" "}
                  <strong>{periodLabel}</strong>.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="text-[11px] font-semibold text-muted-foreground">
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead className="w-36">Customer Key</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead className="text-right">Own Usage</TableHead>
                      <TableHead className="text-right">Share Ratio</TableHead>
                      <TableHead className="text-right text-primary font-bold">
                        Apportioned Diff (ETB)
                      </TableHead>
                      <TableHead className="text-right">Own Base Bill (ETB)</TableHead>
                      <TableHead className="text-right font-bold text-foreground">
                        Total Payable (ETB)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <TableRow
                          key={item.customerKeyNumber}
                          className="hover:bg-muted/30 transition-colors text-xs"
                        >
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {rowNum}
                          </TableCell>
                          <TableCell className="font-mono font-medium text-foreground">
                            {item.customerKeyNumber}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{item.name}</div>
                            {item.customerType && (
                              <div className="text-[10px] text-muted-foreground">
                                {item.customerType}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.ownUsage.toLocaleString()} m³
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                              {item.sharePercentage}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">
                            {item.apportionedDifferenceBill.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {item.ownBillAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {item.totalPayable.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {/* Summary Totals Footer */}
                  <tfoot className="border-t-2 border-border bg-muted/60 font-semibold text-xs text-foreground">
                    <TableRow>
                      <TableCell colSpan={3} className="text-left font-bold pl-4">
                        TOTAL SUMMARY ({items.length} Customers)
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {totals.totalUsage.toLocaleString()} m³
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-muted-foreground">
                        100.00%
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary text-sm">
                        {totals.totalApportioned.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-muted-foreground">
                        {totals.totalOwnBills.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground text-sm">
                        {totals.totalPayable.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">
                Page <strong className="text-foreground">{currentPage}</strong> of{" "}
                <strong className="text-foreground">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-7 px-3 text-xs"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-7 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Formula Clarification Callout */}
          <div className="border border-border/60 rounded-lg p-3 bg-muted/15 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-semibold text-foreground">Apportionment Rule:</span>{" "}
              {method === "proportional_usage" ? (
                <span>
                  Each customer pays their own consumption bill plus a fraction of the bulk difference bill equal to their share of total consumption (
                  <code className="font-mono bg-background px-1 py-0.5 rounded text-[11px] text-foreground">
                    Cᵢ / ΣCₛᵤᵦ × DifferenceBill
                  </code>
                  ). Cents rounding correction is allocated to ensure total apportioned equals exactly the verified difference bill.
                </span>
              ) : (
                <span>
                  The bulk difference bill is divided equally among all assigned individual sub-meter units (
                  <code className="font-mono bg-background px-1 py-0.5 rounded text-[11px] text-foreground">
                    DifferenceBill / N
                  </code>
                  ) regardless of consumption volume.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {summary && (
              <span>
                Total Apportioned:{" "}
                <strong className="text-primary font-mono">
                  ETB {summary.differenceBillAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>{" "}
                among {summary.unitCount} units
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </DialogFooter>

        {/* Hidden Printable Section */}
        <div ref={printRef} className="hidden print:block p-8 font-sans bg-white text-black text-sm">
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-lg font-bold uppercase tracking-wide">
              Addis Ababa Water and Sewerage Authority (AAWSA)
            </h1>
            <h2 className="text-sm font-semibold text-gray-700">
              Bulk Meter Difference Bill Apportionment Statement
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Bulk Meter: <strong>{bulkMeterKey}</strong> {bulkMeterName ? `(${bulkMeterName})` : ""} | Period:{" "}
              <strong>{periodLabel}</strong> | Method:{" "}
              <strong>{method === "proportional_usage" ? "Proportional Consumption" : "Equal Distribution"}</strong>
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4 p-3 bg-gray-50 border rounded text-xs mb-4">
            <div>
              <span className="text-gray-500 block">Bulk Meter Usage:</span>
              <strong className="font-mono">{summary?.bulkUsage ?? 0} m³</strong>
            </div>
            <div>
              <span className="text-gray-500 block">Submeters Sum:</span>
              <strong className="font-mono">{summary?.totalSubmeterUsage ?? 0} m³</strong>
            </div>
            <div>
              <span className="text-gray-500 block">Difference Volume:</span>
              <strong className="font-mono">{summary?.differenceUsage ?? 0} m³</strong>
            </div>
            <div>
              <span className="text-gray-500 block">Difference Bill:</span>
              <strong className="font-mono">
                ETB {(summary?.differenceBillAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="border p-1 text-center w-8">#</th>
                <th className="border p-1 text-left">Customer Key</th>
                <th className="border p-1 text-left">Customer Name</th>
                <th className="border p-1 text-right">Usage (m³)</th>
                <th className="border p-1 text-right">Share (%)</th>
                <th className="border p-1 text-right">Apportioned (ETB)</th>
                <th className="border p-1 text-right">Base Bill (ETB)</th>
                <th className="border p-1 text-right">Total Payable (ETB)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.customerKeyNumber} className="border-b border-gray-200">
                  <td className="border p-1 text-center font-mono">{idx + 1}</td>
                  <td className="border p-1 font-mono">{it.customerKeyNumber}</td>
                  <td className="border p-1">{it.name}</td>
                  <td className="border p-1 text-right font-mono">{it.ownUsage}</td>
                  <td className="border p-1 text-right font-mono">{it.sharePercentage}</td>
                  <td className="border p-1 text-right font-mono">
                    {it.apportionedDifferenceBill.toFixed(2)}
                  </td>
                  <td className="border p-1 text-right font-mono">
                    {it.ownBillAmount.toFixed(2)}
                  </td>
                  <td className="border p-1 text-right font-mono font-bold">
                    {it.totalPayable.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                <td colSpan={3} className="border p-1 text-left">
                  TOTALS ({items.length} Units)
                </td>
                <td className="border p-1 text-right font-mono">{totals.totalUsage} m³</td>
                <td className="border p-1 text-right font-mono">100.00%</td>
                <td className="border p-1 text-right font-mono">
                  {totals.totalApportioned.toFixed(2)}
                </td>
                <td className="border p-1 text-right font-mono">
                  {totals.totalOwnBills.toFixed(2)}
                </td>
                <td className="border p-1 text-right font-mono">
                  {totals.totalPayable.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="grid grid-cols-3 gap-8 mt-12 text-center text-xs pt-4 border-t">
            <div>
              <div className="border-b border-gray-400 pb-8 mb-1"></div>
              <span>Prepared By</span>
            </div>
            <div>
              <div className="border-b border-gray-400 pb-8 mb-1"></div>
              <span>Verified By</span>
            </div>
            <div>
              <div className="border-b border-gray-400 pb-8 mb-1"></div>
              <span>Approved By</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
