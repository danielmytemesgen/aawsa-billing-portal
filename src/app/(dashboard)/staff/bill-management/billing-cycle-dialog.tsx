'use client';

import * as React from "react";
import { CheckCircle, RefreshCcw, Search, Loader2, CalendarRange } from "lucide-react";
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
    getBillingJobStatusAction,
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
    const [selectedMeterId, setSelectedMeterId] = React.useState<string>("");
    const [monthYear, setMonthYear] = React.useState(format(new Date(), "yyyy-MM"));
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [bulkMeters, setBulkMeters] = React.useState<any[]>([]);
    const [isLoadingMeters, setIsLoadingMeters] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");

    // Cycle config read from settings
    const [cycleMode, setCycleModeState] = React.useState<'once_per_month' | 'custom'>('once_per_month');
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

            // Read cycle config from database
            getSystemSettingsAction().then(res => {
                if (res.data) {
                    const s = res.data as Record<string, string>;
                    if (s.billing_cycle_mode) setCycleModeState(s.billing_cycle_mode as 'once_per_month' | 'custom');
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
            getAllBulkMetersAction(),
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

        if (cycleMode === 'custom') {
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

        // Build period override for custom mode
        const periodOverride = cycleMode === 'custom'
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
                    ...periodOverride,
                });

                if (res.data?.success) {
                    toast({ title: "Cycle Closed", description: "Billing cycle for selected meter closed successfully." });
                    onComplete?.();
                    onOpenChange(false);
                } else {
                    toast({ variant: "destructive", title: "Action Failed", description: res.error?.message || "Unknown error" });
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
                    toast({
                        title: "Bulk Cycle Complete",
                        description: `Successfully processed ${updatedJob.processed_items} meters.`
                    });
                    onComplete?.();
                    setTimeout(() => onOpenChange(false), 2000); // Give time to see 100%
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
                        <Badge variant={cycleMode === 'custom' ? 'secondary' : 'outline'} className="text-[10px]">
                            {cycleMode === 'custom' ? 'Custom Range' : 'Once/Month'}
                        </Badge>
                    </div>
                    <DialogDescription>
                        {cycleMode === 'custom'
                            ? 'Specify an exact date range for this billing run. Multiple runs per month are supported.'
                            : 'Close the current billing cycle and generate draft bills for bulk meters.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Bulk toggle */}
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
                        /* Custom date range mode */
                        <div className="space-y-4 p-4 border rounded-lg bg-blue-50/60 border-blue-100">
                            <div className="flex items-center gap-2 text-blue-700">
                                <CalendarRange className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase tracking-wide">Custom Billing Period</span>
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
                            <p className="text-[10px] text-blue-600 italic">
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
                            <Progress value={(processedCount / totalCount) * 100} className="h-2" />
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
