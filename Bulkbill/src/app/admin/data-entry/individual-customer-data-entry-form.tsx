

"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { baseIndividualCustomerDataSchema, meterSizeOptions, subCityOptions, woredaOptions } from "./customer-data-entry-types";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  addCustomer as addCustomerToStore,
  getBulkMeters,
  subscribeToBulkMeters,
  initializeBulkMeters,
  initializeCustomers,
  getBranches,
  subscribeToBranches,
  initializeBranches as initializeAdminBranches
} from "@/lib/data-store";
import type { IndividualCustomer } from "../individual-customers/individual-customer-types";
import type { Branch } from "../branches/branch-types";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse, isValid } from "date-fns";
import { customerTypes, sewerageConnections, paymentStatuses } from "@/lib/billing-calculations";
import { individualCustomerStatuses } from "../individual-customers/individual-customer-types";
import type { StaffMember } from "../staff-management/staff-types";


const FormSchemaForAdminDataEntry = baseIndividualCustomerDataSchema.extend({
  status: z.enum(individualCustomerStatuses, { errorMap: () => ({ message: "Please select a valid status." }) }),
  paymentStatus: z.enum(paymentStatuses, { errorMap: () => ({ message: "Please select a valid payment status." }) }),
});
type AdminDataEntryFormValues = z.infer<typeof FormSchemaForAdminDataEntry>;


const UNASSIGNED_BULK_METER_VALUE = "_SELECT_NONE_BULK_METER_";
const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_INDIVIDUAL_";

export function IndividualCustomerDataEntryForm() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [availableBulkMeters, setAvailableBulkMeters] = React.useState<{ customerKeyNumber: string, name: string }[]>([]);
  const [isLoadingBulkMeters, setIsLoadingBulkMeters] = React.useState(true);
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);


  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }

    setIsLoadingBulkMeters(true);
    Promise.all([
      initializeBulkMeters(),
      initializeCustomers(),
      initializeAdminBranches()
    ]).then(() => {
      const fetchedBms = getBulkMeters().map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }));
      setAvailableBulkMeters(fetchedBms);
      setIsLoadingBulkMeters(false);

      setAvailableBranches(getBranches());
      setIsLoadingBranches(false);
    });

    const unsubscribeBMs = subscribeToBulkMeters((updatedBulkMeters) => {
      const newBms = updatedBulkMeters.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }));
      setAvailableBulkMeters(newBms);
      setIsLoadingBulkMeters(false);
    });
    const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
      setAvailableBranches(updatedBranches);
      setIsLoadingBranches(false);
    });
    return () => {
      unsubscribeBMs();
      unsubscribeBranches();
    }
  }, []);

  const form = useForm<AdminDataEntryFormValues>({
    resolver: zodResolver(FormSchemaForAdminDataEntry),
    defaultValues: {
      assignedBulkMeterId: UNASSIGNED_BULK_METER_VALUE,
      branchId: undefined, // Initialize branchId
      name: "",
      customerKeyNumber: "",
      contractNumber: "",
      customerType: undefined,
      bookNumber: "",
      ordinal: undefined,
      meterSize: undefined,
      meterNumber: "",
      previousReading: undefined,
      currentReading: undefined,
      month: "",
      specificArea: "",
      subCity: "",
      woreda: "",
      sewerageConnection: undefined,
      status: "Active",
      paymentStatus: "Unpaid",
    },
  });

  async function onSubmit(data: AdminDataEntryFormValues) {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User information not found.' });
      return;
    }
    const submissionData = {
      ...data,
      assignedBulkMeterId: data.assignedBulkMeterId === UNASSIGNED_BULK_METER_VALUE ? undefined : data.assignedBulkMeterId,
      branchId: data.branchId === BRANCH_UNASSIGNED_VALUE ? undefined : data.branchId,
    };

    const result = await addCustomerToStore(submissionData, currentUser);
    if (result.success && result.data) {
      toast({
        title: "Data Entry Submitted",
        description: `Data for individual customer ${result.data.name} has been successfully recorded.`,
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: result.message || "Could not record customer data. Please check console for errors.",
      });
    }
  }

  const handleBulkMeterChange = (value: string | undefined) => {
    form.setValue("assignedBulkMeterId", value);
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
    <ScrollArea className="h-[calc(100vh-280px)]">
      <Card className="shadow-lg w-full">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  name="assignedBulkMeterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Bulk Meter</FormLabel>
                      <Select
                        onValueChange={handleBulkMeterChange}
                        value={field.value}
                        disabled={isLoadingBulkMeters || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingBulkMeters ? "Loading..." : "None"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_BULK_METER_VALUE}>None</SelectItem>
                          {availableBulkMeters.length === 0 && !isLoadingBulkMeters && (
                            <SelectItem value="no-bms-available" disabled>
                              No bulk meters available
                            </SelectItem>
                          )}
                          {availableBulkMeters.map((bm) => (
                            <SelectItem key={bm.customerKeyNumber} value={bm.customerKeyNumber}>
                              {bm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="customerKeyNumber" render={({ field }) => (<FormItem><FormLabel>Cust. Key No. <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contractNumber" render={({ field }) => (<FormItem><FormLabel>Contract No. <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />

                <FormField control={form.control} name="customerType" render={({ field }) => (<FormItem><FormLabel>Customer Type <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{customerTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="bookNumber" render={({ field }) => (<FormItem><FormLabel>Book No. <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="ordinal" render={({ field }) => (<FormItem><FormLabel>Ordinal <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />

                <FormField
                  control={form.control}
                  name="meterSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meter Size (inch) <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger disabled={form.formState.isSubmitting}>
                            <SelectValue placeholder="Select a size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {meterSizeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="meterNumber" render={({ field }) => (<FormItem><FormLabel>Meter No. <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="previousReading" render={({ field }) => (<FormItem><FormLabel>Previous Reading <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />

                <FormField control={form.control} name="currentReading" render={({ field }) => (<FormItem><FormLabel>Current Reading <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="month" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Reading Month <span className="text-destructive">*</span></FormLabel><DatePicker date={field.value && isValid(parse(field.value, "yyyy-MM", new Date())) ? parse(field.value, "yyyy-MM", new Date()) : undefined} setDate={(date) => field.onChange(date ? format(date, "yyyy-MM") : "")} disabledTrigger={form.formState.isSubmitting} /><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="specificArea" render={({ field }) => (<FormItem><FormLabel>Specific Area <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={form.formState.isSubmitting} /></FormControl><FormMessage /></FormItem>)} />

                <FormField
                  control={form.control}
                  name="subCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-City <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={form.formState.isSubmitting}
                      >
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
                      <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
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

                <FormField control={form.control} name="sewerageConnection" render={({ field }) => (<FormItem><FormLabel>Sewerage Conn. <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select connection" /></SelectTrigger></FormControl><SelectContent>{sewerageConnections.map(conn => <SelectItem key={conn} value={conn}>{conn}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Customer Status <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{individualCustomerStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="paymentStatus" render={({ field }) => (<FormItem><FormLabel>Payment Status <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger></FormControl><SelectContent>{paymentStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>

              <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Submitting..." : "Submit Individual Customer Reading"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </ScrollArea>
  );
}
