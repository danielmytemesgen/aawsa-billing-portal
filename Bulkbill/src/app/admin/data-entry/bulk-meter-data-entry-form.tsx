
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { bulkMeterDataEntrySchema, type BulkMeterDataEntryFormValues, meterSizeOptions, subCityOptions, woredaOptions } from "./customer-data-entry-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { addBulkMeter as addBulkMeterToStore, initializeBulkMeters, initializeCustomers, getBranches, subscribeToBranches, initializeBranches as initializeAdminBranches } from "@/lib/data-store";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse } from "date-fns";
import type { BulkMeter } from "../bulk-meters/bulk-meter-types";
import type { Branch } from "../branches/branch-types";
import { customerTypes, sewerageConnections } from "@/lib/billing-calculations";
import type { StaffMember } from "../staff-management/staff-types";


const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_BULK_METER_";

export function BulkMeterDataEntryForm() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }

    initializeCustomers();
    initializeBulkMeters();

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

  const form = useForm<BulkMeterDataEntryFormValues>({
    resolver: zodResolver(bulkMeterDataEntrySchema),
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
      xCoordinate: undefined,
      yCoordinate: undefined,
    },
  });

  async function onSubmit(data: BulkMeterDataEntryFormValues) {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User information not found.' });
      return;
    }

    const result = await addBulkMeterToStore(data, currentUser);

    if (result.success && result.data) {
      toast({
        title: "Data Entry Submitted",
        description: `Data for bulk meter ${result.data.name} has been successfully recorded and is pending approval.`,
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: result.message || "Could not record bulk meter data. Please check console for errors.",
      });
    }
  }

  const handleBranchChange = (branchIdValue: string) => {
    const selectedBranch = availableBranches.find(b => b.id === branchIdValue);
    if (selectedBranch) {
      form.setValue("branchId", selectedBranch.id);
    } else if (branchIdValue === BRANCH_UNASSIGNED_VALUE) {
      form.setValue("branchId", undefined);
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <Card className="shadow-lg w-full">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Branch</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || BRANCH_UNASSIGNED_VALUE}
                        disabled={isLoadingBranches || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : "Select a branch"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={BRANCH_UNASSIGNED_VALUE}>None</SelectItem>
                          {availableBranches.map((branch) => (
                            branch?.id ? (
                              <SelectItem key={branch.id} value={branch.id}>
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
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bulk Meter Name / Identifier <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter bulk meter name" {...field} />
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
                        <Input placeholder="Enter customer key number" {...field} />
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
                        <Input placeholder="Enter contract number" {...field} />
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
                        value={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a meter size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {meterSizeOptions.map(option => (
                            <SelectItem key={String(option.value)} value={String(option.value)}>
                              {option.label}
                            </SelectItem>
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
                        <Input placeholder="Enter meter number" {...field} />
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
                      <FormLabel>Previous Reading <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter previous reading"
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
                      <FormLabel>Current Reading <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter current reading"
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
                      <FormLabel>Reading Month <span className="text-destructive">*</span></FormLabel>
                      <DatePicker
                        date={field.value ? parse(field.value, "yyyy-MM", new Date()) : undefined}
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
                        <Input placeholder="Enter specific area" {...field} />
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
                            <SelectItem key={String(option)} value={String(option)}>
                              {option}
                            </SelectItem>
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
                            <SelectItem key={String(option)} value={String(option)}>
                              {option}
                            </SelectItem>
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
                        <Input placeholder="Enter phone number" {...field} />
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue="Non-domestic"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select charge group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customerTypes.map((type) => (
                            <SelectItem key={String(type)} value={String(type)}>
                              {type}
                            </SelectItem>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue="No"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select connection status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sewerageConnections.map((type) => (
                            <SelectItem key={String(type)} value={String(type)}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          placeholder="e.g., 9.005401"
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
                          placeholder="e.g., 38.763611"
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
              </div>

              <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Submitting..." : "Submit Bulk Meter for Approval"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </ScrollArea>
  );
}
