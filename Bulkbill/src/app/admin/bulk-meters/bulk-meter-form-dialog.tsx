
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
import { baseBulkMeterDataSchema, meterSizeOptions, subCityOptions, woredaOptions } from "@/app/admin/data-entry/customer-data-entry-types";
import type { BulkMeter } from "./bulk-meter-types";
import { bulkMeterStatuses } from "./bulk-meter-types";
import { paymentStatuses, customerTypes, sewerageConnections } from "@/lib/billing-calculations";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse, isValid } from "date-fns";
import { getBranches, subscribeToBranches, initializeBranches as initializeAdminBranches } from "@/lib/data-store";
import type { Branch } from "../branches/branch-types";

const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_BULK_METER_DIALOG_";

const bulkMeterFormObjectSchema = baseBulkMeterDataSchema.extend({
  status: z.enum(bulkMeterStatuses, { errorMap: () => ({ message: "Please select a valid status." }) }),
  paymentStatus: z.enum(paymentStatuses, { errorMap: () => ({ message: "Please select a valid payment status." }) }),
  branchId: z.string().optional(), // Add branchId to schema
});

const bulkMeterFormSchema = bulkMeterFormObjectSchema.refine(data => {
  if (data.currentReading === undefined || data.previousReading === undefined) return true;
  return data.currentReading >= data.previousReading;
}, {
  message: "Current Reading must be greater than or equal to Previous Reading.",
  path: ["currentReading"],
});


export type BulkMeterFormValues = z.infer<typeof bulkMeterFormSchema>;

interface BulkMeterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BulkMeterFormValues) => void;
  defaultValues?: BulkMeter | null;
  staffBranchName?: string; // New prop for staff users
}

export function BulkMeterFormDialog({ open, onOpenChange, onSubmit, defaultValues, staffBranchName }: BulkMeterFormDialogProps) {
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);

  React.useEffect(() => {
    setIsLoadingBranches(true);
    initializeAdminBranches().then(() => {
      setAvailableBranches(getBranches());
      setIsLoadingBranches(false);
    });
    const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
      setAvailableBranches(updatedBranches);
      setIsLoadingBranches(false);
    });
    return () => unsubscribeBranches();
  }, []);

  const form = useForm<BulkMeterFormValues>({
    resolver: zodResolver(bulkMeterFormSchema),
    defaultValues: {
      name: "",
      customerKeyNumber: "",
      contractNumber: "",
      meterSize: undefined,
      meterNumber: "",
      previousReading: undefined,
      currentReading: undefined,
      month: "",
      specificArea: "",
      subCity: "",
      woreda: "",
      phoneNumber: "",
      branchId: undefined,
      chargeGroup: "Non-domestic",
      sewerageConnection: "No",
      status: "Active",
      paymentStatus: "Unpaid",
      xCoordinate: undefined,
      yCoordinate: undefined,
    },
  });

  React.useEffect(() => {
    if (defaultValues) {
      form.reset({
        ...defaultValues,
        phoneNumber: (defaultValues as any).phoneNumber || "",
        meterSize: defaultValues.meterSize ?? undefined,
        previousReading: defaultValues.previousReading ?? undefined,
        currentReading: defaultValues.currentReading ?? undefined,
        branchId: defaultValues.branchId || undefined,
        chargeGroup: defaultValues.chargeGroup || "Non-domestic",
        sewerageConnection: defaultValues.sewerageConnection || "No",
        status: defaultValues.status || "Active",
        paymentStatus: defaultValues.paymentStatus || "Unpaid",
        xCoordinate: defaultValues.xCoordinate ?? undefined,
        yCoordinate: defaultValues.yCoordinate ?? undefined,
      });
    } else {
      form.reset({
        name: "",
        customerKeyNumber: "",
        contractNumber: "",
        meterSize: undefined,
        meterNumber: "",
        previousReading: undefined,
        currentReading: undefined,
        month: "",
        specificArea: "",
        subCity: staffBranchName || "", // Use staff branch name for subCity
        woreda: "",
        phoneNumber: "",
        branchId: undefined,
        chargeGroup: "Non-domestic",
        sewerageConnection: "No",
        status: "Active",
        paymentStatus: "Unpaid",
        xCoordinate: undefined,
        yCoordinate: undefined,
      });
    }
  }, [defaultValues, form, open, staffBranchName]);

  const handleSubmit = (data: BulkMeterFormValues) => {
    const submissionData = {
      ...data,
      branchId: data.branchId === BRANCH_UNASSIGNED_VALUE ? undefined : data.branchId,
    };
    onSubmit(submissionData);
    onOpenChange(false);
  };

  const handleBranchChange = (branchIdValue: string) => {
    const selectedBranch = availableBranches.find(b => b.id === branchIdValue);
    if (selectedBranch) {
      form.setValue("branchId", selectedBranch.id);
    } else if (branchIdValue === BRANCH_UNASSIGNED_VALUE) {
      form.setValue("branchId", undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Bulk Meter" : "Add New Bulk Meter"}</DialogTitle>
          <DialogDescription>
            {defaultValues ? "Update the details of the bulk meter." : "Fill in the details to add a new bulk meter."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staffBranchName ? (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <Input value={staffBranchName} readOnly disabled className="bg-muted/50" />
                  </FormControl>
                </FormItem>
              ) : (
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Branch</FormLabel>
                      <Select
                        onValueChange={(value) => handleBranchChange(value)}
                        value={field.value || BRANCH_UNASSIGNED_VALUE}
                        disabled={isLoadingBranches || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : "Select a branch"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={BRANCH_UNASSIGNED_VALUE}>None (Manual Location)</SelectItem>
                          {availableBranches.map((branch) => (
                            branch.id && String(branch.id).trim() !== "" ? (
                              <SelectItem key={String(branch.id)} value={String(branch.id)}>
                                {branch.name}
                              </SelectItem>
                            ) : null
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bulk Meter Name / Identifier <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerKeyNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Key Number <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Number <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meterSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meter Size (inch) <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ? String(field.value) : undefined}
                      value={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a meter size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {meterSizeOptions.map(option => (
                          option.value !== undefined && String(option.value).trim() !== "" ? (
                            <SelectItem key={String(option.value)} value={String(option.value)}>
                              {option.label}
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
                name="meterNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meter Number <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="previousReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Previous Reading <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Current Reading <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Initial Reading Month <span className="text-destructive">*</span></FormLabel>
                    <DatePicker
                      date={field.value && isValid(parse(field.value, 'yyyy-MM', new Date())) ? parse(field.value, 'yyyy-MM', new Date()) : undefined}
                      setDate={(selectedDate) => {
                        field.onChange(selectedDate ? format(selectedDate, "yyyy-MM") : "");
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specificArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specific Area <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-City <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Sub-City" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subCityOptions.map(option => (
                          option !== undefined && String(option).trim() !== "" ? (
                            <SelectItem key={String(option)} value={String(option)}>{option}</SelectItem>
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
                name="woreda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Woreda <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Woreda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {woredaOptions.map(option => (
                          option !== undefined && String(option).trim() !== "" ? (
                            <SelectItem key={String(option)} value={String(option)}>{option}</SelectItem>
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="xCoordinate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>X Coordinate (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="yCoordinate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Y Coordinate (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chargeGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charge Group <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value || 'Non-domestic'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select charge group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customerTypes.map((type) => (
                          type !== undefined && String(type).trim() !== "" ? (
                            <SelectItem key={String(type)} value={String(type)}>
                              {type}
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
                name="sewerageConnection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sewerage Connection <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value || 'No'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select connection status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sewerageConnections.map((type) => (
                          type !== undefined && String(type).trim() !== "" ? (
                            <SelectItem key={String(type)} value={String(type)}>
                              {type}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Active"} defaultValue={field.value || "Active"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bulkMeterStatuses.map(status => (
                          status !== undefined && String(status).trim() !== "" ? (
                            <SelectItem key={String(status)} value={String(status)}>{status}</SelectItem>
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
                name="paymentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Unpaid"} defaultValue={field.value || "Unpaid"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentStatuses.map(status => (
                          status !== undefined && String(status).trim() !== "" ? (
                            <SelectItem key={String(status)} value={String(status)}>{status}</SelectItem>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">
                {defaultValues ? "Save Changes" : "Add Bulk Meter"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
