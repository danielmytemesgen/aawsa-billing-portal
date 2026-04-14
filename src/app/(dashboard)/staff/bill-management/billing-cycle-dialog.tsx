'use client';

import * as React from "react";
import { CheckCircle, RefreshCcw, Search, Loader2, CalendarRange, AlertTriangle } from "lucide-react";
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
    processBillingJobChunkAction, 
    getAllBranchesAction,
    getSystemSettingsAction,
    resetStuckBillingJobsAction
} from "@/lib/actions";
import { format } from "date-fns";
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

    const [branches, setBranches] = React.useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = React.useState<string>("all");
    const [isStuck, setIsStuck] = React.useState(false);
    const [isResetting, setIsResetting] = React.useState(false);

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
            getAllBranchesAction()
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
                await runChunkedProcessing(job.id);
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
                    toast({ title: "Cycle Closed", description: "Billing cycle for selected meter closed successfully." });
                    onComplete?.();
                    onOpenChange(false);
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
     * Recursive chunk processor to handle 700k records in batches
     */
    const runChunkedProcessing = async (jobId: string) => {
        try {
            const chunkRes = await processBillingJobChunkAction(jobId, 1000); // 1000 at a time (bulk-fetch optimized)
            
            if (chunkRes.data) {
                const updatedJob = chunkRes.data;
                setProcessedCount(updatedJob.processed_items);
                
                if (updatedJob.status === 'completed') {
                    const failedCount = updatedJob.error_log
                        ? updatedJob.error_log.split('\n').filter(Boolean).length
                        : 0;
                    toast({
                        title: "Bulk Cycle Complete",
                        description: failedCount > 0
                            ? `Processed ${updatedJob.processed_items} meters. ${failedCount} meter(s) had errors — check the job log.`
                            : `Successfully processed ${updatedJob.processed_items} meters.`,
                        variant: failedCount > 0 ? "destructive" : "default"
                    });
                    onComplete?.();
                    setIsProcessing(false);
                    setTimeout(() => onOpenChange(false), 2000);
                } else if (updatedJob.status === 'failed') {
                    toast({ variant: "destructive", title: "Job Failed", description: updatedJob.error_log || "Unknown error during processing." });
                    setIsProcessing(false);
                } else {
                    // Continue to next chunk
                    await runChunkedProcessing(jobId);
                }
            } else {
                const errorMsg = typeof chunkRes.error === 'string' ? chunkRes.error : (chunkRes.error?.message || "Unknown error");
                toast({ variant: "destructive", title: "Processing Error", description: errorMsg });
                setIsProcessing(false);
            }
        } catch (err) {
            console.error("Chunk error:", err);
            setIsProcessing(false);
        }
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
                                <Input
                                    type="month"
                                    value={monthYear}
                                    onChange={(e) => setMonthYear(e.target.value)}
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
                                    <Input
                                        id="custom-start"
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => {
                                            setCustomStartDate(e.target.value);
                                            if (e.target.value) setMonthYear(e.target.value.substring(0, 7));
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="custom-end" className="text-xs">Period End Date</Label>
                                    <Input
                                        id="custom-end"
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        min={customStartDate}
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

                    {/* Progress bar */}
                    {isProcessing && currentJobId && (
                        <div className="space-y-3 pt-4 border-t">
                            <div className="flex justify-between text-xs font-medium">
                                <span>Processing Batch...</span>
                                <span>{processedCount} / {totalCount}</span>
                            </div>
                            <Progress value={totalCount > 0 ? (processedCount / totalCount) * 100 : 0} className="h-2" />
                            <p className="text-[10px] text-muted-foreground text-center italic">
                                Do not close this dialog until processing is complete.
                            </p>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="destructive"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleRunCycle(true)}
                            disabled={isProcessing}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Carry Balance
                        </Button>
                        <Button
                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleRunCycle(false)}
                            disabled={isProcessing}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Mark Paid
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
