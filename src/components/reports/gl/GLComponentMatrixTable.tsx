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
import { Search, ArrowUpDown, CheckCircle2, AlertTriangle, FileSpreadsheet, Download } from "lucide-react";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import type { GLComponentMatrixRow } from "@/lib/gl-audit-actions";

interface GLComponentMatrixTableProps {
  rows: GLComponentMatrixRow[];
  isLoading?: boolean;
}

export function GLComponentMatrixTable({ rows, isLoading }: GLComponentMatrixTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "Paid and Reconciled" | "Unpaid">("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [sortField, setSortField] = useState<keyof GLComponentMatrixRow>("totalAmount");
  const [sortAsc, setSortAsc] = useState(false);

  const paidCount = useMemo(() => rows.filter((r) => r.paymentStatus === "Paid and Reconciled").length, [rows]);
  const unpaidCount = useMemo(() => rows.filter((r) => r.paymentStatus === "Unpaid").length, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (paymentFilter !== "all") {
        if (paymentFilter === "Paid and Reconciled") {
          if (r.paymentStatus !== "Paid and Reconciled") return false;
        } else if (r.paymentStatus !== paymentFilter) {
          return false;
        }
      }

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.period.toLowerCase().includes(q) ||
        r.customerKey.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q) ||
        r.chargeGroup.toLowerCase().includes(q) ||
        (r.paymentStatus && r.paymentStatus.toLowerCase().includes(q))
      );
    });
  }, [rows, paymentFilter, searchTerm]);

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

  const pagedRows = useMemo(() => {
    return sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedRows, page, rowsPerPage]);

  const toggleSort = (field: keyof GLComponentMatrixRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportMatrix = () => {
    if (filteredRows.length === 0) return;
    const exportData = filteredRows.map((r) => ({
      "Period":               String(r.rawPeriod || r.period || ""),
      "Customer Key":         String(r.customerKey || ""),
      "Customer Name":        String(r.customerName || ""),
      "Branch Code":          String(r.branchCode || ""),
      "Branch Name":          String(r.branchName || ""),
      "Charge Group":         String(r.chargeGroup || ""),
      "Payment Status":       r.paymentStatus === "Paid and Reconciled" ? "Paid and Reconciled" : "Unpaid",
      "Base Water Charge":    r.baseWater ?? 0,
      "Sewerage Charge":      r.sewerage ?? 0,
      "Sanitation Fee":       r.sanitation ?? 0,
      "Meter Rent":           r.meterRent ?? 0,
      "Maintenance Fee":      r.maintenance ?? 0,
      "Additional Fees":      r.additional ?? 0,
      "Penalty Amount":       r.penalty ?? 0,
      "VAT Amount":           r.vat ?? 0,
      "Total Excl VAT":       r.totalExclVat ?? 0,
      "Total Amount (Incl. Arrears)": r.totalAmount ?? 0,
      "Arrears Carryover":     r.outstandingCarryover ?? 0,
      "Audit Status":         String(r.auditStatus || "Clean"),
    }));
    const headers = Object.keys(exportData[0]);
    const blob = arrayToXlsxBlob(exportData, headers, "Component Matrix");
    downloadFile(blob, `GL_Component_Breakdown_Matrix_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar + Payment Status Filter + Export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search customer key, name, branch, payment status..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-9 h-9 rounded-xl border-slate-200 text-xs"
            />
          </div>

          {/* Payment Status Indicator */}
          <div className="flex items-center px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200/80 gap-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-800">Paid &amp; Reconciled ({filteredRows.length})</span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredRows.length} bill component records
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportMatrix}
            disabled={filteredRows.length === 0}
            className="h-9 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 shadow-sm font-semibold"
            title="Download Component Breakdown Matrix to Excel"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Matrix</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader className="bg-slate-50/70 border-b border-slate-200/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("period")}>
                  <div className="flex items-center gap-1">
                    <span>Period</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("customerKey")}>
                  <div className="flex items-center gap-1">
                    <span>Customer Key</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("chargeGroup")}>
                  <div className="flex items-center gap-1">
                    <span>Group</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 cursor-pointer text-center whitespace-nowrap" onClick={() => toggleSort("paymentStatus")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Payment Status</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap" onClick={() => toggleSort("baseWater")}>
                  Base Water
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  Sewerage
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  Sanitation
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  Meter Rent
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  Maintenance
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  Add'l/Fire
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  Penalty
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">
                  VAT
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap" onClick={() => toggleSort("totalAmount")} title="Full bill total including prior-period arrears carried forward">
                  <div className="flex items-center justify-end gap-1">
                    <span>Total (ETB)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap" onClick={() => toggleSort("outstandingCarryover")}>
                  <div className="flex items-center justify-end gap-1" title="Prior-period arrears carried forward into this bill">
                    <span>Arrears</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase text-slate-600 text-center whitespace-nowrap">
                  Audit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={15} className="h-40 text-center text-slate-400">
                    Loading component breakdown...
                  </TableCell>
                </TableRow>
              ) : pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="h-40 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileSpreadsheet className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm font-medium">No component breakdown records found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {r.period}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-indigo-700">
                          {r.customerKey}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[130px]" title={r.customerName}>
                          {r.customerName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] bg-slate-50 font-medium">
                        {r.chargeGroup}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {r.paymentStatus === "Paid and Reconciled" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold px-2 py-0.5 whitespace-nowrap">
                          Paid and Reconciled
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] font-bold px-2 py-0.5">
                          Unpaid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-800 font-medium whitespace-nowrap">
                      {formatNumber(r.baseWater)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                      {r.sewerage > 0 ? formatNumber(r.sewerage) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                      {r.sanitation > 0 ? formatNumber(r.sanitation) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                      {r.meterRent > 0 ? formatNumber(r.meterRent) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                      {r.maintenance > 0 ? formatNumber(r.maintenance) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                      {r.additional > 0 ? formatNumber(r.additional) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-red-600 whitespace-nowrap">
                      {r.penalty > 0 ? formatNumber(r.penalty) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-amber-700 whitespace-nowrap">
                      {r.vat > 0 ? formatNumber(r.vat) : "—"}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap"
                      title={`Current: ${formatNumber(r.totalInclVat)} + Arrears: ${formatNumber(r.outstandingCarryover ?? 0)}`}
                    >
                      {formatNumber(r.totalAmount)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-xs whitespace-nowrap font-semibold ${
                      (r.outstandingCarryover ?? 0) > 0.01 ? 'text-rose-600' : 'text-slate-400'
                    }`} title="Prior-period arrears carried into this bill">
                      {(r.outstandingCarryover ?? 0) > 0.01 ? formatNumber(r.outstandingCarryover) : '—'}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {r.auditStatus === "Clean" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 inline" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

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
