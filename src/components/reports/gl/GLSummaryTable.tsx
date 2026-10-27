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
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import type { GLSummaryRow } from "@/lib/gl-audit-actions";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";

interface GLSummaryTableProps {
  rows: GLSummaryRow[];
  onInspectRow: (row: GLSummaryRow) => void;
  isLoading?: boolean;
}

export function GLSummaryTable({ rows, onInspectRow, isLoading }: GLSummaryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [glFilter, setGlFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "Paid and Reconciled" | "Unpaid">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [sortField, setSortField] = useState<keyof GLSummaryRow>("totalAmount");
  const [sortAsc, setSortAsc] = useState(false);

  // Counts for pills
  const paidCount = useMemo(() => rows.filter((r) => r.paymentStatus === "Paid and Reconciled").length, [rows]);
  const unpaidCount = useMemo(() => rows.filter((r) => r.paymentStatus === "Unpaid").length, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Payment status filter
      if (paymentFilter !== "all") {
        if (paymentFilter === "Paid and Reconciled") {
          if (r.paymentStatus !== "Paid and Reconciled") return false;
        } else if (r.paymentStatus !== paymentFilter) {
          return false;
        }
      }

      // GL code filter
      if (glFilter !== "all" && r.glCode !== glFilter) return false;

      // Status filter
      if (statusFilter === "clean" && r.auditStatus !== "Clean") return false;
      if (statusFilter === "warning" && r.auditStatus !== "Warning") return false;
      if (statusFilter === "error" && r.auditStatus !== "Error") return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          r.period.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q) ||
          r.chargeGroup.toLowerCase().includes(q) ||
          r.glCode.toLowerCase().includes(q) ||
          r.glName.toLowerCase().includes(q) ||
          (r.paymentStatus && r.paymentStatus.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [rows, glFilter, paymentFilter, statusFilter, searchTerm]);

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
    return sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedRows, page, rowsPerPage]);

  const toggleSort = (field: keyof GLSummaryRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Unique GL codes in rows for filter pill
  const availableGlCodes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.glCode))).sort();
  }, [rows]);

  const handleExport = () => {
    if (filteredRows.length === 0) return;
    const exportData = filteredRows.map((r) => ({
      "Period":                String(r.rawPeriod || r.period || ""),
      "Branch":                String(r.branchName || r.branch || ""),
      "Charge Group":          String(r.chargeGroup || ""),
      "GL Code":               String(r.glCode || ""),
      "GL Description":        String(r.glName || ""),
      "Payment Status":        String(r.paymentStatus || ""),
      "Bills Count":           r.count ?? 0,
      "Current Bill (ETB)":    r.currentAmount ?? 0,
      "Arrears Carried (ETB)": r.arrearsAmount ?? 0,
      "Net Excl. VAT (ETB)":   r.withoutVat ?? 0,
      "VAT (15%)":             r.vatAmount ?? 0,
      "Total Amount (ETB)":    r.totalAmount ?? 0,
      "Audit Status":          String(r.auditStatus || "Clean"),
    }));
    const headers = Object.keys(exportData[0]);
    const blob = arrayToXlsxBlob(exportData, headers, "GL Code Summary");
    downloadFile(blob, `GL_Code_Summary_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Controls: Search + Filter Pills */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search GL codes, branches, periods, payment status..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="pl-9 h-9 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Payment Status Indicator */}
          <div className="flex items-center px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200/80 gap-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-800">Paid &amp; Reconciled ({filteredRows.length})</span>
          </div>

          {/* GL Code Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={glFilter === "all" ? "default" : "outline"}
              onClick={() => setGlFilter("all")}
              className="h-8 text-xs rounded-lg px-2.5"
            >
              All Codes
            </Button>
            {availableGlCodes.slice(0, 4).map((code) => (
              <Button
                key={code}
                size="sm"
                variant={glFilter === code ? "default" : "outline"}
                onClick={() => {
                  setGlFilter(code);
                  setPage(0);
                }}
                className="h-8 text-xs rounded-lg px-2 font-mono"
              >
                {code}
              </Button>
            ))}
            {availableGlCodes.length > 4 && (
              <select
                value={availableGlCodes.includes(glFilter) ? glFilter : "more"}
                onChange={(e) => {
                  setGlFilter(e.target.value);
                  setPage(0);
                }}
                className="h-8 text-xs rounded-lg border border-slate-200 px-2 bg-white text-slate-700 outline-none"
              >
                <option value="more" disabled>
                  More Codes...
                </option>
                {availableGlCodes.slice(4).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Export Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className="h-8 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export XLSX</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader className="bg-slate-50/70 border-b border-slate-200/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer" onClick={() => toggleSort("period")}>
                  <div className="flex items-center gap-1">
                    <span>Period</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer" onClick={() => toggleSort("branch")}>
                  <div className="flex items-center gap-1">
                    <span>Branch</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer" onClick={() => toggleSort("chargeGroup")}>
                  <div className="flex items-center gap-1">
                    <span>Charge Group</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer" onClick={() => toggleSort("glCode")}>
                  <div className="flex items-center gap-1">
                    <span>GL Code</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-center" onClick={() => toggleSort("paymentStatus")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Payment Status</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-right" onClick={() => toggleSort("count")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Bills Count</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-right" onClick={() => toggleSort("currentAmount")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Current Bill</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-rose-700 cursor-pointer text-right" onClick={() => toggleSort("arrearsAmount")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Arrears Carried</span>
                    <ArrowUpDown className="h-3 w-3 text-rose-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-right" onClick={() => toggleSort("withoutVat")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Net Excl. VAT</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-right" onClick={() => toggleSort("vatAmount")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>VAT (15%)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-right" onClick={() => toggleSort("totalAmount")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Amount (ETB)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-center">
                  Audit Status
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-center">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-40 text-center text-slate-400">
                    Loading GL ledger records...
                  </TableCell>
                </TableRow>
              ) : pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-40 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileSpreadsheet className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm font-medium">No GL summary records match the selected filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row) => (
                  <TableRow
                    key={row.key}
                    className="hover:bg-indigo-50/40 transition-colors border-b border-slate-100 cursor-pointer"
                    onClick={() => onInspectRow(row)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-slate-800">
                      {row.period}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-slate-50 font-bold">
                          {row.branch}
                        </Badge>
                        <span className="text-xs text-slate-700 font-medium truncate max-w-[110px]" title={row.branchName}>
                          {row.branchName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px] font-medium bg-slate-100 text-slate-700 border-slate-200">
                        {row.chargeGroup}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-xs text-indigo-700">
                          {row.glCode}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[130px]" title={row.glName}>
                          {row.glName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.paymentStatus === "Paid and Reconciled" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold px-2 py-0.5 whitespace-nowrap">
                          Paid and Reconciled
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] font-bold px-2 py-0.5">
                          Unpaid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium text-slate-700">
                      {formatNumber(row.count)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-700">
                      {formatNumber(row.currentAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-rose-700 font-semibold">
                      {row.arrearsAmount > 0 ? formatNumber(row.arrearsAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      {formatNumber(row.withoutVat)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-amber-700">
                      {row.vatAmount > 0 ? formatNumber(row.vatAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      {formatNumber(row.totalAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.auditStatus === "Clean" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Clean
                        </Badge>
                      ) : row.auditStatus === "Warning" ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] font-bold px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" /> {row.anomalyCount} Warn
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 text-[10px] font-bold px-2 py-0.5 animate-pulse">
                          <AlertCircle className="h-3 w-3 mr-1 text-red-600" /> {row.anomalyCount} Flag
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onInspectRow(row)}
                        className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 font-medium px-2 rounded-lg"
                        title="Click to drill-down into bills"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Audit Bills
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Pagination */}
        <TablePagination
          count={filteredRows.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={(n) => {
            setRowsPerPage(n);
            setPage(0);
          }}
        />
      </div>
    </div>
  );
}
