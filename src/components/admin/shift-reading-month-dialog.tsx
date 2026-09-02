"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  CalendarSync,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Layers,
  HelpCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { previewShiftReadingMonthAction, executeShiftReadingMonthAction } from "@/lib/actions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ShiftReadingMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ShiftReadingMonthDialog({
  open,
  onOpenChange,
  onSuccess
}: ShiftReadingMonthDialogProps) {
  const { toast } = useToast();

  const [meterType, setMeterType] = React.useState<"individual" | "bulk" | "both">("both");
  const [sourceMonth, setSourceMonth] = React.useState<string>("2026-09");
  const [targetMonth, setTargetMonth] = React.useState<string>("2026-08");
  const [overwriteTargetExisting, setOverwriteTargetExisting] = React.useState<boolean>(true);

  const [isPreviewing, setIsPreviewing] = React.useState<boolean>(false);
  const [isExecuting, setIsExecuting] = React.useState<boolean>(false);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [executionResult, setExecutionResult] = React.useState<any>(null);

  const resetState = () => {
    setPreviewData(null);
    setExecutionResult(null);
    setIsPreviewing(false);
    setIsExecuting(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const handlePreview = async () => {
    if (!sourceMonth || !targetMonth) {
      toast({ variant: "destructive", title: "Missing Dates", description: "Please enter both Source and Target months (YYYY-MM)." });
      return;
    }
    if (sourceMonth === targetMonth) {
      toast({ variant: "destructive", title: "Identical Months", description: "Source month and target month must be different." });
      return;
    }

    setIsPreviewing(true);
    setPreviewData(null);
    setExecutionResult(null);

    try {
      const res = await previewShiftReadingMonthAction({
        meterType,
        sourceMonth,
        targetMonth
      });

      if (res.data) {
        setPreviewData(res.data);
      } else {
        toast({ variant: "destructive", title: "Preview Failed", description: (res as any).error?.message || "Failed to generate preview." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to preview month shift." });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!sourceMonth || !targetMonth) return;

    setIsExecuting(true);
    try {
      const res = await executeShiftReadingMonthAction({
        meterType,
        sourceMonth,
        targetMonth,
        overwriteTargetExisting
      });

      if (res.data?.success) {
        setExecutionResult(res.data);
        toast({
          title: "Reading Month Shift Complete",
          description: `Successfully moved ${res.data.totalShifted} readings from ${sourceMonth} to ${targetMonth}.`
        });
        if (onSuccess) onSuccess();
      } else {
        toast({
          variant: "destructive",
          title: "Shift Failed",
          description: (res as any).error?.message || "Could not complete reading month shift."
        });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Execution Error", description: err.message || "An unexpected error occurred." });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <CalendarSync className="h-5 w-5 text-indigo-600" />
            Shift / Reassign Reading Month & Cycle
          </DialogTitle>
          <DialogDescription>
            Move existing meter readings in the database from one month/cycle to another (e.g., from <span className="font-semibold text-foreground">2026-09</span> to <span className="font-semibold text-foreground">2026-08</span> or <span className="font-semibold text-foreground">2026-10</span>).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

          {/* Meter Type Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Select Meter Category</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setMeterType("both"); setPreviewData(null); }}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                  meterType === "both"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Meters (Both)
              </button>
              <button
                type="button"
                onClick={() => { setMeterType("individual"); setPreviewData(null); }}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                  meterType === "individual"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Individual Customers
              </button>
              <button
                type="button"
                onClick={() => { setMeterType("bulk"); setPreviewData(null); }}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                  meterType === "bulk"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Bulk Meters
              </button>
            </div>
          </div>

          {/* Month Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="space-y-1.5">
              <Label htmlFor="source-month" className="text-xs font-semibold text-slate-700">
                Source Reading Month (Move From)
              </Label>
              <Input
                id="source-month"
                type="text"
                placeholder="YYYY-MM (e.g. 2026-09)"
                value={sourceMonth}
                onChange={(e) => { setSourceMonth(e.target.value.trim()); setPreviewData(null); }}
                className="bg-white font-mono text-sm"
              />
              <span className="text-[11px] text-muted-foreground">Current month of the readings</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target-month" className="text-xs font-semibold text-slate-700">
                Target Reading Month (Move To)
              </Label>
              <Input
                id="target-month"
                type="text"
                placeholder="YYYY-MM (e.g. 2026-08)"
                value={targetMonth}
                onChange={(e) => { setTargetMonth(e.target.value.trim()); setPreviewData(null); }}
                className="bg-white font-mono text-sm"
              />
              <span className="text-[11px] text-muted-foreground">Destination month for the readings</span>
            </div>
          </div>

          {/* Quick Month Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Quick presets:</span>
            <button
              type="button"
              onClick={() => { setSourceMonth("2026-09"); setTargetMonth("2026-08"); setPreviewData(null); }}
              className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-indigo-300 rounded px-2 py-0.5 text-slate-700 hover:text-indigo-600 transition-colors"
            >
              2026-09 <ArrowRight className="h-3 w-3" /> 2026-08
            </button>
            <button
              type="button"
              onClick={() => { setSourceMonth("2026-09"); setTargetMonth("2026-10"); setPreviewData(null); }}
              className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-indigo-300 rounded px-2 py-0.5 text-slate-700 hover:text-indigo-600 transition-colors"
            >
              2026-09 <ArrowRight className="h-3 w-3" /> 2026-10
            </button>
          </div>

          {/* Overwrite toggle */}
          <div className="flex items-start space-x-2.5 bg-white border border-slate-200 rounded-lg p-3">
            <input
              type="checkbox"
              id="overwrite-target-toggle"
              checked={overwriteTargetExisting}
              onChange={(e) => setOverwriteTargetExisting(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="overwrite-target-toggle" className="text-xs text-slate-700 cursor-pointer select-none leading-snug">
              <span className="font-semibold text-slate-900">Replace existing readings in target month: </span>
              If a customer already has a reading in {targetMonth || "the destination month"}, overwrite it with the reading being moved.
            </label>
          </div>

          {/* Preview Button */}
          {!previewData && !executionResult && (
            <Button
              onClick={handlePreview}
              disabled={isPreviewing || !sourceMonth || !targetMonth}
              variant="outline"
              className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
              {isPreviewing ? "Analyzing Database Records…" : `Preview Shift (${sourceMonth} → ${targetMonth})`}
            </Button>
          )}

          {/* Preview Results Card */}
          {previewData && !executionResult && (
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Preview Analysis</span>
                <span className="text-xs font-medium text-slate-500">
                  {sourceMonth} <ArrowRight className="inline h-3 w-3" /> {targetMonth}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="text-xl font-black text-slate-800">{previewData.totalSourceReadings}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Readings to Move ({sourceMonth})</div>
                  {meterType === "both" && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      ({previewData.indivSourceCount} Indiv, {previewData.bulkSourceCount} Bulk)
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="text-xl font-black text-slate-800">{previewData.totalTargetExistingReadings}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Existing in Target ({targetMonth})</div>
                  {previewData.totalTargetExistingReadings > 0 && (
                    <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                      Will be overwritten
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings for generated bills */}
              {(previewData.sourceBillsCount > 0 || previewData.targetBillsCount > 0) && (
                <Alert className="bg-amber-50 border-amber-300 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-xs font-bold text-amber-900">Billing Notice</AlertTitle>
                  <AlertDescription className="text-xs text-amber-800">
                    {previewData.sourceBillsCount > 0 && (
                      <div>• {previewData.sourceBillsCount} bill(s) already exist for source month {sourceMonth}.</div>
                    )}
                    {previewData.targetBillsCount > 0 && (
                      <div>• {previewData.targetBillsCount} bill(s) already exist for target month {targetMonth}.</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {previewData.totalSourceReadings === 0 && (
                <p className="text-xs text-rose-600 font-medium text-center">
                  No readings found in {sourceMonth} for the selected meter category.
                </p>
              )}
            </div>
          )}

          {/* Done / Execution Result */}
          {executionResult && (
            <Alert className="bg-emerald-50 border-emerald-300">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <AlertTitle className="text-emerald-800 font-bold">Shift Completed Successfully</AlertTitle>
              <AlertDescription className="text-xs text-emerald-700 space-y-1">
                <p>
                  <strong>{executionResult.totalShifted}</strong> reading(s) were successfully moved from <strong>{sourceMonth}</strong> to <strong>{targetMonth}</strong>.
                </p>
                {meterType === "both" && (
                  <p className="text-[11px] opacity-90">
                    (Individual: {executionResult.shiftedIndiv}, Bulk: {executionResult.shiftedBulk})
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-500"
          >
            Close
          </Button>

          {previewData && !executionResult && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewData(null)}
                disabled={isExecuting}
                className="text-xs"
              >
                Change Parameters
              </Button>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={isExecuting || previewData.totalSourceReadings === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarSync className="mr-2 h-4 w-4" />}
                {isExecuting ? "Shifting Records…" : `Confirm & Shift to ${targetMonth}`}
              </Button>
            </div>
          )}

          {executionResult && (
            <Button
              size="sm"
              onClick={resetState}
              variant="outline"
              className="text-xs"
            >
              Perform Another Shift
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
