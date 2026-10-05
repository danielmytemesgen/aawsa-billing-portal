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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  Globe,
  Gauge,
  CreditCard,
  Building2,
  Check,
  ShieldCheck,
  Calendar,
  Hash,
  Droplets,
  Landmark,
  Database,
  ArrowRight,
  TriangleAlert,
  Zap,
  ArrowUpDown,
  CheckCheck,
} from "lucide-react";
import { syncCustomerPaymentAndReadingAction } from "@/lib/actions";
import { useRouter } from "next/navigation";

export interface SyncPaymentStatusDialogProps {
  openTrigger?: number;
  initialCustomerKey?: string;
  initialContractNo?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
  /** When true, automatically query the external server on open if customerKey/contractNo is set. Defaults to true. */
  autoRequest?: boolean;
}

type Step = "form" | "preview" | "done";

export function SyncPaymentStatusDialog({
  openTrigger = 0,
  initialCustomerKey = "",
  initialContractNo = "",
  isOpen,
  onOpenChange,
  triggerButton,
  autoRequest = true,
}: SyncPaymentStatusDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalOpen(val);
  };

  const [step, setStep] = React.useState<Step>("form");
  const [customerKey, setCustomerKey] = React.useState(initialCustomerKey);
  const [contractNo, setContractNo] = React.useState(initialContractNo);
  const [payrollNumber, setPayrollNumber] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [networkMode, setNetworkMode] = React.useState<"auto" | "internal" | "external">("external");

  const [isChecking, setIsChecking] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<any | null>(null);
  const [finalResult, setFinalResult] = React.useState<any | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Double-check confirmation modal guard
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  // Track if we've already automatically requested for the current open cycle
  const autoRequestedRef = React.useRef(false);

  React.useEffect(() => {
    if (openTrigger > 0) setOpen(true);
  }, [openTrigger]);

  React.useEffect(() => {
    if (initialCustomerKey) setCustomerKey(initialCustomerKey);
    if (initialContractNo) setContractNo(initialContractNo);
  }, [initialCustomerKey, initialContractNo]);

  const handleReset = () => {
    setStep("form");
    setPreviewData(null);
    setFinalResult(null);
    setErrorMsg(null);
    setShowConfirmModal(false);
    autoRequestedRef.current = false;
  };

  // Core check runner (dry run — query external server without writing to DB)
  const runCheck = React.useCallback(
    async (targetKey?: string, targetContract?: string, targetMode?: "auto" | "internal" | "external") => {
      const activeKey = (targetKey !== undefined ? targetKey : customerKey).trim();
      const activeContract = (targetContract !== undefined ? targetContract : contractNo).trim();
      const activeMode = targetMode || networkMode;

      if (!activeKey && !activeContract) {
        toast({
          title: "Validation Error",
          description: "Please provide either a Customer Key or a Contract Number.",
          variant: "destructive",
        });
        return;
      }

      setIsChecking(true);
      setErrorMsg(null);
      setPreviewData(null);

      try {
        const res = await syncCustomerPaymentAndReadingAction({
          customerKey: activeKey || undefined,
          contractNo: activeContract || undefined,
          payrollNumber: payrollNumber.trim() || undefined,
          password: password.trim() || undefined,
          networkMode: activeMode,
          dryRun: true,
        });

        if (!res.success) {
          setErrorMsg(res.error || "Failed to retrieve status from AAWSA external endpoint.");
          toast({
            title: "Endpoint Error",
            description: res.error || "Could not reach the AAWSA external uploader service.",
            variant: "destructive",
          });
        } else {
          setPreviewData(res);
          setStep("preview");
        }
      } catch (err: any) {
        const msg = err.message || "An unexpected error occurred.";
        setErrorMsg(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setIsChecking(false);
      }
    },
    [customerKey, contractNo, networkMode, payrollNumber, password, toast]
  );

  // ── AUTOMATIC REQUEST TO EXTERNAL SERVER ON DIALOG OPEN ───────────────────
  React.useEffect(() => {
    if (open && autoRequest && !autoRequestedRef.current && step === "form") {
      const activeKey = (initialCustomerKey || customerKey).trim();
      const activeContract = (initialContractNo || contractNo).trim();

      if (activeKey || activeContract) {
        autoRequestedRef.current = true;
        runCheck(activeKey, activeContract, "external");
      }
    }

    if (!open) {
      autoRequestedRef.current = false;
    }
  }, [open, autoRequest, initialCustomerKey, initialContractNo, customerKey, contractNo, step, runCheck]);

  // Form submit handler for manual check / re-check
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCheck();
  };

  // ── STEP 2: Trigger double-check confirmation ──────────────────────────────
  const handleInitiateApply = () => {
    setShowConfirmModal(true);
  };

  // ── STEP 3: Execute commit to database after double-check ──────────────────
  const handleConfirmApply = async () => {
    setShowConfirmModal(false);
    setIsApplying(true);
    setErrorMsg(null);
    try {
      const res = await syncCustomerPaymentAndReadingAction({
        customerKey: customerKey.trim() || undefined,
        contractNo: contractNo.trim() || undefined,
        payrollNumber: payrollNumber.trim() || undefined,
        password: password.trim() || undefined,
        networkMode,
        dryRun: false,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to apply sync to database.");
        toast({
          title: "Sync Failed",
          description: res.error || "Could not update the database.",
          variant: "destructive",
        });
      } else {
        setFinalResult(res);
        setStep("done");
        toast({
          title: "Sync Applied Successfully",
          description: `Payment: ${res.endpointData?.paymentStatus}. Reconciled: Yes.`,
        });
        router.refresh();
      }
    } catch (err: any) {
      const msg = err.message || "An unexpected error occurred during apply.";
      setErrorMsg(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const data = (finalResult ?? previewData)?.endpointData;
  const currentDb = previewData?.currentDbState;
  const networkUsed = (finalResult ?? previewData)?.networkUsed || networkMode;

  // ── Side-by-Side Double-Check Comparison Table ─────────────────────────────
  const DoubleCheckComparison = () => {
    if (!currentDb || !data) return null;

    const dbReading = currentDb.currentReading;
    const liveReading = data.currentReading;
    const readingDiff = liveReading != null && dbReading != null ? liveReading - dbReading : null;

    const dbStatus = currentDb.paymentStatus || "Unknown";
    const liveStatus = data.paymentStatus || "Unknown";
    const isStatusChanging = dbStatus.toLowerCase() !== liveStatus.toLowerCase();

    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between border-b pb-1.5 font-semibold text-xs">
          <span className="flex items-center gap-1.5 text-primary">
            <CheckCheck className="h-4 w-4" /> Double-Check Comparison: Local DB vs Live External Server
          </span>
          <span className="text-[10px] text-muted-foreground font-normal">
            {currentDb.found ? (currentDb.customerType === "bulk" ? "Bulk Meter" : "Individual Customer") : "New Customer"}
          </span>
        </div>

        <div className="divide-y divide-border/60">
          {/* Row 1: Payment Status */}
          <div className="grid grid-cols-12 py-1.5 items-center gap-2">
            <div className="col-span-4 text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Payment Status
            </div>
            <div className="col-span-3 font-mono font-medium">
              <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                dbStatus === "Paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {dbStatus}
              </span>
            </div>
            <div className="col-span-1 text-center text-muted-foreground">➔</div>
            <div className="col-span-4 font-mono font-bold flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                data.isPaid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {liveStatus} {data.paymentChannel ? `(${data.paymentChannel})` : ""}
              </span>
              {isStatusChanging && (
                <span className="text-[9px] text-emerald-600 font-sans font-bold">UPDATES</span>
              )}
            </div>
          </div>

          {/* Row 2: Meter Reading (Reference Only) */}
          <div className="grid grid-cols-12 py-1.5 items-center gap-2">
            <div className="col-span-4 text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3 w-3" /> Meter Reading <span className="text-[9px] text-muted-foreground/70">(Ref only)</span>
            </div>
            <div className="col-span-3 font-mono font-medium">
              {dbReading != null ? dbReading : "N/A"}
            </div>
            <div className="col-span-1 text-center text-muted-foreground">➔</div>
            <div className="col-span-4 font-mono font-bold text-foreground">
              {liveReading != null ? liveReading : "N/A"}
              {readingDiff !== null && (
                <span className={`ml-1 text-[10px] font-sans font-semibold ${readingDiff > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  ({readingDiff > 0 ? `+${readingDiff}` : readingDiff} m³)
                </span>
              )}
            </div>
          </div>

          {/* Row 3: Outstanding Balance */}
          <div className="grid grid-cols-12 py-1.5 items-center gap-2">
            <div className="col-span-4 text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Outstanding Debt
            </div>
            <div className="col-span-3 font-mono font-medium">
              {currentDb.latestOutstanding != null ? `ETB ${currentDb.latestOutstanding.toLocaleString()}` : "N/A"}
            </div>
            <div className="col-span-1 text-center text-muted-foreground">➔</div>
            <div className="col-span-4 font-mono font-bold text-foreground">
              {data.outstandingAmount != null ? `ETB ${Number(data.outstandingAmount).toLocaleString()}` : "N/A"}
            </div>
          </div>

          {/* Row 4: Bill Key / Bank Ref */}
          <div className="grid grid-cols-12 py-1.5 items-center gap-2">
            <div className="col-span-4 text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" /> Bill Key / Ref
            </div>
            <div className="col-span-3 font-mono text-[11px] truncate text-muted-foreground">
              {currentDb.latestBillKey || "None"}
            </div>
            <div className="col-span-1 text-center text-muted-foreground">➔</div>
            <div className="col-span-4 font-mono text-[11px] font-bold text-foreground truncate" title={data.billKey || ""}>
              {data.billKey || "N/A"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Reusable result card ───────────────────────────────────────────────────
  const ResultCard = ({ pendingConfirm }: { pendingConfirm: boolean }) => (
    <div
      className={`p-4 rounded-xl border space-y-3 ${
        pendingConfirm
          ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40"
          : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-current/10 pb-2">
        <div className="flex items-center gap-2">
          {pendingConfirm ? (
            <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          )}
          <div>
            <span className="font-semibold text-sm">
              {pendingConfirm ? "Live Data Retrieved — Double Check Review" : "Synchronization Complete"}
            </span>
            {data?.customerName && (
              <div className="text-[11px] text-muted-foreground font-medium">{data.customerName}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium uppercase flex items-center gap-1">
            <Globe className="h-2.5 w-2.5" />
            {networkUsed} Server
          </span>
          {data?.billedPeriod && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              Period: {data.billedPeriod}
            </span>
          )}
        </div>
      </div>

      {/* Side-by-side double check comparison (when pending confirm) */}
      {pendingConfirm && <DoubleCheckComparison />}

      {/* Row 1: Status + Readings Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CreditCard className="h-3 w-3" /> Live Payment
          </div>
          <div className={`font-bold mt-1 text-sm ${data?.isPaid ? "text-emerald-600" : "text-amber-600"}`}>
            {data?.paymentStatus || "Unknown"}
          </div>
          {data?.paymentChannel && (
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Landmark className="h-2.5 w-2.5" /> {data.paymentChannel}
            </div>
          )}
        </div>

        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3" /> Live Reading
          </div>
          <div className="font-bold mt-1 text-sm text-foreground">{data?.currentReading ?? "N/A"}</div>
          {data?.previousReading != null && (
            <div className="text-[10px] text-muted-foreground mt-0.5">Prev: {data.previousReading}</div>
          )}
        </div>

        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Droplets className="h-3 w-3" /> Consumption
          </div>
          <div className="font-bold mt-1 text-sm text-foreground">
            {data?.consumption != null ? `${data.consumption} m³` : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">This period</div>
        </div>

        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" /> Bill Key
          </div>
          <div className="font-bold mt-1 text-xs font-mono truncate" title={data?.billKey || ""}>
            {data?.billKey || "N/A"}
          </div>
          {data?.paymentDate && (
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> {data.paymentDate}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Financial Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground">This Month Bill</div>
          <div className="font-bold mt-0.5 text-foreground">
            {data?.thisMonthAmount != null
              ? `ETB ${Number(data.thisMonthAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "N/A"}
          </div>
        </div>
        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground">Outstanding Debt</div>
          <div className="font-bold mt-0.5 text-foreground">
            {data?.outstandingAmount != null
              ? `ETB ${Number(data.outstandingAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "N/A"}
          </div>
        </div>
        <div className="p-2 bg-background/90 rounded-lg border">
          <div className="text-[10px] text-muted-foreground">Amount Paid</div>
          <div className={`font-bold mt-0.5 ${data?.amountPaid ? "text-emerald-600" : "text-foreground"}`}>
            {data?.amountPaid != null
              ? `ETB ${Number(data.amountPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "N/A"}
          </div>
        </div>
      </div>

      {/* DB Sync Outcomes (Step 3 only) */}
      {!pendingConfirm && finalResult?.dbSync && (
        <div className="p-2.5 bg-background/90 rounded-lg border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
          <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Database Updates Successfully Committed:
          </div>
          <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
            {finalResult.dbSync.customerFound && (
              <li>
                Customer type:{" "}
                <span className="font-medium text-foreground">
                  {finalResult.dbSync.customerType === "bulk" ? "Bulk Meter" : "Individual Customer"}
                </span>
              </li>
            )}
            <li>
              Payment status:{" "}
              <span className="font-medium text-foreground">
                {finalResult.dbSync.paymentStatusUpdated ? "Updated" : "Already up to date"}
              </span>
            </li>
            <li>
              Bill reconciled:{" "}
              <span className="font-medium text-foreground">
                {finalResult.dbSync.billUpdated ? "Yes" : "No bill matched"}
              </span>
            </li>
            <li>
              Reconciliation:{" "}
              <span className="font-medium text-emerald-600">
                ✅ Reconciled (Readings are not modified by payment sync)
              </span>
            </li>
            <li>
              Payment record:{" "}
              <span className="font-medium text-foreground">
                {finalResult.dbSync.paymentRecorded ? "Created" : "Already exists or unpaid"}
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Warning banner in Step 2 */}
      {pendingConfirm && (
        <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
          <CheckCheck className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <strong>Double-Check Review:</strong> Verify the differences above. Your database has <strong>not</strong> been touched yet. Click <strong>&quot;Confirm &amp; Apply to Database&quot;</strong> to commit.
          </div>
        </div>
      )}
    </div>
  );

  // ── Step indicator in dialog header ───────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`flex items-center gap-1 font-semibold ${
          step === "form" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {step !== "form" ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <span className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center text-[9px] font-bold text-primary">
            1
          </span>
        )}
        Live Request
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span
        className={`flex items-center gap-1 font-semibold ${
          step === "preview" ? "text-amber-600" : step === "done" ? "text-emerald-600" : "text-muted-foreground"
        }`}
      >
        {step === "done" ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <span
            className={`h-4 w-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
              step === "preview" ? "border-amber-500 text-amber-600" : "border-muted-foreground"
            }`}
          >
            2
          </span>
        )}
        Double-Check Review
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className={`flex items-center gap-1 font-semibold ${step === "done" ? "text-emerald-600" : "text-muted-foreground"}`}>
        {step === "done" ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <span className="h-4 w-4 rounded-full border-2 border-muted-foreground flex items-center justify-center text-[9px] font-bold">
            3
          </span>
        )}
        Commit to DB
      </span>
    </div>
  );

  return (
    <>
      {triggerButton ? <span onClick={() => setOpen(true)}>{triggerButton}</span> : null}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <RefreshCw className="h-5 w-5 text-primary" />
                AAWSA Payment Status &amp; Reconciliation Sync
              </DialogTitle>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <Zap className="h-3 w-3 text-emerald-500" /> Auto-External
              </span>
            </div>
            <DialogDescription>
              Double-check flow: Live fetch from external server (bill.aawsa.gov.et:5001), side-by-side comparison with local DB, and verified confirmation.
            </DialogDescription>
            <div className="pt-1">
              <StepIndicator />
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-1">

            {/* ── STEP 1 FORM & LIVE AUTO-REQUEST STATUS ─────────────────── */}
            {step === "form" && (
              <form onSubmit={handleCheck} className="space-y-4">
                {/* Active Live Checking Indicator */}
                {isChecking && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3 animate-pulse">
                    <Loader2 className="h-6 w-6 text-primary animate-spin shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" /> Requesting External Server (bill.aawsa.gov.et:5001)...
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Fetching live CBE payment &amp; reconciliation status for{" "}
                        <span className="font-mono font-medium text-foreground">
                          {customerKey || contractNo || "meter"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="contractNo" className="text-xs font-semibold">Contract Number</Label>
                    <Input
                      id="contractNo"
                      placeholder="e.g. 745305"
                      value={contractNo}
                      onChange={(e) => setContractNo(e.target.value)}
                      disabled={isChecking}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customerKey" className="text-xs font-semibold">Customer Key Number</Label>
                    <Input
                      id="customerKey"
                      placeholder="e.g. BM-50557125"
                      value={customerKey}
                      onChange={(e) => setCustomerKey(e.target.value)}
                      disabled={isChecking}
                    />
                  </div>
                </div>

                {/* Network Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Target Endpoint Routing</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Default: bill.aawsa.gov.et:5001
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["external", "auto", "internal"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setNetworkMode(mode)}
                        className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
                          networkMode === mode
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-medium shadow-sm"
                            : "border-muted bg-card/50 hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          {mode === "external" && <Globe className="h-3.5 w-3.5 text-emerald-500" />}
                          {mode === "auto" && <RefreshCw className="h-3.5 w-3.5 text-blue-500" />}
                          {mode === "internal" && <Server className="h-3.5 w-3.5 text-gray-500" />}
                          {mode === "external"
                            ? "External (Default)"
                            : mode === "auto"
                            ? "Auto-Detect"
                            : "Internal LAN"}
                        </div>
                        <div className="text-[10px] mt-0.5 opacity-80 truncate">
                          {mode === "external" && "bill.aawsa.gov.et:5001"}
                          {mode === "auto" && "External → Internal"}
                          {mode === "internal" && "10.10.254.155:5001"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Staff Credentials */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Staff Uploader Credentials
                    </span>
                    <span className="text-[10px] font-normal">(Leave blank to use system env defaults)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Payroll Number"
                      value={payrollNumber}
                      onChange={(e) => setPayrollNumber(e.target.value)}
                      disabled={isChecking}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isChecking}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2.5 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Endpoint Error</div>
                      <div className="opacity-90">{errorMsg}</div>
                    </div>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isChecking}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isChecking} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    {isChecking ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Checking External Server...</>
                    ) : (
                      <><Globe className="h-4 w-4" /> Check External Server</>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* ── STEP 2 DOUBLE-CHECK PREVIEW ─────────────────────────────── */}
            {step === "preview" && previewData && (
              <div className="space-y-4">
                <ResultCard pendingConfirm={true} />

                {errorMsg && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2.5 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Apply Error</div>
                      <div className="opacity-90">{errorMsg}</div>
                    </div>
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-1 pt-1">
                  <Button type="button" variant="outline" onClick={handleReset} disabled={isApplying}>
                    &larr; Re-Check / Edit
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isApplying}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleInitiateApply}
                    disabled={isApplying}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isApplying ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Applying...</>
                    ) : (
                      <><CheckCheck className="h-4 w-4" /> Confirm &amp; Apply to Database</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* ── STEP 3 DONE ─────────────────────────────────────────────── */}
            {step === "done" && finalResult && (
              <div className="space-y-4">
                <ResultCard pendingConfirm={false} />
                <DialogFooter className="pt-1">
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Check Another
                  </Button>
                  <Button type="button" onClick={() => setOpen(false)} className="gap-2">
                    <Check className="h-4 w-4" /> Done
                  </Button>
                </DialogFooter>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>

      {/* ── EXPLICIT DOUBLE-CHECK CONFIRMATION ALERT MODAL ────────────────── */}
      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
              <TriangleAlert className="h-5 w-5" />
              Double-Check Confirmation Required
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-foreground pt-1">
                <p>
                  You are about to commit the following updates from the external server to the local database:
                </p>
                <div className="p-2.5 rounded-lg bg-muted/60 border text-xs space-y-1 font-mono">
                  <div><strong>Customer:</strong> {data?.customerName || customerKey}</div>
                  <div><strong>Customer Key:</strong> {customerKey || data?.customerKeyFromApi}</div>
                  <div><strong>Payment Status:</strong> <span className={data?.isPaid ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{data?.paymentStatus} {data?.paymentChannel ? `(${data.paymentChannel})` : ""}</span></div>
                  <div><strong>Reconciliation:</strong> <span className="text-emerald-600 font-bold">Reconciled</span></div>
                  <div><strong>Bill Key:</strong> {data?.billKey || "N/A"}</div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  (Note: Only payment status and reconciliation are updated. Meter readings are NOT altered by this action.)
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmModal(false)}>
              Cancel &amp; Re-Check
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Check className="h-4 w-4" />
              Yes, Commit to Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
