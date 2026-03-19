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
import { Plus, Trash2, ShieldAlert, CalendarClock, Activity } from "lucide-react";

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
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-slate-950">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-orange-600" />
                
                <DialogHeader className="px-10 pt-10 pb-6 relative z-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-5 mb-2 relative z-10">
                        <div className="h-14 w-14 rounded-[1.25rem] bg-rose-950 flex items-center justify-center text-rose-500 shadow-sm border border-rose-900">
                            <ShieldAlert className="h-7 w-7" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-white leading-tight">Penalty Policy Engine</DialogTitle>
                            <DialogDescription className="font-bold text-slate-400 mt-1">
                                Configure when penalties start and the applicable interest rates.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onFormSubmit)} className="px-10 pb-10 space-y-8 relative z-10">
                        <div className="grid grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                            <FormField
                                control={form.control}
                                name="penalty_month_threshold"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-400">Penalty Starts (Month)</FormLabel>
                                            <CalendarClock className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <FormControl>
                                            <div className="relative group">
                                                <Input 
                                                    type="number" 
                                                    className="h-14 bg-slate-800 border border-slate-700/50 rounded-2xl font-black text-white focus:ring-4 focus:ring-rose-500/20 px-5 text-lg"
                                                    {...field} 
                                                    onChange={e => field.onChange(parseInt(e.target.value))} 
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-tighter bg-slate-900/50 px-2 py-1 rounded-md">
                                                    Months
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-xs uppercase font-black px-1" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bank_lending_rate"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-400">Bank Interest Rate (%)</FormLabel>
                                            <Activity className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <FormControl>
                                            <div className="relative group">
                                                <Input 
                                                    type="number" 
                                                    className="h-14 bg-slate-800 border border-slate-700/50 rounded-2xl font-black text-white focus:ring-4 focus:ring-rose-500/20 px-5 tabular-nums text-xl"
                                                    {...field} 
                                                    onChange={e => field.onChange(parseFloat(e.target.value))} 
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-rose-500 bg-rose-950/80 px-3 py-1 rounded-lg border border-rose-900/50 shadow-lg">
                                                    %
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-xs uppercase font-black px-1" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <FormLabel className="text-sm font-black uppercase tracking-widest text-slate-200">Tiered Penalty Triggers</FormLabel>
                                {canUpdate && (
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddTier} className="h-8 rounded-xl bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold">
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-3 p-4 rounded-3xl bg-slate-900/50 border border-slate-800 max-h-[220px] overflow-y-auto">
                                {tiers.map((tier, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <div className="flex-1 flex items-center bg-slate-800/80 border border-slate-700/50 rounded-xl px-5 h-14 focus-within:ring-2 focus-within:ring-rose-500/50 transition-all">
                                            <span className="text-xs font-black uppercase text-slate-500 mr-2 tracking-widest">Month +</span>
                                            <Input
                                                type="number"
                                                value={tier.month}
                                                className="h-9 border-none focus-visible:ring-0 px-1 w-full bg-transparent text-white font-black text-lg"
                                                onChange={e => {
                                                    const newTiers = [...tiers];
                                                    newTiers[index].month = parseInt(e.target.value) || 0;
                                                    setTiers(newTiers);
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 flex items-center bg-slate-800/80 border border-slate-700/50 rounded-xl px-5 h-14 focus-within:ring-2 focus-within:ring-rose-500/50 transition-all">
                                            <span className="text-xs font-black uppercase text-slate-500 mr-2 tracking-widest">Rate</span>
                                            <Input
                                                type="number"
                                                value={tier.rate}
                                                className="h-9 border-none focus-visible:ring-0 px-1 w-full bg-transparent text-white font-black tabular-nums text-right text-lg"
                                                onChange={e => {
                                                    const newTiers = [...tiers];
                                                    newTiers[index].rate = parseFloat(e.target.value) || 0;
                                                    setTiers(newTiers);
                                                }}
                                            />
                                            <span className="text-sm font-black text-rose-500 ml-2">%</span>
                                        </div>
                                        {canUpdate && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-12 w-12 rounded-xl text-rose-500 bg-rose-950/50 hover:bg-rose-900 hover:text-rose-100 transition-colors flex-shrink-0"
                                                onClick={() => handleRemoveTier(index)}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <FormDescription className="text-[11px] font-bold text-slate-500 px-2 leading-relaxed">
                                Cumulative penalty magnitude is aggregated intrinsically.
                            </FormDescription>
                        </div>

                        <DialogFooter className="gap-3 sm:gap-0 mt-4 pt-4 border-t border-slate-800/50">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-14 rounded-2xl bg-transparent border-slate-700 font-bold hover:bg-slate-800 hover:text-white px-10 text-slate-400 transition-all">
                                Abort
                            </Button>
                            {canUpdate && (
                                <Button type="submit" className="h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 font-bold px-12 shadow-xl shadow-rose-900/20 text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0">
                                    save change
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
