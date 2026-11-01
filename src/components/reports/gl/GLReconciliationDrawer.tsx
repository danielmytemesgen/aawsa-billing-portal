"use client";

import React, { useState, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/lib/format";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
  Scale,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  Info,
} from "lucide-react";
import type { GLReconciliationAudit, GLDivergentBill } from "@/lib/gl-audit-actions";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";

interface GLReconciliationDrawerProps {
  open: boolean;
  onClose: () => void;
  reconciliationAudit: GLReconciliationAudit | null;
  periodLabel?: string;
  branchLabel?: string;
}

export function GLReconciliationDrawer({
  open,
  onClose,
  reconciliationAudit,
  periodLabel = "Current Filter Scope",
  branchLabel = "All Branches",
}: GLReconciliationDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const bills = reconciliationAudit?.divergentBills || [];
  const isReconciled = reconciliationAudit?.isReconciled ?? true;
  const variance = reconciliationAudit?.varianceAmount || 0;
  const paidReportTotal = reconciliationAudit?.paidReportTotal || 0;
  const glGrossTotal = reconciliationAudit?.glGrossTotal || 0;

  // Filter divergent bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesSearch =
        !searchTerm.trim() ||
        b.billKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customerKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.rootCauseReason.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        typeFilter === "all" || b.varianceType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [bills, searchTerm, typeFilter]);

  const handleExportXLSX = () => {
    if (bills.length === 0) return;
    const rows = bills.map((b) => ({
      "Bill Key": b.billKey,
      "Customer Key": b.customerKey,
      "Customer Name": b.customerName,
      "Branch": b.branchName,
      "Period": b.period,
      "Paid Report Amount (ETB)": b.paidReportAmount,
      "GL Recognized Amount (ETB)": b.glRecognizedAmount,
      "Variance Δ (ETB)": b.varianceAmount,
      "Variance Type": b.varianceType,
      "Root Cause & Reason": b.rootCauseReason,
    }));

    const headers = Object.keys(rows[0]);
    const blob = arrayToXlsxBlob(rows, headers, "Reconciliation_Variances");
    downloadFile(blob, `AAWSA_Reconciliation_Variances_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getVarianceBadge = (type: GLDivergentBill["varianceType"]) => {
    switch (type) {
      case "PENALTY_EXCLUSION":
        return (
          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-semibold">
            Tariff Penalty Policy
          </Badge>
        );
      case "PARTIAL_PAYMENT":
        return (
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-semibold">
            Partial Payment
          </Badge>
        );
      case "COMPONENT_ROUNDING":
        return (
          <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-semibold">
            Math Mismatch
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200 font-semibold">
            Ledger Discrepancy
          </Badge>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl lg:max-w-5xl flex flex-col p-0 bg-slate-50/70 border-l border-slate-200 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="p-6 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isReconciled ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"}`}>
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <SheetTitle className="text-xl font-black text-slate-900 tracking-tight">
                  Paid Bills vs GL Reconciliation Audit
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 font-medium">
                  Scope: {periodLabel} · Branch: {branchLabel}
                </SheetDescription>
              </div>
            </div>
            {isReconciled ? (
              <Badge className="bg-emerald-500 text-white font-bold text-xs px-3 py-1 gap-1.5 shadow-sm">
                <ShieldCheck className="h-4 w-4" /> 100% Reconciled
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-amber-600 text-white font-bold text-xs px-3 py-1 gap-1.5 shadow-sm">
                <AlertTriangle className="h-4 w-4" /> Variance Detected
              </Badge>
            )}
          </div>

          {/* Top Scorecard Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Paid Bills Report Total
              </div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {formatNumber(paidReportTotal)} <span className="text-xs font-medium text-slate-500">ETB</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                GL Gross Billed
              </div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {formatNumber(glGrossTotal)} <span className="text-xs font-medium text-slate-500">ETB</span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isReconciled ? "bg-emerald-50/60 border-emerald-200" : "bg-amber-50 border-amber-300"}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Net Variance (Δ)
              </div>
              <div className={`text-lg font-black mt-0.5 ${isReconciled ? "text-emerald-700" : "text-amber-700"}`}>
                {Math.abs(variance) > 0 ? (variance > 0 ? `+${formatNumber(variance)}` : formatNumber(variance)) : "0.00"}{" "}
                <span className="text-xs font-medium">ETB</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Divergent Bills
              </div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {bills.length} <span className="text-xs font-medium text-slate-500">{bills.length === 1 ? "bill" : "bills"}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Content Body */}
        <div className="p-6 flex-1 flex flex-col min-h-0 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by Bill Key, Customer, Branch, or Reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 rounded-xl border-slate-200 text-xs bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by variance type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Variance Types</option>
                <option value="PENALTY_EXCLUSION">Tariff Penalty Policy</option>
                <option value="PARTIAL_PAYMENT">Partial Payments</option>
                <option value="COMPONENT_ROUNDING">Math Mismatch</option>
                <option value="STATUS_MISMATCH">Other Discrepancies</option>
              </select>

              {bills.length > 0 && (
                <Button
                  onClick={handleExportXLSX}
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-slate-200 bg-white text-xs font-semibold h-9 gap-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export</span>
                </Button>
              )}
            </div>
          </div>

          {/* Table or Empty Reconciled State */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {bills.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 mb-3">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  100% Reconciled — Zero Variances
                </h3>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Every bill recognized in the Paid Bills Report matches the General Ledger classifications with 100% exact parity (0.00 ETB discrepancy).
                </p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Info className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500">No divergent bills match your search criteria.</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="text-[11px] font-bold text-slate-700">Bill Key &amp; Customer</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700">Branch &amp; Period</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 text-right">Paid Report</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 text-right">GL Recognized</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 text-right">Variance (Δ)</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700">Type &amp; Diagnosis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((b) => (
                      <TableRow key={b.billId} className="hover:bg-slate-50/70 border-b border-slate-100">
                        <TableCell className="py-2.5">
                          <div className="font-mono font-bold text-xs text-slate-900">{b.billKey}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{b.customerName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{b.customerKey}</div>
                        </TableCell>

                        <TableCell className="py-2.5">
                          <div className="font-semibold text-xs text-slate-800">{b.branchName}</div>
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 mt-0.5">
                            {b.period}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-2.5 text-right font-mono text-xs font-semibold text-slate-900">
                          {formatNumber(b.paidReportAmount)} ETB
                        </TableCell>

                        <TableCell className="py-2.5 text-right font-mono text-xs font-semibold text-indigo-700">
                          {formatNumber(b.glRecognizedAmount)} ETB
                        </TableCell>

                        <TableCell className="py-2.5 text-right">
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg ${
                              Math.abs(b.varianceAmount) > 0.01
                                ? b.varianceAmount > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                                : "text-slate-500"
                            }`}
                          >
                            {b.varianceAmount > 0 ? `+${formatNumber(b.varianceAmount)}` : formatNumber(b.varianceAmount)} ETB
                          </span>
                        </TableCell>

                        <TableCell className="py-2.5 max-w-[280px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            {getVarianceBadge(b.varianceType)}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-tight">
                            {b.rootCauseReason}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 bg-white border-t border-slate-200 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredBills.length} of {bills.length} divergent bills
          </div>
          <Button onClick={onClose} variant="outline" className="rounded-xl h-9 text-xs font-semibold">
            Close Inspector
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
