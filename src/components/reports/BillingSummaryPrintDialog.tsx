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
import {
  Printer,
  Download,
  FileText,
  Loader2,
  Building2,
  Calendar,
  CheckCircle2,
  FileClock,
  Truck,
  TrendingUp,
  Percent,
} from "lucide-react";
import type { BillsBranchSummaryRow } from "@/lib/db-queries";
import { formatNumber } from "@/lib/format";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BillingSummaryPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryData: BillsBranchSummaryRow[];
  paidData: BillsBranchSummaryRow[];
  unsettledData: BillsBranchSummaryRow[];
  branchFilterName?: string;
  monthYearFilter?: string;
  searchTerm?: string;
}

export function BillingSummaryPrintDialog({
  open,
  onOpenChange,
  deliveryData = [],
  paidData = [],
  unsettledData = [],
  branchFilterName = "All Branches",
  monthYearFilter = "All Months",
  searchTerm = "",
}: BillingSummaryPrintDialogProps) {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const currentDate = format(new Date(), "MMMM dd, yyyy 'at' HH:mm");

  // Filter rows by search term if provided
  const filterRows = React.useCallback(
    (rows: BillsBranchSummaryRow[]) => {
      if (!searchTerm.trim()) return rows;
      const term = searchTerm.toLowerCase().trim();
      return rows.filter(
        (r) =>
          r.branchName.toLowerCase().includes(term) ||
          r.branchCode.toLowerCase().includes(term)
      );
    },
    [searchTerm]
  );

  const filteredDelivery = React.useMemo(() => filterRows(deliveryData), [filterRows, deliveryData]);
  const filteredPaid = React.useMemo(() => filterRows(paidData), [filterRows, paidData]);
  const filteredUnsettled = React.useMemo(() => filterRows(unsettledData), [filterRows, unsettledData]);

  // Aggregate metrics
  const totals = React.useMemo(() => {
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

  // Consolidated comparison rows
  const consolidatedRows = React.useMemo(() => {
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
        period: r.period || monthYearFilter,
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
        period: r.period || monthYearFilter,
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
        period: r.period || monthYearFilter,
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
  }, [filteredDelivery, filteredPaid, filteredUnsettled, monthYearFilter]);

  // Native Print / Browser PDF Save
  const handlePrint = () => {
    window.print();
  };

  // Direct PDF Download via html2canvas & jsPDF
  const handleDownloadPdf = async () => {
    const element = document.getElementById("billing-summary-print-doc");
    if (!element) {
      toast({
        title: "PDF Error",
        description: "Printable content element not found.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPdf(true);
    toast({
      title: "Generating PDF",
      description: "Rendering high-resolution summary report document...",
    });

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safePeriod = monthYearFilter.replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`AAWSA_Billing_Summary_Report_${safePeriod}.pdf`);

      toast({
        title: "PDF Download Complete",
        description: "Summary report downloaded successfully as PDF.",
      });
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast({
        title: "PDF Generation Failed",
        description: err.message || "Could not generate PDF document.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderSectionTable = (
    title: string,
    badgeText: string,
    badgeClass: string,
    rows: BillsBranchSummaryRow[],
    totalBills: number,
    totalAmount: number,
    amountClass: string
  ) => (
    <div className="space-y-2 mt-5">
      <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        <div className="text-right text-xs font-mono font-bold text-slate-800">
          Subtotal: ETB {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 text-[10px] uppercase font-bold text-slate-700">
            <th className="py-1.5 px-2 text-left">Branch</th>
            <th className="py-1.5 px-2 text-right">Number of Bills</th>
            <th className="py-1.5 px-2 text-center">Period</th>
            <th className="py-1.5 px-2 text-right">Total Amount (ETB)</th>
            <th className="py-1.5 px-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-3 text-center text-slate-400 italic">
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const share = totalAmount > 0 ? (row.totalAmount / totalAmount) * 100 : 0;
              return (
                <tr key={`${row.branchCode}-${idx}`} className="border-b border-slate-200">
                  <td className="py-1.5 px-2 font-medium text-slate-800">
                    <span className="font-mono font-bold mr-1.5 text-slate-600">[{row.branchCode}]</span>
                    {row.branchName}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-700">
                    {formatNumber(row.billCount)}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-600">
                    {row.period || monthYearFilter}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                    ETB {row.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-500 text-[11px]">
                    {share.toFixed(1)}%
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-bold bg-slate-50 text-xs font-mono">
            <td className="py-2 px-2 text-slate-900 font-black">
              TOTAL ({rows.length} {rows.length === 1 ? "Branch" : "Branches"})
            </td>
            <td className="py-2 px-2 text-right font-black text-slate-900">
              {formatNumber(totalBills)}
            </td>
            <td className="py-2 px-2 text-center text-slate-600 text-[11px]">
              {monthYearFilter}
            </td>
            <td className={`py-2 px-2 text-right font-black ${amountClass}`}>
              ETB {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="py-2 px-2 text-right text-slate-600">
              100.0%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-0 shadow-2xl border-slate-200">
        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #billing-summary-print-doc,
            #billing-summary-print-doc * {
              visibility: visible;
            }
            #billing-summary-print-doc {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Modal Toolbar (Screen only) */}
        <div className="sticky top-0 z-20 bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md no-print">
          <div>
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-indigo-400" />
              <DialogTitle className="text-lg font-bold text-white">
                Billing Summary Report — Print / PDF Preview
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Review print layout, export directly to PDF, or send to physical printer.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 rounded-xl gap-1.5 font-semibold text-xs"
            >
              {isGeneratingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-400" />}
              <span>Download PDF</span>
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 rounded-xl gap-1.5 font-semibold text-xs shadow-md"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </Button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div id="billing-summary-print-doc" className="p-8 space-y-6 bg-white text-slate-900">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Addis Ababa Water & Sewerage Authority (AAWSA)
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                BILLING SUMMARY REPORT
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Consolidated Branch Breakdown: Total Delivery, Total Paid & Total Unsettled
              </p>
            </div>
            <div className="text-left md:text-right text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold text-slate-800">Generated: </span>
                {currentDate}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Branch Filter: </span>
                <span className="font-mono font-bold text-slate-900">{branchFilterName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Period: </span>
                <span className="font-mono font-bold text-indigo-700">{monthYearFilter}</span>
              </div>
            </div>
          </div>

          {/* Executive Summary Metric KPI Tiles */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                Total Delivery
              </div>
              <div className="text-sm font-black font-mono text-blue-950 mt-1">
                ETB {totals.delivery.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-blue-700 font-mono mt-0.5">
                {formatNumber(totals.delivery.bills)} bills posted
              </div>
            </div>

            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Total Paid
              </div>
              <div className="text-sm font-black font-mono text-emerald-950 mt-1">
                ETB {totals.paid.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                {formatNumber(totals.paid.bills)} bills settled
              </div>
            </div>

            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Total Unsettled
              </div>
              <div className="text-sm font-black font-mono text-amber-950 mt-1">
                ETB {totals.unsettled.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                {formatNumber(totals.unsettled.bills)} bills pending
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                Collection Efficiency
              </div>
              <div className="text-sm font-black font-mono text-indigo-950 mt-1">
                {totals.collectionRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {totals.unsettledRate.toFixed(1)}% outstanding
              </div>
            </div>
          </div>

          {/* Section 1: Total Delivery */}
          {renderSectionTable(
            "1. Total Delivery Summary",
            "Delivered / Posted Bills",
            "bg-blue-50 text-blue-800 border-blue-200",
            filteredDelivery,
            totals.delivery.bills,
            totals.delivery.amount,
            "text-blue-900"
          )}

          {/* Section 2: Total Paid */}
          {renderSectionTable(
            "2. Total Paid Summary",
            "Collected Payments",
            "bg-emerald-50 text-emerald-800 border-emerald-200",
            filteredPaid,
            totals.paid.bills,
            totals.paid.amount,
            "text-emerald-900"
          )}

          {/* Section 3: Total Unsettled */}
          {renderSectionTable(
            "3. Total Unsettled Summary",
            "Pending Settlements",
            "bg-amber-50 text-amber-800 border-amber-200",
            filteredUnsettled,
            totals.unsettled.bills,
            totals.unsettled.amount,
            "text-amber-900"
          )}

          {/* Section 4: Consolidated Branch Matrix */}
          <div className="space-y-2 mt-6">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-300">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">4. Consolidated Branch Comparison Matrix</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-300">
                  {consolidatedRows.length} Branches
                </span>
              </div>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-[10px] uppercase font-bold text-slate-700">
                  <th className="py-1.5 px-2 text-left" rowSpan={2}>Branch</th>
                  <th className="py-1.5 px-2 text-center" rowSpan={2}>Period</th>
                  <th className="py-1 px-2 text-center bg-blue-50/70 text-blue-900 border-l border-r border-blue-100" colSpan={2}>
                    Total Delivery
                  </th>
                  <th className="py-1 px-2 text-center bg-emerald-50/70 text-emerald-900 border-r border-emerald-100" colSpan={2}>
                    Total Paid
                  </th>
                  <th className="py-1 px-2 text-center bg-amber-50/70 text-amber-900 border-r border-amber-100" colSpan={2}>
                    Total Unsettled
                  </th>
                  <th className="py-1.5 px-2 text-right" rowSpan={2}>Recovery</th>
                </tr>
                <tr className="border-b border-slate-300 text-[9px] uppercase font-bold text-slate-600">
                  <th className="py-1 px-1.5 text-right bg-blue-50/40 text-blue-800 border-l border-blue-100">Bills</th>
                  <th className="py-1 px-1.5 text-right bg-blue-50/40 text-blue-800 border-r border-blue-100">Amount (ETB)</th>
                  <th className="py-1 px-1.5 text-right bg-emerald-50/40 text-emerald-800">Bills</th>
                  <th className="py-1 px-1.5 text-right bg-emerald-50/40 text-emerald-800 border-r border-emerald-100">Amount (ETB)</th>
                  <th className="py-1 px-1.5 text-right bg-amber-50/40 text-amber-800">Bills</th>
                  <th className="py-1 px-1.5 text-right bg-amber-50/40 text-amber-800 border-r border-amber-100">Amount (ETB)</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedRows.map((r, idx) => {
                  const recRate = r.deliveryAmount > 0 ? (r.paidAmount / r.deliveryAmount) * 100 : 0;
                  return (
                    <tr key={`${r.branchCode}-${idx}`} className="border-b border-slate-200 font-mono text-[11px]">
                      <td className="py-1.5 px-2 font-sans font-medium text-slate-800">
                        <span className="font-bold mr-1 text-slate-600">[{r.branchCode}]</span> {r.branchName}
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-600">{r.period}</td>
                      <td className="py-1.5 px-2 text-right text-blue-900 border-l border-slate-200">
                        {formatNumber(r.deliveryBills)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-blue-950 border-r border-slate-200">
                        ETB {r.deliveryAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-2 text-right text-emerald-900">
                        {formatNumber(r.paidBills)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-emerald-950 border-r border-slate-200">
                        ETB {r.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-2 text-right text-amber-900">
                        {formatNumber(r.unsettledBills)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-amber-950 border-r border-slate-200">
                        ETB {r.unsettledAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-slate-900">
                        {recRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-400 font-bold bg-slate-100 text-xs font-mono">
                  <td className="py-2 px-2 text-slate-900 font-black font-sans">
                    TOTAL ({consolidatedRows.length} Branches)
                  </td>
                  <td className="py-2 px-2 text-center text-slate-600 text-[11px]">{monthYearFilter}</td>
                  <td className="py-2 px-2 text-right font-black text-blue-950 border-l border-slate-300">
                    {formatNumber(totals.delivery.bills)}
                  </td>
                  <td className="py-2 px-2 text-right font-black text-blue-950 border-r border-slate-300">
                    ETB {totals.delivery.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-black text-emerald-950">
                    {formatNumber(totals.paid.bills)}
                  </td>
                  <td className="py-2 px-2 text-right font-black text-emerald-950 border-r border-slate-300">
                    ETB {totals.paid.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-black text-amber-950">
                    {formatNumber(totals.unsettled.bills)}
                  </td>
                  <td className="py-2 px-2 text-right font-black text-amber-950 border-r border-slate-300">
                    ETB {totals.unsettled.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-black text-indigo-950">
                    {totals.collectionRate.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Sign-off Signatures */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 pb-7"></div>
              <div className="font-bold text-slate-900 mt-2">Prepared By (Staff Signature)</div>
              <div className="text-slate-400 text-[10px]">Date: ________________________</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-7"></div>
              <div className="font-bold text-slate-900 mt-2">Verified By (Branch Auditor)</div>
              <div className="text-slate-400 text-[10px]">Date: ________________________</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-7"></div>
              <div className="font-bold text-slate-900 mt-2">Approved By (Branch Manager)</div>
              <div className="text-slate-400 text-[10px]">Date: ________________________</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (Screen only) */}
        <div className="no-print bg-slate-50 p-4 rounded-b-3xl flex items-center justify-between border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Tip: In the print dialog, select <span className="font-bold text-slate-700">"Save as PDF"</span> for digital PDF output or choose your printer.
          </p>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Close
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              variant="outline"
              className="rounded-xl border-slate-300 gap-1.5 font-semibold text-slate-700"
            >
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-emerald-600" />}
              <span>Download PDF (.pdf)</span>
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl gap-2 shadow-md"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

