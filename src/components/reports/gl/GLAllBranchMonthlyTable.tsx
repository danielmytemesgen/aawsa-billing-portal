"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TablePagination } from "@/components/ui/table-pagination";
import { formatNumber } from "@/lib/format";
import {
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  Building2,
  Copy,
  Check,
  Filter,
  DollarSign,
  Layers,
  Calculator,
} from "lucide-react";
import type { GLAllBranchMonthlyRow } from "@/lib/gl-audit-actions";
import { arrayToXlsxBlob, arrayToCsvBlob, downloadFile } from "@/lib/xlsx";
import { useToast } from "@/hooks/use-toast";

interface GLAllBranchMonthlyTableProps {
  rows: GLAllBranchMonthlyRow[];
  isLoading?: boolean;
  canExport?: boolean;
}

export function GLAllBranchMonthlyTable({
  rows,
  isLoading,
  canExport = true,
}: GLAllBranchMonthlyTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedGlCode, setSelectedGlCode] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<keyof GLAllBranchMonthlyRow>("branch");
  const [sortAsc, setSortAsc] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Distinct branch codes & GL codes
  const availableBranches = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.branch))).sort();
  }, [rows]);

  const availableGlCodes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.glCode))).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedBranch !== "all" && r.branch !== selectedBranch) return false;
      if (selectedGlCode !== "all" && r.glCode !== selectedGlCode) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          r.branch.toLowerCase().includes(q) ||
          (r.branchName && r.branchName.toLowerCase().includes(q)) ||
          r.glCode.toLowerCase().includes(q) ||
          (r.glName && r.glName.toLowerCase().includes(q)) ||
          r.period.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, selectedBranch, selectedGlCode, searchTerm]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal ?? "").localeCompare(String(bVal ?? ""))
        : String(bVal ?? "").localeCompare(String(aVal ?? ""));
    });
  }, [filteredRows, sortField, sortAsc]);

  // Paginated rows
  const pagedRows = useMemo(() => {
    if (rowsPerPage === -1) return sortedRows;
    return sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedRows, page, rowsPerPage]);

  const toggleSort = (field: keyof GLAllBranchMonthlyRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "branch" || field === "period" || field === "glCode");
    }
  };

  // Grand totals of filtered rows
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.count += r.count;
        acc.totalAmount += r.totalAmount;
        acc.vatAmount += r.vatAmount;
        acc.withoutVat += r.withoutVat;
        return acc;
      },
      { count: 0, totalAmount: 0, vatAmount: 0, withoutVat: 0 }
    );
  }, [filteredRows]);

  // Export XLSX matching the exact screenshot layout
  const handleExportXLSX = () => {
    if (!canExport) {
      toast({
        title: "Access Restricted",
        description: "You do not have permission to export GL reports.",
        variant: "destructive",
      });
      return;
    }
    if (filteredRows.length === 0) {
      toast({ title: "No Data", description: "No rows available to export." });
      return;
    }

    try {
      const exportData = filteredRows.map((r) => ({
        "COUNT": r.count,
        "BRANCH": r.branch,
        "GL_CODE": r.glCode,
        "TOTAL_AMOUNT": r.totalAmount,
        "VAT_AMOUNT": r.vatAmount,
        "WITH_OUT_VAT": r.withoutVat,
        "PERIOD": r.period,
      }));

      const headers = ["COUNT", "BRANCH", "GL_CODE", "TOTAL_AMOUNT", "VAT_AMOUNT", "WITH_OUT_VAT", "PERIOD"];
      const blob = arrayToXlsxBlob(exportData, headers, "All Branch Monthly GL");
      const filename = `AAWSA_All_Branch_Monthly_GL_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      downloadFile(blob, filename);

      toast({
        title: "Export Complete",
        description: `${exportData.length} All Branch Monthly GL rows downloaded.`,
      });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    }
  };

  // Export CSV matching the exact screenshot layout
  const handleExportCSV = () => {
    if (!canExport) {
      toast({
        title: "Access Restricted",
        description: "You do not have permission to export GL reports.",
        variant: "destructive",
      });
      return;
    }
    if (filteredRows.length === 0) return;

    try {
      const exportData = filteredRows.map((r) => ({
        "COUNT": r.count,
        "BRANCH": r.branch,
        "GL_CODE": r.glCode,
        "TOTAL_AMOUNT": r.totalAmount,
        "VAT_AMOUNT": r.vatAmount,
        "WITH_OUT_VAT": r.withoutVat,
        "PERIOD": r.period,
      }));

      const headers = ["COUNT", "BRANCH", "GL_CODE", "TOTAL_AMOUNT", "VAT_AMOUNT", "WITH_OUT_VAT", "PERIOD"];
      const blob = arrayToCsvBlob(exportData, headers);
      downloadFile(blob, `all_branch_monthly_gl_report_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "CSV Exported", description: `${exportData.length} rows downloaded.` });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    }
  };

  // Copy to clipboard as TSV for immediate spreadsheet paste
  const handleCopyClipboard = () => {
    if (filteredRows.length === 0) return;
    const headerLine = "COUNT\tBRANCH\tGL_CODE\tTOTAL_AMOUNT\tVAT_AMOUNT\tWITH_OUT_VAT\tPERIOD";
    const bodyLines = filteredRows.map(
      (r) => `${r.count}\t${r.branch}\t${r.glCode}\t${r.totalAmount}\t${r.vatAmount}\t${r.withoutVat}\t${r.period}`
    );
    const text = [headerLine, ...bodyLines].join("\n");
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast({ title: "Copied to Clipboard", description: `${filteredRows.length} rows ready to paste into Excel.` });
  };

  return (
    <div className="space-y-4">
      {/* ── Summary KPI Snapshot Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
            <Calculator className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Transactions</div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {formatNumber(totals.count)}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
            <DollarSign className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide">Total Gross Amount</div>
            <div className="text-base font-bold text-emerald-950 font-mono truncate" title={`ETB ${totals.totalAmount.toLocaleString()}`}>
              ETB {formatNumber(totals.totalAmount)}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-blue-700 uppercase tracking-wide">Total VAT (15%)</div>
            <div className="text-base font-bold text-blue-950 font-mono truncate" title={`ETB ${totals.vatAmount.toLocaleString()}`}>
              ETB {formatNumber(totals.vatAmount)}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-purple-700 uppercase tracking-wide">Net Without VAT</div>
            <div className="text-base font-bold text-purple-950 font-mono truncate" title={`ETB ${totals.withoutVat.toLocaleString()}`}>
              ETB {formatNumber(totals.withoutVat)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search branch, GL code, period..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-8 h-9 text-xs rounded-xl border-slate-200"
            />
          </div>

          {/* Branch Pill Filter */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-md py-0.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0">Branch:</span>
            <button
              type="button"
              onClick={() => { setSelectedBranch("all"); setPage(0); }}
              className={`px-2 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                selectedBranch === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({rows.length})
            </button>
            {availableBranches.map((br) => (
              <button
                key={br}
                type="button"
                onClick={() => { setSelectedBranch(br); setPage(0); }}
                className={`px-2 py-1 rounded-lg text-xs font-bold shrink-0 transition-all font-mono ${
                  selectedBranch === br
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {br}
              </button>
            ))}
          </div>

          {/* GL Code Pill Filter */}
          {availableGlCodes.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 overflow-x-auto max-w-sm py-0.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0">GL:</span>
              <button
                type="button"
                onClick={() => { setSelectedGlCode("all"); setPage(0); }}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all ${
                  selectedGlCode === "all"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {availableGlCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => { setSelectedGlCode(code); setPage(0); }}
                  className={`px-1.5 py-1 rounded-lg text-[10px] font-mono font-bold shrink-0 transition-all ${
                    selectedGlCode === code
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleCopyClipboard}
            variant="ghost"
            size="sm"
            className="h-9 px-2.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
            title="Copy as TSV to paste into Excel"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            {isCopied ? "Copied" : "Copy"}
          </Button>

          {canExport && (
            <>
              <Button
                onClick={handleExportCSV}
                variant="ghost"
                size="sm"
                className="h-9 px-2.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
                title="Download CSV"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
              <Button
                onClick={handleExportXLSX}
                size="sm"
                className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm"
                title="Download formatted Excel workbook"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export XLSX
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <ScrollArea className="w-full">
          <div className="min-w-[760px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50 border-b border-slate-200">
                  {/* COUNT */}
                  <TableHead
                    onClick={() => toggleSort("count")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 w-28 text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>COUNT</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* BRANCH */}
                  <TableHead
                    onClick={() => toggleSort("branch")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 w-28"
                  >
                    <div className="flex items-center gap-1">
                      <span>BRANCH</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* GL_CODE */}
                  <TableHead
                    onClick={() => toggleSort("glCode")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 w-36"
                  >
                    <div className="flex items-center gap-1">
                      <span>GL_CODE</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* TOTAL_AMOUNT */}
                  <TableHead
                    onClick={() => toggleSort("totalAmount")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 text-right w-44"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>TOTAL_AMOUNT</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* VAT_AMOUNT */}
                  <TableHead
                    onClick={() => toggleSort("vatAmount")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 text-right w-36"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>VAT_AMOUNT</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* WITH_OUT_VAT */}
                  <TableHead
                    onClick={() => toggleSort("withoutVat")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 text-right w-40"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>WITH_OUT_VAT</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>

                  {/* PERIOD */}
                  <TableHead
                    onClick={() => toggleSort("period")}
                    className="cursor-pointer select-none font-bold text-xs text-slate-700 h-10 w-28 text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>PERIOD</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <TableRow key={idx} className="animate-pulse border-b border-slate-100">
                      <TableCell className="text-right py-3"><div className="h-4 bg-slate-200 rounded w-16 ml-auto" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-200 rounded w-10" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-200 rounded w-20" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 bg-slate-200 rounded w-24 ml-auto" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 bg-slate-200 rounded w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 bg-slate-200 rounded w-24 ml-auto" /></TableCell>
                      <TableCell className="text-center"><div className="h-4 bg-slate-200 rounded w-14 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-xs">
                      No All Branch Monthly GL records found matching the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((row) => (
                    <TableRow
                      key={row.key}
                      className="hover:bg-indigo-50/40 transition-colors border-b border-slate-100 text-xs font-mono"
                    >
                      {/* COUNT */}
                      <TableCell className="text-right font-bold text-slate-800 py-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/60">
                          {formatNumber(row.count)}
                        </span>
                      </TableCell>

                      {/* BRANCH */}
                      <TableCell className="font-bold text-slate-900 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-black">
                            {row.branch}
                          </span>
                          {row.branchName && (
                            <span className="text-[11px] font-sans text-slate-400 font-normal truncate max-w-[90px] hidden sm:inline" title={row.branchName}>
                              {row.branchName}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* GL_CODE */}
                      <TableCell className="font-bold py-2.5">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-black tracking-wide">
                            {row.glCode}
                          </span>
                          {row.glName && (
                            <span className="text-[10px] font-sans text-slate-400 font-normal leading-tight truncate max-w-[130px]" title={row.glName}>
                              {row.glName}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* TOTAL_AMOUNT */}
                      <TableCell className="text-right font-bold text-slate-900 py-2.5">
                        {row.totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      {/* VAT_AMOUNT */}
                      <TableCell className="text-right font-medium text-slate-600 py-2.5">
                        {row.vatAmount > 0
                          ? row.vatAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "0"}
                      </TableCell>

                      {/* WITH_OUT_VAT */}
                      <TableCell className="text-right font-medium text-slate-700 py-2.5">
                        {row.withoutVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      {/* PERIOD */}
                      <TableCell className="text-center font-semibold text-slate-700 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60 text-[11px]">
                          {row.period}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* Grand Total Footer */}
              {!isLoading && filteredRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-slate-100/90 font-bold text-xs border-t-2 border-slate-300 font-mono">
                    <TableCell className="text-right font-black text-slate-900 py-3">
                      {formatNumber(totals.count)}
                    </TableCell>
                    <TableCell className="font-bold text-slate-700">
                      TOTAL ({filteredRows.length} rows)
                    </TableCell>
                    <TableCell className="text-slate-500">—</TableCell>
                    <TableCell className="text-right font-black text-emerald-700 py-3">
                      {totals.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-black text-blue-700 py-3">
                      {totals.vatAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-black text-purple-700 py-3">
                      {totals.withoutVat.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-center text-slate-500">—</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* ── Pagination ── */}
        <div className="p-3 border-t border-slate-100 no-print">
          <TablePagination
            count={filteredRows.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            rowsPerPageOptions={[15, 25, 50, 100]}
          />
        </div>
      </div>
    </div>
  );
}
