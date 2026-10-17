"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Check,
} from "lucide-react";
import { getReconciliationAnomaliesAction, fixReconciliationAnomaliesAction } from "@/lib/actions";

export interface ReconciliationAuditDialogProps {
  openTrigger: number;
  onComplete?: () => void;
  branchId?: string;
}

export function ReconciliationAuditDialog({
  openTrigger,
  onComplete,
  branchId,
}: ReconciliationAuditDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [reason, setReason] = useState("Reverted false Reconciled status: bill is unpaid with zero payment");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Open dialog whenever openTrigger increments
  useEffect(() => {
    if (openTrigger > 0) {
      setOpen(true);
      fetchAnomalies();
    }
  }, [openTrigger]);

  const fetchAnomalies = async () => {
    setIsLoading(true);
    setSuccessMessage(null);
    try {
      const res = await getReconciliationAnomaliesAction({
        branchId: branchId && branchId !== "all" ? branchId : undefined,
      });
      if (res.success && res.anomalies) {
        setAnomalies(res.anomalies);
        // By default, select all detected anomalies for convenience
        setSelectedIds(new Set(res.anomalies.map((a: any) => a.id)));
      } else {
        setAnomalies([]);
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      toast({
        title: "Scan Failed",
        description: err.message || "Failed to scan for reconciliation anomalies.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAnomalies = useMemo(() => {
    if (!searchTerm.trim()) return anomalies;
    const lower = searchTerm.toLowerCase();
    return anomalies.filter(
      (a) =>
        (a.billKey && a.billKey.toLowerCase().includes(lower)) ||
        (a.customerKey && a.customerKey.toLowerCase().includes(lower)) ||
        (a.customerName && a.customerName.toLowerCase().includes(lower)) ||
        (a.individual_customer_id && a.individual_customer_id.toLowerCase().includes(lower)) ||
        (a.bankRef && a.bankRef.toLowerCase().includes(lower))
    );
  }, [anomalies, searchTerm]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredAnomalies.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFixAnomalies = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one bill to correct.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fixReconciliationAnomaliesAction({
        billIds: Array.from(selectedIds),
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        setSuccessMessage(`Successfully corrected ${res.count} bills. Reconciliation status reverted to 'Not reconciled'.`);
        toast({
          title: "Correction Successful",
          description: `${res.count} bills reverted to 'Not reconciled' and 'Unpaid'.`,
        });
        // Refresh anomalies and notify parent
        onComplete?.();
        await fetchAnomalies();
      } else {
        toast({
          title: "Correction Failed",
          description: res.message || "An error occurred while updating bills.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to apply reconciliation corrections.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllSelected = filteredAnomalies.length > 0 && filteredAnomalies.every((a) => selectedIds.has(a.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                Audit & Fix Reconciliation Status
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Detect and revert bills that were erroneously marked as Reconciled or Paid with zero payment.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successMessage && (
          <Alert className="my-2 bg-emerald-50 border-emerald-200 text-emerald-800 rounded-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-sm font-semibold">Done</AlertTitle>
            <AlertDescription className="text-xs">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Anomalies Detected</p>
                <p className="text-2xl font-bold text-amber-950 mt-0.5">{anomalies.length}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>

            <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Selected for Fix</p>
                <p className="text-2xl font-bold text-blue-950 mt-0.5">{selectedIds.size}</p>
              </div>
              <Check className="h-6 w-6 text-blue-600" />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Correction Action</p>
                <p className="text-xs font-semibold text-slate-900 mt-1">Revert to Not Reconciled</p>
              </div>
              <RotateCcw className="h-5 w-5 text-slate-500" />
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search Bill Key or Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-slate-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnomalies}
                disabled={isLoading}
                className="h-9 text-xs rounded-lg border-slate-200 gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Re-scan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleSelectAll(!isAllSelected)}
                className="h-9 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                {isAllSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[320px] overflow-y-auto shadow-inner">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5">Bill Key</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5">Customer</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5">Branch</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5 text-right">Bill Total</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5 text-right">Paid</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5 text-center">Status</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5 text-center">Reconciliation</TableHead>
                  <TableHead className="font-bold text-slate-700 py-2.5">Bank Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                        <span>Auditing bills for reconciliation discrepancies...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAnomalies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        <span className="font-semibold text-slate-800">All Clean!</span>
                        <span className="text-xs text-slate-500">No reconciliation discrepancies or false paid statuses found.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAnomalies.map((bill) => {
                    const isChecked = selectedIds.has(bill.id);
                    return (
                      <TableRow
                        key={bill.id}
                        className={`hover:bg-slate-50 cursor-pointer ${isChecked ? "bg-amber-50/40" : ""}`}
                        onClick={() => handleToggleRow(bill.id)}
                      >
                        <TableCell className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleRow(bill.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-medium py-2 text-indigo-700">
                          {bill.billKey || bill.bill_number || bill.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="font-medium text-slate-900">{bill.customerName || "-"}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {bill.customerKey || bill.individual_customer_id || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-slate-600">{bill.customerBranch || "-"}</TableCell>
                        <TableCell className="py-2 text-right font-medium">
                          {Number(bill.totalBillAmount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-right font-bold text-red-600">
                          {Number(bill.amountPaid || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700">
                            {bill.paymentStatus || "Unpaid"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-600 text-white">
                            {bill.reconciliationStatus || "Reconciled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 font-mono text-[10px] text-slate-500">
                          {bill.bankRef || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Audit Note Input */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="auditReason" className="text-xs font-semibold text-slate-700">
              Audit Correction Note (Logged into Bill History)
            </Label>
            <Input
              id="auditReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reversed false Reconciled status: bill is unpaid with zero payment"
              className="h-9 text-xs rounded-lg border-slate-200"
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedIds.size} of {anomalies.length} bill(s) selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleFixAnomalies}
              disabled={isSubmitting || selectedIds.size === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying Fix...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Fix & Revert Selected ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
