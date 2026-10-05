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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Zap,
  Clock,
  CheckCheck,
  AlertTriangle,
  Download,
  StopCircle,
} from "lucide-react";
import type { BatchSyncMeterResult } from "@/lib/actions";

export interface BatchSyncProgressDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  autoStart?: boolean;
}

type Phase = "idle" | "running" | "done" | "error";

export function BatchSyncProgressDialog({
  isOpen,
  onOpenChange,
  autoStart = false,
}: BatchSyncProgressDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [total, setTotal] = React.useState(0);
  const [synced, setSynced] = React.useState(0);
  const [failed, setFailed] = React.useState(0);
  const [durationMs, setDurationMs] = React.useState(0);
  const [results, setResults] = React.useState<BatchSyncMeterResult[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isBusyNotice, setIsBusyNotice] = React.useState(false);
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const hasStartedRef = React.useRef(false);
  const stopRequestedRef = React.useRef(false);
  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const progressPct = total > 0 ? Math.min(100, Math.round(((synced + failed) / total) * 100)) : 0;

  const reset = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPhase("idle");
    setTotal(0);
    setSynced(0);
    setFailed(0);
    setDurationMs(0);
    setResults([]);
    setErrorMsg(null);
    setIsBusyNotice(false);
    setActiveJobId(null);
    setIsCancelling(false);
    hasStartedRef.current = false;
    stopRequestedRef.current = false;
  };

  const handleStop = async () => {
    stopRequestedRef.current = true;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (activeJobId) {
      setIsCancelling(true);
      try {
        await fetch("/api/billing/cancel-sync-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: activeJobId }),
        });
      } catch (err) {
        console.warn("Failed to cancel server sync job:", err);
      } finally {
        setIsCancelling(false);
      }
    }
    setPhase("done");
    toast({
      title: "Sync Stopped",
      description: "Batch sync operation was stopped.",
    });
    router.refresh();
  };

  const pollJobStatus = async () => {
    try {
      const res = await fetch("/api/billing/batch-sync-bulk-meters", {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-internal-key": "d52e2cc3ace3a52a189ed2607f311da6",
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.job;
    } catch {
      return null;
    }
  };

  const runSync = React.useCallback(async () => {
    if (phase === "running") return;
    setPhase("running");
    setTotal(0);
    setSynced(0);
    setFailed(0);
    setResults([]);
    setErrorMsg(null);
    setIsBusyNotice(false);
    stopRequestedRef.current = false;

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setDurationMs(Date.now() - startTime);
    }, 500);

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        if (stopRequestedRef.current) return;
        const job = await pollJobStatus();
        if (job) {
          if (job.id) setActiveJobId(job.id);
          if (job.total_meters) setTotal(job.total_meters);
          if (job.synced_ok != null) setSynced(job.synced_ok);
          if (job.synced_error != null) setFailed(job.synced_error);

          const summaryResults = job.summary?.results;
          if (Array.isArray(summaryResults) && summaryResults.length > 0) {
            setResults(summaryResults);
          }
        }
      }, 1500);
    };

    startPolling();

    try {
      const postRes = await fetch("/api/billing/batch-sync-bulk-meters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-internal-key": "d52e2cc3ace3a52a189ed2607f311da6",
        },
        body: JSON.stringify({ concurrency: 20, dryRun: false }),
      });

      const data = await postRes.json().catch(() => ({}));
      if (data.jobId) setActiveJobId(data.jobId);

      if (postRes.status === 409 || data.busy) {
        setIsBusyNotice(true);
        if (data.jobId) setActiveJobId(data.jobId);
        toast({
          title: "Sync in Progress",
          description: "A sync job is already active on the server. Connecting to its live stream...",
        });

        // Wait for existing background job to complete
        while (!stopRequestedRef.current) {
          await new Promise((r) => setTimeout(r, 2000));
          const job = await pollJobStatus();
          if (job) {
            if (job.id) setActiveJobId(job.id);
            if (job.total_meters) setTotal(job.total_meters);
            if (job.synced_ok != null) setSynced(job.synced_ok);
            if (job.synced_error != null) setFailed(job.synced_error);
            if (job.status !== "running") {
              if (Array.isArray(job.summary?.results)) {
                setResults(job.summary.results);
              }
              break;
            }
          }
        }
      } else if (!postRes.ok || !data.success) {
        throw new Error(data.error || `HTTP ${postRes.status} during batch sync`);
      } else {
        if (data.jobId) setActiveJobId(data.jobId);
        setTotal(data.total ?? 0);
        setSynced(data.synced ?? 0);
        setFailed(data.failed ?? 0);
        if (Array.isArray(data.results)) {
          setResults(data.results);
        }
      }

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      clearInterval(timerInterval);
      setDurationMs(Date.now() - startTime);
      setPhase("done");

      toast({
        title: "Batch Sync Complete",
        description: `Successfully synchronized bulk meters with AAWSA external server.`,
      });

      router.refresh();
    } catch (err: any) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      clearInterval(timerInterval);
      setDurationMs(Date.now() - startTime);
      setPhase("error");
      setErrorMsg(err.message || "Unexpected error during batch sync.");
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    }
  }, [phase, toast, router]);

  React.useEffect(() => {
    if (isOpen && autoStart && !hasStartedRef.current && phase === "idle") {
      hasStartedRef.current = true;
      runSync();
    }
    if (!isOpen) reset();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, autoStart, phase, runSync]);

  const exportCSV = () => {
    if (!results.length) return;
    const headers = ["Customer Key", "Name", "Status", "Payment Status", "Current Reading", "Channel", "Bill Key", "Error"];
    const rows = results.map((r) => [
      r.customerKeyNumber,
      r.name,
      r.status,
      r.paymentStatus || "",
      r.currentReading != null ? String(r.currentReading) : "",
      r.paymentChannel || "",
      r.billKey || "",
      r.error || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aawsa_batch_sync_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v && phase !== "running") { onOpenChange(false); reset(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Zap className="h-5 w-5 text-emerald-500" />
              AAWSA Batch Sync — All Bulk Meters
            </DialogTitle>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 font-medium flex items-center gap-1">
              <Globe className="h-3 w-3" /> External Server
            </span>
          </div>
          <DialogDescription>
            High-speed parallel sync against bill.aawsa.gov.et:5001 for all active bulk meters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {phase === "idle" && (
            <div className="p-6 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10 flex flex-col items-center gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <RefreshCw className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-base">Ready for Fast Batch Sync</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-md">
                  Processes active bulk meters concurrently in parallel batches with live real-time progress updates.
                </div>
              </div>
              <Button onClick={runSync} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8">
                <Zap className="h-4 w-4" /> Start Batch Sync Now
              </Button>
            </div>
          )}

          {phase === "running" && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 text-primary animate-spin shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-primary flex items-center gap-1.5">
                      <Globe className="h-4 w-4" /> Syncing in Progress...
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {isBusyNotice
                        ? "Streaming progress from active server sync job..."
                        : total > 0
                        ? `Processing ${total} bulk meters in parallel on server (concurrency: 20)`
                        : "Initializing batch sync on server..."}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  disabled={isCancelling}
                  className="gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Stopping...
                    </>
                  ) : (
                    <>
                      <StopCircle className="h-3.5 w-3.5" /> Stop Sync
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Overall Progress ({synced + failed} / {total || "..."})</span>
                  <span className="font-bold text-foreground">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-3 rounded-full" />
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-600 font-semibold">{synced} synced successfully</span>
                  <span className="text-destructive font-semibold">{failed} failed / not found</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Elapsed: {(durationMs / 1000).toFixed(1)}s</span>
                </div>
                <span className="text-[11px] opacity-75">Live updates streaming</span>
              </div>

              {/* Live results preview during sync */}
              {results.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold flex items-center justify-between">
                    <span>Recent Live Results ({results.length})</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Streaming real-time</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-border/60">
                    {results.slice(-8).reverse().map((r, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-muted/20">
                        {r.status === "ok" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground w-28 shrink-0 truncate">
                          {r.customerKeyNumber}
                        </span>
                        <span className="flex-1 truncate font-medium">{r.name}</span>
                        {r.status === "ok" && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {r.paymentStatus}
                          </span>
                        )}
                        {r.status === "error" && (
                          <span className="shrink-0 text-[10px] text-destructive truncate max-w-[130px]">
                            {r.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  failed === 0
                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200"
                    : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200"
                }`}
              >
                {failed === 0 ? (
                  <CheckCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-sm">
                    {failed === 0 ? "All meters synced successfully!" : "Batch sync completed"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {results.length} meters processed in {(durationMs / 1000).toFixed(1)}s (avg {results.length ? ((durationMs / results.length)).toFixed(0) : 0}ms/meter)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-background/90 rounded-lg border text-center">
                  <div className="text-2xl font-black text-foreground">{results.length}</div>
                  <div className="text-muted-foreground mt-0.5">Total Processed</div>
                </div>
                <div className="p-3 bg-background/90 rounded-lg border text-center">
                  <div className="text-2xl font-black text-emerald-600">{synced}</div>
                  <div className="text-muted-foreground mt-0.5">Synced OK</div>
                </div>
                <div className="p-3 bg-background/90 rounded-lg border text-center">
                  <div className="text-2xl font-black text-destructive">{failed}</div>
                  <div className="text-muted-foreground mt-0.5">Errors / Not Found</div>
                </div>
              </div>

              {results.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">Per-Meter Results ({results.length})</span>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={exportCSV}>
                      <Download className="h-3 w-3" /> Export CSV
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                    {results.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/20">
                        {r.status === "ok" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground w-28 shrink-0 truncate">
                          {r.customerKeyNumber}
                        </span>
                        <span className="flex-1 truncate font-medium">{r.name}</span>
                        {r.status === "ok" && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {r.paymentStatus}
                          </span>
                        )}
                        {r.status === "error" && (
                          <span className="shrink-0 text-[10px] text-destructive truncate max-w-[140px]">
                            {r.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <XCircle className="h-4 w-4" /> Batch Sync Failed
              </div>
              <div className="opacity-90">{errorMsg}</div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          {phase === "idle" && (
            <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
              Cancel
            </Button>
          )}
          {phase === "running" && (
            <Button variant="outline" onClick={handleStop} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <StopCircle className="h-4 w-4 mr-1.5" /> Stop Sync
            </Button>
          )}
          {(phase === "done" || phase === "error") && (
            <>
              <Button variant="outline" onClick={reset}>
                Run Again
              </Button>
              <Button onClick={() => { onOpenChange(false); reset(); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
