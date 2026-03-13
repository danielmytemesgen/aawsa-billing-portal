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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar, PlusCircle, Info } from "lucide-react";

const formSchema = z.object({
    effectiveDate: z.string().refine((dateString) => {
        if (!dateString) return false;
        const [year, month, day] = dateString.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate <= today;
    }, {
        message: "Effective date cannot be in the future.",
    }),
});

export type NewVersionFormValues = z.infer<typeof formSchema>;

interface NewVersionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: NewVersionFormValues) => void;
}

export function NewVersionDialog({ open, onOpenChange, onSubmit }: NewVersionDialogProps) {
    const form = useForm<NewVersionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            effectiveDate: new Date().toISOString().split('T')[0],
        },
    });

    React.useEffect(() => {
        if (open) {
            form.reset({
                effectiveDate: new Date().toISOString().split('T')[0],
            });
        }
    }, [open, form]);

    const handleSubmit = (data: NewVersionFormValues) => {
        onSubmit(data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
                
                <DialogHeader className="px-10 pt-10 pb-6">
                    <div className="flex items-center gap-5 mb-2">
                        <div className="h-14 w-14 rounded-[1.25rem] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                            <PlusCircle className="h-7 w-7" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">New Tariff Epoch</DialogTitle>
                            <DialogDescription className="font-bold text-slate-400 mt-1">
                                Initializing a fresh pricing version for the billing system.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="px-10 pb-10 space-y-8">
                        <FormField
                            control={form.control}
                            name="effectiveDate"
                            render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Effective Date</FormLabel>
                                        <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest italic">Compliance Required</span>
                                    </div>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all">
                                                <Calendar className="h-4 w-4" />
                                            </div>
                                            <Input 
                                                type="date" 
                                                max={new Date().toISOString().split('T')[0]} 
                                                className="h-16 pl-16 bg-slate-50 border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all cursor-pointer text-lg"
                                                {...field} 
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-xs uppercase font-black px-1" />
                                </FormItem>
                            )}
                        />

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex gap-5">
                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-amber-500 shadow-sm border border-slate-100">
                                <Info className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900 leading-none">Immutability Notice</p>
                                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                    Historical dates ensure audit integrity. Future-dated tariffs must be staged via administrative override.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="gap-3 sm:gap-0 mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-14 rounded-2xl border-slate-200 font-bold hover:bg-slate-50 px-10 text-slate-600 transition-all">
                                Cancel
                            </Button>
                            <Button type="submit" className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold px-12 shadow-xl shadow-indigo-100/50 text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0">
                                Launch Version
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
