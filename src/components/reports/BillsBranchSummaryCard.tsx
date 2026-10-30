"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Building2,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Receipt,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle2,
  FileClock,
} from "lucide-react";
import type { BillsBranchSummaryRow } from "@/lib/db-queries";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { formatNumber } from "@/lib/format";
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

export interface BillsBranchSummaryCardProps {
  type?: "sent" | "paid" | "unsettled";
  summary: BillsBranchSummaryRow[];
  isLoading?: boolean;
  selectedMonthYear?: string;
  onMonthYearChange?: (monthYear: string) => void;
  monthOptions?: { value: string; label: string }[];
}

export function BillsBranchSummaryCard({
  type = "sent",
  summary = [],
  isLoading = false,
  selectedMonthYear = "all",
  onMonthYearChange,
  monthOptions = [],
}: BillsBranchSummaryCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Type configuration
  const config = useMemo(() => {
    switch (type) {
      case "paid":
        return {
          title: "Paid Bills Branch Summary",
          badgeText: "Paid Collections",
          description: "Overview of collected payments and settlement totals by branch and period",
          headerGradient: "from-emerald-50/90 via-teal-50/50 to-slate-50/40",
          iconBg: "bg-emerald-100 text-emerald-700",
          icon: <CheckCircle2 className="h-5 w-5" />,
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          kpi1Icon: <Receipt className="h-5 w-5" />,
          kpi1Bg: "bg-emerald-100 text-emerald-700",
          kpi1Label: "Total Paid Bills",
          kpi2Icon: <DollarSign className="h-5 w-5" />,
          kpi2Bg: "bg-teal-100 text-teal-700",
          kpi2Label: "Total Collections (ETB)",
          kpi2Text: "text-teal-950",
          kpi3Icon: <TrendingUp className="h-5 w-5" />,
          kpi3Bg: "bg-indigo-100 text-indigo-700",
          kpi3Label: "Average Payment Amount",
          exportPrefix: "AAWSA_Paid_Bills_Branch_Summary",
          exportSheet: "Paid Bills Branch Summary",
          exportBtnBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
          accentColor: "emerald",
          barColor: "bg-emerald-500",
        };
      case "unsettled":
        return {
          title: "Unsettled Bills Branch Summary",
          badgeText: "Pending Settlements",
          description: "Overview of outstanding bills and pending settlement totals by branch and period",
          headerGradient: "from-amber-50/90 via-orange-50/50 to-slate-50/40",
          iconBg: "bg-amber-100 text-amber-700",
          icon: <FileClock className="h-5 w-5" />,
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          kpi1Icon: <FileClock className="h-5 w-5" />,
          kpi1Bg: "bg-amber-100 text-amber-700",
          kpi1Label: "Total Unsettled Bills",
          kpi2Icon: <DollarSign className="h-5 w-5" />,
          kpi2Bg: "bg-orange-100 text-orange-700",
          kpi2Label: "Total Outstanding Amount (ETB)",
          kpi2Text: "text-orange-950",
          kpi3Icon: <TrendingUp className="h-5 w-5" />,
          kpi3Bg: "bg-rose-100 text-rose-700",
          kpi3Label: "Average Unsettled Amount",
          exportPrefix: "AAWSA_Unsettled_Bills_Branch_Summary",
          exportSheet: "Unsettled Bills Branch Summary",
          exportBtnBg: "bg-amber-600 hover:bg-amber-700 text-white",
          accentColor: "amber",
          barColor: "bg-amber-500",
        };
      case "sent":
      default:
        return {
          title: "Branch Summary Report",
          badgeText: "Sent Bills",
          description: "Overview of sent bills and financial dispatch totals by branch and period",
          headerGradient: "from-blue-50/90 via-indigo-50/50 to-slate-50/40",
          iconBg: "bg-indigo-100 text-indigo-700",
          icon: <Building2 className="h-5 w-5" />,
          badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
          kpi1Icon: <Receipt className="h-5 w-5" />,
          kpi1Bg: "bg-blue-100 text-blue-700",
          kpi1Label: "Total Number of Bills",
          kpi2Icon: <DollarSign className="h-5 w-5" />,
          kpi2Bg: "bg-emerald-100 text-emerald-700",
          kpi2Label: "Total Amount (ETB)",
          kpi2Text: "text-emerald-950",
          kpi3Icon: <TrendingUp className="h-5 w-5" />,
          kpi3Bg: "bg-purple-100 text-purple-700",
          kpi3Label: "Average Sent Bill Amount",
          exportPrefix: "AAWSA_Sent_Bills_Branch_Summary",
          exportSheet: "Sent Bills Branch Summary",
          exportBtnBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
          accentColor: "indigo",
          barColor: "bg-indigo-500",
        };
    }
  }, [type]);

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonthYear === "all") return "All Available Months";
    const found = monthOptions.find((m) => m.value === selectedMonthYear);
    return found ? found.label : selectedMonthYear;
  }, [selectedMonthYear, monthOptions]);

  // Aggregate totals
  const totals = useMemo(() => {
    return summary.reduce(
      (acc, r) => {
        acc.totalBills += r.billCount;
        acc.totalAmount += r.totalAmount;
        return acc;
      },
      { totalBills: 0, totalAmount: 0 }
    );
  }, [summary]);

  const handleExportXLSX = () => {
    if (summary.length === 0) {
      toast({ title: "No Data", description: "No summary rows to export." });
      return;
    }
    try {
      const exportData = summary.map((r) => ({
        "Branch Code": r.branchCode,
        "Branch Name": r.branchName,
        "Period": r.period || formatPeriod(selectedMonthYear),
        "Number of Bills (Count)": r.billCount,
        "Total Amount (ETB)": r.totalAmount,
        "Share (%)": totals.totalAmount > 0 ? `${((r.totalAmount / totals.totalAmount) * 100).toFixed(2)}%` : "0%",
      }));

      // Add Grand Total row
      exportData.push({
        "Branch Code": "TOTAL",
        "Branch Name": `All Branches (${summary.length} rows)`,
        "Period": selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All Periods",
        "Number of Bills (Count)": totals.totalBills,
        "Total Amount (ETB)": parseFloat(totals.totalAmount.toFixed(2)),
        "Share (%)": "100%",
      });

      const headers = ["Branch Code", "Branch Name", "Period", "Number of Bills (Count)", "Total Amount (ETB)", "Share (%)"];
      const blob = arrayToXlsxBlob(exportData, headers, config.exportSheet);
      const filename = `${config.exportPrefix}_${selectedMonthYear}_${new Date().toISOString().split("T")[0]}.xlsx`;
      downloadFile(blob, filename);

      toast({ title: "Export Complete", description: "Branch summary downloaded as Excel." });
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message, variant: "destructive" });
    }
  };

  const handleExportCSV = () => {
    if (summary.length === 0) return;
    try {
      const exportData = summary.map((r) => ({
        "BRANCH_CODE": r.branchCode,
        "BRANCH_NAME": r.branchName,
        "PERIOD": r.period || formatPeriod(selectedMonthYear),
        "COUNT": r.billCount,
        "TOTAL_AMOUNT_ETB": r.totalAmount,
        "SHARE_PERCENT": totals.totalAmount > 0 ? `${((r.totalAmount / totals.totalAmount) * 100).toFixed(2)}%` : "0%",
      }));
      const headers = ["BRANCH_CODE", "BRANCH_NAME", "PERIOD", "COUNT", "TOTAL_AMOUNT_ETB", "SHARE_PERCENT"];
      const blob = arrayToCsvBlob(exportData, headers);
      downloadFile(blob, `${config.exportPrefix.toLowerCase()}_${selectedMonthYear}_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "CSV Downloaded", description: "Branch summary downloaded as CSV." });
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCopy = () => {
    if (summary.length === 0) return;
    const header = "BRANCH\tPERIOD\tCOUNT\tTOTAL_AMOUNT_ETB\tSHARE_%";
    const rows = summary.map(
      (r) =>
        `${r.branchName} (${r.branchCode})\t${r.period || formatPeriod(selectedMonthYear)}\t${r.billCount}\t${r.totalAmount}\t${
          totals.totalAmount > 0 ? ((r.totalAmount / totals.totalAmount) * 100).toFixed(2) : 0
        }%`
    );
    rows.push(
      `TOTAL\t${selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All"}\t${totals.totalBills}\t${totals.totalAmount.toFixed(2)}\t100%`
    );
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast({ title: "Copied to Clipboard", description: "Ready to paste into Excel." });
  };

  return (
    <Card className="shadow-md border-slate-200/80 overflow-hidden rounded-3xl bg-white">
      {/* ── Header ── */}
      <CardHeader className={`bg-gradient-to-r ${config.headerGradient} border-b pb-4 pt-5 px-6`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-2xl ${config.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold text-slate-900">
                  {config.title}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`${config.badgeClass} font-bold text-[11px] px-2 py-0.5`}
                >
                  {summary.length} {summary.length === 1 ? "Row" : "Rows"}
                </Badge>
                {selectedMonthYear !== "all" && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[11px] px-2.5 py-0.5 font-mono"
                  >
                    Period: {formatPeriod(selectedMonthYear)}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                {config.description} · {selectedMonthLabel}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
            {/* Period (Month Selection / Filter) */}
            {onMonthYearChange && monthOptions.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Period:</span>
                <Select
                  value={selectedMonthYear || "all"}
                  onValueChange={onMonthYearChange}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-7 border-0 bg-transparent shadow-none px-1 text-xs font-bold text-indigo-950 focus:ring-0 min-w-[130px]">
                    <SelectValue placeholder="All Periods" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[300px]">
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              disabled={summary.length === 0}
              className="h-9 px-2.5 text-xs rounded-xl bg-white border-slate-200 text-slate-700 shadow-sm"
              title="Copy as TSV"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {isCopied ? "Copied" : "Copy"}
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              disabled={summary.length === 0}
              className="h-9 px-2.5 text-xs rounded-xl bg-white border-slate-200 text-slate-700 shadow-sm"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button
              onClick={handleExportXLSX}
              size="sm"
              disabled={summary.length === 0}
              className={`h-9 px-3 text-xs rounded-xl ${config.exportBtnBg} font-semibold shadow-sm`}
              title="Export Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export Excel
            </Button>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-xl text-slate-500 hover:text-slate-800"
              title={isExpanded ? "Collapse Summary" : "Expand Summary"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* ── Collapsible Body ── */}
      {isExpanded && (
        <CardContent className="p-0">
          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-slate-100 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/50">
            <div className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${config.kpi1Bg} flex items-center justify-center shrink-0`}>
                {config.kpi1Icon}
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  {config.kpi1Label}
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {formatNumber(totals.totalBills)}
                </div>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${config.kpi2Bg} flex items-center justify-center shrink-0`}>
                {config.kpi2Icon}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {config.kpi2Label}
                </div>
                <div className={`text-xl font-bold font-mono ${config.kpi2Text}`}>
                  ETB {formatNumber(totals.totalAmount)}
                </div>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${config.kpi3Bg} flex items-center justify-center shrink-0`}>
                {config.kpi3Icon}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {config.kpi3Label}
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  ETB{" "}
                  {totals.totalBills > 0
                    ? formatNumber(totals.totalAmount / totals.totalBills)
                    : "0.00"}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200 text-xs">
                  <TableHead className="font-bold text-slate-700 h-10 w-52">
                    Branch
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 h-10 w-32 text-center">
                    Period
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 h-10 text-right w-44">
                    Number of Bills (Count)
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 h-10 text-right w-48">
                    Total Amount (ETB)
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 h-10 text-right w-36">
                    Share (%)
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx} className="animate-pulse border-b border-slate-100">
                      <TableCell><div className="h-4 bg-slate-200 rounded w-32" /></TableCell>
                      <TableCell className="text-center"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 bg-slate-200 rounded w-28 ml-auto" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : summary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-xs text-slate-400">
                      No records found matching your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.map((row, idx) => {
                    const share = totals.totalAmount > 0 ? (row.totalAmount / totals.totalAmount) * 100 : 0;
                    return (
                      <TableRow
                        key={`${row.branchId || row.branchName}-${row.period || idx}`}
                        className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs"
                      >
                        {/* Branch */}
                        <TableCell className="py-2.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold font-mono text-[11px]">
                              {row.branchCode}
                            </span>
                            <span>{row.branchName}</span>
                          </div>
                        </TableCell>

                        {/* Period */}
                        <TableCell className="py-2.5 text-center font-mono">
                          <Badge
                            variant="outline"
                            className={`${config.badgeClass} font-bold font-mono text-[11px] px-2 py-0.5`}
                          >
                            {row.period || (selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All")}
                          </Badge>
                        </TableCell>

                        {/* Number of Bills (Count) */}
                        <TableCell className="py-2.5 text-right font-mono font-bold text-slate-800">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/60">
                            {formatNumber(row.billCount)}
                          </span>
                        </TableCell>

                        {/* Total Amount (ETB) */}
                        <TableCell className="py-2.5 text-right font-mono font-bold text-emerald-900">
                          ETB{" "}
                          {row.totalAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>

                        {/* Share */}
                        <TableCell className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full ${config.barColor} rounded-full transition-all`}
                                style={{ width: `${Math.min(100, Math.max(3, share))}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-slate-600">
                              {share.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>

              {/* Grand Total Footer */}
              {!isLoading && summary.length > 0 && (
                <tfoot>
                  <TableRow className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300 font-mono">
                    <TableCell className="py-3 text-slate-900 font-black">
                      TOTAL ({summary.length} {summary.length === 1 ? "Row" : "Rows"})
                    </TableCell>
                    <TableCell className="py-3 text-center text-indigo-700 font-bold font-mono text-[11px]">
                      {selectedMonthYear !== "all" ? formatPeriod(selectedMonthYear) : "All Periods"}
                    </TableCell>
                    <TableCell className="py-3 text-right font-black text-slate-900">
                      {formatNumber(totals.totalBills)}
                    </TableCell>
                    <TableCell className="py-3 text-right font-black text-emerald-700">
                      ETB{" "}
                      {totals.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="py-3 text-right text-slate-700 font-black">
                      100.0%
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
