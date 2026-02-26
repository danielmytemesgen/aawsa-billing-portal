
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
  year: string; // Updated to string for consistency with effective_date
  canUpdate: boolean;
}

export function MeterRentDialog({ open, onOpenChange, onSubmit, defaultPrices, currency = "ETB", year, canUpdate }: MeterRentDialogProps) {
  // Defensive: ensure defaultPrices is an object and map legacy fraction keys to decimal keys
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

    // Map legacy keys (like '1/2') to standardized decimal keys (like '0.5')
    const mapped: { [key: string]: number } = {};

    // Fraction to Decimal map
    const fracMap: { [key: string]: string } = {
      '1/2': '0.5', '3/4': '0.75', '1 1/4': '1.25', '1 1/2': '1.5', '2 1/2': '2.5'
    };

    // Initialize with 0s for all options
    meterSizeOptions.forEach(opt => {
      mapped[opt.value] = 0;
    });

    // Overlay with existing data, mapping legacy keys if needed
    Object.entries(prices).forEach(([key, val]) => {
      const cleanKey = key.trim();
      const decimalKey = fracMap[cleanKey] || cleanKey;

      // Only keep if it's one of our valid options
      if (mapped[decimalKey] !== undefined) {
        mapped[decimalKey] = Number(val) || 0;
      }
    });

    return mapped;
  }, [defaultPrices]);

  // Schema now uses the known meterSizeOptions
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
    // Convert form data back to standardized decimal keys
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Meter Rent Prices ({year})</DialogTitle>
          <DialogDescription>
            Update the monthly rent price for each meter size for the selected tariff version.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <ScrollArea className="h-96 w-full pr-4">
              <div className="space-y-4 py-2">
                {meterSizeOptions.map(option => (
                  <FormField
                    key={option.value}
                    control={form.control}
                    name={`price_${option.value.replace(/\./g, '_')}`}
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-4">
                        <FormLabel className="w-1/2 flex-shrink-0">{`Rent for ${option.label} Meter`}</FormLabel>
                        <div className="flex w-1/2 items-center gap-2">
                          <FormControl>
                            <Input type="number" step="0.01" {...field} disabled={!canUpdate} />
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
