
import * as React from "react";
import { CheckCircle, RefreshCcw, Search, Loader2, CalendarRange, AlertTriangle, Download, Printer, Terminal, ArrowRight, Wrench, Check, RotateCcw, FileText, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { 
    getAllBulkMetersAction, 
    runBillingCycleAction, 
    startBillingJobAction, 
    getBranchesLookupAction,
    getSystemSettingsAction,
    resetStuckBillingJobsAction,
    createBulkMeterReadingAction,
    createIndividualCustomerReadingAction,
    getBulkMeterByIdAction
} from "@/lib/actions";
import { format, parse } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { BILLING_DUE_DATE_OFFSET_DAYS } from "@/lib/billing-config";

interface BillingCycleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete?: () => void;
}

export function BillingCycleDialog({ open, onOpenChange, onComplete }: BillingCycleDialogProps) {
    const { toast } = useToast();
    const [isBulk, setIsBulk] = React.useState(false);
    const [allowOverlap, setAllowOverlap] = React.useState(false);
    const [selectedMeterId, setSelectedMeterId] = React.useState<string>("");
    const [monthYear, setMonthYear] = React.useState(format(new Date(), "yyyy-MM"));
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [bulkMeters, setBulkMeters] = React.useState<any[]>([]);
    const [isLoadingMeters, setIsLoadingMeters] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [negativeConsumptionWarning, setNegativeConsumptionWarning] = React.useState<string | null>(null);

    // Cycle config read from settings
    const [cycleMode, setCycleModeState] = React.useState<'once_per_month' | 'custom' | 'unlimited'>('once_per_month');
    const [dueDateOffsetDays, setDueDateOffsetDays] = React.useState(BILLING_DUE_DATE_OFFSET_DAYS);

    // Custom date range fields
    const [customStartDate, setCustomStartDate] = React.useState("");
    const [customEndDate, setCustomEndDate] = React.useState("");

    // Phase 2: Progress State
    const [processedCount, setProcessedCount] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);

    // Polling interval ref — cleared when job completes or dialog closes
    const pollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const [branches, setBranches] = React.useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = React.useState<string>("all");
    const [isStuck, setIsStuck] = React.useState(false);
    const [isResetting, setIsResetting] = React.useState(false);
    const [jobErrors, setJobErrors] = React.useState<string[]>([]);

    // Timing & Metrics for Premium dashboard
    const [startTime, setStartTime] = React.useState<number | null>(null);
    const [speed, setSpeed] = React.useState<number>(0);
    const [eta, setEta] = React.useState<number | null>(null);

    // Live Terminal Console
    const [terminalLogs, setTerminalLogs] = React.useState<string[]>([]);
    const [isConsoleOpen, setIsConsoleOpen] = React.useState(false);

    // Interactive Correction List
    interface ParsedJobError {
        id: string;
        customerKey: string;
        message: string;
        resolved?: boolean;
        isResolving?: boolean;
        isEditingReading?: boolean;
        customReadingValue?: string;
        customPrevReadingValue?: string;
    }
    const [parsedErrors, setParsedErrors] = React.useState<ParsedJobError[]>([]);

    // Cleanup polling on unmount
    React.useEffect(() => {
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, []);

    React.useEffect(() => {
        if (open) {
            loadMeters();
            setProcessedCount(0);
            setTotalCount(0);
            setCurrentJobId(null);
            setIsStuck(false);
            setNegativeConsumptionWarning(null);
            setSelectedMeterId("");
            setSearchTerm("");
            setIsBulk(false);
            setAllowOverlap(false);
            setJobErrors([]);

            // Read cycle config from database
            getSystemSettingsAction().then(res => {
                if (res.data) {
                    const s = res.data as Record<string, string>;
                    if (s.billing_cycle_mode) setCycleModeState(s.billing_cycle_mode as 'once_per_month' | 'custom' | 'unlimited');
                    if (s.billing_due_date_offset) setDueDateOffsetDays(parseInt(s.billing_due_date_offset, 10));
                }
            });

            // Default custom dates to current month bounds
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            setCustomStartDate(`${y}-${m}-01`);
            setCustomEndDate(`${y}-${m}-${new Date(y, today.getMonth() + 1, 0).getDate()}`);
        }
    }, [open]);

    async function loadMeters() {
        setIsLoadingMeters(true);
        const [res, branchRes] = await Promise.all([
            getAllBulkMetersAction({ excludePending: false }), // load all so count is accurate
            (async () => {
                const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
                if (isOffline) {
                    try {
                        const cached = localStorage.getItem('cached_branches_lookup');
                        if (cached) return { data: JSON.parse(cached) as { id: string; name: string }[], error: null };
                    } catch (e) { /* ignore */ }
                    return { data: [] as { id: string; name: string }[], error: null };
                }
                try {
                    const r = await getBranchesLookupAction();
                    if (r && r.data) {
                        try {
                            localStorage.setItem('cached_branches_lookup', JSON.stringify(r.data));
                        } catch (e) { /* ignore */ }
                    }
                    return r;
                } catch (e) {
                    console.warn("Offline: failed to fetch branches lookup in billing cycle dialog", e);
                    try {
                        const cached = localStorage.getItem('cached_branches_lookup');
                        if (cached) return { data: JSON.parse(cached) as { id: string; name: string }[], error: null };
                    } catch (err) { /* ignore */ }
                    return { data: [] as { id: string; name: string }[], error: null };
                }
            })()
        ]);
        if (res.data) setBulkMeters(res.data);
        if (!branchRes.error && branchRes.data) setBranches(branchRes.data);
        setIsLoadingMeters(false);
    }

    const filteredMeters = bulkMeters.filter(m =>
        (m.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (m.customerKeyNumber?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    const handleRunCycle = async (carryBalance: boolean) => {
        if (!isBulk && !selectedMeterId) {
            toast({ variant: "destructive", title: "Error", description: "Please select a meter." });
            return;
        }

        if (cycleMode === 'custom' || cycleMode === 'unlimited') {
            if (!customStartDate || !customEndDate) {
                toast({ variant: "destructive", title: "Error", description: "Please set both period start and end dates." });
                return;
            }
            if (customStartDate >= customEndDate) {
                toast({ variant: "destructive", title: "Error", description: "Period start must be before end date." });
                return;
            }
        }

        if (!isBulk) {
            const selectedMeter = bulkMeters.find(m => m.customerKeyNumber === selectedMeterId);
            if (selectedMeter && selectedMeter.status !== 'Active') {
                toast({ variant: "destructive", title: "Cannot create bill", description: "Account is not Active. Please approve the account first." });
                return;
            }
        }

        setIsProcessing(true);
        setProcessedCount(0);
        setNegativeConsumptionWarning(null);
        setJobErrors([]);
        setStartTime(Date.now());
        setSpeed(0);
        setEta(null);
        setTerminalLogs([`[${new Date().toLocaleTimeString()}] 🚀 Initiated billing job for month ${monthYear}`]);

        // Build period override for custom/unlimited mode
        const periodOverride = (cycleMode === 'custom' || cycleMode === 'unlimited')
            ? { periodStartDate: customStartDate, periodEndDate: customEndDate }
            : {};

        try {
            if (isBulk) {
                const startRes = await startBillingJobAction({
                    type: 'bulk_meters',
                    monthYear,
                    carryBalance,
                    branchId: selectedBranch === "all" ? undefined : selectedBranch,
                    dueDateOffsetDays,
                    allowOverlap,
                    ...periodOverride,
                });

                if (startRes.error) {
                    const errorMsg = typeof startRes.error === 'string' ? startRes.error : (startRes.error?.message || "Unknown error");
                    toast({ variant: "destructive", title: "Job Failed to Start", description: errorMsg });
                    
                    if (errorMsg.toLowerCase().includes("already pending") || errorMsg.toLowerCase().includes("already processing")) {
                        setIsStuck(true);
                    }
                    
                    setIsProcessing(false);
                    return;
                }

                const job = startRes.data;
                setCurrentJobId(job.id);
                setTotalCount(job.total_items);
                setProcessedCount(job.processed_items || 0);

                // ── Fire server-side processing (recursive resumption) ────────────────
                // If the server hits its safety ceiling it returns { resumed: true }.
                // We keep re-firing the request so the job always finishes even if the
                // Node.js request runtime has a per-request time limit.
                const fireProcessJob = (jobId: string) => {
                    fetch('/api/billing/process-job', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobId }),
                    }).then(async (res) => {
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            console.error('[billing] process-job API error:', err);
                            return;
                        }
                        const data = await res.json().catch(() => ({}));
                        // If server returned early due to safety ceiling, resume immediately
                        if (data?.resumed) {
                            console.log('[billing] Job hit timeout ceiling — resuming automatically…');
                            fireProcessJob(jobId);
                        }
                    }).catch((err) => {
                        console.error('[billing] process-job fetch error:', err);
                    });
                };
                fireProcessJob(job.id);

                // ── Poll job status every 4 seconds ──────────────────────────────────
                startPolling(job.id, job.total_items);


            } else {
                const res = await runBillingCycleAction({
                    bulkMeterId: selectedMeterId,
                    carryBalance,
                    monthYear,
                    dueDateOffsetDays,
                    allowOverlap,
                    ...periodOverride,
                });

                if (res.data?.success) {
                    if (res.data.warning) {
                        setNegativeConsumptionWarning(res.data.warning);
                    } else {
                        toast({ title: "Cycle Closed", description: "Billing cycle for selected meter closed successfully." });
                        onComplete?.();
                        onOpenChange(false);
                    }
                    setIsProcessing(false);
                } else {
                    const errMsg: string = res.error?.message || "Unknown error";
                    // Detect negative consumption — surface a detailed staff attention warning
                    if (errMsg.toLowerCase().includes("negative")) {
                        setNegativeConsumptionWarning(errMsg);
                    } else {
                        toast({ variant: "destructive", title: "Action Failed", description: errMsg });
                    }
                    setIsProcessing(false);
                }
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
            setIsProcessing(false);
        }
    };

    /**
     * Polls /api/billing/job-status every 4 seconds.
     * Updates the progress bar and fires completion/failure toasts.
     * The server runs the actual processing loop — the browser only watches.
     */
    const startPolling = (jobId: string, total: number) => {
        // Clear any existing poll
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/billing/job-status?jobId=${jobId}`);
                if (!res.ok) return;
                const { job } = await res.json();
                if (!job) return;

                setProcessedCount(job.processed_items || 0);
                setTotalCount(job.total_items || total);

                // Throughput and ETA calculation
                const activeStartTime = startTime || Date.now();
                const elapsed = (Date.now() - activeStartTime) / 1000;
                if (elapsed > 0.5 && job.processed_items > 0) {
                    const currentSpeed = job.processed_items / elapsed;
                    setSpeed(currentSpeed);
                    const remaining = (job.total_items || total) - job.processed_items;
                    if (currentSpeed > 0) {
                        setEta(Math.ceil(remaining / currentSpeed));
                    }
                }

                if (job.error_log) {
                    const lines = job.error_log.split('\n').filter(Boolean);
                    setJobErrors(lines);
                }

                // Update Live Console Logs
                setTerminalLogs(prev => {
                    const timeStr = new Date().toLocaleTimeString();
                    const progressMsg = `[${timeStr}] ⚙️ Processed ${job.processed_items}/${job.total_items || total} items...`;
                    
                    const nextLogs = [...prev];
                    // Replace previous progress log to keep terminal neat
                    if (nextLogs.length > 0 && nextLogs[nextLogs.length - 1].includes("Processed")) {
                        nextLogs[nextLogs.length - 1] = progressMsg;
                    } else {
                        nextLogs.push(progressMsg);
                    }
                    return nextLogs;
                });

                if (job.status === 'completed') {
                    clearInterval(pollingRef.current!);
                    pollingRef.current = null;

                    const errorLines: string[] = job.error_log
                        ? job.error_log.split('\n').filter(Boolean)
                        : [];

                    setTerminalLogs(prev => [
                        ...prev,
                        `[${new Date().toLocaleTimeString()}] ✅ Billing job completed. Success count: ${job.processed_items}. Issues count: ${errorLines.length}`
                    ]);

                    // Separate overlap-skipped meters from other errors
                    const overlapSkipped = errorLines.filter((l: string) =>
                        l.toLowerCase().includes('overlap') || l.toLowerCase().includes('overlaps with an existing bill')
                    );
                    const otherErrors = errorLines.filter((l: string) =>
                        !l.toLowerCase().includes('overlap') && !l.toLowerCase().includes('overlaps with an existing bill')
                    );

                    let description = `Successfully billed ${job.processed_items} meter(s).`;
                    const hasIssues = overlapSkipped.length > 0 || otherErrors.length > 0;

                    if (overlapSkipped.length > 0 && otherErrors.length > 0) {
                        description = `Billed ${job.processed_items} meter(s). ${overlapSkipped.length} skipped (bills already exist for this period). ${otherErrors.length} other error(s) — check the job log.`;
                    } else if (overlapSkipped.length > 0) {
                        description = `Billed ${job.processed_items} meter(s). ${overlapSkipped.length} meter(s) were skipped because bills already exist for ${monthYear}. Enable "Allow Overlap" to re-create those bills.`;
                    } else if (otherErrors.length > 0) {
                        description = `Billed ${job.processed_items} meter(s). ${otherErrors.length} meter(s) had errors — check the job log.`;
                    }

                    toast({
                        title: "✅ Bulk Cycle Complete",
                        description,
                        variant: hasIssues ? "destructive" : "default"
                    });
                    onComplete?.();
                    setIsProcessing(false);

                    // Only auto-close if there were no skipped meters or errors!
                    if (!hasIssues) {
                        setTimeout(() => onOpenChange(false), 2000);
                    }

                } else if (job.status === 'failed') {
                    clearInterval(pollingRef.current!);
                    pollingRef.current = null;
                    setTerminalLogs(prev => [
                        ...prev,
                        `[${new Date().toLocaleTimeString()}] ❌ Job failed: ${job.error_log || 'Unknown error'}`
                    ]);
                    toast({ variant: "destructive", title: "Job Failed", description: job.error_log || "Unknown error during processing." });
                    setIsProcessing(false);
                }
                // If still 'processing' or 'pending' — continue polling
            } catch (err) {
                console.error('[billing] polling error:', err);
                // Don't stop polling on transient network errors
            }
        }, 1000); // poll every 1 second for live progress updates
    };


    const handleExportIssues = () => {
        if (jobErrors.length === 0) return;
        const textContent = `AAWSA Billing Portal - Billing Job Issues Log\nJob ID: ${currentJobId || 'N/A'}\nDate: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}\nBilling Month: ${monthYear}\n\nIssues & Skips:\n` + jobErrors.map((err, i) => `${i + 1}. ${err}`).join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `billing_job_issues_${monthYear}.txt`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleResetJob = async () => {
        setIsResetting(true);
        try {
            const res = await resetStuckBillingJobsAction(monthYear, isBulk ? 'bulk_meters' : 'individual_customers');
            if (res.data?.success) {
                toast({ title: "Job Reset", description: "The stuck job has been cleared. You can now try running the cycle again." });
                setIsStuck(false);
            } else {
                toast({ variant: "destructive", title: "Reset Failed", description: res.error?.message || "Could not reset the job." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred during reset." });
        } finally {
            setIsResetting(false);
        }
    };

    // Live update parsed errors list when new jobErrors arrive
    React.useEffect(() => {
        if (jobErrors.length > 0) {
            setParsedErrors(prev => {
                const existingMap = new Map(prev.map(e => [e.id, e]));
                
                return jobErrors.map((err, idx) => {
                    const separatorIndex = err.indexOf(':');
                    const customerKey = separatorIndex !== -1 ? err.substring(0, separatorIndex).trim() : '';
                    const message = separatorIndex !== -1 ? err.substring(separatorIndex + 1).trim() : err;
                    const errorId = `${customerKey}-${idx}`;
                    
                    const existing = existingMap.get(errorId);
                    if (existing) {
                        return { ...existing, message };
                    }
                    
                    return {
                        id: errorId,
                        customerKey,
                        message,
                        resolved: false,
                        isResolving: false,
                        isEditingReading: false,
                        customReadingValue: "",
                        customPrevReadingValue: ""
                    };
                });
            });
        } else {
            setParsedErrors([]);
        }
    }, [jobErrors]);

    const handleResolveInline = async (errItem: any, isBulkType: boolean) => {
        if (!errItem.customReadingValue) {
            toast({ variant: "destructive", title: "Missing value", description: "Please enter a reading value." });
            return;
        }

        setParsedErrors(prev => prev.map(e => e.id === errItem.id ? { ...e, isResolving: true } : e));

        try {
            const readingVal = parseFloat(errItem.customReadingValue);
            const prevReadingVal = errItem.customPrevReadingValue ? parseFloat(errItem.customPrevReadingValue) : undefined;
            const rDate = new Date();
            const rMonth = monthYear;

            if (isBulkType) {
                const readingInsert = {
                    CUSTOMERKEY: errItem.customerKey,
                    reading_date: rDate.toISOString(),
                    reading_value: readingVal,
                    month_year: rMonth
                };
                
                const res = await createBulkMeterReadingAction(readingInsert);
                if (res.error) {
                    toast({ variant: "destructive", title: "Error", description: res.error.message || "Failed to save reading" });
                    return;
                }
            } else {
                const readingInsert = {
                    individual_customer_id: errItem.customerKey,
                    reading_date: rDate.toISOString(),
                    reading_value: readingVal,
                    month_year: rMonth
                };
                const res = await createIndividualCustomerReadingAction(readingInsert);
                if (res.error) {
                    toast({ variant: "destructive", title: "Error", description: res.error.message || "Failed to save reading" });
                    return;
                }
            }

            const res = await runBillingCycleAction({
                bulkMeterId: errItem.customerKey,
                carryBalance: true,
                monthYear,
                dueDateOffsetDays,
                allowOverlap: true,
            });

            if (res.data?.success) {
                toast({ title: "Resolved & Billed", description: `Reading updated and bill generated for customer ${errItem.customerKey}.` });
                setParsedErrors(prev => prev.map(e => e.id === errItem.id ? { ...e, resolved: true, isResolving: false } : e));
                onComplete?.();
            } else {
                toast({ variant: "destructive", title: "Failed to bill", description: res.error?.message || "Reading saved, but billing failed." });
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to resolve inline error" });
        } finally {
            setParsedErrors(prev => prev.map(e => e.id === errItem.id ? { ...e, isResolving: false } : e));
        }
    };

    const handleForceRecreate = async (errItem: any, isBulkType: boolean) => {
        setParsedErrors(prev => prev.map(e => e.id === errItem.id ? { ...e, isResolving: true } : e));
        try {
            const res = await runBillingCycleAction({
                bulkMeterId: errItem.customerKey,
                carryBalance: true,
                monthYear,
                dueDateOffsetDays,
                allowOverlap: true,
            });

            if (res.data?.success) {
                toast({ title: "Bill Recreated", description: `Existing bill overwritten successfully for customer ${errItem.customerKey}.` });
                setParsedErrors(prev => prev.map(e => e.id === errItem.id ? { ...e, resolved: true, isResolving: false } : e));
                onComplete?.();
            } else {
                toast({ variant: "destructive", title: "Action Failed", description: res.error?.message || "Failed to recreate bill." });
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e?.message || "Unexpected error occurred." });
        } finally {
            setParsedErrors(prev => prev.map(e => e.id === errItem.id ? { ...e, isResolving: false } : e));
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <DialogTitle>Run Billing Cycle</DialogTitle>
                        <Badge variant={cycleMode === 'unlimited' ? 'default' : cycleMode === 'custom' ? 'secondary' : 'outline'} className="text-[10px]">
                            {cycleMode === 'unlimited' ? 'Unlimited / Day' : cycleMode === 'custom' ? 'Custom Range' : 'Once/Month'}
                        </Badge>
                    </div>
                    <DialogDescription>
                        {cycleMode === 'custom'
                            ? 'Specify an exact date range for this billing run. Multiple runs per month are supported.'
                            : cycleMode === 'unlimited'
                            ? 'You can generate as many bills as required at any time for any billing period.'
                            : 'Close the current billing cycle and generate draft bills for bulk meters.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Bulk toggle & Allow Overlap */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="isBulk"
                                checked={isBulk}
                                onCheckedChange={(checked) => setIsBulk(checked as boolean)}
                            />
                            <Label htmlFor="isBulk" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Apply to ALL bulk meters (Bulk Cycle)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="allowOverlap"
                                checked={allowOverlap}
                                onCheckedChange={(checked) => setAllowOverlap(checked as boolean)}
                            />
                            <Label htmlFor="allowOverlap" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-600">
                                Allow Overlap
                            </Label>
                        </div>
                    </div>

                    {/* ⚠️ Bulk cycle scope warning — shown as soon as isBulk is checked */}
                    {isBulk && !isProcessing && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>Bulk Cycle — This will affect ALL meters</span>
                            </div>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                You are about to run the billing cycle for{" "}
                                <span className="font-bold">
                                    {selectedBranch === "all"
                                        ? `all ${bulkMeters.filter(m => m.status === "Active").length} active bulk meters`
                                        : `all active bulk meters in the selected branch (${bulkMeters.filter(m => m.status === "Active" && m.branch_id === selectedBranch).length} meters)`}
                                </span>.
                                This will generate draft bills for every meter in scope.
                                Make sure all meter readings are up to date before proceeding.
                            </p>
                            <ul className="text-[11px] text-amber-700 list-disc list-inside space-y-0.5">
                                <li>Verify the billing month is correct before running.</li>
                                <li>Meters with negative consumption will be skipped and logged.</li>
                                <li>This action cannot be undone without manually deleting each bill.</li>
                            </ul>
                            {/* ❌ Overlap skip warning — only shown when Allow Overlap is NOT checked */}
                            {!allowOverlap && (
                                <div className="mt-2 flex items-start gap-2 p-2 bg-red-50 border border-red-300 rounded">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-red-700 leading-relaxed">
                                        <span className="font-bold">Overlap protection is ON.</span>{" "}
                                        Any meter that already has a bill for the selected period ({monthYear}) will be{" "}
                                        <span className="font-bold">skipped automatically</span> and logged as an error.
                                        To re-create bills for meters with existing records, enable{" "}
                                        <span className="font-semibold text-amber-700">Allow Overlap</span>.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Single meter picker */}
                    {!isBulk && (
                        <div className="space-y-3">
                            <Label>Select Bulk Meter</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search meter..."
                                    className="pl-8 mb-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={selectedMeterId} onValueChange={setSelectedMeterId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingMeters ? "Loading meters..." : "Choose a meter"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredMeters.length === 0 ? (
                                        <div className="p-2 text-sm text-center text-muted-foreground">No meters found</div>
                                    ) : (
                                        filteredMeters.map(m => (
                                            <SelectItem key={m.customerKeyNumber} value={m.customerKeyNumber} disabled={m.status !== 'Active'}>
                                                <div className="flex items-center justify-between w-full gap-2">
                                                    <span>{m.name} ({m.customerKeyNumber})</span>
                                                    {m.status !== 'Active' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded font-bold uppercase">Pending</span>}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Period fields */}
                    {cycleMode === 'once_per_month' ? (
                        <div className={isBulk ? "grid grid-cols-2 gap-4" : "space-y-2"}>
                            <div className="space-y-2">
                                <Label>Billing Month</Label>
                                <DatePicker
                                    date={monthYear ? parse(monthYear, "yyyy-MM", new Date()) : undefined}
                                    onSelect={(date) => {
                                        if (date) setMonthYear(format(date, "yyyy-MM"));
                                    }}
                                    placeholder="Select Month"
                                    className="w-full"
                                />
                            </div>
                            {isBulk && (
                                <div className="space-y-2">
                                    <Label>Branch</Label>
                                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                        <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Branches</SelectItem>
                                            {branches.map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Custom/Unlimited date range mode */
                        <div className={`space-y-4 p-4 border rounded-lg ${cycleMode === 'unlimited' ? 'bg-green-50/60 border-green-100' : 'bg-blue-50/60 border-blue-100'}`}>
                            <div className={`flex items-center gap-2 ${cycleMode === 'unlimited' ? 'text-green-700' : 'text-blue-700'}`}>
                                <CalendarRange className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase tracking-wide">
                                    {cycleMode === 'unlimited' ? 'Unlimited Billing Period' : 'Custom Billing Period'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="custom-start" className="text-xs">Period Start Date</Label>
                                    <DatePicker
                                        date={customStartDate ? new Date(customStartDate) : undefined}
                                        onSelect={(date) => {
                                            if (date) {
                                                const startStr = format(date, "yyyy-MM-dd");
                                                setCustomStartDate(startStr);
                                                setMonthYear(startStr.substring(0, 7));
                                            }
                                        }}
                                        placeholder="Start Date"
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="custom-end" className="text-xs">Period End Date</Label>
                                    <DatePicker
                                        date={customEndDate ? new Date(customEndDate) : undefined}
                                        onSelect={(date) => {
                                            if (date) setCustomEndDate(format(date, "yyyy-MM-dd"));
                                        }}
                                        placeholder="End Date"
                                        className="w-full"
                                        disabledTrigger={!customStartDate}
                                    />
                                </div>
                            </div>
                            {isBulk && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Branch</Label>
                                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                        <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Branches</SelectItem>
                                            {branches.map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <p className={`text-[10px] italic ${cycleMode === 'unlimited' ? 'text-green-600' : 'text-blue-600'}`}>
                                Due date: {dueDateOffsetDays} days after period end. Configured in Settings → Billing Settings.
                            </p>
                        </div>
                    )}

                    {/* Premium Progress Dashboard */}
                    {currentJobId && (
                        <div className="space-y-4 pt-4 border-t animate-in fade-in duration-300">
                            {/* Dashboard grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                {/* SVG Ring Center */}
                                <div className="flex flex-col items-center justify-center space-y-1">
                                    <div className="relative w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                className="text-slate-100"
                                                strokeWidth="6"
                                                stroke="currentColor"
                                                fill="transparent"
                                                r="42"
                                                cx="48"
                                                cy="48"
                                            />
                                            <circle
                                                className="text-blue-600 transition-all duration-300 ease-out"
                                                strokeWidth="6"
                                                strokeDasharray="263.89"
                                                strokeDashoffset={263.89 - (totalCount > 0 ? (processedCount / totalCount) * 263.89 : 0)}
                                                strokeLinecap="round"
                                                stroke="currentColor"
                                                fill="transparent"
                                                r="42"
                                                cx="48"
                                                cy="48"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-lg font-bold text-slate-800">
                                                {totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0}%
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">Billed</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Performance metrics */}
                                <div className="md:col-span-2 space-y-2.5">
                                    <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                                        <span className="text-slate-500 font-medium">Status</span>
                                        <span className="font-bold flex items-center gap-1">
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                                    <span className="text-blue-600">Processing...</span>
                                                </>
                                            ) : jobErrors.length > 0 ? (
                                                <span className="text-amber-600">Billed with Issues</span>
                                            ) : (
                                                <span className="text-green-600">Completed</span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <span className="text-slate-400 block font-medium">Speed</span>
                                            <span className="font-bold text-slate-700">{speed > 0 ? `${speed.toFixed(1)} bills/s` : '--'}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <span className="text-slate-400 block font-medium">ETA</span>
                                            <span className="font-bold text-slate-700">{eta !== null ? `${eta}s` : '--'}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm col-span-2 flex justify-between items-center">
                                            <div>
                                                <span className="text-slate-400 block font-medium">Progress</span>
                                                <span className="font-bold text-slate-700">{processedCount.toLocaleString()} / {totalCount.toLocaleString()}</span>
                                            </div>
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                ID: {currentJobId?.substring(0, 8)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Carbon Console Log */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                                    className="w-full bg-slate-100 px-3 py-2 flex items-center justify-between text-xs text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Terminal className="h-3.5 w-3.5" />
                                        <span>Job Live Terminal Console</span>
                                    </div>
                                    {isConsoleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                {isConsoleOpen && (
                                    <div className="bg-slate-950 font-mono text-[10px] text-green-400 p-3 h-28 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                                        {terminalLogs.map((log, idx) => (
                                            <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Live Issues & Inline Corrections Panel */}
                            {parsedErrors.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                            Actionable Failures & Skips ({parsedErrors.filter(e => !e.resolved).length})
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleExportIssues}
                                            className="h-7 px-2 text-[10px] text-slate-600 hover:text-slate-900 border"
                                        >
                                            <Download className="h-3 w-3 mr-1" />
                                            Export Logs
                                        </Button>
                                    </div>

                                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                        {parsedErrors.map((err) => {
                                            const isOverlap = err.message.toLowerCase().includes("overlap");
                                            return (
                                                <div
                                                    key={err.id}
                                                    className={`p-3 rounded-lg border transition-all ${
                                                        err.resolved
                                                            ? "bg-green-50 border-green-200 text-green-800"
                                                            : "bg-white border-slate-200 shadow-sm"
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge variant={err.resolved ? "default" : "destructive"} className="text-[8px] font-bold py-0 h-4">
                                                                    {err.customerKey || "System"}
                                                                </Badge>
                                                                {err.resolved && (
                                                                    <span className="text-[10px] font-bold text-green-700 flex items-center gap-0.5">
                                                                        <Check className="h-3 w-3" /> Resolved
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] font-medium text-slate-700 leading-normal">
                                                                {err.message}
                                                            </p>
                                                        </div>

                                                        {!err.resolved && (
                                                            <div className="flex gap-1.5">
                                                                {isOverlap ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-50"
                                                                        disabled={err.isResolving}
                                                                        onClick={() => handleForceRecreate(err, true)}
                                                                    >
                                                                        {err.isResolving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                                                        Overwrite Bill
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-[10px] border-blue-300 text-blue-800 hover:bg-blue-50"
                                                                        disabled={err.isResolving}
                                                                        onClick={() => {
                                                                            setParsedErrors(prev =>
                                                                                prev.map(e => e.id === err.id ? { ...e, isEditingReading: !e.isEditingReading } : e)
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Wrench className="h-3 w-3 mr-1" />
                                                                        {err.isEditingReading ? "Cancel" : "Fix Reading"}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Expandable Inline correction form */}
                                                    {err.isEditingReading && !err.resolved && (
                                                        <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                            <div className="grid grid-cols-2 gap-2.5">
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-500">Prev. Reading</span>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="e.g. 100"
                                                                        className="h-8 text-[11px]"
                                                                        value={err.customPrevReadingValue || ""}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setParsedErrors(prev =>
                                                                                prev.map(item => item.id === err.id ? { ...item, customPrevReadingValue: val } : item)
                                                                            );
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-500">New Reading</span>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="e.g. 150"
                                                                        className="h-8 text-[11px]"
                                                                        value={err.customReadingValue || ""}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setParsedErrors(prev =>
                                                                                prev.map(item => item.id === err.id ? { ...item, customReadingValue: val } : item)
                                                                            );
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                className="w-full h-8 text-[11px] bg-blue-600 hover:bg-blue-700"
                                                                disabled={err.isResolving}
                                                                onClick={() => handleResolveInline(err, true)}
                                                            >
                                                                {err.isResolving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                                Save Reading & Re-create Bill
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isStuck && !isProcessing && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md space-y-2">
                            <p className="text-xs text-amber-800 font-medium">A billing job for this month is already active or stuck.</p>
                            <p className="text-[10px] text-amber-700">If the job was interrupted or is taking too long (over 30 mins), you can reset it below.</p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full text-xs border-amber-300 hover:bg-amber-100 text-amber-900"
                                onClick={handleResetJob}
                                disabled={isResetting}
                            >
                                {isResetting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3 w-3" />}
                                Reset Stuck Job
                            </Button>
                        </div>
                    )}

                    {/* ⚠️ Negative Consumption Staff Warning */}
                    {negativeConsumptionWarning && (
                        <div className="p-4 bg-red-50 border border-red-300 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <span>⚠️ Attention Required — Negative Consumption Detected</span>
                            </div>
                            <p className="text-xs text-red-700 leading-relaxed">
                                The total usage recorded by individual sub-meters <strong>exceeds</strong> the bulk meter reading for this period.
                                This means the bill <strong>cannot be generated</strong> until the readings are corrected.
                            </p>
                            <div className="bg-red-100 rounded p-3 space-y-1">
                                <p className="text-[11px] font-bold text-red-800 uppercase tracking-wide">What to do:</p>
                                <ul className="text-[11px] text-red-700 space-y-1 list-disc list-inside">
                                    <li>Go to <strong>Meter Readings</strong> and verify the current &amp; previous readings for this bulk meter.</li>
                                    <li>Check all individual sub-meter readings assigned to this bulk meter.</li>
                                    <li>Look for data entry errors, meter rollovers, or misassigned readings.</li>
                                    <li>Correct the readings, then re-run the billing cycle.</li>
                                </ul>
                            </div>
                            <p className="text-[10px] text-red-500 italic">{negativeConsumptionWarning}</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing && !currentJobId}>
                        {processedCount > 0 && processedCount === totalCount && !isProcessing ? "Close" : "Cancel"}
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex-1 sm:flex-none"
                        onClick={() => handleRunCycle(true)}
                        disabled={isProcessing}
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        Print Bill for {monthYear}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
