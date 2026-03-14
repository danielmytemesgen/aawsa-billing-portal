
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import * as z from "zod";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";

// Base schema for form fields, we will add a refinement check dynamically.
const formSchemaBase = z.object({
  meterType: z.enum(['individual_customer_meter', 'bulk_meter'], {
    required_error: "Please select a meter type.",
  }),
  entityId: z.string().min(1, "Please select a meter."), // This will now hold the customerKeyNumber
  reading: z.coerce.number().min(0, "Reading must be a non-negative number."),
  date: z.date({
    required_error: "A date is required.",
  }),
});

export type AddMeterReadingFormValues = z.infer<typeof formSchemaBase>;

interface AddMeterReadingFormProps {
  onSubmit: (values: AddMeterReadingFormValues) => void;
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  isLoading?: boolean;
}

export function AddMeterReadingForm({ onSubmit, customers, bulkMeters, isLoading }: AddMeterReadingFormProps) {
  // The final schema is built dynamically inside the component to include a refinement check.
  const formSchema = React.useMemo(() => {
    return formSchemaBase.refine(
      (data) => {
        let lastReading = -1; // Use -1 to indicate not found, as 0 is a valid reading.
        if (data.meterType === 'individual_customer_meter') {
          const customer = customers.find(c => c.customerKeyNumber === data.entityId);
          if (customer) lastReading = customer.currentReading;
        } else if (data.meterType === 'bulk_meter') {
          const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === data.entityId);
          if (bulkMeter) lastReading = bulkMeter.currentReading;
        }
        if (lastReading === -1) return true;
        return data.reading >= lastReading;
      },
      (data) => {
        let lastReading = 0;
        if (data.meterType === 'individual_customer_meter') {
          lastReading = customers.find(c => c.customerKeyNumber === data.entityId)?.currentReading ?? 0;
        } else {
          lastReading = bulkMeters.find(bm => bm.customerKeyNumber === data.entityId)?.currentReading ?? 0;
        }
        return {
           message: `Reading cannot be lower than the last reading (${lastReading.toFixed(2)}).`,
           path: ["reading"],
        }
      }
    );
  }, [customers, bulkMeters]);

  const form = useForm<AddMeterReadingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meterType: 'individual_customer_meter', // Default to individual
      entityId: "",
      reading: 0,
      date: new Date(),
    }
  });

  const selectedMeterType = form.watch("meterType");
  const selectedEntityId = form.watch("entityId");

  const availableMeters = React.useMemo(() => {
    if (selectedMeterType === 'individual_customer_meter') {
      return customers.map(c => ({
        value: c.customerKeyNumber,
        label: `${c.name} (Meter: ${c.meterNumber})`,
      }));
    }
    if (selectedMeterType === 'bulk_meter') {
      return bulkMeters.map(bm => ({
        value: bm.customerKeyNumber,
        label: `${bm.name} (Meter: ${bm.meterNumber})`,
      }));
    }
    return [];
  }, [selectedMeterType, customers, bulkMeters]);

  function handleSubmit(values: AddMeterReadingFormValues) {
    onSubmit(values);
  }

  React.useEffect(() => {
    if (form.getFieldState('reading').isTouched) {
      form.trigger('reading');
    }
  }, [selectedEntityId, form]);

  const handleTabChange = (value: string) => {
    form.setValue('meterType', value as AddMeterReadingFormValues['meterType']);
    form.resetField('entityId');
    form.resetField('reading');
    form.clearErrors();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs 
          defaultValue="individual_customer_meter" 
          onValueChange={handleTabChange} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual_customer_meter">Individual Customer</TabsTrigger>
            <TabsTrigger value="bulk_meter">Bulk Meter</TabsTrigger>
          </TabsList>
        </Tabs>

        <FormField
          control={form.control}
          name="entityId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Meter</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoading || availableMeters.length === 0}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={availableMeters.length === 0 ? "No meters available for type" : "Select a meter"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableMeters.map((meter) => (
                    (meter.value !== undefined && String(meter.value).trim() !== "") ? (
                      <SelectItem key={String(meter.value)} value={String(meter.value)}>
                        {meter.label}
                      </SelectItem>
                    ) : null
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="reading"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reading Value</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter reading value"
                  {...field}
                  disabled={isLoading || !selectedEntityId}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date of Reading</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoading}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2000-01-01") 
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading || !form.formState.isValid}>
          {isLoading ? "Submitting..." : "Add Reading"}
        </Button>
      </form>
    </Form>
  );
}
