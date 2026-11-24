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
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Copy,
  Check,
  Send,
  Droplets,
  DollarSign,
  AlertTriangle,
  Receipt,
  HelpCircle,
  Clock,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BillExplainerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: any | null;
  customer: any | null;
  reconstructedData?: {
    d30: number;
    d30_60: number;
    d60: number;
    penalty: number;
    outstanding: number;
    currentMonthly: number;
    totalPayable: number;
    paymentStatus: string;
  } | null;
}

export function BillExplainerModal({
  open,
  onOpenChange,
  bill,
  customer,
  reconstructedData,
}: BillExplainerModalProps) {
  const { toast } = useToast();
  const [copiedScript, setCopiedScript] = React.useState(false);
  const [copiedSms, setCopiedSms] = React.useState(false);

  if (!bill) return null;

  const monthYear = bill.month_year || bill.MONTHYEAR || bill.month || "Current Period";
  const prevRead = Number(bill.prev_read ?? bill.PREVREAD ?? bill.prevRead ?? 0);
  const currRead = Number(bill.curr_read ?? bill.CURRREAD ?? bill.currRead ?? 0);
  const usage = Number(bill.cons ?? bill.CONS ?? Math.max(0, currRead - prevRead));
  const diffUsage = Number(bill.difference_usage ?? bill.differenceUsage ?? 0);

  const d30 = reconstructedData ? reconstructedData.d30 : Number(bill.debit_30 ?? bill.debit30 ?? 0);
  const d30_60 = reconstructedData ? reconstructedData.d30_60 : Number(bill.debit_30_60 ?? bill.debit30_60 ?? 0);
  const d60 = reconstructedData ? reconstructedData.d60 : Number(bill.debit_60 ?? bill.debit60 ?? 0);
  const penalty = reconstructedData ? reconstructedData.penalty : Number(bill.penalty_amt ?? bill.PENALTYAMT ?? 0);
  const currentMonthly = reconstructedData ? reconstructedData.currentMonthly : Number(bill.this_month_bill_amt ?? bill.total_bill_amount ?? 0);
  const outstanding = reconstructedData ? reconstructedData.outstanding : (d30 + d30_60 + d60 + penalty);
  const totalPayable = reconstructedData ? reconstructedData.totalPayable : (outstanding + currentMonthly);
  const paymentStatus = reconstructedData ? reconstructedData.paymentStatus : (bill.payment_status || "Unpaid");
  const isPaid = (paymentStatus || "").toLowerCase() === "paid";

  // Generate caller talking points
  const customerName = customer?.name || "Customer";
  const customerKey = customer?.customerKey || bill.CUSTOMERKEY || "Account";
  const customerPhone = customer?.phone || "";

  const scriptText = `Dear ${customerName}, your total payable bill for ${monthYear} is ${totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB. This consists of: ${currentMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB for this month's water consumption of ${usage.toFixed(2)} m³ (meter read ${prevRead.toFixed(1)} to ${currRead.toFixed(1)})${diffUsage > 0 ? `, plus ${diffUsage.toFixed(2)} m³ bulk difference allocation` : ""}.${outstanding > 0 ? ` You also have prior unpaid arrears of ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB (including ${d30 > 0 ? `1-month debt: ${d30.toFixed(2)} ETB, ` : ""}${penalty > 0 ? `penalty: ${penalty.toFixed(2)} ETB` : "no penalties"}).` : " You have no outstanding arrears."} Payment can be made via Telebirr or CBE Birr using your customer key ${customerKey}.`;

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopiedScript(true);
      toast({ title: "Copied to Clipboard", description: "Agent talking script copied successfully." });
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      toast({ variant: "destructive", title: "Copy Failed", description: "Unable to copy script." });
    }
  };

  const breakdownSmsText = `AAWSA Bill Breakdown: Account ${customerKey} (${monthYear}). Current: ${currentMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB, Arrears: ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB, Total: ${totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB. Due: ${bill.due_date ? (() => { try { return format(new Date(bill.due_date), "MMM d, yyyy"); } catch { return String(bill.due_date); } })() : "End of month"}. Pay via Telebirr/CBE Birr Ref: ${customerKey}.`;

  const copyBreakdownSms = async () => {
    try {
      await navigator.clipboard.writeText(breakdownSmsText);
      setCopiedSms(true);
      toast({
        title: "Breakdown SMS Copied!",
        description: "SMS template copied to clipboard. Ready to paste into messaging app.",
      });
      setTimeout(() => setCopiedSms(false), 2500);
    } catch {
      toast({ variant: "destructive", title: "Copy Failed", description: "Unable to copy SMS template." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/40">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Bill Explainer & Spoken Script
                <Badge variant="outline" className="ml-1 text-xs font-mono bg-white text-blue-700 border-blue-200">
                  {monthYear}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                Instant line-by-line financial breakdown for {customerName} ({customerKey}).
              </DialogDescription>
            </div>
            <Badge
              className={isPaid ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"}
            >
              {paymentStatus}
            </Badge>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Main 3-box breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-blue-100 bg-blue-50/40 shadow-xs">
              <CardContent className="p-3">
                <div className="text-[11px] font-medium text-blue-700 flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 text-blue-600" /> Current Charge
                </div>
                <div className="text-lg font-bold font-mono text-blue-950 mt-1">
                  {currentMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-[10px] text-blue-500 font-normal ml-1">ETB</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Usage: <span className="font-semibold text-gray-800">{usage.toFixed(2)} m³</span>
                </div>
                {diffUsage > 0 && (
                  <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                    + {diffUsage.toFixed(2)} m³ diff apportionment
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-100 bg-amber-50/40 shadow-xs">
              <CardContent className="p-3">
                <div className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-600" /> Prior Arrears
                </div>
                <div className="text-lg font-bold font-mono text-amber-950 mt-1">
                  {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-[10px] text-amber-600 font-normal ml-1">ETB</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {outstanding > 0 ? "Past unpaid debt" : "No overdue balance"}
                </div>
                {penalty > 0 && (
                  <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                    Includes {penalty.toFixed(2)} ETB penalty
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50 shadow-xs">
              <CardContent className="p-3">
                <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
                  <Receipt className="h-3.5 w-3.5 text-emerald-700" /> Total Payable
                </div>
                <div className="text-lg font-extrabold font-mono text-emerald-950 mt-1">
                  {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-[10px] text-emerald-700 font-normal ml-1">ETB</span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  Status: <span className="font-bold">{paymentStatus}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line item aging table */}
          <div className="border rounded-md overflow-hidden bg-white text-xs">
            <div className="bg-gray-50 px-3 py-2 border-b font-semibold text-gray-700 flex justify-between">
              <span>Arrears & Aging Breakdown</span>
              <span className="font-mono text-gray-500">ETB</span>
            </div>
            <div className="divide-y text-gray-700">
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-gray-600">Debit 30 (1 Month Overdue)</span>
                <span className="font-mono">{d30.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-gray-600">Debit 30–60 (2 Months Overdue)</span>
                <span className="font-mono">{d30_60.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-gray-600">Debit 60+ (3+ Months Overdue)</span>
                <span className="font-mono">{d60.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-gray-600">Late Payment Penalty Fee</span>
                <span className="font-mono text-amber-700 font-medium">{penalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Spoken Customer Explanation Script */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                Spoken Customer Talking Points (Verbatim Script)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={copyScript}
                className="h-7 text-[11px] gap-1 px-2 border-slate-300 hover:bg-slate-200/60"
              >
                {copiedScript ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedScript ? "Copied!" : "Copy Script"}
              </Button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-sans bg-white p-2.5 rounded border border-slate-200/70 italic">
              &quot;{scriptText}&quot;
            </p>
          </div>

          {/* SMS Breakdown Template Preview (View Before Copy) */}
          <div className="bg-blue-50/50 border border-blue-200/70 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                SMS Breakdown Preview (Ready to copy)
              </span>
              <span className="text-[10px] text-blue-600 font-mono">
                {breakdownSmsText.length} chars ({Math.ceil(breakdownSmsText.length / 160)} SMS)
              </span>
            </div>
            <div className="text-xs font-mono text-slate-800 bg-white p-2.5 rounded border border-blue-100 leading-relaxed select-all">
              {breakdownSmsText}
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-gray-50 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Close
          </Button>
          <Button
            size="sm"
            onClick={copyBreakdownSms}
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-semibold"
          >
            {copiedSms ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedSms ? "SMS Copied!" : "Copy Breakdown SMS"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
