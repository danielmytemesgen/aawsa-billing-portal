"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// A generic meter type that covers both Individual and Bulk meters for props
interface GenericMeter {
  customerKeyNumber: string;
  name: string;
  currentReading: number;
}

interface AddReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (readingValue: number) => Promise<void>; // Make it async
  meter: GenericMeter;
}

export function AddReadingDialog({ open, onOpenChange, onSubmit, meter }: AddReadingDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const formSchema = React.useMemo(() => z.object({
    reading: z.coerce.number().min(meter.currentReading, {
      message: `Reading must be >= current reading of ${meter.currentReading.toFixed(2)}.`,
    }),
  }), [meter.currentReading]);

  const form = useForm<{ reading: number }>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reading: meter.currentReading,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ reading: meter.currentReading });
    }
  }, [open, meter.currentReading, form]);

  const handleSubmit = async (data: { reading: number }) => {
    setIsSubmitting(true);
    await onSubmit(data.reading);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Reading for {meter.name}</DialogTitle>
          <DialogDescription>
            Enter the new reading from the meter. It must be greater than or equal to the last reading.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reading"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Reading Value</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Reading"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
