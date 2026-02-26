

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
import { baseIndividualCustomerDataSchema, meterSizeOptions, subCityOptions, woredaOptions } from "@/app/admin/data-entry/customer-data-entry-types";

import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { Branch } from "@/app/admin/branches/branch-types";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse, isValid } from "date-fns";
import { customerTypes, sewerageConnections, paymentStatuses } from "@/lib/billing-calculations";
import { individualCustomerStatuses } from "@/app/admin/individual-customers/individual-customer-types";
import type { StaffMember } from "@/app/admin/staff-management/staff-types";


interface StaffIndividualCustomerEntryFormProps {
  branchName: string;
}

const StaffEntryFormSchema = baseIndividualCustomerDataSchema; // Removed status and paymentStatus from staff form schema
type StaffEntryFormValues = z.infer<typeof StaffEntryFormSchema>;


const UNASSIGNED_BULK_METER_VALUE = "_SELECT_NONE_BULK_METER_";

export function StaffIndividualCustomerEntryForm({ branchName }: StaffIndividualCustomerEntryFormProps) {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<StaffMember | null>(null);
  const [availableBulkMeters, setAvailableBulkMeters] = React.useState<{ customerKeyNumber: string, name: string }[]>([]);
  const [isLoadingBulkMeters, setIsLoadingBulkMeters] = React.useState(true);
  const [staffBranchId, setStaffBranchId] = React.useState<string | undefined>(undefined);

  const form = useForm<StaffEntryFormValues>({
    resolver: zodResolver(StaffEntryFormSchema),
    defaultValues: {
      assignedBulkMeterId: UNASSIGNED_BULK_METER_VALUE,
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
      branchId: staffBranchId,
      woreda: "",
      sewerageConnection: undefined,
    },
  });

  const assignedBulkMeterIdValue = form.watch("assignedBulkMeterId");
  const actualBulkMeterIsSelected = assignedBulkMeterIdValue !== UNASSIGNED_BULK_METER_VALUE && !!assignedBulkMeterIdValue;

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) setCurrentUser(JSON.parse(userJson));

    setIsLoadingBulkMeters(true);
    Promise.all([
      initializeBulkMeters(),
      initializeCustomers(),
      initializeAdminBranches()
    ]).then(() => {
      const allBranches = getBranches();
      const normalizedStaffBranchName = branchName.trim().toLowerCase();
      const staffBranch = allBranches.find(b => {
        const normalizedBranchName = b.name.trim().toLowerCase();
        return normalizedBranchName.includes(normalizedStaffBranchName) || normalizedStaffBranchName.includes(normalizedBranchName);
      });

      if (staffBranch) {
        setStaffBranchId(staffBranch.id);
        const branchFilteredBms = getBulkMeters().filter(bm => bm.branchId === staffBranch.id);
        setAvailableBulkMeters(branchFilteredBms.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })));
      }
      setIsLoadingBulkMeters(false);
    });

    const unsubscribeBMs = subscribeToBulkMeters((updatedBulkMeters) => {
      if (staffBranchId) {
        const branchFilteredBms = updatedBulkMeters.filter(bm => bm.branchId === staffBranchId);
        setAvailableBulkMeters(branchFilteredBms.map(bm => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name })));
      }
    });

    return () => {
      unsubscribeBMs();
    }
  }, [branchName, staffBranchId]);

  React.useEffect(() => {
    form.reset({ ...form.getValues(), subCity: "", branchId: staffBranchId });
  }, [staffBranchId, form]);

  async function onSubmit(data: StaffEntryFormValues) {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User information not found.' });
      return;
    }

    const submissionData = {
      ...data,
      assignedBulkMeterId: data.assignedBulkMeterId === UNASSIGNED_BULK_METER_VALUE ? undefined : data.assignedBulkMeterId,
      branchId: staffBranchId, // Ensure branchId is set from state
    };

    // Status will be set to 'Pending Approval' by addCustomerToStore
    const result = await addCustomerToStore(submissionData as Omit<IndividualCustomer, 'created_at' | 'updated_at' | 'calculatedBill' | 'arrears' | 'status' | 'paymentStatus'>, currentUser);
    if (result.success && result.data) {
      toast({
        title: "Data Entry Submitted for Approval",
        description: `Data for customer ${result.data.name} has been recorded and is now pending approval.`,
      });
      form.reset({
        assignedBulkMeterId: UNASSIGNED_BULK_METER_VALUE,
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
        branchId: staffBranchId,
        woreda: "",
        sewerageConnection: undefined,
      });
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

  const commonFieldDisabled = !actualBulkMeterIsSelected || form.formState.isSubmitting || isLoadingBulkMeters;
  const submitButtonDisabled = !actualBulkMeterIsSelected || form.formState.isSubmitting || isLoadingBulkMeters;


  return (
    <ScrollArea className="h-[calc(100vh-380px)]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <FormControl>
                <Input value={branchName} readOnly disabled className="bg-muted/50" />
              </FormControl>
            </FormItem>
            <FormField
              control={form.control}
              name="assignedBulkMeterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Bulk Meter *</FormLabel>
                  <Select
                    onValueChange={handleBulkMeterChange}
                    value={field.value || UNASSIGNED_BULK_METER_VALUE}
                    disabled={isLoadingBulkMeters || form.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingBulkMeters ? "Loading bulk meters..." : "Select a bulk meter"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_BULK_METER_VALUE}>None</SelectItem>
                      {availableBulkMeters.length === 0 && !isLoadingBulkMeters && (
                        <SelectItem value="no-bms-available-staff" disabled>
                          No bulk meters available in this branch
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
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="customerKeyNumber" render={({ field }) => (<FormItem><FormLabel>Cust. Key No. *</FormLabel><FormControl><Input {...field} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="contractNumber" render={({ field }) => (<FormItem><FormLabel>Contract No. *</FormLabel><FormControl><Input {...field} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />

            <FormField control={form.control} name="customerType" render={({ field }) => (<FormItem><FormLabel>Customer Type *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={commonFieldDisabled}><FormControl><SelectTrigger disabled={commonFieldDisabled}><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{customerTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="bookNumber" render={({ field }) => (<FormItem><FormLabel>Book No. *</FormLabel><FormControl><Input {...field} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ordinal" render={({ field }) => (<FormItem><FormLabel>Ordinal *</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />

            <FormField
              control={form.control}
              name="meterSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meter Size (inch) *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined} disabled={commonFieldDisabled}>
                    <FormControl>
                      <SelectTrigger disabled={commonFieldDisabled}>
                        <SelectValue placeholder="Select a size" />
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
            <FormField control={form.control} name="meterNumber" render={({ field }) => (<FormItem><FormLabel>Meter No. *</FormLabel><FormControl><Input {...field} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="previousReading" render={({ field }) => (<FormItem><FormLabel>Previous Reading *</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />

            <FormField control={form.control} name="currentReading" render={({ field }) => (<FormItem><FormLabel>Current Reading *</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="month" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Reading Month *</FormLabel><DatePicker date={field.value && isValid(parse(field.value, "yyyy-MM", new Date())) ? parse(field.value, "yyyy-MM", new Date()) : undefined} setDate={(date) => field.onChange(date ? format(date, "yyyy-MM") : "")} disabledTrigger={commonFieldDisabled} /><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="specificArea" render={({ field }) => (<FormItem><FormLabel>Specific Area *</FormLabel><FormControl><Input {...field} disabled={commonFieldDisabled} /></FormControl><FormMessage /></FormItem>)} />

            <FormField
              control={form.control}
              name="subCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-City *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={commonFieldDisabled}
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
                  <FormLabel>Woreda *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined} disabled={commonFieldDisabled}>
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

            <FormField control={form.control} name="sewerageConnection" render={({ field }) => (<FormItem><FormLabel>Sewerage Conn. *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={commonFieldDisabled}><FormControl><SelectTrigger disabled={commonFieldDisabled}><SelectValue placeholder="Select connection" /></SelectTrigger></FormControl><SelectContent>{sewerageConnections.map(conn => <SelectItem key={conn} value={conn}>{conn}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          </div>

          <Button type="submit" className="w-full md:w-auto" disabled={submitButtonDisabled}>
            {form.formState.isSubmitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        </form>
      </Form>
    </ScrollArea>
  );
}
