"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle, XCircle, AlertTriangle, DollarSign, Calendar,
  CreditCard, Hash, FileText, Loader2, RotateCcw,
} from "lucide-react";
import type { DomainBill } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface EditBillStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: DomainBill | null;
  customerKey: string;
  onSuccess?: (billId: string, newStatus: "Paid" | "Unpaid") => void;
}

const PAYMENT_CHANNELS = [
  "Cash",
  "TELEBIRR",
  "CBE",
  "CBEBIRR",
  "CBEDD",
  "CBEINTERNET",
  "CBEBR",
  "AWASH",
  "AWASHTELLER",
  "AWASHPAY",
  "KACHA",
  "SAFARICOM",
  "Bank Transfer",
  "Dashen Bank",
  "Abyssinia Bank",
  "Hibret Bank",
  "Bunna Bank",
  "Nib Bank",
  "Ebirr",
  "HelloCash",
  "Cheque",
  "Manual / Portal",
];

export function EditBillStatusDialog({
  open, onOpenChange, bill, customerKey, onSuccess,
}: EditBillStatusDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<"Paid" | "Unpaid">("Paid");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentChannel, setPaymentChannel] = useState("Cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [notes, setNotes] = useState("");

  const currentStatus = bill?.paymentStatus ?? "Unpaid";
  const isCurrentlyPaid = currentStatus === "Paid";
  const totalAmount = Number(bill?.TOTALBILLAMOUNT ?? 0);
  const outstandingAmt = Number(bill?.OUTSTANDINGAMT ?? 0);
  const existingPaid = Number(bill?.amountPaid ?? 0);

  useEffect(() => {
    if (open && bill) {
      setError(null);
      setNotes("");
      setTransactionRef("");
      setReversalReason("");
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setPaymentChannel("Cash");
      if (isCurrentlyPaid) {
        setTargetStatus("Unpaid");
        setAmountPaid("");
      } else {
        setTargetStatus("Paid");
        setAmountPaid(totalAmount > 0 ? totalAmount.toFixed(2) : "");
      }
    }
  }, [open, bill, isCurrentlyPaid, totalAmount]);

  const handleSave = async () => {
    if (!bill) return;
    setIsSaving(true);
    setError(null);
    try {
      const { updateBillPaymentStatus } = await import("@/lib/data-store");
      const result = await updateBillPaymentStatus({
        billId: bill.id,
        monthYear: bill.monthYear,
        newStatus: targetStatus,
        amountPaid: targetStatus === "Paid" && amountPaid ? Number(amountPaid) : undefined,
        paymentDate: targetStatus === "Paid" ? paymentDate : undefined,
        paymentChannel: targetStatus === "Paid" ? paymentChannel : undefined,
        transactionReference: transactionRef.trim() || undefined,
        reversalReason: targetStatus === "Unpaid" ? (reversalReason.trim() || undefined) : undefined,
        notes: notes.trim() || undefined,
        customerKey,
      });
      if (!result.success) { setError(result.message ?? "Failed to update payment status."); return; }
      onSuccess?.(bill.id, targetStatus);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!bill) return null;

  const amtVal = amountPaid ? Number(amountPaid) : 0;
  const isPartial = targetStatus === "Paid" && amtVal > 0 && amtVal < totalAmount - 0.01;
  const isOver = targetStatus === "Paid" && amtVal > 0 && amtVal > totalAmount + 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCurrentlyPaid
              ? <RotateCcw className="h-4 w-4 text-destructive" />
              : <CheckCircle className="h-4 w-4 text-emerald-600" />}
            {isCurrentlyPaid ? "Reverse Payment" : "Mark as Paid"}
          </DialogTitle>
          <DialogDescription>
            {isCurrentlyPaid
              ? "Reverse this bill's paid status and reset the payment records."
              : "Record a payment and mark this bill as paid."}
          </DialogDescription>
        </DialogHeader>

        {/* Bill Summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bill Month</span>
            <span className="font-semibold">{bill.monthYear}</span>
          </div>
          {bill.BILLKEY && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Bill Key</span>
              <span className="font-mono text-xs font-bold">{bill.BILLKEY}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-bold text-primary">ETB {totalAmount.toFixed(2)}</span>
          </div>
          {outstandingAmt > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-semibold text-destructive">ETB {outstandingAmt.toFixed(2)}</span>
            </div>
          )}
          {existingPaid > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-semibold text-emerald-600">ETB {existingPaid.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t">
            <span className="text-muted-foreground">Current Status</span>
            <Badge variant={isCurrentlyPaid ? "default" : "destructive"} className={cn(isCurrentlyPaid && "bg-emerald-600")}>
              {isCurrentlyPaid ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
              {currentStatus}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Will Become</span>
            <Badge className={cn(targetStatus === "Paid" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700")}>
              {targetStatus === "Paid" ? <CheckCircle className="mr-1 h-3 w-3" /> : <RotateCcw className="mr-1 h-3 w-3" />}
              {targetStatus}
            </Badge>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Change To</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={targetStatus === "Paid" ? "default" : "outline"}
              size="sm"
              onClick={() => { setTargetStatus("Paid"); setAmountPaid(totalAmount > 0 ? totalAmount.toFixed(2) : ""); }}
              className={cn(targetStatus === "Paid" && "bg-emerald-600 hover:bg-emerald-700")}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />Mark Paid
            </Button>
            <Button
              variant={targetStatus === "Unpaid" ? "destructive" : "outline"}
              size="sm"
              onClick={() => { setTargetStatus("Unpaid"); setAmountPaid(""); }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />Revert to Unpaid
            </Button>
          </div>
        </div>

        {/* Paid fields */}
        {targetStatus === "Paid" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ebs-amount" className="flex items-center gap-1 text-xs">
                  <DollarSign className="h-3.5 w-3.5" />Amount Paid (ETB)
                </Label>
                <Input
                  id="ebs-amount"
                  type="number" min="0" step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={totalAmount.toFixed(2)}
                  className={cn(isPartial && "border-amber-400", isOver && "border-red-400")}
                />
                {isPartial && <p className="text-[10px] text-amber-600">Partial payment</p>}
                {isOver && <p className="text-[10px] text-red-600">Exceeds total bill</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ebs-date" className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3.5 w-3.5" />Payment Date
                </Label>
                <Input id="ebs-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs"><CreditCard className="h-3.5 w-3.5" />Payment Channel</Label>
              <Select value={paymentChannel} onValueChange={setPaymentChannel}>
                <SelectTrigger id="ebs-channel" className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_CHANNELS.map((ch) => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ebs-ref" className="flex items-center gap-1 text-xs">
                <Hash className="h-3.5 w-3.5" />Transaction Reference <span className="text-muted-foreground ml-1">(optional)</span>
              </Label>
              <Input id="ebs-ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. TXN123456" />
            </div>
          </div>
        )}

        {/* Unpaid reversal */}
        {targetStatus === "Unpaid" && (
          <div className="space-y-3">
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This resets <strong>amount paid to 0</strong>, records a reversal entry, and recalculates outstanding balance and aging debt.
              </AlertDescription>
            </Alert>
            <div className="space-y-1">
              <Label htmlFor="ebs-reason" className="flex items-center gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" />Reason for Reversal
              </Label>
              <Textarea id="ebs-reason" value={reversalReason} onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Payment made in error, bounced cheque, etc." className="min-h-[60px] resize-none" />
            </div>
          </div>
        )}

        {/* Shared notes */}
        <div className="space-y-1">
          <Label htmlFor="ebs-notes" className="flex items-center gap-1 text-xs">
            <FileText className="h-3.5 w-3.5" />Additional Notes <span className="text-muted-foreground ml-1">(optional)</span>
          </Label>
          <Textarea id="ebs-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional remarks..." className="min-h-[48px] resize-none" />
        </div>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant={targetStatus === "Unpaid" ? "destructive" : "default"}
            className={cn(targetStatus === "Paid" && "bg-emerald-600 hover:bg-emerald-700")}
          >
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving�</>
            ) : targetStatus === "Paid" ? (
              <><CheckCircle className="mr-2 h-4 w-4" />Confirm Payment</>
            ) : (
              <><RotateCcw className="mr-2 h-4 w-4" />Confirm Reversal</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
