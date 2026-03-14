
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
import { meterSizeOptions } from "@/app/admin/data-entry/customer-data-entry-types";

// Create a dynamic schema based on the meter sizes
const createMeterRentSchema = (prices: { [key: string]: number }) => {
  const schemaObject = Object.keys(prices).reduce((acc, key) => {
    acc[`price_${key.replace(/\./g, '_')}`] = z.coerce.number().min(0, "Price must be non-negative.");
    return acc;
  }, {} as Record<string, z.ZodType<any, any>>);
  return z.object(schemaObject);
};


interface MeterRentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { [key: string]: number }) => void;
  defaultPrices: { [key: string]: number };
  currency?: string;
  year: number;
  canUpdate: boolean;
}

export function MeterRentDialog({ open, onOpenChange, onSubmit, defaultPrices, currency = "ETB", year, canUpdate }: MeterRentDialogProps) {
  // Defensive: ensure defaultPrices is an object (some callers pass DB raw string)
  const safeDefaultPrices = React.useMemo(() => {
    if (!defaultPrices) return {};
    if (typeof defaultPrices === 'string') {
      try {
        const parsed = JSON.parse(defaultPrices);
        return (parsed && typeof parsed === 'object') ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    return defaultPrices;
  }, [defaultPrices]);

  const formSchema = React.useMemo(() => createMeterRentSchema(safeDefaultPrices), [safeDefaultPrices]);
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: Object.entries(safeDefaultPrices).reduce((acc, [key, value]) => {
      acc[`price_${key.replace(/\./g, '_')}`] = value;
      return acc;
    }, {} as any),
  });

  React.useEffect(() => {
    // Reset form if default prices change (e.g., when a new year is selected)
    form.reset(Object.entries(safeDefaultPrices).reduce((acc, [key, value]) => {
      acc[`price_${key.replace(/\./g, '_')}`] = value;
      return acc;
    }, {} as any));
  }, [safeDefaultPrices, form, open]);

  const handleSubmit = (data: FormValues) => {
    // Convert form data back to the original price object format
    const newPrices = Object.entries(data).reduce((acc, [formKey, value]) => {
      const originalKey = formKey.replace('price_', '').replace(/_/g, '.');
      acc[originalKey] = value;
      return acc;
    }, {} as { [key: string]: number });
    onSubmit(newPrices);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Meter Rent Prices for {year}</DialogTitle>
          <DialogDescription>
            Update the monthly rent price for each meter size for the selected year.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
             <ScrollArea className="h-72 w-full pr-4">
                <div className="space-y-4">
                  {meterSizeOptions.map(option => (
                      <FormField
                          key={option.value}
                          control={form.control}
                          name={`price_${option.value.replace(/\./g, '_')}`}
                          render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                              <FormLabel className="w-1/2">{`Rent for ${option.label} Meter`}</FormLabel>
                              <div className="flex w-1/2 items-center gap-2">
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} disabled={!canUpdate}/>
                                </FormControl>
                                <span className="text-sm text-muted-foreground">{currency}</span>
                              </div>
                              <FormMessage className="col-span-2" />
                          </FormItem>
                          )}
                      />
                  ))}
                </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {canUpdate && <Button type="submit">Save Changes</Button>}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
