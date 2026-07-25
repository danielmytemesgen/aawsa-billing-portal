"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X, Download, FileSpreadsheet, Send, CheckCircle2, Building2, Calendar, UserCheck } from "lucide-react";
import type { DomainBill } from "@/lib/data-store";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { Branch } from "@/app/(dashboard)/admin/branches/branch-types";
import { getBillKey, getCustomerIdentifier, getCustomerKeyDisplay, getBranchNameDisplay } from "@/lib/export-utils";
import { getMonthlyBillAmt } from "@/lib/billing-utils";
import { formatNumber } from "@/lib/format";
import { formatDate } from "@/lib/utils";
import { format } from "date-fns";

interface ReportPrintSummaryDialogProps {
  open: boolean;
  onOpenChange?: any;
  type: 'sent' | 'paid';
  bills: DomainBill[];
  customers?: IndividualCustomer[];
  bulkMeters?: BulkMeter[];
  branches?: Branch[];
  branchFilterName?: string;
  monthYearFilter?: string;
  searchTerm?: string;
}

export function ReportPrintSummaryDialog({
  open,
  onOpenChange,
  type,
  bills = [],
  customers = [],
  bulkMeters = [],
  branches = [],
  branchFilterName = "All Branches",
  monthYearFilter = "All Months",
  searchTerm = "",
}: ReportPrintSummaryDialogProps) {
  const currentDate = format(new Date(), "MMMM dd, yyyy 'at' HH:mm");

  // Summary Metrics
  const metrics = React.useMemo(() => {
    let totalUsage = 0;
    let totalCurrent = 0;
    let totalOutstanding = 0;
    let totalPenalty = 0;
    let totalAmount = 0;
    let reconciledCount = 0;

    bills.forEach((bill: any) => {
      const prevRead = Number(bill.PREVREAD ?? bill.prevRead ?? 0);
      const currRead = Number(bill.CURRREAD ?? bill.currRead ?? 0);
      const usage = bill.CONS !== undefined && bill.CONS !== null ? Number(bill.CONS) : Math.max(0, currRead - prevRead);
      totalUsage += usage;

      const d30 = Number(bill.debit30 ?? bill.debit_30 ?? 0);
      const d30_60 = Number(bill.debit30_60 ?? bill.debit_30_60 ?? 0);
      const d60 = Number(bill.debit60 ?? bill.debit_60 ?? 0);

      const outstanding = Number(bill.OUTSTANDINGAMT ?? (d30 + d30_60 + d60));
      const currentBill = getMonthlyBillAmt(bill);
      const penalty = Number(bill.PENALTYAMT ?? 0);
      const totalDue = Number(bill.totalAmountDue ?? bill.TOTALBILLAMOUNT ?? (outstanding + currentBill + penalty));

      totalOutstanding += outstanding;
      totalCurrent += currentBill;
      totalPenalty += penalty;
      totalAmount += type === 'paid' ? Number(bill.amount_paid ?? bill.amountPaid ?? totalDue) : totalDue;

      const status = bill.reconciliation_status_computed || bill.reconciliation_status || bill.reconciliationStatus || "";
      if (status.toLowerCase() === 'reconciled') reconciledCount++;
    });

    return {
      totalCount: bills.length,
      totalUsage,
      totalCurrent,
      totalOutstanding,
      totalPenalty,
      totalAmount,
      reconciledCount,
    };
  }, [bills, type]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 shadow-2xl border-slate-200">
        <style jsx global>{`
          @media print {
            /* Hide main page layout elements */
            header, nav, aside, footer, main, .no-print, [data-aria-hidden="true"] {
              display: none !important;
            }

            /* Reset html & body for printable document */
            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Reset Radix Dialog Portal & DialogContent containers */
            [data-radix-portal],
            [role="dialog"],
            div[data-state="open"] {
              position: static !important;
              display: block !important;
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
              width: 100% !important;
              max-width: 100% !important;
              transform: none !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Hide focus guards */
            [data-radix-focus-guard] {
              display: none !important;
            }

            /* Force print summary section to be visible and occupy full document flow */
            #print-summary-section {
              display: block !important;
              visibility: visible !important;
              position: relative !important;
              left: auto !important;
              top: auto !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 5mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              box-shadow: none !important;
              border: none !important;
            }

            #print-summary-section * {
              visibility: visible !important;
            }

            #print-summary-section tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            #print-summary-section thead {
              display: table-header-group !important;
            }

            #print-summary-section tfoot {
              display: table-footer-group !important;
            }

            @page {
              size: A4 landscape;
              margin: 8mm;
            }
          }
        `}</style>

        {/* Modal Header Controls (Screen only) */}
        <div className="no-print bg-slate-900 text-white p-6 rounded-t-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {type === 'sent' ? (
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Send className="h-5 w-5" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Print Summary — {type === 'sent' ? 'Sent Bills Report' : 'Paid Bills Report'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-0.5">
                Official Summary Statement for {branchFilterName} ({metrics.totalCount} records)
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl gap-2 shadow-md"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Print Summary Content Document */}
        <div id="print-summary-section" className="p-8 space-y-6 bg-white">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blue-700">Addis Ababa Water & Sewerage Authority</div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                {type === 'sent' ? 'SENT BILLS SUMMARY REPORT' : 'PAID BILLS SUMMARY REPORT'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">Generated on {currentDate}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1 min-w-[220px]">
              <div className="flex justify-between text-slate-600">
                <span className="font-bold">Branch:</span>
                <span className="font-semibold text-slate-900">{branchFilterName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-bold">Period:</span>
                <span className="font-semibold text-slate-900">{monthYearFilter}</span>
              </div>
              {searchTerm && (
                <div className="flex justify-between text-slate-600">
                  <span className="font-bold">Search:</span>
                  <span className="font-semibold text-slate-900">{searchTerm}</span>
                </div>
              )}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Records</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalCount}</div>
            </div>
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="text-xs font-bold text-blue-700 uppercase">Total Consumption</div>
              <div className="text-2xl font-black text-blue-900 mt-1">{formatNumber(metrics.totalUsage)} m³</div>
            </div>
            {type === 'sent' ? (
              <>
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                  <div className="text-xs font-bold text-amber-700 uppercase">Total Current Bill</div>
                  <div className="text-2xl font-black text-amber-900 mt-1">{formatNumber(metrics.totalCurrent)} ETB</div>
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  <div className="text-xs font-bold text-indigo-700 uppercase">Total Payable</div>
                  <div className="text-2xl font-black text-indigo-950 mt-1">{formatNumber(metrics.totalAmount)} ETB</div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <div className="text-xs font-bold text-emerald-700 uppercase">Total Amount Paid</div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">{formatNumber(metrics.totalAmount)} ETB</div>
                </div>
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                  <div className="text-xs font-bold text-purple-700 uppercase">Reconciled Records</div>
                  <div className="text-2xl font-black text-purple-900 mt-1">{metrics.reconciledCount} / {metrics.totalCount}</div>
                </div>
              </>
            )}
          </div>

          {/* Report Data Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Bill Key</th>
                  <th className="py-3 px-3">Customer / Meter</th>
                  <th className="py-3 px-3">Customer Key</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3 text-right">Usage (m³)</th>
                  {type === 'sent' ? (
                    <>
                      <th className="py-3 px-3 text-right">Current Bill</th>
                      <th className="py-3 px-3 text-right">Outstanding</th>
                      <th className="py-3 px-3 text-right">Penalty</th>
                      <th className="py-3 px-3 text-right">Total Due</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-3 text-right">Amount Paid</th>
                      <th className="py-3 px-3">Payment Date</th>
                      <th className="py-3 px-3">Channel</th>
                      <th className="py-3 px-3 text-center">Reconciled</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bills.length > 0 ? (
                  bills.map((bill: any, index: number) => {
                    const billKey = getBillKey(bill);
                    const custName = getCustomerIdentifier(bill, customers, bulkMeters);
                    const custKey = getCustomerKeyDisplay(bill);
                    const branchName = getBranchNameDisplay(bill, customers, bulkMeters, branches);

                    const prevRead = Number(bill.PREVREAD ?? bill.prevRead ?? 0);
                    const currRead = Number(bill.CURRREAD ?? bill.currRead ?? 0);
                    const usage = bill.CONS !== undefined && bill.CONS !== null ? Number(bill.CONS) : Math.max(0, currRead - prevRead);

                    const currentBill = getMonthlyBillAmt(bill);
                    const d30 = Number(bill.debit30 ?? bill.debit_30 ?? 0);
                    const d30_60 = Number(bill.debit30_60 ?? bill.debit_30_60 ?? 0);
                    const d60 = Number(bill.debit60 ?? bill.debit_60 ?? 0);

                    const outstanding = Number(bill.OUTSTANDINGAMT ?? (d30 + d30_60 + d60));
                    const penalty = Number(bill.PENALTYAMT ?? 0);
                    const totalDue = Number(bill.totalAmountDue ?? bill.TOTALBILLAMOUNT ?? (outstanding + currentBill + penalty));
                    const amtPaid = Number(bill.amount_paid ?? bill.amountPaid ?? totalDue);

                    const status = bill.paymentStatus || bill.payment_status || 'Unpaid';
                    const reconStatus = bill.reconciliation_status_computed || bill.reconciliation_status || bill.reconciliationStatus || 'Not reconciled';

                    return (
                      <tr key={bill.id || index} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{index + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{billKey}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{custName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{custKey}</td>
                        <td className="py-2.5 px-3 text-slate-600">{branchName}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatNumber(usage)}</td>
                        {type === 'sent' ? (
                          <>
                            <td className="py-2.5 px-3 text-right">{formatNumber(currentBill)}</td>
                            <td className="py-2.5 px-3 text-right">{formatNumber(outstanding)}</td>
                            <td className="py-2.5 px-3 text-right text-red-600">{formatNumber(penalty)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-900">{formatNumber(totalDue)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {status}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatNumber(amtPaid)}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {bill.last_payment_date ? format(new Date(bill.last_payment_date), 'yyyy-MM-dd HH:mm') : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{bill.payment_channel || 'CBE'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${reconStatus.toLowerCase() === 'reconciled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {reconStatus}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      No records found for summary print.
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Summary Totals Row */}
              {bills.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider">Total Summary:</td>
                    <td className="py-3 px-3 text-right font-mono">{formatNumber(metrics.totalUsage)} m³</td>
                    {type === 'sent' ? (
                      <>
                        <td className="py-3 px-3 text-right font-mono">{formatNumber(metrics.totalCurrent)}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatNumber(metrics.totalOutstanding)}</td>
                        <td className="py-3 px-3 text-right font-mono text-red-600">{formatNumber(metrics.totalPenalty)}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-indigo-900">{formatNumber(metrics.totalAmount)} ETB</td>
                        <td className="py-3 px-3"></td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-800">{formatNumber(metrics.totalAmount)} ETB</td>
                        <td colSpan={3} className="py-3 px-3 text-center text-purple-800">
                          {metrics.reconciledCount} Reconciled
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Official Sign-off Footer */}
          <div className="pt-10 border-t border-slate-200 grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 pb-8"></div>
              <div className="font-bold text-slate-800 mt-2">Prepared By (Staff Signature)</div>
              <div className="text-slate-400 text-[10px]">Date: ________________________</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8"></div>
              <div className="font-bold text-slate-800 mt-2">Verified By (Branch Auditor)</div>
              <div className="text-slate-400 text-[10px]">Date: ________________________</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8"></div>
              <div className="font-bold text-slate-800 mt-2">Approved By (Branch Manager)</div>
              <div className="text-slate-400 text-[10px]">Date: ________________________</div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Screen only) */}
        <div className="no-print bg-slate-100 p-4 rounded-b-3xl flex justify-end gap-3 border-t border-slate-200">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} className="rounded-xl">
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl gap-2 shadow-md"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
