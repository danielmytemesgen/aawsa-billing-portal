"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Upload, FileDown, X, Save, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import {
  getAssignedCustomerReadingsAction,
  updateBulkAndAssignedReadingsAction,
  calculateBillAction,
} from "@/lib/actions";
import { updateBulkMeter as updateBulkMeterInStore, updateCustomer as updateCustomerInStore } from "@/lib/data-store";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import type { DomainBill } from "@/lib/data-store";

interface EditReadingsRecalculateSectionProps {
  bulkMeter: BulkMeter;
  latestBill?: DomainBill | null;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export function EditReadingsRecalculateSection({
  bulkMeter,
  latestBill,
  onClose,
  onSaveSuccess,
}: EditReadingsRecalculateSectionProps) {
  const { toast } = useToast();

  const monthYear = (latestBill as any)?.month_year || latestBill?.monthYear || bulkMeter.month || format(new Date(), "yyyy-MM");
  const dateBilledVal = latestBill?.createdAt || (latestBill as any)?.created_at;
  const dateBilledStr = dateBilledVal ? format(new Date(dateBilledVal), "PPP") : format(new Date(), "PPP");

  const [bulkPrevRead, setBulkPrevRead] = useState<number>(
    latestBill?.PREVREAD ?? bulkMeter.previousReading ?? 0
  );
  const [bulkCurrRead, setBulkCurrRead] = useState<number>(
    latestBill?.CURRREAD ?? bulkMeter.currentReading ?? 0
  );

  const [assignedReadings, setAssignedReadings] = useState<any[]>([]);
  const [assignedReadingEdits, setAssignedReadingEdits] = useState<Record<string, { previous: number; current: number }>>({});
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);

  const [calculatedPreview, setCalculatedPreview] = useState<{ usage: number; amount: number } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingAssigned(true);
    getAssignedCustomerReadingsAction(bulkMeter.customerKeyNumber, monthYear)
      .then((res) => {
        if (!isMounted) return;
        if (res.data && Array.isArray(res.data)) {
          setAssignedReadings(res.data);
          const initEdits: Record<string, { previous: number; current: number }> = {};
          for (const row of res.data as any[]) {
            initEdits[row.customerKeyNumber] = { previous: row.previous, current: row.current };
          }
          setAssignedReadingEdits(initEdits);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setIsLoadingAssigned(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bulkMeter.customerKeyNumber, monthYear]);

  const handleAssignedReadingChange = (key: string, field: "current" | "previous", value: string) => {
    const num = parseFloat(value) || 0;
    setAssignedReadingEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: num },
    }));
  };

  const handleFileUploadAssignedReadings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r\n|\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          toast({ variant: "destructive", title: "CSV Error", description: "File must contain header and at least one row." });
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
        const keyIdx = headers.findIndex((h) => ["customerkey", "customer key", "customer", "cust_key", "customerkeynumber", "meterkey", "meter", "id"].includes(h));
        const prevIdx = headers.findIndex((h) => ["previousreading", "previous reading", "prevreading", "prev reading", "prevread", "prev_read", "previous"].includes(h));
        const currIdx = headers.findIndex((h) => ["currentreading", "current reading", "currreading", "curr reading", "currread", "curr_read", "reading", "readingvalue", "current"].includes(h));

        if (keyIdx === -1 || (currIdx === -1 && prevIdx === -1)) {
          toast({
            variant: "destructive",
            title: "Invalid Headers",
            description: "CSV must contain columns: 'Customer Key' and ('Current Reading' or 'Previous Reading').",
          });
          return;
        }

        let updatedCount = 0;
        const newEdits = { ...assignedReadingEdits };

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const key = cols[keyIdx];
          if (!key) continue;

          const matched = assignedReadings.find(
            (r) => r.customerKeyNumber.toLowerCase() === key.toLowerCase() || r.customerKeyNumber.replace(/\D/g, "") === key.replace(/\D/g, "")
          );

          if (matched) {
            const targetKey = matched.customerKeyNumber;
            const existing = newEdits[targetKey] || { previous: matched.previous, current: matched.current };
            const newPrev = prevIdx !== -1 && cols[prevIdx] !== "" ? parseFloat(cols[prevIdx]) : existing.previous;
            const newCurr = currIdx !== -1 && cols[currIdx] !== "" ? parseFloat(cols[currIdx]) : existing.current;

            newEdits[targetKey] = {
              previous: isNaN(newPrev) ? existing.previous : newPrev,
              current: isNaN(newCurr) ? existing.current : newCurr,
            };
            updatedCount++;
          }
        }

        setAssignedReadingEdits(newEdits);
        toast({ title: "CSV Uploaded", description: `Loaded ${updatedCount} sub-meter reading(s) from CSV.` });
      } catch (err) {
        console.error("CSV Parse Error", err);
        toast({ variant: "destructive", title: "Error", description: "Failed to parse CSV file." });
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const rows = assignedReadings.map((row) => {
      const edits = assignedReadingEdits[row.customerKeyNumber] ?? { previous: row.previous, current: row.current };
      return [`"${row.customerKeyNumber}"`, `"${row.name}"`, edits.previous, edits.current].join(",");
    });
    const csvContent = ["Customer Key,Customer Name,Previous Reading,Current Reading", ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `readings_template_${bulkMeter.customerKeyNumber}_${monthYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: `${assignedReadings.length} customers exported.` });
  };

  const handleRecalculate = async () => {
    setIsCalculating(true);
    try {
      const bulkUsage = bulkCurrRead - bulkPrevRead;
      const totalSubmeterUsage = Object.values(assignedReadingEdits).reduce(
        (sum, r) => sum + (r.current - r.previous),
        0
      );
      const effectiveUsage = Math.max(0, bulkUsage - totalSubmeterUsage);
      const typeParam = (bulkMeter.chargeGroup as any) || "Non-domestic";
      const sizeParam = bulkMeter.meterSize;
      const sewerage = bulkMeter.sewerageConnection || "No";

      const calcRes = await calculateBillAction(
        effectiveUsage,
        typeParam,
        sewerage,
        sizeParam,
        monthYear
      );

      if (calcRes.data) {
        setCalculatedPreview({
          usage: calcRes.data.effectiveUsage,
          amount: calcRes.data.totalBill,
        });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Calculation Error", description: "Failed to calculate preview." });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const assignedUpdates = Object.entries(assignedReadingEdits).map(([key, vals]) => ({
        customerKeyNumber: key,
        currRead: vals.current,
        prevRead: vals.previous,
      }));

      let success = false;

      if (latestBill?.id) {
        const res = await updateBulkAndAssignedReadingsAction({
          bulkBillId: latestBill.id,
          bulkCurrRead,
          bulkPrevRead,
          assignedUpdates,
        });

        if (res?.error) {
          toast({ variant: "destructive", title: "Save Failed", description: res.error.message || "An error occurred." });
        } else {
          success = true;
        }
      } else {
        await updateBulkMeterInStore(bulkMeter.customerKeyNumber, {
          previousReading: bulkPrevRead,
          currentReading: bulkCurrRead,
        });
        for (const update of assignedUpdates) {
          await updateCustomerInStore(update.customerKeyNumber, {
            previousReading: update.prevRead,
            currentReading: update.currRead,
          });
        }
        success = true;
      }

      if (success) {
        toast({ title: "Saved", description: "Bulk meter and assigned customer readings updated and rebilled." });
        onSaveSuccess();
        onClose();
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save changes." });
    } finally {
      setIsSaving(false);
    }
  };

  const totalSubmeterUsage = Object.values(assignedReadingEdits).reduce(
    (sum, r) => sum + (r.current - r.previous),
    0
  );
  const bulkDiff = bulkCurrRead - bulkPrevRead - totalSubmeterUsage;

  return (
    <div className="bg-[#fffdf5] dark:bg-amber-950/20 p-4 sm:p-5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 space-y-4 my-4 shadow-sm">
      <h4 className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-base sm:text-lg">
        <Edit2 className="h-5 w-5 text-amber-600 dark:text-amber-400" /> Edit Readings & Recalculate
      </h4>

      {/* Main Bulk Meter Readings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-amber-200/80">Previous Reading</label>
          <Input
            type="number"
            value={bulkPrevRead}
            onChange={(e) => setBulkPrevRead(parseFloat(e.target.value) || 0)}
            className="h-10 border-amber-300 dark:border-amber-800 bg-white dark:bg-amber-950/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-amber-200/80">Current Reading</label>
          <Input
            type="number"
            value={bulkCurrRead}
            onChange={(e) => setBulkCurrRead(parseFloat(e.target.value) || 0)}
            className="h-10 border-amber-300 dark:border-amber-800 bg-white dark:bg-amber-950/40"
          />
        </div>
      </div>

      {/* Sub-meter readings table */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-2">
            ASSIGNED INDIVIDUAL CUSTOMER READINGS
            {isLoadingAssigned && <span className="text-amber-600 font-normal normal-case">(loading…)</span>}
          </h5>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt" onChange={handleFileUploadAssignedReadings} className="hidden" />
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 bg-white dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-sm cursor-pointer">
              <Upload className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" /> Upload CSV
            </span>
          </label>
        </div>

        {!isLoadingAssigned && assignedReadings.length === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 italic py-2">
            No assigned individual customers found for this bulk meter.
          </p>
        )}

        {assignedReadings.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 overflow-hidden text-xs shadow-xs">
            <table className="w-full">
              <thead className="bg-[#fff9e6] dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="px-3 py-2 text-right font-semibold">Prev. Reading</th>
                  <th className="px-3 py-2 text-right font-semibold">Curr. Reading</th>
                  <th className="px-3 py-2 text-right font-semibold">Usage (m³)</th>
                  <th className="px-3 py-2 text-center font-semibold">Bill Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-amber-950/20 divide-y divide-amber-100 dark:divide-amber-900/30">
                {assignedReadings.map((row) => {
                  const edits = assignedReadingEdits[row.customerKeyNumber] ?? { previous: row.previous, current: row.current };
                  const usage = edits.current - edits.previous;
                  return (
                    <tr key={row.customerKeyNumber} className="hover:bg-amber-50/60 dark:hover:bg-amber-900/20 transition-colors">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{row.name}</div>
                        <div className="text-gray-400 text-[11px] font-mono">{row.customerKeyNumber}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={edits.previous}
                          onChange={(e) => handleAssignedReadingChange(row.customerKeyNumber, "previous", e.target.value)}
                          className="w-24 border border-amber-300 dark:border-amber-800 rounded-lg px-2 py-1 text-right text-xs bg-white dark:bg-amber-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={edits.current}
                          onChange={(e) => handleAssignedReadingChange(row.customerKeyNumber, "current", e.target.value)}
                          className="w-24 border border-amber-300 dark:border-amber-800 rounded-lg px-2 py-1 text-right text-xs bg-white dark:bg-amber-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${usage < 0 ? "text-red-600" : "text-gray-800 dark:text-gray-200"}`}>
                        {usage.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.billStatus ? (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              row.billStatus === "Posted"
                                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : row.billStatus === "Draft"
                                ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                : row.billStatus === "Approved"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {row.billStatus}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-[11px] italic">No bill</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#fff9e6] dark:bg-amber-900/40 border-t border-amber-200 dark:border-amber-900">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-amber-900 dark:text-amber-200 font-bold">
                    Total Sub-meter Usage:
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-extrabold text-amber-950 dark:text-amber-100 text-sm">
                    {totalSubmeterUsage.toFixed(2)} m³
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-left text-xs text-amber-800 dark:text-amber-300 italic font-medium">
                    Bulk diff = {bulkDiff.toFixed(2)} m³
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Calculated Preview Box */}
      {calculatedPreview && (
        <div className="bg-white dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 text-sm space-y-1.5 shadow-xs">
          <div className="flex justify-between border-b border-amber-100 dark:border-amber-900 pb-1">
            <span className="text-muted-foreground">Consumption:</span>
            <span className="font-bold font-mono">{Number(calculatedPreview.usage).toFixed(2)} m³</span>
          </div>
          <div className="flex justify-between text-blue-600 dark:text-blue-400 font-semibold">
            <span>New Amount:</span>
            <span className="font-bold font-mono">ETB {Number(calculatedPreview.amount).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Bottom Action Bar & Details */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
        <div>
          {assignedReadings.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors shadow-sm cursor-pointer"
            >
              <FileDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Download Template
            </button>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="rounded-lg h-9 px-4 border-gray-300"
          >
            <X className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRecalculate}
            disabled={isCalculating}
            className="rounded-lg h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
          >
            {isCalculating ? (
              <>
                <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Calculating...
              </>
            ) : (
              "Check Preview"
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
          >
            {isSaving ? (
              <>
                <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Bill Period & Date Billed footer */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-amber-200/40 text-xs">
        <div>
          <span className="text-gray-500 dark:text-amber-300/70 font-semibold uppercase tracking-wider block">BILL PERIOD</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">{monthYear}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-amber-300/70 font-semibold uppercase tracking-wider block">DATE BILLED</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">{dateBilledStr}</span>
        </div>
      </div>
    </div>
  );
}
