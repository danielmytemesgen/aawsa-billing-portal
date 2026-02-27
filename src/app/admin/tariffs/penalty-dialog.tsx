"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

const penaltySchema = z.object({
    penalty_month_threshold: z.number().min(1).max(24),
    bank_lending_rate: z.number().min(0).max(100),
    penalty_tiered_rates: z.array(z.object({
        month: z.number().min(1),
        rate: z.number().min(0).max(100),
    })).min(1),
});

type PenaltyFormValues = z.infer<typeof penaltySchema>;

interface PenaltyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: {
        penalty_month_threshold: number;
        bank_lending_rate: number;
        penalty_tiered_rates: { month: number; rate: number }[];
    }) => void;
    defaultValues: {
        penalty_month_threshold: number;
        bank_lending_rate: number;
        penalty_tiered_rates: { month: number; rate: number }[];
    };
    canUpdate: boolean;
}

export function PenaltyDialog({
    open,
    onOpenChange,
    onSubmit,
    defaultValues,
    canUpdate,
}: PenaltyDialogProps) {
    const form = useForm<PenaltyFormValues>({
        resolver: zodResolver(penaltySchema),
        defaultValues: {
            ...defaultValues,
            bank_lending_rate: defaultValues.bank_lending_rate * 100,
            penalty_tiered_rates: defaultValues.penalty_tiered_rates.map(t => ({
                ...t,
                rate: t.rate * 100
            }))
        },
    });

    const [tiers, setTiers] = React.useState(defaultValues.penalty_tiered_rates.map(t => ({ ...t, rate: t.rate * 100 })));

    const handleAddTier = () => {
        const lastMonth = tiers.length > 0 ? tiers[tiers.length - 1].month : 2;
        setTiers([...tiers, { month: lastMonth + 1, rate: 0 }]);
    };

    const handleRemoveTier = (index: number) => {
        setTiers(tiers.filter((_, i) => i !== index));
    };

    const onFormSubmit = (values: PenaltyFormValues) => {
        onSubmit({
            penalty_month_threshold: values.penalty_month_threshold,
            bank_lending_rate: values.bank_lending_rate / 100,
            penalty_tiered_rates: tiers.map(t => ({
                month: t.month,
                rate: t.rate / 100
            })).sort((a, b) => a.month - b.month)
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Penalty Configuration</DialogTitle>
                    <DialogDescription>
                        Configure when penalties start and the applicable interest rates.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="penalty_month_threshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Penalty Starts (Month)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bank_lending_rate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bank Interest Rate (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <FormLabel>Tiered Penalty Rates</FormLabel>
                                {canUpdate && (
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddTier}>
                                        <Plus className="h-4 w-4 mr-1" /> Add Tier
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-2 border rounded-md p-3 max-h-[200px] overflow-y-auto bg-muted/20">
                                {tiers.map((tier, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center bg-background border rounded px-2">
                                            <span className="text-[10px] text-muted-foreground mr-1">Month</span>
                                            <Input
                                                type="number"
                                                value={tier.month}
                                                className="h-8 border-none focus-visible:ring-0 px-1 w-10"
                                                onChange={e => {
                                                    const newTiers = [...tiers];
                                                    newTiers[index].month = parseInt(e.target.value) || 0;
                                                    setTiers(newTiers);
                                                }}
                                            />
                                            <span className="text-[10px] text-muted-foreground ml-1">+</span>
                                        </div>
                                        <div className="flex-1 flex items-center bg-background border rounded px-2">
                                            <Input
                                                type="number"
                                                value={tier.rate}
                                                className="h-8 border-none focus-visible:ring-0 px-1 text-right"
                                                onChange={e => {
                                                    const newTiers = [...tiers];
                                                    newTiers[index].rate = parseFloat(e.target.value) || 0;
                                                    setTiers(newTiers);
                                                }}
                                            />
                                            <span className="text-xs text-muted-foreground ml-1">%</span>
                                        </div>
                                        {canUpdate && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive"
                                                onClick={() => handleRemoveTier(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <FormDescription className="text-[11px]">
                                Penalty rate is added to the bank interest rate for the specified month.
                            </FormDescription>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            {canUpdate && <Button type="submit">Save Changes</Button>}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
