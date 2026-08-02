
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
import { Textarea } from "@/components/ui/textarea";
import { Layers, Info } from "lucide-react";

const formSchema = z.object({
  description: z.string().min(3, "Description must be at least 3 characters."),
  // maxConsumption is string to handle "Infinity" or numeric values
  maxConsumption: z.string().refine(value => value === "Infinity" || !isNaN(parseFloat(value)) && parseFloat(value) >= 0, {
    message: "Max Consumption must be a non-negative number or 'Infinity'.",
  }),
  rate: z.string().refine(value => !isNaN(parseFloat(value)) && parseFloat(value) >= 0, {
    message: "Rate must be a non-negative number.",
  }),
});

export type TariffFormValues = z.infer<typeof formSchema>;

interface TariffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TariffFormValues) => void;
  defaultValues?: TariffFormValues | null;
  currency?: string;
  tierType: 'water' | 'sewerage' | null;
  canUpdate: boolean;
}

export function TariffFormDialog({ open, onOpenChange, onSubmit, defaultValues, currency = "ETB", tierType, canUpdate }: TariffFormDialogProps) {
  const form = useForm<TariffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      description: "",
      maxConsumption: "",
      rate: "",
    },
  });

  React.useEffect(() => {
    if (defaultValues) {
      form.reset(defaultValues);
    } else {
      form.reset({
        description: "",
        maxConsumption: "",
        rate: "",
      });
    }
  }, [defaultValues, form, open]);

  const handleSubmit = (data: TariffFormValues) => {
    onSubmit(data);
    onOpenChange(false); 
  };
  
  const dialogTitle = tierType === 'water' ? 'Water Tariff Tier' : 'Sewerage Tariff Tier';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-[2rem] bg-white">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        
        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
                {defaultValues ? `Update ${dialogTitle}` : `Create ${dialogTitle}`}
              </DialogTitle>
              <DialogDescription className="font-bold text-slate-400">
                {defaultValues ? "Modifying existing tariff spectrum values." : "Establishing new pricing tier parameters."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="px-8 pb-8 space-y-6">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-sm font-black uppercase tracking-widest text-slate-700 ml-1">Tier Specification</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Define the consumption scope (e.g., Residential Baseline 0-5 m³)" 
                        className="min-h-[100px] bg-slate-50 border-slate-200 rounded-2xl font-bold p-5 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none text-base text-slate-900"
                        {...field} 
                        disabled={!canUpdate}
                      />
                    </FormControl>
                    <FormMessage className="text-xs uppercase font-black px-1" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxConsumption"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-black uppercase tracking-widest text-slate-700 ml-1">Upper Limit (m³)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., 50 or Infinity" 
                          className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold px-5 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all text-lg text-slate-900"
                          {...field} 
                          disabled={!canUpdate}
                        />
                      </FormControl>
                      <FormMessage className="text-xs uppercase font-black px-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-black uppercase tracking-widest text-slate-700 ml-1">Unit Rate ({currency})</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-black px-5 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all tabular-nums text-xl text-slate-900"
                            {...field} 
                            disabled={!canUpdate}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                            /m³
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs uppercase font-black px-1" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 flex gap-4 border border-slate-200">
              <div className="h-8 w-8 mt-0.5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700">
                <Info className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold text-slate-600 leading-relaxed">
                For the highest tier in the sequence, enter <span className="text-indigo-700 font-black bg-indigo-50 px-1.5 py-0.5 rounded-md">&apos;Infinity&apos;</span> to capture all volume above previous thresholds.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12 rounded-2xl border-slate-200 font-bold hover:bg-slate-50 px-8">
                Dismiss
              </Button>
              {canUpdate && (
                <Button type="submit" className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold px-10 shadow-lg shadow-indigo-100">
                  {defaultValues ? "Apply Changes" : "Create Tier"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
