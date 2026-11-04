"use client";

import { READING_CORRECTION_REASONS } from "@/types/db";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  FileEdit,
  Gauge,
  History,
  Loader2,
  TrendingDown,
  TrendingUp,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { correctMeterReadingAction } from "@/lib/actions";
import type { DisplayReading } from "@/lib/data-store";

interface CorrectMeterReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reading: DisplayReading | null;
  onSuccess?: () => void;
}

export const REASON_CATEGORIES = READING_CORRECTION_REASONS;

export function CorrectMeterReadingDialog({
  open,
  onOpenChange,
  reading,
  onSuccess,
}: CorrectMeterReadingDialogProps) {
  const { toast } = useToast();

  const [newPrevious, setNewPrevious] = React.useState<number>(0);
  const [newCurrent, setNewCurrent] = React.useState<number>(0);
  const [reasonCategory, setReasonCategory] = React.useState<string>("meter_dial_misread");
  const [reason, setReason] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Initialize values when dialog opens
  React.useEffect(() => {
    if (reading && open) {
      setNewPrevious(Number(reading.previousReading || 0));
      setNewCurrent(Number(reading.readingValue || 0));
      setReasonCategory("meter_dial_misread");
      setReason("");
      setNotes("");
      setErrorMsg(null);
    }
  }, [reading, open]);

  if (!reading) return null;

  const oldPrevious = Number(reading.previousReading || 0);
  const oldCurrent = Number(reading.readingValue || 0);
  const oldConsumption = Math.max(0, oldCurrent - oldPrevious);

  const newConsumption = Math.max(0, newCurrent - newPrevious);
  const consumptionDiff = newConsumption - oldConsumption;
  const readingDiff = newCurrent - oldCurrent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newCurrent < newPrevious) {
      setErrorMsg("New Current Reading cannot be less than New Previous Reading.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 4) {
      setErrorMsg("Please provide a specific justification reason (minimum 4 characters).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await correctMeterReadingAction({
        readingId: reading.id,
        meterType: reading.meterType === "bulk" ? "bulk" : "individual",
        customerKey: reading.meterId || reading.meterIdentifier,
        monthYear: reading.monthYear || (reading.readingDate ? String(reading.readingDate).substring(0, 7) : ""),
        newPreviousReading: Number(newPrevious),
        newCurrentReading: Number(newCurrent),
        reason: reason.trim(),
        reasonCategory,
        notes: notes.trim() || undefined,
      });

      if (res?.error) {
        setErrorMsg(res.error.message || "Failed to correct meter reading.");
        toast({
          title: "Correction Failed",
          description: res.error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reading Corrected",
          description: `Reading updated successfully. Consumption variance: ${consumptionDiff >= 0 ? "+" : ""}${consumptionDiff.toFixed(2)} m³. Audit log recorded.`,
        });
        onOpenChange(false);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit reading correction.");
      toast({
        title: "Error",
        description: err.message || "Network error while saving correction.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[620px] max-h-[92vh] overflow-y-auto p-5 sm:p-6 custom-scrollbar">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <FileEdit className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Correct Meter Reading
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Audited modification of recorded meter readings with live variance calculation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Warning Banner */}
        <Alert className="bg-amber-50/70 border-amber-200 text-amber-900 py-2.5 px-3 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
          <AlertDescription className="text-xs ml-1">
            <span className="font-bold">Permanent Audit Trail:</span> All modifications, old vs new values, volume variances, and staff credentials are automatically recorded in the <strong>Reading Corrections Report</strong>.
          </AlertDescription>
        </Alert>

        {/* Meter Info Card */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-500">Meter / Customer Key:</span>
            <span className="font-bold text-slate-900 font-mono">{reading.meterIdentifier}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-500">Meter Type:</span>
            <Badge variant={reading.meterType === "bulk" ? "secondary" : "default"} className="text-[10px] h-5">
              {reading.meterType === "bulk" ? "Bulk Meter" : "Individual Customer"}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-500">Billing Period:</span>
            <span className="font-bold text-slate-800">{reading.monthYear || "Current Cycle"}</span>
          </div>
          {reading.branchName && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-500">Branch:</span>
              <span className="font-medium text-slate-700">{reading.branchName}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Side-by-Side Comparison Matrix */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reading Comparison Matrix</span>
              <span className="text-[11px] font-medium text-slate-500">Values in m³</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 p-3 sm:p-4 gap-3 bg-white">
              {/* Old State */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" /> Original State
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-slate-500 text-[11px]">Previous Reading</div>
                  <div className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    {oldPrevious.toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-slate-500 text-[11px]">Current Reading</div>
                  <div className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    {oldCurrent.toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1 text-xs pt-1">
                  <div className="text-slate-500 text-[11px]">Recorded Usage</div>
                  <div className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                    {oldConsumption.toFixed(2)} m³
                  </div>
                </div>
              </div>

              {/* New State */}
              <div className="space-y-3 pl-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  <FileEdit className="h-3.5 w-3.5" /> Corrected State
                </div>
                <div className="space-y-1 text-xs">
                  <Label htmlFor="newPrev" className="text-[11px] text-slate-700 font-medium">New Previous Reading</Label>
                  <Input
                    id="newPrev"
                    type="number"
                    step="any"
                    value={newPrevious}
                    onChange={(e) => setNewPrevious(parseFloat(e.target.value) || 0)}
                    className="h-8.5 font-bold text-blue-700 bg-blue-50/40 border-blue-200 focus-visible:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <Label htmlFor="newCurr" className="text-[11px] text-slate-700 font-medium">New Current Reading</Label>
                  <Input
                    id="newCurr"
                    type="number"
                    step="any"
                    value={newCurrent}
                    onChange={(e) => setNewCurrent(parseFloat(e.target.value) || 0)}
                    className="h-8.5 font-bold text-blue-700 bg-blue-50/40 border-blue-200 focus-visible:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1 text-xs pt-1">
                  <div className="text-slate-700 text-[11px] font-medium">Corrected Usage</div>
                  <div className="font-black text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200">
                    {newConsumption.toFixed(2)} m³
                  </div>
                </div>
              </div>
            </div>

            {/* Live Variance Footer */}
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-slate-500" />
                Consumption Variance:
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    consumptionDiff > 0
                      ? "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 font-bold"
                      : consumptionDiff < 0
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }
                >
                  {consumptionDiff > 0 ? (
                    <span className="flex items-center gap-0.5"><TrendingUp className="h-3 w-3 mr-0.5" />+{consumptionDiff.toFixed(2)} m³</span>
                  ) : consumptionDiff < 0 ? (
                    <span className="flex items-center gap-0.5"><TrendingDown className="h-3 w-3 mr-0.5" />{consumptionDiff.toFixed(2)} m³</span>
                  ) : (
                    "0.00 m³ (No change)"
                  )}
                </Badge>
              </div>
            </div>
          </div>

          {/* Reason Category */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-xs font-bold text-slate-700">
              Reason Category <span className="text-rose-500">*</span>
            </Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger id="category" className="h-9 text-xs font-medium">
                <SelectValue placeholder="Select reason category" />
              </SelectTrigger>
              <SelectContent>
                {REASON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detailed Justification */}
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs font-bold text-slate-700">
              Correction Justification & Details <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g. Reader transposed digits from 5430 to 4530 during field cycle. Verified on customer meter dial during supervisor audit."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs min-h-[68px] resize-none"
              required
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-slate-600">
              Optional Internal Audit Notes
            </Label>
            <Input
              id="notes"
              placeholder="Reference ticket #, supervisor approval code, or inspector ID"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8.5 text-xs"
            />
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs ml-1">{errorMsg}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving & Auditing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Confirm & Log Correction
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
