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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Branch, BranchStatus } from "./branch-types";

const branchStatuses = ['Active', 'Inactive'] as const;

const formSchema = z.object({
  name: z.string().min(2, { message: "Branch name must be at least 2 characters." }),
  location: z.string().min(5, { message: "Location must be at least 5 characters." }),
  contactPerson: z.string().min(2, { message: "Contact person name must be at least 2 characters." }).optional().or(z.literal('')),
  contactPhone: z.string().regex(/^$|^\+?[0-9\s-()]{7,20}$/, { message: "Invalid phone number format." }).optional().or(z.literal('')),
  status: z.enum(branchStatuses, { errorMap: () => ({ message: "Please select a valid status."}) }),
});

export type BranchFormValues = z.infer<typeof formSchema>; // Export the type

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BranchFormValues) => void;
  defaultValues?: Branch | null;
}

export function BranchFormDialog({ open, onOpenChange, onSubmit, defaultValues }: BranchFormDialogProps) {
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      contactPerson: "",
      contactPhone: "",
      status: undefined as any,
    },
  });

  React.useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        location: defaultValues.location,
        contactPerson: defaultValues.contactPerson || "",
        contactPhone: defaultValues.contactPhone || "",
        status: defaultValues.status,
      });
    } else {
      form.reset({
        name: "",
        location: "",
        contactPerson: "",
        contactPhone: "",
        status: undefined,
      });
    }
  }, [defaultValues, form, open]);

  const handleSubmit = (data: BranchFormValues) => {
    onSubmit(data);
    onOpenChange(false); 
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Branch" : "Add New Branch"}</DialogTitle>
          <DialogDescription>
            {defaultValues ? "Update the details of the branch." : "Fill in the details to add a new branch."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Kality Branch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Kality Sub-City, Woreda 05" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ato Kebede" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g., +251 91 123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branchStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">
                {defaultValues ? "Save Changes" : "Add Branch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

