"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Calendar,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  TrendingUp,
  Receipt,
  DollarSign,
  CheckCircle2,
  FileClock,
  Layers,
  ChevronDown,
  BarChart3,
  Percent,
  Truck,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import type { BillsBranchSummaryRow } from "@/lib/db-queries";
import { multiSheetToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { formatNumber } from "@/lib/format";
import { BillingSummaryPrintDialog } from "@/components/reports/BillingSummaryPrintDialog";
import { useToast } from "@/hooks/use-toast";

const formatPeriod = (monthYearStr?: string) => {
  if (!monthYearStr || monthYearStr === "all") return "All Periods";
  const clean = String(monthYearStr).trim();
  if (!clean.includes("-")) return clean;
  const [yr, mo] = clean.split("-").map(Number);
  if (!yr || !mo) return clean;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mName = monthNames[mo - 1] || "Jan";
  const shortYr = String(yr).slice(-2);
  return `${shortYr}-${mName}`;
};

export interface BillingSummaryReportContentProps {
  deliveryData: BillsBranchSummaryRow[];
  paidData: BillsBranchSummaryRow[];
  unsettledData: BillsBranchSummaryRow[];
  isLoading: boolean;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  selectedMonthYear: string;
  onMonthYearChange: (monthYear: string) => void;
  branches: { id: string; name: string }[];
  monthOptions: { value: string; label: string }[];
  canSelectBranch: boolean;
  assignedBranchName?: string;
  onRefresh: () => void;
}

export function BillingSummaryReportContent({
  deliveryData = [],
  paidData = [],
  unsettledData = [],
  isLoading = false,
  selectedBranchId = "all",
  onBranchChange,
  selectedMonthYear = "all",
  onMonthYearChange,
  branches = [],
  monthOptions = [],
  canSelectBranch = true,
  assignedBranchName,
  onRefresh,
}: BillingSummaryReportContentProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all_in_one" | "consolidated" | "delivery" | "paid" | "unsettled">("all_in_one");
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  // Filter rows by branch search term
  const filterRows = useCallback((rows: BillsBranchSummaryRow[]) => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.branchName.toLowerCase().includes(term) ||
        r.branchCode.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredDelivery = useMemo(() => filterRows(deliveryData), [filterRows, deliveryData]);
  const filteredPaid = useMemo(() => filterRows(paidData), [filterRows, paidData]);
  const filteredUnsettled = useMemo(() => filterRows(unsettledData), [filterRows, unsettledData]);

  // Aggregate totals
  const totals = useMemo(() => {
    const calc = (rows: BillsBranchSummaryRow[]) =>
      rows.reduce(
        (acc, r) => ({
          bills: acc.bills + (Number(r.billCount) || 0),
          amount: acc.amount + (Number(r.totalAmount) || 0),
        }),
        { bills: 0, amount: 0 }
      );

    const deliveryTotals = calc(filteredDelivery);
    const paidTotals = calc(filteredPaid);
    const unsettledTotals = calc(filteredUnsettled);

    const collectionRate =
      deliveryTotals.amount > 0 ? (paidTotals.amount / deliveryTotals.amount) * 100 : 0;
    const unsettledRate =
      deliveryTotals.amount > 0 ? (unsettledTotals.amount / deliveryTotals.amount) * 100 : 0;

    return {
      delivery: deliveryTotals,
      paid: paidTotals,
      unsettled: unsettledTotals,
      collectionRate,
      unsettledRate,
    };
  }, [filteredDelivery, filteredPaid, filteredUnsettled]);

  // Consolidated comparison rows by branch
  const consolidatedRows = useMemo(() => {
    const branchMap = new Map<
      string,
      {
        branchName: string;
        branchCode: string;
        period: string;
        deliveryBills: number;
        deliveryAmount: number;
        paidBills: number;
        paidAmount: number;
        unsettledBills: number;
        unsettledAmount: number;
      }
    >();

    const getBranchKey = (r: BillsBranchSummaryRow) => `${r.branchId || r.branchName}_${r.period || "all"}`;

    filteredDelivery.forEach((r) => {
      const key = getBranchKey(r);
      const existing = branchMap.get(key) || {
        branchName: r.branchName,
        branchCode: r.branchCode,
        period: r.period || (selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All"),
        deliveryBills: 0,
        deliveryAmount: 0,
        paidBills: 0,
        paidAmount: 0,
        unsettledBills: 0,
        unsettledAmount: 0,
      };
      existing.deliveryBills += Number(r.billCount) || 0;
      existing.deliveryAmount += Number(r.totalAmount) || 0;
      branchMap.set(key, existing);
    });

    filteredPaid.forEach((r) => {
      const key = getBranchKey(r);
      const existing = branchMap.get(key) || {
        branchName: r.branchName,
        branchCode: r.branchCode,
        period: r.period || (selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All"),
        deliveryBills: 0,
        deliveryAmount: 0,
        paidBills: 0,
        paidAmount: 0,
        unsettledBills: 0,
        unsettledAmount: 0,
      };
      existing.paidBills += Number(r.billCount) || 0;
      existing.paidAmount += Number(r.totalAmount) || 0;
      branchMap.set(key, existing);
    });

    filteredUnsettled.forEach((r) => {
      const key = getBranchKey(r);
      const existing = branchMap.get(key) || {
        branchName: r.branchName,
        branchCode: r.branchCode,
        period: r.period || (selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All"),
        deliveryBills: 0,
        deliveryAmount: 0,
        paidBills: 0,
        paidAmount: 0,
        unsettledBills: 0,
        unsettledAmount: 0,
      };
      existing.unsettledBills += Number(r.billCount) || 0;
      existing.unsettledAmount += Number(r.totalAmount) || 0;
      branchMap.set(key, existing);
    });

    return Array.from(branchMap.values()).sort((a, b) => b.deliveryAmount - a.deliveryAmount);
  }, [filteredDelivery, filteredPaid, filteredUnsettled, selectedMonthYear]);

  // Export handlers
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const headers = ["Branch Code", "Branch Name", "Period", "Number of Bills", "Total Amount (ETB)"];

      const mapRows = (rows: BillsBranchSummaryRow[]) =>
        rows.map((r) => ({
          "Branch Code": r.branchCode,
          "Branch Name": r.branchName,
          Period: r.period || (selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All Periods"),
          "Number of Bills": r.billCount,
          "Total Amount (ETB)": r.totalAmount,
        }));

      const consolidatedHeaders = [
        "Branch Code",
        "Branch Name",
        "Period",
        "Delivery Bills",
        "Delivery Amount (ETB)",
        "Paid Bills",
        "Paid Amount (ETB)",
        "Unsettled Bills",
        "Unsettled Amount (ETB)",
        "Collection Rate (%)",
      ];

      const consolidatedExportData = consolidatedRows.map((r) => ({
        "Branch Code": r.branchCode,
        "Branch Name": r.branchName,
        Period: r.period,
        "Delivery Bills": r.deliveryBills,
        "Delivery Amount (ETB)": r.deliveryAmount,
        "Paid Bills": r.paidBills,
        "Paid Amount (ETB)": r.paidAmount,
        "Unsettled Bills": r.unsettledBills,
        "Unsettled Amount (ETB)": r.unsettledAmount,
        "Collection Rate (%)":
          r.deliveryAmount > 0 ? ((r.paidAmount / r.deliveryAmount) * 100).toFixed(1) + "%" : "0.0%",
      }));

      const blob = multiSheetToXlsxBlob([
        {
          sheetName: "Consolidated Summary",
          headers: consolidatedHeaders,
          data: consolidatedExportData,
        },
        {
          sheetName: "Total Delivery",
          headers,
          data: mapRows(filteredDelivery),
        },
        {
          sheetName: "Total Paid",
          headers,
          data: mapRows(filteredPaid),
        },
        {
          sheetName: "Total Unsettled",
          headers,
          data: mapRows(filteredUnsettled),
        },
      ]);

      const periodLabel = selectedMonthYear !== "all" ? selectedMonthYear : "All_Periods";
      downloadFile(blob, `AAWSA_Billing_Summary_Report_${periodLabel}.xlsx`);
      toast({
        title: "Excel Export Complete",
        description: "Summary report workbook generated with Delivery, Paid, and Unsettled sheets.",
      });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate Excel report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      const headers = [
        "Branch Code",
        "Branch Name",
        "Period",
        "Delivery Bills",
        "Delivery Amount (ETB)",
        "Paid Bills",
        "Paid Amount (ETB)",
        "Unsettled Bills",
        "Unsettled Amount (ETB)",
        "Collection Rate (%)",
      ];

      const data = consolidatedRows.map((r) => ({
        "Branch Code": r.branchCode,
        "Branch Name": r.branchName,
        Period: r.period,
        "Delivery Bills": r.deliveryBills,
        "Delivery Amount (ETB)": r.deliveryAmount,
        "Paid Bills": r.paidBills,
        "Paid Amount (ETB)": r.paidAmount,
        "Unsettled Bills": r.unsettledBills,
        "Unsettled Amount (ETB)": r.unsettledAmount,
        "Collection Rate (%)":
          r.deliveryAmount > 0 ? ((r.paidAmount / r.deliveryAmount) * 100).toFixed(1) + "%" : "0.0%",
      }));

      const blob = arrayToCsvBlob(data, headers);
      const periodLabel = selectedMonthYear !== "all" ? selectedMonthYear : "All_Periods";
      downloadFile(blob, `AAWSA_Billing_Summary_Report_${periodLabel}.csv`);
      toast({
        title: "CSV Export Complete",
        description: "Summary report CSV generated successfully.",
      });
    } catch (err: any) {
      console.error("CSV Export error:", err);
      toast({
        title: "Export Failed",
        description: err.message || "Failed to generate CSV report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonthYear || selectedMonthYear === "all") return "All Periods";
    const found = monthOptions.find((m) => m.value === selectedMonthYear);
    return found ? found.label : selectedMonthYear;
  }, [selectedMonthYear, monthOptions]);

  const selectedBranchLabel = useMemo(() => {
    if (!canSelectBranch) return assignedBranchName || "Your Branch";
    if (!selectedBranchId || selectedBranchId === "all") return "All Branches";
    const found = branches.find((b) => String(b.id) === String(selectedBranchId));
    return found ? found.name : "Selected Branch";
  }, [canSelectBranch, assignedBranchName, selectedBranchId, branches]);

  // Reusable Section Table Component
  const renderSummaryTable = (
    title: string,
    badgeText: string,
    theme: "indigo" | "emerald" | "amber",
    icon: React.ReactNode,
    rows: BillsBranchSummaryRow[],
    totalBills: number,
    totalAmount: number
  ) => {
    const themeStyles = {
      indigo: {
        gradient: "from-blue-50/90 via-indigo-50/50 to-slate-50/40",
        border: "border-blue-200/80",
        iconBg: "bg-blue-100 text-blue-700",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        barColor: "bg-blue-600",
        accentText: "text-blue-900",
        amountColor: "text-blue-950",
      },
      emerald: {
        gradient: "from-emerald-50/90 via-teal-50/50 to-slate-50/40",
        border: "border-emerald-200/80",
        iconBg: "bg-emerald-100 text-emerald-700",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        barColor: "bg-emerald-600",
        accentText: "text-emerald-900",
        amountColor: "text-emerald-950",
      },
      amber: {
        gradient: "from-amber-50/90 via-orange-50/50 to-slate-50/40",
        border: "border-amber-200/80",
        iconBg: "bg-amber-100 text-amber-700",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        barColor: "bg-amber-600",
        accentText: "text-amber-900",
        amountColor: "text-amber-950",
      },
    }[theme];

    return (
      <Card className={`shadow-sm border ${themeStyles.border} overflow-hidden rounded-2xl bg-white`}>
        <CardHeader className={`bg-gradient-to-r ${themeStyles.gradient} border-b border-slate-100 py-3.5 px-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${themeStyles.iconBg} shadow-sm shrink-0`}>
                {icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{title}</h3>
                  <Badge variant="outline" className={`${themeStyles.badgeClass} font-semibold text-[11px]`}>
                    {badgeText}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {rows.length} {rows.length === 1 ? "branch entry" : "branch entries"} matching current filters
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Subtotal</span>
              <span className={`text-sm font-mono font-black ${themeStyles.amountColor}`}>
                ETB {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/90 text-[11px] uppercase tracking-wider text-slate-600">
                <TableRow className="border-b border-slate-200/80">
                  <TableHead className="w-[32%] py-2.5 pl-5 font-bold">Branch</TableHead>
                  <TableHead className="w-[18%] py-2.5 text-right font-bold">Number of Bills</TableHead>
                  <TableHead className="w-[18%] py-2.5 text-center font-bold">Period</TableHead>
                  <TableHead className="w-[22%] py-2.5 text-right font-bold">Total Amount in ETB</TableHead>
                  <TableHead className="w-[10%] py-2.5 text-right pr-5 font-bold">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Loading report data...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No records found matching current criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, idx) => {
                    const share = totalAmount > 0 ? (row.totalAmount / totalAmount) * 100 : 0;
                    return (
                      <TableRow
                        key={`${row.branchId || row.branchName}-${row.period || idx}`}
                        className="hover:bg-slate-50/70 border-b border-slate-100 text-xs transition-colors"
                      >
                        <TableCell className="py-2.5 pl-5 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-slate-700 font-mono font-bold text-[10px]">
                              {row.branchCode}
                            </span>
                            <span>{row.branchName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono font-bold text-slate-700">
                          {formatNumber(row.billCount)}
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge variant="outline" className={`${themeStyles.badgeClass} font-mono text-[10px] px-2 py-0.5`}>
                            {row.period || (selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                          ETB {row.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-2.5 pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full ${themeStyles.barColor} rounded-full`}
                                style={{ width: `${Math.min(100, Math.max(3, share))}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-slate-500">
                              {share.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {!isLoading && rows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-slate-100/90 font-mono font-bold text-xs border-t-2 border-slate-300">
                    <TableCell className="py-3 pl-5 text-slate-900 font-black">
                      TOTAL ({rows.length} {rows.length === 1 ? "Branch" : "Branches"})
                    </TableCell>
                    <TableCell className="py-3 text-right font-black text-slate-900">
                      {formatNumber(totalBills)}
                    </TableCell>
                    <TableCell className="py-3 text-center text-slate-600 font-bold font-mono text-[11px]">
                      {selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All Periods"}
                    </TableCell>
                    <TableCell className={`py-3 text-right font-black ${themeStyles.amountColor}`}>
                      ETB {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 pr-5 text-right font-black text-slate-700">
                      100.0%
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #billing-summary-printable,
          #billing-summary-printable * {
            visibility: visible;
          }
          #billing-summary-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Billing Summary Report
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Consolidated view combining Total Delivery, Total Paid, and Total Unsettled billing metrics by branch.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 gap-2 font-semibold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintDialogOpen(true)}
            className="h-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 gap-2 font-semibold text-slate-700"
          >
            <Printer className="h-4 w-4 text-blue-600" />
            <span>Print / PDF Summary</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isExporting || isLoading}
                className="h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm gap-2 font-semibold px-4"
              >
                <Download className="h-4 w-4" />
                <span>Export Report</span>
                <ChevronDown className="h-4 w-4 ml-1 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
              <DropdownMenuItem onClick={() => setIsPrintDialogOpen(true)} className="cursor-pointer gap-2 py-2.5 font-medium border-b border-slate-100">
                <Printer className="h-4 w-4 text-indigo-600" />
                <span>Print / Save PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer gap-2 py-2.5 font-medium">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Export Excel (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} className="cursor-pointer gap-2 py-2.5 font-medium">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Export CSV (.csv)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm no-print">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search branch code or name..."
                className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50/70 focus:bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
              {/* Branch Filter */}
              {canSelectBranch ? (
                <div className="w-full sm:w-[220px]">
                  <Select value={selectedBranchId} onValueChange={onBranchChange}>
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white shadow-sm font-medium">
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                        <SelectValue placeholder="All Branches" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-[300px]">
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={String(b.id)} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-slate-400 font-medium">Branch:</span>
                  <span className="text-slate-900">{assignedBranchName || "Your Branch"}</span>
                </div>
              )}

              {/* Month / Period Filter */}
              <div className="w-full sm:w-[200px]">
                <Select value={selectedMonthYear} onValueChange={onMonthYearChange}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white shadow-sm font-medium">
                    <div className="flex items-center gap-2 truncate">
                      <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                      <SelectValue placeholder="All Months" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[300px]">
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View Selector Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveTab("all_in_one")}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "all_in_one"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  All in One
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveTab("consolidated")}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "consolidated"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Percent className="h-3.5 w-3.5 mr-1.5" />
                  Comparison
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveTab("delivery")}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "delivery"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Delivery
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveTab("paid")}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "paid"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Paid
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveTab("unsettled")}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "unsettled"
                      ? "bg-white text-amber-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Unsettled
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Printable Container */}
      <div id="billing-summary-printable" className="space-y-6">
        {/* Printable Official Header (Shown during printing or atop container) */}
        <div className="hidden print:block p-4 border-b border-slate-300">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                Addis Ababa Water and Sewerage Authority (AAWSA)
              </h1>
              <h2 className="text-base font-semibold text-slate-700 mt-0.5">
                Billing Summary Report — Delivery, Paid & Unsettled
              </h2>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <p>Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
              <p>Period: {selectedMonthLabel}</p>
              <p>Branch: {selectedBranchLabel}</p>
            </div>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Delivery */}
          <Card className="rounded-2xl border-blue-200/70 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
            <CardContent className="p-4 pl-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Total Delivery</span>
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 font-mono font-black text-xl text-slate-900">
                ETB {totals.delivery.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{formatNumber(totals.delivery.bills)} total bills</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-bold">
                  Posted & Active
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Total Paid */}
          <Card className="rounded-2xl border-emerald-200/70 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600" />
            <CardContent className="p-4 pl-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Total Paid</span>
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 font-mono font-black text-xl text-slate-900">
                ETB {totals.paid.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{formatNumber(totals.paid.bills)} settled bills</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                  {totals.collectionRate.toFixed(1)}% Collected
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Total Unsettled */}
          <Card className="rounded-2xl border-amber-200/70 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-white shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-600" />
            <CardContent className="p-4 pl-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Total Unsettled</span>
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <FileClock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 font-mono font-black text-xl text-slate-900">
                ETB {totals.unsettled.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{formatNumber(totals.unsettled.bills)} pending bills</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-bold">
                  {totals.unsettledRate.toFixed(1)}% Outstanding
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Collection Rate & Health */}
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-900" />
            <CardContent className="p-4 pl-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Recovery Rate</span>
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 font-mono font-black text-xl text-indigo-950 flex items-baseline gap-2">
                <span>{totals.collectionRate.toFixed(1)}%</span>
                <span className="text-xs font-semibold text-slate-400">efficiency</span>
              </div>
              <div className="mt-2">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, totals.collectionRate))}%` }}
                    title={`Paid: ${totals.collectionRate.toFixed(1)}%`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, totals.unsettledRate))}%` }}
                    title={`Unsettled: ${totals.unsettledRate.toFixed(1)}%`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION VIEW: All in One (Stacked) */}
        {(activeTab === "all_in_one" || activeTab === "delivery") && (
          <div className="space-y-6">
            {renderSummaryTable(
              "Total Delivery Summary",
              "Delivered / Posted Bills",
              "indigo",
              <Truck className="h-5 w-5" />,
              filteredDelivery,
              totals.delivery.bills,
              totals.delivery.amount
            )}
          </div>
        )}

        {(activeTab === "all_in_one" || activeTab === "paid") && (
          <div className="space-y-6">
            {renderSummaryTable(
              "Total Paid Summary",
              "Collected Payments",
              "emerald",
              <CheckCircle2 className="h-5 w-5" />,
              filteredPaid,
              totals.paid.bills,
              totals.paid.amount
            )}
          </div>
        )}

        {(activeTab === "all_in_one" || activeTab === "unsettled") && (
          <div className="space-y-6">
            {renderSummaryTable(
              "Total Unsettled Summary",
              "Pending Settlements",
              "amber",
              <FileClock className="h-5 w-5" />,
              filteredUnsettled,
              totals.unsettled.bills,
              totals.unsettled.amount
            )}
          </div>
        )}

        {/* SECTION VIEW: Consolidated Comparison Table */}
        {(activeTab === "consolidated" || activeTab === "all_in_one") && (
          <Card className="shadow-sm border border-slate-200 overflow-hidden rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 py-3.5 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-900 text-white shadow-sm shrink-0">
                    <Percent className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Consolidated Branch Comparison</h3>
                    <p className="text-xs text-slate-500">
                      Cross-sectional comparison of Delivery vs Paid vs Unsettled metrics per branch
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 font-mono text-xs font-bold">
                  {consolidatedRows.length} Branches
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-100/90 text-[11px] uppercase tracking-wider text-slate-600">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="py-2.5 pl-5 font-bold" rowSpan={2}>Branch</TableHead>
                      <TableHead className="py-2.5 text-center font-bold" rowSpan={2}>Period</TableHead>
                      <TableHead className="py-2 text-center font-bold bg-blue-50/60 text-blue-900 border-l border-r border-blue-100" colSpan={2}>
                        Total Delivery
                      </TableHead>
                      <TableHead className="py-2 text-center font-bold bg-emerald-50/60 text-emerald-900 border-r border-emerald-100" colSpan={2}>
                        Total Paid
                      </TableHead>
                      <TableHead className="py-2 text-center font-bold bg-amber-50/60 text-amber-900 border-r border-amber-100" colSpan={2}>
                        Total Unsettled
                      </TableHead>
                      <TableHead className="py-2.5 pr-5 text-right font-bold" rowSpan={2}>Recovery %</TableHead>
                    </TableRow>
                    <TableRow className="border-b border-slate-200 text-[10px]">
                      <TableHead className="py-1.5 text-right font-semibold bg-blue-50/40 text-blue-800 border-l border-blue-100">Bills</TableHead>
                      <TableHead className="py-1.5 text-right font-semibold bg-blue-50/40 text-blue-800 border-r border-blue-100">Amount (ETB)</TableHead>
                      <TableHead className="py-1.5 text-right font-semibold bg-emerald-50/40 text-emerald-800">Bills</TableHead>
                      <TableHead className="py-1.5 text-right font-semibold bg-emerald-50/40 text-emerald-800 border-r border-emerald-100">Amount (ETB)</TableHead>
                      <TableHead className="py-1.5 text-right font-semibold bg-amber-50/40 text-amber-800">Bills</TableHead>
                      <TableHead className="py-1.5 text-right font-semibold bg-amber-50/40 text-amber-800 border-r border-amber-100">Amount (ETB)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-slate-400">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                          Loading comparison matrix...
                        </TableCell>
                      </TableRow>
                    ) : consolidatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                          No data available for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      consolidatedRows.map((r, idx) => {
                        const recRate = r.deliveryAmount > 0 ? (r.paidAmount / r.deliveryAmount) * 100 : 0;
                        return (
                          <TableRow key={`${r.branchCode}-${idx}`} className="hover:bg-slate-50/80 border-b border-slate-100 text-xs font-mono">
                            <TableCell className="py-2.5 pl-5 font-semibold text-slate-800 font-sans">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-[10px]">
                                  {r.branchCode}
                                </span>
                                <span>{r.branchName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-center text-slate-500 text-[11px]">
                              {r.period}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-blue-900 border-l border-blue-50">
                              {formatNumber(r.deliveryBills)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-bold text-blue-950 border-r border-blue-50">
                              ETB {r.deliveryAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-emerald-900">
                              {formatNumber(r.paidBills)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-bold text-emerald-950 border-r border-emerald-50">
                              ETB {r.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-amber-900">
                              {formatNumber(r.unsettledBills)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-bold text-amber-950 border-r border-amber-50">
                              ETB {r.unsettledAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="py-2.5 pr-5 text-right">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.5 ${
                                  recRate >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : recRate >= 50
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {recRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                  {!isLoading && consolidatedRows.length > 0 && (
                    <tfoot>
                      <TableRow className="bg-slate-100 font-mono font-bold text-xs border-t-2 border-slate-300">
                        <TableCell className="py-3 pl-5 text-slate-900 font-black font-sans">
                          TOTAL ({consolidatedRows.length} Branches)
                        </TableCell>
                        <TableCell className="py-3 text-center text-slate-600 font-mono text-[11px]">
                          {selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All Periods"}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-blue-950 border-l border-slate-200">
                          {formatNumber(totals.delivery.bills)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-blue-950 border-r border-slate-200">
                          ETB {totals.delivery.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-emerald-950">
                          {formatNumber(totals.paid.bills)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-emerald-950 border-r border-slate-200">
                          ETB {totals.paid.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-amber-950">
                          {formatNumber(totals.unsettled.bills)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-amber-950 border-r border-slate-200">
                          ETB {totals.unsettled.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-3 pr-5 text-right font-black text-indigo-950">
                          {totals.collectionRate.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BillingSummaryPrintDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        deliveryData={deliveryData}
        paidData={paidData}
        unsettledData={unsettledData}
        branchFilterName={selectedBranchLabel}
        monthYearFilter={selectedMonthLabel}
        searchTerm={searchTerm}
      />
    </div>
  );
}

