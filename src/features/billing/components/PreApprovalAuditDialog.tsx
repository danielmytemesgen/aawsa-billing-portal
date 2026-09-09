'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertTriangle, ShieldCheck, Filter, AlertCircle, Loader2 } from 'lucide-react';
import { getPreApprovalAuditAction } from '@/lib/actions';
import type { PreApprovalAuditResult } from '@/lib/db-queries';

interface PreApprovalAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthYear: string;
  onApproveClean: (cleanIds: string[]) => Promise<void>;
  onApproveAll: () => Promise<void>;
  onFilterFlagged: (flaggedIds: string[]) => void;
}

export function PreApprovalAuditDialog({
  open,
  onOpenChange,
  monthYear,
  onApproveClean,
  onApproveAll,
  onFilterFlagged,
}: PreApprovalAuditDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [auditData, setAuditData] = React.useState<PreApprovalAuditResult | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !monthYear) return;

    let isMounted = true;
    setLoading(true);

    getPreApprovalAuditAction(monthYear)
      .then((res) => {
        if (isMounted) {
          setAuditData(res);
        }
      })
      .catch((err) => {
        console.error('Error fetching pre-approval audit:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, monthYear]);

  const handleApproveClean = async () => {
    if (!auditData || auditData.cleanBillIds.length === 0) return;
    setActionLoading(true);
    try {
      await onApproveClean(auditData.cleanBillIds);
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAll = async () => {
    setActionLoading(true);
    try {
      await onApproveAll();
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFilterFlagged = () => {
    if (!auditData) return;
    const flaggedIds = auditData.flaggedBills.map((b) => b.id);
    onFilterFlagged(flaggedIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Pre-Approval Smart Audit</DialogTitle>
              <DialogDescription>
                Cycle {monthYear} • Pre-flight safety check before approving invoices
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Running anomaly heuristics on pending invoices...</p>
          </div>
        ) : auditData ? (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 flex items-start gap-3">
                <div className="p-2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {auditData.cleanBillsCount}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Clean Invoices</div>
                  <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    Zero anomaly flags detected
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {auditData.flaggedBillsCount}
                  </div>
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Flagged For Review</div>
                  <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Requires supervisor inspection
                  </div>
                </div>
              </div>
            </div>

            {/* Flagged Invoices List */}
            {auditData.flaggedBills.length > 0 ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Flagged Invoices Requiring Attention ({auditData.flaggedBills.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFilterFlagged}
                    className="h-7 text-xs text-primary gap-1"
                  >
                    <Filter className="w-3 h-3" />
                    Filter in Table
                  </Button>
                </div>

                <ScrollArea className="flex-1 border rounded-lg bg-muted/20 p-2 max-h-[220px]">
                  <div className="space-y-2">
                    {auditData.flaggedBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-2.5 rounded-lg border bg-card text-card-foreground shadow-sm space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="font-semibold flex items-center gap-1.5">
                            <span>{bill.customerName}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">
                              {bill.customerKey}
                            </Badge>
                          </div>
                          <span className="font-mono text-muted-foreground">
                            ETB {bill.thisMonthBillAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {bill.flags.map((flag, idx) => (
                            <Badge
                              key={idx}
                              variant="destructive"
                              className="text-[10px] font-normal py-0.5 px-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                            >
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="py-6 border rounded-lg bg-emerald-500/5 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  All Invoices Verified Clean
                </div>
                <div className="text-xs text-muted-foreground">
                  No readings inversions, high losses, or anomalies were detected.
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={actionLoading}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {auditData && auditData.flaggedBillsCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApproveAll}
                disabled={actionLoading}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Approve All ({auditData.totalPending})
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleApproveClean}
              disabled={actionLoading || !auditData || auditData.cleanBillsCount === 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Approve Clean Only ({auditData?.cleanBillsCount ?? 0})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
