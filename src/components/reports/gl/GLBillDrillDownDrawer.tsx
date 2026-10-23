"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Loader2,
  X,
  Scale,
} from "lucide-react";
import {
  getGLBillsDrillDownAction,
  type GLSummaryRow,
  type GLBillDrillDownItem,
} from "@/lib/gl-audit-actions";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";

interface GLBillDrillDownDrawerProps {
  selectedRow: GLSummaryRow | null;
  open: boolean;
  onClose: () => void;
}

export function GLBillDrillDownDrawer({
  selectedRow,
  open,
  onClose,
}: GLBillDrillDownDrawerProps) {
  const [bills, setBills] = useState<GLBillDrillDownItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [searchTerm, setSearchTerm] = useState("");
  const [auditFilter, setAuditFilter] = useState<"all" | "clean" | "flagged">("all");

  const fetchDrillDownBills = useCallback(async () => {
    if (!selectedRow) return;
    setIsLoading(true);
    try {
      const res = await getGLBillsDrillDownAction({
        branchCode: selectedRow.branchCode || selectedRow.branch,
        period: selectedRow.rawPeriod,
        chargeGroup: selectedRow.chargeGroup,
        glCode: selectedRow.glCode,
        paymentStatus: selectedRow.paymentStatus,
        searchTerm: searchTerm.trim() || undefined,
        auditFilter,
        page,
        limit: rowsPerPage,
      });

      if (res.success && res.bills) {
        setBills(res.bills);
        setTotal(res.total || 0);
      } else {
        setBills([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Failed to load drill-down bills:", err);
      setBills([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRow, searchTerm, auditFilter, page, rowsPerPage]);

  useEffect(() => {
    if (open && selectedRow) {
      setPage(0);
      fetchDrillDownBills();
    }
  }, [open, selectedRow]);

  useEffect(() => {
    if (open && selectedRow) {
      fetchDrillDownBills();
    }
  }, [fetchDrillDownBills]);

  // Export drill-down list to Excel
  const handleExportDrillDown = () => {
    if (bills.length === 0) return;
    const exportData = bills.map((b) => ({
      "Bill Key": b.billKey,
      "Customer Key": b.customerKey,
      "Customer Name": b.customerName,
      "Branch": b.branchName,
      "Charge Group": b.chargeGroup,
      "Period": b.period,
      "Consumption (m3)": b.cons,
      "Base Water Charge": b.baseWater,
      "Sewerage Charge": b.sewerage,
      "Sanitation Fee": b.sanitation,
      "Meter Rent": b.meterRent,
      "Maintenance Fee": b.maintenance,
      "Additional/Fire": b.additional,
      "Penalty Amount": b.penalty,
      "VAT Amount": b.vat,
      "This Month Bill": b.thisMonthAmount,
      "Outstanding Amount": b.outstanding,
      "Total Bill Amount": b.totalAmount,
      "Payment Status": b.paymentStatus,
      "DR Account": b.drAcctNo,
      "CR Account": b.crAcctNo,
      "GL Code": b.glCode,
      "Audit Status": b.auditStatus,
      "Audit Flags": b.auditFlags.join(" | "),
    }));

    const blob = arrayToXlsxBlob(exportData, Object.keys(exportData[0]));
    const filename = `gl_audit_${selectedRow?.glCode || "drilldown"}_${selectedRow?.period || "period"}.xlsx`;
    downloadFile(blob, filename);
  };

  if (!selectedRow) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl lg:max-w-5xl p-0 flex flex-col z-[100] bg-white shadow-2xl border-l border-slate-200"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/20 font-bold tracking-wider">
                  GL AUDIT DRILL-DOWN
                </span>
                <Badge variant="outline" className="border-indigo-400 text-indigo-200 text-xs font-mono">
                  {selectedRow.glCode} · {selectedRow.glName}
                </Badge>
                {selectedRow.paymentStatus.toLowerCase().includes("paid") ? (
                  <Badge className="bg-emerald-500 text-white border-0 text-xs font-bold px-2 py-0.5 whitespace-nowrap">
                    Paid and Reconciled
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white border-0 text-xs font-bold px-2 py-0.5">
                    Unpaid
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-black tracking-tight">
                {selectedRow.chargeGroup} ({selectedRow.branchName} — {selectedRow.period})
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Displaying individual customer bills ({selectedRow.paymentStatus.toLowerCase()}) composing the {formatNumber(selectedRow.totalAmount)} ETB General Ledger balance.
              </p>
            </div>

            <Button
              size="sm"
              onClick={handleExportDrillDown}
              variant="outline"
              className="rounded-xl border-white/20 text-white hover:bg-white/10 shrink-0 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export XLSX
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-center">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Billed</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{formatNumber(selectedRow.totalAmount)} ETB</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Excl. VAT</span>
              <span className="text-sm font-bold font-mono text-white">{formatNumber(selectedRow.withoutVat)} ETB</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">VAT (15%)</span>
              <span className="text-sm font-bold font-mono text-amber-400">{formatNumber(selectedRow.vatAmount)} ETB</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Bills Contributing</span>
              <span className="text-sm font-bold font-mono text-indigo-300">{formatNumber(total)} bills</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by customer name, bill key, meter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 rounded-xl border-slate-200 text-xs bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={auditFilter === "all" ? "default" : "outline"}
              onClick={() => setAuditFilter("all")}
              className="h-8 text-xs rounded-lg px-2.5"
            >
              All ({total})
            </Button>
            <Button
              size="sm"
              variant={auditFilter === "clean" ? "default" : "outline"}
              onClick={() => setAuditFilter("clean")}
              className="h-8 text-xs rounded-lg px-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              Clean Only
            </Button>
            <Button
              size="sm"
              variant={auditFilter === "flagged" ? "destructive" : "outline"}
              onClick={() => setAuditFilter("flagged")}
              className="h-8 text-xs rounded-lg px-2.5 text-red-700 border-red-200 hover:bg-red-50"
            >
              Flagged Only
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full w-full">
            <Table>
              <TableHeader className="bg-slate-100/80 sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-xs uppercase text-slate-600 whitespace-nowrap">Bill Key</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 whitespace-nowrap">Customer</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">Consumption</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">Base Water</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">VAT</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 text-right whitespace-nowrap">Total Bill</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 whitespace-nowrap">DR / CR Accounts</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-600 text-center whitespace-nowrap">Audit Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        <span>Fetching audit bills...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : bills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center text-slate-400">
                      No individual bills match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  bills.map((b) => (
                    <TableRow key={b.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-indigo-700 whitespace-nowrap">
                        {b.billKey}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]" title={b.customerName}>
                            {b.customerName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {b.customerKey}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                        {formatNumber(b.cons)} m³
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-800 whitespace-nowrap">
                        {formatNumber(b.baseWater)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-700 whitespace-nowrap">
                        {b.vat > 0 ? formatNumber(b.vat) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {formatNumber(b.totalAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col text-[10px] font-mono">
                          <span className="text-slate-600">DR: {b.drAcctNo || "EMPTY"}</span>
                          <span className="text-slate-600">CR: {b.crAcctNo || "EMPTY"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {b.auditStatus === "PASS" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> PASS
                          </Badge>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] font-bold">
                              <AlertCircle className="h-3 w-3 mr-1 text-red-600" /> FLAGGED
                            </Badge>
                            <span className="text-[9px] text-red-600 max-w-[120px] truncate mt-0.5" title={b.auditFlags.join(", ")}>
                              {b.auditFlags[0]}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Drawer Footer with Pagination */}
        <div className="border-t border-slate-200 bg-white p-3 shrink-0 flex items-center justify-between">
          <TablePagination
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
          />
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs font-medium">
            Close Audit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
