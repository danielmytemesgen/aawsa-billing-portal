"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    previewBillsForPeriodAndBranchAction,
    bulkDeleteBillsForPeriodAndBranchAction,
    getBranchesLookupAction
} from "@/lib/actions";

interface BulkDeleteBillsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMonthYear?: string;
    initialBranchId?: string;
    branches?: Array<{ id: string; name: string }>;
    onSuccess?: () => void;
    onTriggerRebill?: (params: { monthYear: string; branchId?: string }) => void;
}

export function BulkDeleteBillsDialog({
    open,
    onOpenChange,
    initialMonthYear,
    initialBranchId,
    branches: propBranches,
    onSuccess,
    onTriggerRebill,
}: BulkDeleteBillsDialogProps) {
    const { toast } = useToast();

    const [monthYear, setMonthYear] = useState<string>(
        initialMonthYear && initialMonthYear !== "all"
            ? initialMonthYear
            : format(new Date(), "yyyy-MM")
    );
    const [selectedBranch, setSelectedBranch] = useState<string>(
        initialBranchId && initialBranchId !== "all" ? initialBranchId : "all"
    );
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>(propBranches || []);
    const [excludePaid, setExcludePaid] = useState<boolean>(true);
    const [confirmText, setConfirmText] = useState<string>("");

    const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isRebilling, setIsRebilling] = useState<boolean>(false);

    const [preview, setPreview] = useState<{
        total_count: number;
        total_amount: number;
        draft_count: number;
        pending_count: number;
        approved_unpaid_count: number;
        paid_count: number;
        paid_amount: number;
        unpaid_amount: number;
        eligible_delete_count: number;
    } | null>(null);

    // Sync initial props
    useEffect(() => {
        if (open) {
            if (initialMonthYear && initialMonthYear !== "all") {
                setMonthYear(initialMonthYear);
            }
            if (initialBranchId && initialBranchId !== "all") {
                setSelectedBranch(initialBranchId);
            }
            setConfirmText("");
        }
    }, [open, initialMonthYear, initialBranchId]);

    // Load branches if not provided
    useEffect(() => {
        if (open && (!branches || branches.length === 0)) {
            getBranchesLookupAction().then((res) => {
                if (res.data) setBranches(res.data);
            }).catch(console.error);
        }
    }, [open, branches]);

    // Fetch impact preview whenever monthYear or selectedBranch changes
    useEffect(() => {
        if (!open || !monthYear) return;

        let isCurrent = true;
        setIsLoadingPreview(true);

        previewBillsForPeriodAndBranchAction({
            monthYear,
            branchId: selectedBranch === "all" ? undefined : selectedBranch,
        })
            .then((res) => {
                if (isCurrent) {
                    if (res.data) {
                        setPreview(res.data);
                    } else {
                        setPreview(null);
                    }
                    setIsLoadingPreview(false);
                }
            })
            .catch((err) => {
                if (isCurrent) {
                    console.error("Preview fetch error:", err);
                    setPreview(null);
                    setIsLoadingPreview(false);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [open, monthYear, selectedBranch]);

    const activeBranchObj = branches.find((b) => b.id === selectedBranch);
    const branchName = activeBranchObj ? activeBranchObj.name : "All Branches";

    const isConfirmed = confirmText.trim().toUpperCase() === "DELETE" ||
        (activeBranchObj && confirmText.trim().toLowerCase() === activeBranchObj.name.toLowerCase());

    const handleDelete = async (andRebill: boolean = false) => {
        if (!isConfirmed) return;
        if (!preview || preview.eligible_delete_count === 0) {
            toast({
                title: "No Bills to Delete",
                description: "There are no eligible draft or unapproved bills in this scope.",
                variant: "destructive",
            });
            return;
        }

        if (andRebill) {
            setIsRebilling(true);
        } else {
            setIsDeleting(true);
        }

        try {
            const res = await bulkDeleteBillsForPeriodAndBranchAction({
                monthYear,
                branchId: selectedBranch === "all" ? undefined : selectedBranch,
                excludePaid,
            });

            if (res.error) {
                toast({
                    title: "Deletion Failed",
                    description: res.error.message || "Failed to bulk delete bills.",
                    variant: "destructive",
                });
                return;
            }

            const data = res.data;
            toast({
                title: "Batch Reset Successful",
                description: `Deleted ${data.deletedCount} bills. Customer balances and meter readings restored.`,
            });

            onOpenChange(false);
            if (onSuccess) onSuccess();

            if (andRebill && onTriggerRebill) {
                onTriggerRebill({
                    monthYear,
                    branchId: selectedBranch === "all" ? undefined : selectedBranch,
                });
            }
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsRebilling(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-destructive">
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-950/50">
                            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Bulk Delete / Reset Bills
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 pt-1">
                        Permanently reset or delete all bills for a specific period and branch. This reconciles customer balances and restores meter readings to allow a clean rebill.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Period & Branch Selectors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="period" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Billing Period
                            </Label>
                            <Input
                                id="period"
                                type="month"
                                value={monthYear}
                                onChange={(e) => setMonthYear(e.target.value)}
                                className="h-9 font-medium"
                                disabled={isDeleting || isRebilling}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="branch" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Branch
                            </Label>
                            <Select
                                value={selectedBranch}
                                onValueChange={setSelectedBranch}
                                disabled={isDeleting || isRebilling}
                            >
                                <SelectTrigger id="branch" className="h-9">
                                    <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Accessible Branches</SelectItem>
                                    {branches.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Live Preview Card */}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <span>Batch Scope Impact</span>
                            {isLoadingPreview && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
                        </div>

                        {preview ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="text-xs text-muted-foreground">Total In Scope</div>
                                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                            {preview.total_count}
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-red-100 dark:border-red-950 shadow-sm">
                                        <div className="text-xs text-red-600 dark:text-red-400 font-medium">To Be Deleted</div>
                                        <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">
                                            {preview.eligible_delete_count}
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-green-100 dark:border-green-950 shadow-sm">
                                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">Paid (Protected)</div>
                                        <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-0.5">
                                            {preview.paid_count}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-700">
                                    <span>Draft: <b>{preview.draft_count}</b> | Pending: <b>{preview.pending_count}</b></span>
                                    <span>Unpaid Balance Reversed: <b className="text-red-600">ETB {preview.unpaid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                                {isLoadingPreview ? "Calculating eligible bills..." : "No bills found for the selected scope."}
                            </div>
                        )}
                    </div>

                    {/* Safety Options & Warnings */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 rounded-lg">
                            <Checkbox
                                id="excludePaid"
                                checked={excludePaid}
                                onCheckedChange={(val) => setExcludePaid(val as boolean)}
                            />
                            <Label htmlFor="excludePaid" className="text-xs text-amber-900 dark:text-amber-200 font-medium leading-normal cursor-pointer">
                                Preserve paid & settled bills (recommended). Only delete Draft, Pending, and Unpaid bills.
                            </Label>
                        </div>

                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                            <div>
                                <span className="font-semibold">Automatic Integrity Rollback:</span> Deleting these bills will decrement each meter&apos;s outstanding balance and restore their previous meter readings so they can be accurately re-billed.
                            </div>
                        </div>
                    </div>

                    {/* Confirmation Input Gate */}
                    <div className="space-y-2 pt-2 border-t">
                        <Label htmlFor="confirmWord" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Type <span className="text-red-600 font-mono font-bold">DELETE</span> to confirm:
                        </Label>
                        <Input
                            id="confirmWord"
                            placeholder="Type DELETE"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="h-9 font-mono"
                            disabled={isDeleting || isRebilling}
                        />
                    </div>
                </div>

                <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting || isRebilling}
                    >
                        Cancel
                    </Button>

                    <div className="flex items-center gap-2">
                        {onTriggerRebill && (
                            <Button
                                type="button"
                                variant="outline"
                                className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5"
                                disabled={!isConfirmed || isDeleting || isRebilling || !preview || preview.eligible_delete_count === 0}
                                onClick={() => handleDelete(true)}
                            >
                                {isRebilling ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Resetting & Rebilling...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4" />
                                        Delete & Rebill Now
                                    </>
                                )}
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="destructive"
                            className="gap-1.5"
                            disabled={!isConfirmed || isDeleting || isRebilling || !preview || preview.eligible_delete_count === 0}
                            onClick={() => handleDelete(false)}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    Delete {preview?.eligible_delete_count || 0} Bills
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
