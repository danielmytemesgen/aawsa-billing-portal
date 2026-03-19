
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { meterSizeOptions } from "@/app/(dashboard)/admin/data-entry/customer-data-entry-types";
import { DollarSign, Settings2, Info } from "lucide-react";

interface MeterRentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { [key: string]: number }) => void;
  defaultPrices: { [key: string]: number };
  currency?: string;
  year: string;
  canUpdate: boolean;
}

export function MeterRentDialog({ open, onOpenChange, onSubmit, defaultPrices, currency = "ETB", year, canUpdate }: MeterRentDialogProps) {
  const safeDefaultPrices = React.useMemo(() => {
    let prices: { [key: string]: number } = {};
    if (defaultPrices) {
      if (typeof defaultPrices === 'string') {
        try {
          const parsed = JSON.parse(defaultPrices);
          prices = (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (_) {
          prices = {};
        }
      } else {
        prices = defaultPrices;
      }
    }
    const mapped: { [key: string]: number } = {};
    const fracMap: { [key: string]: string } = {
      '1/2': '0.5', '3/4': '0.75', '1 1/4': '1.25', '1 1/2': '1.5', '2 1/2': '2.5'
    };
    meterSizeOptions.forEach(opt => { mapped[opt.value] = 0; });
    Object.entries(prices).forEach(([key, val]) => {
      const cleanKey = key.trim();
      const decimalKey = fracMap[cleanKey] || cleanKey;
      if (mapped[decimalKey] !== undefined) {
        mapped[decimalKey] = Number(val) || 0;
      }
    });
    return mapped;
  }, [defaultPrices]);

  const formSchema = React.useMemo(() => {
    const schemaObject = meterSizeOptions.reduce((acc, opt) => {
      acc[`price_${opt.value.replace(/\./g, '_')}`] = z.coerce.number().min(0, "Price must be non-negative.");
      return acc;
    }, {} as Record<string, z.ZodType<any, any>>);
    return z.object(schemaObject);
  }, []);

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: meterSizeOptions.reduce((acc, opt) => {
      acc[`price_${opt.value.replace(/\./g, '_')}`] = safeDefaultPrices[opt.value] || 0;
      return acc;
    }, {} as any),
  });

  React.useEffect(() => {
    if (open) {
      form.reset(meterSizeOptions.reduce((acc, opt) => {
        acc[`price_${opt.value.replace(/\./g, '_')}`] = safeDefaultPrices[opt.value] || 0;
        return acc;
      }, {} as any));
    }
  }, [safeDefaultPrices, form, open]);

  const handleSubmit = (data: FormValues) => {
    const newPrices = Object.entries(data).reduce((acc, [formKey, value]) => {
      const originalKey = formKey.replace('price_', '').replace(/_/g, '.');
      acc[originalKey] = value;
      return acc;
    }, {} as { [key: string]: number });
    onSubmit(newPrices);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-[2rem] bg-white">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-600" />
        
        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Settings2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">Meter Connection Matrix</DialogTitle>
              <DialogDescription className="font-bold text-slate-400">
                Calibrating standard monthly rental fees for version <span className="text-indigo-600 font-black">{year}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="px-8 flex items-center gap-4 py-4 bg-slate-50 border-y border-slate-200">
              <Info className="h-5 w-5 text-slate-500" />
              <p className="text-xs font-black uppercase text-slate-600 tracking-widest">All values should be entered in {currency} per month.</p>
            </div>

            <ScrollArea className="h-[400px] px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 py-4 pb-10">
                {meterSizeOptions.map(option => (
                  <FormField
                    key={option.value}
                    control={form.control}
                    name={`price_${option.value.replace(/\./g, '_')}`}
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500">Size: {option.label}</FormLabel>
                          {field.value > 0 && <span className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" />}
                        </div>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 bg-indigo-50 rounded-md flex items-center justify-center text-sm font-black text-indigo-700 border border-indigo-200 group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all">
                              <DollarSign className="h-4 w-4" />
                            </div>
                            <Input 
                              type="number" 
                              step="0.01" 
                              className="pl-14 h-14 bg-white border-slate-200 rounded-2xl font-black text-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all tabular-nums shadow-sm text-slate-900"
                              {...field} 
                              disabled={!canUpdate} 
                            />
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 group-focus-within:text-indigo-500 uppercase tracking-widest">
                              {currency}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs uppercase font-black px-1" />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="px-8 pb-8 pt-2 gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12 rounded-2xl border-slate-200 font-bold hover:bg-slate-50 px-8">
                Discard Updates
              </Button>
              {canUpdate && (
                <Button type="submit" className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold px-10 shadow-lg shadow-indigo-100">
                  Synchronize Matrix
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
