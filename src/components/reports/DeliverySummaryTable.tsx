"use client";

import React, { useState, useMemo } from "react";
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
  Building2,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Search,
  RotateCcw,
  Receipt,
  DollarSign,
  Layers,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  Printer,
  Sparkles,
} from "lucide-react";
import type { DeliverySummaryRow } from "@/lib/db-queries";
import { downloadFile } from "@/lib/xlsx";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (val: number | undefined | null): string => {
  const n = Number(val || 0);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatCount = (val: number | undefined | null): string => {
  const n = Number(val || 0);
  return n.toLocaleString("en-US");
};

export interface DeliverySummaryTableProps {
  data: DeliverySummaryRow[];
  isLoading?: boolean;
  selectedMonthYear: string;
  onMonthYearChange: (monthYear: string) => void;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  selectedChargeGroup: string;
  onChargeGroupChange: (group: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  branches: { id: string; name: string }[];
  monthOptions: { value: string; label: string }[];
  canSelectBranch?: boolean;
  latestMonth?: string;
}

export function DeliverySummaryTable({
  data,
  isLoading = false,
  selectedMonthYear,
  onMonthYearChange,
  selectedBranchId,
  onBranchChange,
  selectedChargeGroup,
  onChargeGroupChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  branches,
  monthOptions,
  canSelectBranch = true,
  latestMonth,
}: DeliverySummaryTableProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [sortField, setSortField] = useState<keyof DeliverySummaryRow>("period");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Sorting
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA || "").localeCompare(String(valB || ""))
        : String(valB || "").localeCompare(String(valA || ""));
    });
  }, [data, sortField, sortAsc]);

  const handleSort = (field: keyof DeliverySummaryRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Grand totals
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => {
        acc.numberOfBills += row.numberOfBills || 0;
        acc.waterConsumption += row.waterConsumption || 0;
        acc.meterRent += row.meterRent || 0;
        acc.sanitation += row.sanitation || 0;
        acc.sewrage += row.sewrage || 0;
        acc.maintenance += row.maintenance || 0;
        acc.vatAmount += row.vatAmount || 0;
        acc.billAmount += row.billAmount || 0;
        acc.debit30 += row.debit30 || 0;
        acc.debit30To60 += row.debit30To60 || 0;
        acc.debit60 += row.debit60 || 0;
        acc.totalOutstanding += (row.debit30 || 0) + (row.debit30To60 || 0) + (row.debit60 || 0);
        acc.totalAmount += row.totalAmount || 0;
        return acc;
      },
      {
        numberOfBills: 0,
        waterConsumption: 0,
        meterRent: 0,
        sanitation: 0,
        sewrage: 0,
        maintenance: 0,
        vatAmount: 0,
        billAmount: 0,
        debit30: 0,
        debit30To60: 0,
        debit60: 0,
        totalOutstanding: 0,
        totalAmount: 0,
      }
    );
  }, [data]);

  // Excel Export matching exact structure and sample columns
  const handleExportXlsx = () => {
    try {
      const headerRow1 = [
        "",
        "",
        "",
        "",
        "CURRENT MONTH BILL",
        "",
        "",
        "",
        "",
        "",
        "",
        "OUTSTANDING",
        "",
        "",
        "",
      ];

      const headerRow2 = [
        "period",
        "branch",
        "charge_group",
        "number_of_bill",
        "water_consumption",
        "meter rent",
        "sanitation",
        "sewrage",
        "maintenance",
        "vat_amount",
        "bill_amount",
        "debit_30",
        "debit_30_60",
        "debit_60",
        "_total_amount",
      ];

      const dataRows = sortedData.map((r) => [
        r.period,
        r.branch,
        r.chargeGroup,
        r.numberOfBills,
        r.waterConsumption,
        r.meterRent,
        r.sanitation,
        r.sewrage,
        r.maintenance,
        r.vatAmount,
        r.billAmount,
        r.debit30,
        r.debit30To60,
        r.debit60,
        r.totalAmount,
      ]);

      const totalRow = [
        "TOTAL",
        "",
        "",
        totals.numberOfBills,
        totals.waterConsumption,
        totals.meterRent,
        totals.sanitation,
        totals.sewrage,
        totals.maintenance,
        totals.vatAmount,
        totals.billAmount,
        totals.debit30,
        totals.debit30To60,
        totals.debit60,
        totals.totalAmount,
      ];

      const aoa = [headerRow1, headerRow2, ...dataRows, totalRow];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Merge category headers
      ws["!merges"] = [
        // Merging CURRENT MONTH BILL (cols 4..10)
        { s: { r: 0, c: 4 }, e: { r: 0, c: 10 } },
        // Merging OUTSTANDING (cols 11..14)
        { s: { r: 0, c: 11 }, e: { r: 0, c: 14 } },
      ];

      // Auto column widths
      ws["!cols"] = [
        { wch: 12 }, // period
        { wch: 22 }, // branch
        { wch: 16 }, // charge_group
        { wch: 16 }, // number_of_bill
        { wch: 20 }, // water_consumption
        { wch: 14 }, // meter rent
        { wch: 14 }, // sanitation
        { wch: 14 }, // sewrage
        { wch: 14 }, // maintenance
        { wch: 14 }, // vat_amount
        { wch: 18 }, // bill_amount
        { wch: 14 }, // debit_30
        { wch: 14 }, // debit_30_60
        { wch: 14 }, // debit_60
        { wch: 18 }, // _total_amount
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Delivery Summary");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      downloadFile(blob, `delivery_summary_report_${selectedMonthYear || "all"}.xlsx`);

      toast({
        title: "Export Complete",
        description: `Exported ${sortedData.length} records to Excel successfully.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Export Failed",
        description: e.message || "Failed to generate Excel file",
        variant: "destructive",
      });
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    try {
      const headers = [
        "period",
        "branch",
        "charge_group",
        "number_of_bill",
        "water_consumption",
        "meter rent",
        "sanitation",
        "sewrage",
        "maintenance",
        "vat_amount",
        "bill_amount",
        "debit_30",
        "debit_30_60",
        "debit_60",
        "_total_amount",
      ];

      const lines = [
        headers.join(","),
        ...sortedData.map((r) =>
          [
            `"${r.period}"`,
            `"${r.branch.replace(/"/g, '""')}"`,
            `"${r.chargeGroup}"`,
            r.numberOfBills,
            r.waterConsumption.toFixed(2),
            r.meterRent.toFixed(2),
            r.sanitation.toFixed(2),
            r.sewrage.toFixed(2),
            r.maintenance.toFixed(2),
            r.vatAmount.toFixed(2),
            r.billAmount.toFixed(2),
            r.debit30.toFixed(2),
            r.debit30To60.toFixed(2),
            r.debit60.toFixed(2),
            r.totalAmount.toFixed(2),
          ].join(",")
        ),
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      downloadFile(blob, `delivery_summary_report_${selectedMonthYear || "all"}.csv`);

      toast({
        title: "Export Complete",
        description: `Exported ${sortedData.length} records to CSV successfully.`,
      });
    } catch (e: any) {
      toast({
        title: "Export Failed",
        description: e.message || "Failed to generate CSV",
        variant: "destructive",
      });
    }
  };

  // Copy to Clipboard (TSV)
  const handleCopyClipboard = () => {
    const headers = [
      "period",
      "branch",
      "charge_group",
      "number_of_bill",
      "water_consumption",
      "meter rent",
      "sanitation",
      "sewrage",
      "maintenance",
      "vat_amount",
      "bill_amount",
      "debit_30",
      "debit_30_60",
      "debit_60",
      "_total_amount",
    ];

    const lines = [
      headers.join("\t"),
      ...sortedData.map((r) =>
        [
          r.period,
          r.branch,
          r.chargeGroup,
          r.numberOfBills,
          r.waterConsumption.toFixed(2),
          r.meterRent.toFixed(2),
          r.sanitation.toFixed(2),
          r.sewrage.toFixed(2),
          r.maintenance.toFixed(2),
          r.vatAmount.toFixed(2),
          r.billAmount.toFixed(2),
          r.debit30.toFixed(2),
          r.debit30To60.toFixed(2),
          r.debit60.toFixed(2),
          r.totalAmount.toFixed(2),
        ].join("\t")
      ),
    ];

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "Table data copied as TSV. Paste directly into Excel or Google Sheets.",
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Total Bills */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Bill Count
                </p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {formatCount(totals.numberOfBills)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Across all branches & groups</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 border border-blue-100 dark:border-blue-900">
                <Layers className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Month Bill Total */}
        <Card className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Current Month Billed
                  </p>
                </div>
                <h3 className="text-2xl font-bold text-emerald-950 dark:text-emerald-100 mt-1 font-mono">
                  {formatCurrency(totals.billAmount)} <span className="text-xs font-normal">ETB</span>
                </h3>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-1">
                  Water: {formatCurrency(totals.waterConsumption)} | VAT: {formatCurrency(totals.vatAmount)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 border border-emerald-200">
                <Receipt className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Arrears Total */}
        <Card className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Outstanding Arrears
                  </p>
                </div>
                <h3 className="text-2xl font-bold text-amber-950 dark:text-amber-100 mt-1 font-mono">
                  {formatCurrency(totals.totalOutstanding)} <span className="text-xs font-normal">ETB</span>
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-1">
                  30d: {formatCurrency(totals.debit30)} | &gt;60d: {formatCurrency(totals.debit60)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 border border-amber-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Deliverable Revenue */}
        <Card className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                  Grand Total Revenue
                </p>
                <h3 className="text-2xl font-bold text-indigo-950 dark:text-indigo-100 mt-1 font-mono">
                  {formatCurrency(totals.totalAmount)} <span className="text-xs font-normal">ETB</span>
                </h3>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-400 mt-1">Current bill + Outstanding</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-700 border border-indigo-200">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs px-2.5 py-0.5 rounded-full">
                  Delivery Report
                </Badge>
                <span className="text-xs text-slate-500 font-medium">Standard Water Delivery Summary</span>
                {latestMonth && selectedMonthYear === latestMonth && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Latest Month Data
                  </Badge>
                )}
                {latestMonth && selectedMonthYear !== latestMonth && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMonthYearChange(latestMonth)}
                    className="h-6 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300/60 rounded-full transition-colors"
                    title="Jump to latest month data"
                  >
                    Jump to Latest Month
                  </Button>
                )}
              </div>
              <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                Delivery Summary Report
              </CardTitle>
              <CardDescription className="text-sm text-slate-500 mt-0.5">
                Aggregated monthly delivery metrics by period, branch, and customer charge category.
              </CardDescription>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyClipboard}
                className="h-9 px-3 gap-1.5 rounded-xl text-slate-700 dark:text-slate-200 border-slate-200 hover:bg-slate-50"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                <span className="text-xs">{copied ? "Copied" : "Copy TSV"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-9 px-3 gap-1.5 rounded-xl text-slate-700 dark:text-slate-200 border-slate-200 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                <span className="text-xs">CSV</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleExportXlsx}
                className="h-9 px-3 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-xs font-semibold">Export Excel (.xlsx)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-9 px-3 gap-1.5 rounded-xl text-slate-700 border-slate-200 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                <span className="text-xs">Print</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-9 w-9 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 print:hidden">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search branch or group..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            {/* Period / Month Selector */}
            <div>
              <Select value={selectedMonthYear} onValueChange={onMonthYearChange}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <SelectValue placeholder="All Periods" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch Selector */}
            {canSelectBranch && (
              <div>
                <Select value={selectedBranchId} onValueChange={onBranchChange}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                      <SelectValue placeholder="All Branches" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl">
                    <SelectItem value="all" className="text-sm">
                      All Branches
                    </SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-sm">
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Charge Group Selector */}
            <div>
              <Select value={selectedChargeGroup} onValueChange={onChargeGroupChange}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Sparkles className="h-4 w-4 text-slate-400 shrink-0" />
                    <SelectValue placeholder="All Charge Groups" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-sm">
                    All Charge Groups
                  </SelectItem>
                  <SelectItem value="Domestic" className="text-sm">
                    Domestic
                  </SelectItem>
                  <SelectItem value="Non-domestic" className="text-sm">
                    Non-domestic
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {/* Multi-tier Table Content */}
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table className="w-full text-xs border-collapse">
              {/* Multi-tier Header */}
              <TableHeader>
                {/* Row 1: High-level category spans matching sample annotations */}
                <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/80">
                  <TableHead
                    colSpan={4}
                    className="text-left font-bold text-slate-700 dark:text-slate-300 py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]"
                  >
                    Dimension &amp; Volume
                  </TableHead>
                  <TableHead
                    colSpan={7}
                    className="text-center font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 py-2.5 px-3 border-r border-emerald-300 dark:border-emerald-800 uppercase tracking-wider text-[11px]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Current Month Bill
                    </span>
                  </TableHead>
                  <TableHead
                    colSpan={4}
                    className="text-center font-bold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 py-2.5 px-3 uppercase tracking-wider text-[11px]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Outstanding
                    </span>
                  </TableHead>
                </TableRow>

                {/* Row 2: Exact column names from sample spreadsheet */}
                <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 font-semibold text-slate-600 dark:text-slate-300">
                  {/* Base columns */}
                  <TableHead
                    onClick={() => handleSort("period")}
                    className="cursor-pointer hover:bg-slate-100 py-3 px-3 text-left whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>period</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("branch")}
                    className="cursor-pointer hover:bg-slate-100 py-3 px-3 text-left whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>branch</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("chargeGroup")}
                    className="cursor-pointer hover:bg-slate-100 py-3 px-3 text-left whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>charge_group</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("numberOfBills")}
                    className="cursor-pointer hover:bg-slate-100 py-3 px-3 text-right whitespace-nowrap border-r border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>number_of_bill</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* Current Month Bill Columns (Green tint) */}
                  <TableHead
                    onClick={() => handleSort("waterConsumption")}
                    className="cursor-pointer hover:bg-emerald-50 py-3 px-3 text-right whitespace-nowrap bg-emerald-50/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>water_consumption</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("meterRent")}
                    className="cursor-pointer hover:bg-emerald-50 py-3 px-3 text-right whitespace-nowrap bg-emerald-50/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>meter rent</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("sanitation")}
                    className="cursor-pointer hover:bg-emerald-50 py-3 px-3 text-right whitespace-nowrap bg-emerald-50/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>sanitation</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("sewrage")}
                    className="cursor-pointer hover:bg-emerald-50 py-3 px-3 text-right whitespace-nowrap bg-emerald-50/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>sewrage</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("maintenance")}
                    className="cursor-pointer hover:bg-emerald-50 py-3 px-3 text-right whitespace-nowrap bg-emerald-50/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>maintenance</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("vatAmount")}
                    className="cursor-pointer hover:bg-emerald-50 py-3 px-3 text-right whitespace-nowrap bg-emerald-50/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>vat_amount</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("billAmount")}
                    className="cursor-pointer hover:bg-emerald-100 py-3 px-3 text-right whitespace-nowrap bg-emerald-100/50 font-bold text-emerald-950 dark:text-emerald-100 border-r border-emerald-300 dark:border-emerald-800"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>bill_amount</span>
                      <ArrowUpDown className="h-3 w-3 text-emerald-600" />
                    </div>
                  </TableHead>

                  {/* Outstanding Columns (Orange tint) */}
                  <TableHead
                    onClick={() => handleSort("debit30")}
                    className="cursor-pointer hover:bg-amber-50 py-3 px-3 text-right whitespace-nowrap bg-amber-50/30 text-amber-900 dark:text-amber-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>debit_30</span>
                      <ArrowUpDown className="h-3 w-3 text-amber-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("debit30To60")}
                    className="cursor-pointer hover:bg-amber-50 py-3 px-3 text-right whitespace-nowrap bg-amber-50/30 text-amber-900 dark:text-amber-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>debit_30_60</span>
                      <ArrowUpDown className="h-3 w-3 text-amber-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("debit60")}
                    className="cursor-pointer hover:bg-amber-50 py-3 px-3 text-right whitespace-nowrap bg-amber-50/30 text-amber-900 dark:text-amber-200"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>debit_60</span>
                      <ArrowUpDown className="h-3 w-3 text-amber-400" />
                    </div>
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("totalAmount")}
                    className="cursor-pointer hover:bg-indigo-100 py-3 px-3 text-right whitespace-nowrap bg-indigo-50/50 font-bold text-indigo-950 dark:text-indigo-100"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>_total_amount</span>
                      <ArrowUpDown className="h-3 w-3 text-indigo-600" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-7 w-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading delivery summary data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Layers className="h-8 w-8 text-slate-300" />
                        <span className="text-sm font-medium">No delivery summary records found</span>
                        <span className="text-xs text-slate-400">
                          Try adjusting your period, branch, or charge group filter.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row, idx) => (
                    <TableRow
                      key={`${row.period}-${row.branch}-${row.chargeGroup}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors"
                    >
                      {/* period */}
                      <TableCell className="py-3 px-3 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row.period}
                      </TableCell>

                      {/* branch */}
                      <TableCell className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.branch}
                      </TableCell>

                      {/* charge_group */}
                      <TableCell className="py-3 px-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            row.chargeGroup.toLowerCase().includes("non")
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 text-[11px]"
                              : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 text-[11px]"
                          }
                        >
                          {row.chargeGroup}
                        </Badge>
                      </TableCell>

                      {/* number_of_bill */}
                      <TableCell className="py-3 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap border-r border-slate-200 dark:border-slate-800">
                        {formatCount(row.numberOfBills)}
                      </TableCell>

                      {/* water_consumption */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-emerald-50/15">
                        {formatCurrency(row.waterConsumption)}
                      </TableCell>

                      {/* meter rent */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-emerald-50/15">
                        {formatCurrency(row.meterRent)}
                      </TableCell>

                      {/* sanitation */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-emerald-50/15">
                        {formatCurrency(row.sanitation)}
                      </TableCell>

                      {/* sewrage */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-emerald-50/15">
                        {formatCurrency(row.sewrage)}
                      </TableCell>

                      {/* maintenance */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-emerald-50/15">
                        {formatCurrency(row.maintenance)}
                      </TableCell>

                      {/* vat_amount */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-emerald-50/15">
                        {formatCurrency(row.vatAmount)}
                      </TableCell>

                      {/* bill_amount (Current month total) */}
                      <TableCell className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap bg-emerald-50/40 border-r border-emerald-200 dark:border-emerald-800">
                        {formatCurrency(row.billAmount)}
                      </TableCell>

                      {/* debit_30 */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-amber-50/15">
                        {formatCurrency(row.debit30)}
                      </TableCell>

                      {/* debit_30_60 */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-amber-50/15">
                        {formatCurrency(row.debit30To60)}
                      </TableCell>

                      {/* debit_60 */}
                      <TableCell className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap bg-amber-50/15">
                        {formatCurrency(row.debit60)}
                      </TableCell>

                      {/* _total_amount */}
                      <TableCell className="py-3 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap bg-indigo-50/30">
                        {formatCurrency(row.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* Table Footer: Totals Row */}
              {sortedData.length > 0 && (
                <tfoot>
                  <TableRow className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 font-bold text-slate-900 dark:text-white">
                    <TableCell colSpan={3} className="py-3.5 px-3 text-left font-bold uppercase tracking-wider text-xs">
                      Grand Total ({sortedData.length} rows)
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono font-bold border-r border-slate-300 dark:border-slate-700">
                      {formatCount(totals.numberOfBills)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-emerald-100/40">
                      {formatCurrency(totals.waterConsumption)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-emerald-100/40">
                      {formatCurrency(totals.meterRent)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-emerald-100/40">
                      {formatCurrency(totals.sanitation)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-emerald-100/40">
                      {formatCurrency(totals.sewrage)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-emerald-100/40">
                      {formatCurrency(totals.maintenance)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-emerald-100/40">
                      {formatCurrency(totals.vatAmount)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-200/50 border-r border-emerald-300 dark:border-emerald-800">
                      {formatCurrency(totals.billAmount)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-amber-100/40">
                      {formatCurrency(totals.debit30)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-amber-100/40">
                      {formatCurrency(totals.debit30To60)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono bg-amber-100/40">
                      {formatCurrency(totals.debit60)}
                    </TableCell>
                    <TableCell className="py-3.5 px-3 text-right font-mono font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-100/60">
                      {formatCurrency(totals.totalAmount)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
