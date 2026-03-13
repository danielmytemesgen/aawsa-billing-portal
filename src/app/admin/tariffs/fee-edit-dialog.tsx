
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Edit3, Settings, Info } from "lucide-react";

const formSchema = z.object({
    value: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
        message: "Value must be a non-negative number.",
    }),
});

export type FeeFormValues = z.infer<typeof formSchema>;

interface FeeEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: number) => void;
    title: string;
    description: string;
    label: string;
    defaultValue: number;
    isPercentage: boolean;
    canUpdate: boolean;
}

export function FeeEditDialog({
    open,
    onOpenChange,
    onSubmit,
    title,
    description,
    label,
    defaultValue,
    isPercentage,
    canUpdate
}: FeeEditDialogProps) {

    const initialDisplayValue = isPercentage ? (defaultValue * 100).toString() : defaultValue.toString();

    const form = useForm<FeeFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            value: initialDisplayValue,
        },
    });

    React.useEffect(() => {
        if (open) {
            form.reset({
                value: initialDisplayValue,
            });
        }
    }, [defaultValue, initialDisplayValue, form, open]);

    const handleSubmit = (data: FeeFormValues) => {
        const numericValue = parseFloat(data.value);
        const finalValue = isPercentage ? numericValue / 100 : numericValue;
        onSubmit(finalValue);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
                
                <DialogHeader className="px-10 pt-10 pb-6">
                    <div className="flex items-center gap-5 mb-2">
                        <div className="h-14 w-14 rounded-[1.25rem] bg-slate-50 flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                            <Settings className="h-7 w-7" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">{title}</DialogTitle>
                            <DialogDescription className="font-bold text-slate-400 mt-1">
                                Calibrating specific fiscal multipliers.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="px-10 pb-10 space-y-8">
                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</FormLabel>
                                        <Edit3 className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <FormControl>
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                {...field}
                                                disabled={!canUpdate}
                                                className={`h-16 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all px-6 tabular-nums text-xl ${isPercentage ? "pr-14" : ""}`}
                                            />
                                            {isPercentage && (
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-base font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                                                    %
                                                </div>
                                            )}
                                        </div>
                                    </FormControl>
                                    <div className="flex items-start gap-3 px-1 mt-2">
                                        <Info className="h-4 w-4 text-slate-500 mt-0.5" />
                                        <FormDescription className="text-xs font-bold text-slate-500 leading-relaxed italic">
                                            {isPercentage
                                                ? "Enter the precise percentage value (e.g., 15 for a 15% surcharge)."
                                                : "Input the threshold baseline in cubic meters (m³)."}
                                        </FormDescription>
                                    </div>
                                    <FormMessage className="text-xs uppercase font-black px-1" />
                                </FormItem>
                            )}
                        />
                        
                        <DialogFooter className="gap-3 sm:gap-0 mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-14 rounded-2xl border-slate-200 font-bold hover:bg-slate-50 px-10 text-slate-600 transition-all">
                                Cancel
                            </Button>
                            {canUpdate && (
                                <Button type="submit" className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold px-12 shadow-xl shadow-indigo-100/50 text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0">
                                    Update Metric
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
