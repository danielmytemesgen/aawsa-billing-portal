
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AdditionalFee } from '@/lib/billing-calculations';
import { Percent, DollarSign, PlusCircle, Info } from 'lucide-react';

const formSchema = z.object({
    name: z.string().min(1, "Fee name is required"),
    value: z.number().min(0, "Value must be 0 or greater"),
    type: z.enum(['percentage', 'flat']),
});

interface AdditionalFeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: AdditionalFee) => void;
    initialData?: AdditionalFee;
    isEditing?: boolean;
}

export function AdditionalFeeDialog({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    isEditing = false
}: AdditionalFeeDialogProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            value: 0,
            type: 'percentage',
        },
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    value: initialData.type === 'percentage' ? initialData.value * 100 : initialData.value,
                    type: initialData.type,
                });
            } else {
                form.reset({
                    name: '',
                    value: 0,
                    type: 'percentage',
                });
            }
        }
    }, [open, initialData, form]);

    const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
        const finalData: AdditionalFee = {
            name: values.name,
            value: values.type === 'percentage' ? values.value / 100 : values.value,
            type: values.type,
        };
        onSubmit(finalData);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" />
                
                <DialogHeader className="px-10 pt-10 pb-6">
                    <div className="flex items-center gap-5 mb-2">
                        <div className="h-14 w-14 rounded-[1.25rem] bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                            {form.watch('type') === 'percentage' ? <Percent className="h-7 w-7" /> : <DollarSign className="h-7 w-7" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
                                {isEditing ? 'Modify Custom Fee' : 'New Custom Fee'}
                            </DialogTitle>
                            <DialogDescription className="font-bold text-slate-400 mt-1">
                                {isEditing ? 'Updating specific charge parameters.' : 'Injecting a new fiscal component into the billing cycle.'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="px-10 pb-10 space-y-8">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Fee Label</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="e.g. Infrastructure Surcharge" 
                                            className="h-16 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all px-6 text-lg"
                                            {...field} 
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs uppercase font-black px-1" />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="value"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Magnitude</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    className="h-16 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all px-6 tabular-nums text-xl"
                                                    {...field}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                                    {form.watch('type') === 'percentage' ? '%' : 'ETB'}
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-xs uppercase font-black px-1" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Nature</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-16 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all px-6 text-base">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-2xl border-slate-200 shadow-xl overflow-hidden">
                                                <SelectItem value="percentage" className="py-4 font-bold focus:bg-emerald-50 focus:text-emerald-700 text-base">Percentage Trigger</SelectItem>
                                                <SelectItem value="flat" className="py-4 font-bold focus:bg-emerald-50 focus:text-emerald-700 text-base">Flat Amount</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-xs uppercase font-black px-1" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 flex gap-5">
                            <Info className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-emerald-900 leading-relaxed">
                                {form.watch('type') === 'percentage' 
                                    ? "Proportional fees are calculated against the base consumption subtotal before tax." 
                                    : "Flat rates are applied as a universal constants for every individual billing instance."}
                            </p>
                        </div>

                        <DialogFooter className="gap-3 sm:gap-0 mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-14 rounded-2xl border-slate-200 font-bold hover:bg-slate-50 px-10 text-slate-600 transition-all">
                                Dismiss
                            </Button>
                            <Button type="submit" className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold px-12 shadow-xl shadow-emerald-100/50 text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0">
                                {isEditing ? 'Commit Changes' : 'Append Fee'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
