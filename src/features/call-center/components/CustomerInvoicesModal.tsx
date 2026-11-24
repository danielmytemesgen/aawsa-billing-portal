"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Printer,
  Sparkles,
  DollarSign,
  Receipt,
  Calendar,
  CheckCircle,
  XCircle,
  Droplets,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CustomerInvoicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any | null;
  bills: any[];
  reconstructedHistoryMap: Map<string, any>;
  onPreviewInvoice: (bill: any) => void;
  onExplainBill: (bill: any, recon: any) => void;
}

export function CustomerInvoicesModal({
  open,
  onOpenChange,
  customer,
  bills,
  reconstructedHistoryMap,
  onPreviewInvoice,
  onExplainBill,
}: CustomerInvoicesModalProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredBills = React.useMemo(() => {
    if (!bills || !bills.length) return [];
    if (!searchTerm.trim()) return bills;
    const q = searchTerm.toLowerCase();
    return bills.filter((b) => {
      const month = String(b.month_year || b.MONTHYEAR || b.month || "").toLowerCase();
      const id = String(b.id || b.bill_key || b.BILLKEY || "").toLowerCase();
      const status = String(b.status || b.payment_status || "").toLowerCase();
      return month.includes(q) || id.includes(q) || status.includes(q);
    });
  }, [bills, searchTerm]);

  // Aggregate summary
  const { totalInvoiced, totalOutstanding, unpaidCount } = React.useMemo(() => {
    if (!bills || !bills.length) {
      return { totalInvoiced: 0, totalOutstanding: 0, unpaidCount: 0 };
    }
    let invoicedSum = 0;
    let unpaid = 0;
    let maxOutstanding = 0;

    for (const b of bills) {
      const rowKey = b.id || b.bill_key || b.BILLKEY || b.month_year;
      const recon = reconstructedHistoryMap?.get(rowKey);
      const isUnpaid = recon
        ? recon.paymentStatus.toLowerCase().includes("unpaid")
        : (b.payment_status || "").toLowerCase().includes("unpaid");

      if (isUnpaid) unpaid++;

      const thisAmt = recon
        ? recon.currentMonthly
        : Number(b.this_month_bill_amt ?? b.total_bill_amount ?? 0);
      invoicedSum += thisAmt;

      if (recon && recon.outstanding > maxOutstanding) {
        maxOutstanding = recon.outstanding;
      }
    }

    const currentBal = Number(customer?.outstandingBill || maxOutstanding || 0);

    return {
      totalInvoiced: invoicedSum,
      totalOutstanding: currentBal,
      unpaidCount: unpaid,
    };
  }, [bills, reconstructedHistoryMap, customer]);

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:max-w-5xl max-w-5xl md:max-w-[1020px] max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl border-gray-200"
        style={{ width: "95vw", maxWidth: "1020px" }}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-50/90 to-indigo-50/40 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Customer Invoices Archive — {customer.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                All generated billing invoices and settlement records for account {customer.customerKey}.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs font-mono bg-white text-gray-700">
                Key: {customer.customerKey}
              </Badge>
              <Badge variant="secondary" className="text-xs font-mono">
                Meter: {customer.meterNumber || "N/A"}
              </Badge>
              <Badge variant="outline" className="text-xs bg-white text-blue-700 border-blue-200">
                {customer.branchName || "Branch"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* KPI Strip */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5 text-blue-600" /> Total Invoices
            </span>
            <p className="text-lg font-bold font-mono text-gray-900 mt-0.5">
              {bills.length}
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-blue-600" /> Current Outstanding
            </span>
            <p className={cn("text-lg font-bold font-mono mt-0.5", totalOutstanding > 0 ? "text-blue-700" : "text-emerald-700")}>
              {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-amber-600" /> Unpaid Invoices
            </span>
            <p className={cn("text-lg font-bold font-mono mt-0.5", unpaidCount > 0 ? "text-amber-700" : "text-emerald-700")}>
              {unpaidCount} bill{unpaidCount !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-500" /> Latest Billing
            </span>
            <p className="text-sm font-bold font-mono text-gray-800 mt-1 truncate">
              {bills[0]?.month_year || "No bills"}
            </p>
          </div>
        </div>

        {/* Invoices Table Container */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Billing Period</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 whitespace-nowrap">Invoice ID</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Consumption (m³)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Current Bill (ETB)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">Arrears & Penalty</TableHead>
                  <TableHead className="text-xs font-bold text-gray-900 py-3 text-right whitespace-nowrap">Total Payable (ETB)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-center whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-700 py-3 text-right whitespace-nowrap">In-Console Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-sm text-gray-400">
                      No invoices found for this account.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((b, idx) => {
                    const rowKey = b.id || b.bill_key || b.BILLKEY || b.month_year;
                    const recon = reconstructedHistoryMap.get(rowKey);
                    const monthYear = b.month_year || b.MONTHYEAR || b.month || `Period ${idx + 1}`;
                    const billId = b.id ? String(b.id).slice(0, 8) : b.bill_key || `INV-${idx + 1}`;

                    const prev = Number(b.prev_read ?? b.PREVREAD ?? b.prevRead ?? 0);
                    const curr = Number(b.curr_read ?? b.CURRREAD ?? b.currRead ?? 0);
                    const cons = Number(b.cons ?? b.CONS ?? Math.max(0, curr - prev));
                    const diffUsage = Number(b.difference_usage ?? b.differenceUsage ?? 0);

                    const currentMonthly = recon
                      ? recon.currentMonthly
                      : Number(b.this_month_bill_amt ?? b.total_bill_amount ?? 0);
                    const outstanding = recon
                      ? recon.outstanding
                      : Number(b.debit_30 ?? 0) + Number(b.debit_30_60 ?? 0) + Number(b.debit_60 ?? 0) + Number(b.penalty_amt ?? 0);
                    const totalPayable = recon ? recon.totalPayable : outstanding + currentMonthly;

                    const payStatus = recon ? recon.paymentStatus : b.payment_status || "Unpaid";
                    const isPaid = (payStatus || "").toLowerCase() === "paid";

                    return (
                      <TableRow key={rowKey || idx} className="hover:bg-blue-50/20 transition-colors">
                        {/* Month / Period */}
                        <TableCell className="font-mono font-bold text-xs text-gray-900 py-3 whitespace-nowrap">
                          {monthYear}
                        </TableCell>

                        {/* Invoice Ref */}
                        <TableCell className="font-mono text-xs text-gray-500 py-3 whitespace-nowrap">
                          {billId}
                        </TableCell>

                        {/* Consumption */}
                        <TableCell className="font-mono text-xs text-right py-3 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">{cons.toFixed(2)} m³</span>
                          {diffUsage > 0 && (
                            <span className="text-[10px] text-orange-600 ml-1">(+{diffUsage.toFixed(1)} diff)</span>
                          )}
                        </TableCell>

                        {/* Current Monthly */}
                        <TableCell className="font-mono text-xs text-gray-700 text-right py-3 whitespace-nowrap">
                          {currentMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        {/* Arrears */}
                        <TableCell className="font-mono text-xs text-right py-3 whitespace-nowrap">
                          {outstanding > 0 ? (
                            <span className="text-amber-700 font-semibold">{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-gray-300">0.00</span>
                          )}
                        </TableCell>

                        {/* Total Payable */}
                        <TableCell className="font-mono font-bold text-xs text-blue-700 text-right py-3 whitespace-nowrap">
                          {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="text-center py-3 whitespace-nowrap">
                          <Badge
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                              isPaid
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            )}
                          >
                            {isPaid ? <CheckCircle className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                            {payStatus}
                          </Badge>
                        </TableCell>

                        {/* In-Console Actions */}
                        <TableCell className="text-right py-3 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onPreviewInvoice(b);
                              }}
                              className="h-7 text-xs px-2.5 bg-blue-50/70 hover:bg-blue-100 text-blue-700 border-blue-200 gap-1 font-semibold cursor-pointer"
                              title="View & Print Official Digital Invoice Document"
                            >
                              <Printer className="h-3 w-3 text-blue-600" />
                              View Invoice
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onExplainBill(b, recon);
                              }}
                              className="h-7 text-xs px-2 text-purple-700 bg-purple-50/60 hover:bg-purple-100 border-purple-200 gap-1 font-semibold cursor-pointer"
                              title="Open Spoken Breakdown & Talking Script"
                            >
                              <Sparkles className="h-3 w-3 text-purple-600" />
                              Explain
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[11px] text-gray-500 italic">
            * All invoice documents can be previewed, audited, and printed directly without leaving the Call Center 360° Console.
          </p>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 px-4 bg-gray-900 hover:bg-gray-800 text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
