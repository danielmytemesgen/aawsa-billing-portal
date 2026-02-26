'use client';

import * as React from "react";
import { CheckCircle, RefreshCcw, Search, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { getAllBulkMetersAction, runBillingCycleAction } from "@/lib/actions";
import { format } from "date-fns";

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

    React.useEffect(() => {
        if (open) {
            loadMeters();
        }
    }, [open]);

    async function loadMeters() {
        setIsLoadingMeters(true);
        const res = await getAllBulkMetersAction();
        if (res.data) {
            setBulkMeters(res.data);
        }
        setIsLoadingMeters(false);
    }

    const filteredMeters = bulkMeters.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.customerKeyNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRunCycle = async (carryBalance: boolean) => {
        if (!isBulk && !selectedMeterId) {
            toast({ variant: "destructive", title: "Error", description: "Please select a meter." });
            return;
        }

        setIsProcessing(true);
        try {
            if (isBulk) {
                let successCount = 0;
                let failCount = 0;

                for (const meter of bulkMeters) {
                    const res = await runBillingCycleAction({
                        bulkMeterId: meter.customerKeyNumber,
                        carryBalance,
                        monthYear
                    });
                    if (res.data?.success) successCount++; else failCount++;
                }

                toast({
                    title: "Bulk Cycle Complete",
                    description: `Processed ${successCount} meters successfully. ${failCount} failed.`
                });
            } else {
                const res = await runBillingCycleAction({
                    bulkMeterId: selectedMeterId,
                    carryBalance,
                    monthYear
                });

                if (res.data?.success) {
                    toast({ title: "Cycle Closed", description: "Billing cycle for selected meter closed successfully." });
                } else {
                    toast({ variant: "destructive", title: "Action Failed", description: res.error?.message || "Unknown error" });
                }
            }

            onComplete?.();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Run Billing Cycle</DialogTitle>
                    <DialogDescription>
                        Close the current billing cycle and generate draft bills for bulk meters.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
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
                                            <SelectItem key={m.customerKeyNumber} value={m.customerKeyNumber}>
                                                {m.name} ({m.customerKeyNumber})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Billing Month</Label>
                        <Input
                            type="month"
                            value={monthYear}
                            onChange={(e) => setMonthYear(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
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
