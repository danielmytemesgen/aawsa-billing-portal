"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
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
import { generateBulkMeterKeys } from "@/lib/utils";
import { bulkMeterDataEntrySchema, type BulkMeterDataEntryFormValues, meterSizeOptions, subCityOptions, woredaOptions } from "@/app/(dashboard)/admin/data-entry/customer-data-entry-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addBulkMeter as addBulkMeterToStore, initializeBulkMeters, getBulkMeters, getBranches, initializeBranches, getRoutes, subscribeToRoutes, fetchRoutes } from "@/lib/data-store";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse } from "date-fns";
import { customerTypes, sewerageConnections } from "@/lib/billing-calculations";
import type { StaffMember } from "@/app/(dashboard)/admin/staff-management/staff-types";
import { Checkbox } from "@/components/ui/checkbox";
import { getAllFaultCodes } from "@/lib/fault-codes";
import { Sparkles, Activity, TrendingUp } from "lucide-react";

interface StaffBulkMeterEntryFormProps {
  branchName: string;
}

export function StaffBulkMeterEntryForm({ branchName }: StaffBulkMeterEntryFormProps) {
  const { toast } = useToast();
  const [staffBranchId, setStaffBranchId] = React.useState<string | undefined>(undefined);
  const [availableRoutes, setAvailableRoutes] = React.useState<any[]>([]);
  const [hasFault, setHasFault] = React.useState(false);

  const form = useForm<BulkMeterDataEntryFormValues>({
    resolver: zodResolver(bulkMeterDataEntrySchema),
    defaultValues: {
      name: "",
      customerKeyNumber: "",
      instKey: "",
      contractNumber: "",
      meterSize: 1,
      NUMBER_OF_DIALS: undefined,
      meterNumber: "",
      previousReading: undefined,
      currentReading: undefined,
      month: format(new Date(), "yyyy-MM"),
      specificArea: "",
      subCity: "",
      woreda: "",
      phoneNumber: "",
      chargeGroup: "Non-domestic",
      sewerageConnection: "No",
      routeKey: undefined,
      ordinal: undefined,
      xCoordinate: undefined,
      yCoordinate: undefined,
      zCoordinate: undefined,
    },
  });

  // Initialize staff branch, routes, and generate bulk meter keys for staff entry
  React.useEffect(() => {
    initializeBranches().then(() => {
      const allBranches = getBranches();
      const normalizedStaffBranchName = (branchName || "").trim().toLowerCase();
      const staffBranch = allBranches.find(b => {
        const normalizedBranchName = b.name.trim().toLowerCase();
        return normalizedBranchName === normalizedStaffBranchName || normalizedBranchName.includes(normalizedStaffBranchName) || normalizedStaffBranchName.includes(normalizedBranchName);
      });
      if (staffBranch) {
        setStaffBranchId(staffBranch.id);
        form.setValue("branchId", staffBranch.id);
      }
    });

    // Fetch and subscribe to routes
    fetchRoutes().then(() => setAvailableRoutes(getRoutes()));
    const unsubRoutes = subscribeToRoutes((r) => setAvailableRoutes(r));

    // Initialize bulk meters and generate unique keys
    initializeBulkMeters().then(() => {
      const existing = getBulkMeters();
      const { customerKey, instKey } = generateBulkMeterKeys(existing);
      form.setValue("customerKeyNumber", customerKey);
      form.setValue("instKey", instKey);
    });

    return () => unsubRoutes();
  }, [branchName, form]);

  const handleRegenerateKeys = () => {
    const existing = getBulkMeters();
    const { customerKey, instKey } = generateBulkMeterKeys(existing);
    form.setValue("customerKeyNumber", customerKey, { shouldValidate: true });
    form.setValue("instKey", instKey, { shouldValidate: true });
    toast({
      title: "New Keys Generated",
      description: `Assigned Key: ${customerKey}, INST_KEY: ${instKey}`,
    });
  };

  async function onSubmit(data: BulkMeterDataEntryFormValues) {
    const bulkMeterDataForStore = {
      ...data,
      branchId: staffBranchId,
      status: "Pending Approval" as const,
    };

    const result = await addBulkMeterToStore(bulkMeterDataForStore);

    if (result.success && result.data) {
      toast({
        title: "Bulk Meter Submitted for Approval",
        description: `Data for bulk meter "${result.data.name}" (Branch: ${branchName}) has been successfully recorded.`,
      });

      const existing = getBulkMeters();
      const { customerKey, instKey } = generateBulkMeterKeys(existing);

      form.reset({
        name: "",
        customerKeyNumber: customerKey,
        instKey: instKey,
        contractNumber: "",
        meterSize: 1,
        NUMBER_OF_DIALS: undefined,
        meterNumber: "",
        previousReading: undefined,
        currentReading: undefined,
        month: format(new Date(), "yyyy-MM"),
        specificArea: "",
        subCity: "",
        woreda: "",
        phoneNumber: "",
        branchId: staffBranchId,
        chargeGroup: "Non-domestic",
        sewerageConnection: "No",
        routeKey: undefined,
        ordinal: undefined,
        xCoordinate: undefined,
        yCoordinate: undefined,
        zCoordinate: undefined,
        faultCode: undefined,
      });
      setHasFault(false);
    } else {
      toast({
        variant: 'destructive',
        title: "Submission Failed",
        description: result.message || "An unexpected error occurred."
      });
    }
  }

  return (
    <ScrollArea className="h-[calc(100vh-380px)]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <FormControl>
                <Input value={branchName} readOnly disabled className="bg-muted/50" />
              </FormControl>
            </FormItem>
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

            <div className="md:col-span-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Auto-Generated Meter Keys</p>
                <p className="text-[11px] text-muted-foreground">Unique keys are automatically assigned. Click regenerate if needed.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerateKeys}
                disabled={form.formState.isSubmitting}
                className="text-xs gap-1.5 h-8"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Generate Fresh Keys
              </Button>
            </div>

            <FormField
              control={form.control}
              name="customerKeyNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Key Number <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-slate-50 dark:bg-slate-900 font-mono font-bold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>INST_KEY <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-slate-50 dark:bg-slate-900 font-mono font-bold" />
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
                    <Input {...field} placeholder="e.g., CNT-2024-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meterNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>METER_KEY / Meter Number <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., MET-2822965" {...field} />
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
                    onValueChange={(val) => field.onChange(parseFloat(val))}
                    value={field.value ? String(field.value) : "1"}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {meterSizeOptions.map((option) => (
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

            <FormField
              control={form.control}
              name="NUMBER_OF_DIALS"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Dials (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 5"
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => { const val = e.target.value; field.onChange(val === "" ? undefined : parseInt(val, 10)); }}
                    />
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
                      type="number" step="0.01" placeholder="e.g., 100.00" {...field}
                      value={field.value ?? ""}
                      onChange={e => { const val = e.target.value; field.onChange(val === "" ? undefined : parseFloat(val)); }}
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
                      type="number" step="0.01" placeholder="e.g., 150.00" {...field}
                      value={field.value ?? ""}
                      onChange={e => { const val = e.target.value; field.onChange(val === "" ? undefined : parseFloat(val)); }}
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
                  <FormLabel className="mb-2">Reading Month <span className="text-destructive">*</span></FormLabel>
                  <DatePicker
                    date={field.value ? parse(field.value, "yyyy-MM", new Date()) : undefined}
                    setDate={(selectedDate) => {
                      field.onChange(selectedDate ? format(selectedDate, "yyyy-MM") : "");
                    }}
                    disabledTrigger={form.formState.isSubmitting}
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
                    <Input placeholder="e.g., Bole Medhanealem" {...field} />
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
                        <SelectItem key={option} value={option}>
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
                        <SelectItem key={option} value={option}>
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
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., +251 91 123 4567" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value} defaultValue="Non-domestic">
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customerTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="routeKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Route Key</FormLabel>
                  <FormControl>
                    <div>
                      <Input
                        placeholder="Enter or select route (e.g., RT-01)"
                        {...field}
                        list="staff-bulk-routes-list"
                      />
                      <datalist id="staff-bulk-routes-list">
                        {availableRoutes.map((r: any) => (
                          <option key={r.routeKey || r.route_key} value={r.routeKey || r.route_key}>
                            {r.description ? `${r.routeKey || r.route_key} (${r.description})` : r.routeKey || r.route_key}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ordinal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordinal</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 1"
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
                    />
                  </FormControl>
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
                  <Select onValueChange={field.onChange} value={field.value} defaultValue="No">
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sewerageConnections.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
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
                  <FormLabel>Latitude / X (Northing, ~9.0°)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="any" placeholder="e.g., 9.005401" {...field}
                      value={field.value ?? ""}
                      onChange={e => { const val = e.target.value; field.onChange(val === "" ? undefined : parseFloat(val)); }}
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
                  <FormLabel>Longitude / Y (Easting, ~38.7°)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="any" placeholder="e.g., 38.763611" {...field}
                      value={field.value ?? ""}
                      onChange={e => { const val = e.target.value; field.onChange(val === "" ? undefined : parseFloat(val)); }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zCoordinate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Z Coordinate (Altitude)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="any" placeholder="e.g., 2300" {...field}
                      value={field.value ?? ""}
                      onChange={e => { const val = e.target.value; field.onChange(val === "" ? undefined : parseFloat(val)); }}
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
    </ScrollArea>
  );
}
