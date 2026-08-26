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
import { baseIndividualCustomerDataSchema, meterSizeOptions, subCityOptions, woredaOptions } from "@/app/(dashboard)/admin/data-entry/customer-data-entry-types";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  addCustomer as addCustomerToStore,
  getBulkMeters,
  subscribeToBulkMeters,
  initializeBulkMeters,
  initializeCustomers,
  getBranches,
  initializeBranches as initializeAdminBranches,
  getCustomers,
} from "@/lib/data-store";
import { generateCustomerKeys } from "@/lib/utils";
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse, isValid } from "date-fns";
import { customerTypes, sewerageConnections } from "@/lib/billing-calculations";
import { Checkbox } from "@/components/ui/checkbox";
import { getAllFaultCodes } from "@/lib/fault-codes";
import { subscribeToFaultCodes } from "@/lib/data-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  User,
  Hash,
  Book,
  Layers,
  Activity,
  MapPin,
  Droplets,
  Settings,
  Briefcase,
  Network,
  TrendingUp,
  CheckCircle2,
  Lock,
  Search,
  Check,
  ChevronsUpDown,
  Sparkles,
  Crosshair,
  Globe,
} from "lucide-react";

interface StaffIndividualCustomerEntryFormProps {
  branchName: string;
}

const StaffEntryFormSchema = baseIndividualCustomerDataSchema.extend({
  assignedBulkMeterId: z
    .string({ required_error: "Assigning to a Bulk Meter is mandatory." })
    .min(1, { message: "Assigning to a Bulk Meter is mandatory." })
    .refine((val) => val !== "_SELECT_NONE_BULK_METER_", {
      message: "Assigning to a Bulk Meter is mandatory.",
    }),
});
type StaffEntryFormValues = z.infer<typeof StaffEntryFormSchema>;

const UNASSIGNED_BULK_METER_VALUE = "_SELECT_NONE_BULK_METER_";

const REQUIRED_FIELDS: (keyof StaffEntryFormValues)[] = [
  "assignedBulkMeterId",
  "name",
  "customerKeyNumber",
  "instKey",
  "contractNumber",
  "customerType",
  "bookNumber",
  "ordinal",
  "meterSize",
  "meterNumber",
  "previousReading",
  "currentReading",
  "month",
  "specificArea",
  "subCity",
  "woreda",
  "sewerageConnection",
];

export function StaffIndividualCustomerEntryForm({ branchName }: StaffIndividualCustomerEntryFormProps) {
  const { toast } = useToast();
  const [availableBulkMeters, setAvailableBulkMeters] = React.useState<{ customerKeyNumber: string; name: string; specificArea?: string }[]>([]);
  const [isLoadingBulkMeters, setIsLoadingBulkMeters] = React.useState(true);
  const [staffBranchId, setStaffBranchId] = React.useState<string | undefined>(undefined);
  const [hasFault, setHasFault] = React.useState(false);
  const [faultCodesList, setFaultCodesList] = React.useState(getAllFaultCodes());
  const [bulkMeterComboboxOpen, setBulkMeterComboboxOpen] = React.useState(false);
  const [keepBulkMeterAfterSubmit, setKeepBulkMeterAfterSubmit] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = subscribeToFaultCodes(() => {
      setFaultCodesList(getAllFaultCodes());
    });
    return () => unsubscribe();
  }, []);

  const form = useForm<StaffEntryFormValues>({
    resolver: zodResolver(StaffEntryFormSchema),
    defaultValues: {
      assignedBulkMeterId: "",
      name: "",
      customerKeyNumber: "",
      instKey: "",
      contractNumber: "",
      customerType: "Domestic",
      bookNumber: "",
      ordinal: undefined,
      meterSize: 0.5,
      NUMBER_OF_DIALS: undefined,
      meterNumber: "",
      previousReading: undefined,
      currentReading: undefined,
      month: format(new Date(), "yyyy-MM"),
      specificArea: "",
      subCity: "",
      branchId: staffBranchId,
      woreda: "",
      sewerageConnection: "No",
      faultCode: undefined,
      xCoordinate: undefined,
      yCoordinate: undefined,
      zCoordinate: undefined,
    },
  });

  const watchedValues = form.watch();
  const prevReading = watchedValues.previousReading;
  const currReading = watchedValues.currentReading;
  const assignedBulkMeterIdValue = watchedValues.assignedBulkMeterId;
  const xValue = watchedValues.xCoordinate;
  const yValue = watchedValues.yCoordinate;
  const hasCoordinates = !!(xValue && yValue);

  const isBulkMeterSelected =
    !!assignedBulkMeterIdValue &&
    assignedBulkMeterIdValue !== "" &&
    assignedBulkMeterIdValue !== UNASSIGNED_BULK_METER_VALUE;

  const selectedBmObj = availableBulkMeters.find(
    (b) => b.customerKeyNumber === assignedBulkMeterIdValue
  );

  const consumption =
    currReading !== undefined &&
    prevReading !== undefined &&
    !isNaN(currReading) &&
    !isNaN(prevReading)
      ? currReading - prevReading
      : null;

  const filledCount = REQUIRED_FIELDS.filter((field) => {
    const val = watchedValues[field];
    return val !== undefined && val !== "" && val !== null && val !== UNASSIGNED_BULK_METER_VALUE;
  }).length;
  const progressPct = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  // Initialize and filter bulk meters for staff member's branch
  React.useEffect(() => {
    setIsLoadingBulkMeters(true);
    Promise.all([
      initializeBulkMeters(),
      initializeCustomers(),
      initializeAdminBranches(),
    ]).then(() => {
      const allBranches = getBranches();
      const allBms = getBulkMeters();
      const normalizedStaffBranchName = (branchName || "").trim().toLowerCase();

      const staffBranch = allBranches.find((b) => {
        const normalizedBranchName = b.name.trim().toLowerCase();
        return (
          normalizedBranchName === normalizedStaffBranchName ||
          normalizedBranchName.includes(normalizedStaffBranchName) ||
          normalizedStaffBranchName.includes(normalizedBranchName)
        );
      });

      if (staffBranch) {
        setStaffBranchId(staffBranch.id);
        form.setValue("branchId", staffBranch.id);

        let filteredBms = allBms.filter(
          (bm) => bm.branchId === staffBranch.id
        );

        if (filteredBms.length === 0) {
          filteredBms = allBms;
        }

        setAvailableBulkMeters(
          filteredBms.map((bm) => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name, specificArea: bm.specificArea }))
        );
      } else {
        setAvailableBulkMeters(
          allBms.map((bm) => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name, specificArea: bm.specificArea }))
        );
      }
      setIsLoadingBulkMeters(false);
    });

    const unsubscribeBMs = subscribeToBulkMeters((updatedBulkMeters) => {
      if (staffBranchId) {
        let branchFilteredBms = updatedBulkMeters.filter((bm) => bm.branchId === staffBranchId);
        if (branchFilteredBms.length === 0) branchFilteredBms = updatedBulkMeters;
        setAvailableBulkMeters(
          branchFilteredBms.map((bm) => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name, specificArea: bm.specificArea }))
        );
      } else {
        setAvailableBulkMeters(
          updatedBulkMeters.map((bm) => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name, specificArea: bm.specificArea }))
        );
      }
    });

    return () => {
      unsubscribeBMs();
    };
  }, [branchName, form, staffBranchId]);

  const handleBulkMeterSelect = (keyNumber: string) => {
    form.setValue("assignedBulkMeterId", keyNumber, { shouldValidate: true });
    setBulkMeterComboboxOpen(false);
  };

  const handleAutoGenerateKeys = () => {
    const existing = getCustomers();
    const { customerKey, instKey } = generateCustomerKeys(existing);
    form.setValue("customerKeyNumber", customerKey, { shouldValidate: true });
    form.setValue("instKey", instKey, { shouldValidate: true });
    toast({
      title: "Keys Auto-Generated",
      description: `Assigned Key: ${customerKey}, INST_KEY: ${instKey}`,
    });
  };

  async function onSubmit(data: StaffEntryFormValues) {
    const submissionData = {
      ...data,
      assignedBulkMeterId:
        data.assignedBulkMeterId === UNASSIGNED_BULK_METER_VALUE ? undefined : data.assignedBulkMeterId,
      branchId: staffBranchId,
      status: "Pending Approval" as const,
    };

    const result = await addCustomerToStore(
      submissionData as Omit<
        IndividualCustomer,
        "created_at" | "updated_at" | "calculatedBill" | "arrears" | "status" | "paymentStatus"
      >
    );

    if (result.success && result.data) {
      toast({
        title: "Data Entry Submitted for Approval",
        description: `Customer "${result.data.name}" has been recorded and is pending approval.`,
      });

      const retainedBulkMeter = keepBulkMeterAfterSubmit ? data.assignedBulkMeterId : "";

      form.reset({
        assignedBulkMeterId: retainedBulkMeter,
        name: "",
        customerKeyNumber: "",
        instKey: "",
        contractNumber: "",
        customerType: "Domestic",
        bookNumber: "",
        ordinal: undefined,
        meterSize: 0.5,
        NUMBER_OF_DIALS: undefined,
        meterNumber: "",
        previousReading: undefined,
        currentReading: undefined,
        month: format(new Date(), "yyyy-MM"),
        specificArea: "",
        subCity: "",
        branchId: staffBranchId,
        woreda: "",
        sewerageConnection: "No",
        faultCode: undefined,
        xCoordinate: undefined,
        yCoordinate: undefined,
        zCoordinate: undefined,
      });
      setHasFault(false);
    } else {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: result.message || "Could not record customer data. Please check for errors.",
      });
    }
  }

  return (
    <ScrollArea className="h-[calc(100vh-320px)] pr-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">

          {/* ── Progress Indicator ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {progressPct === 100 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                )}
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Form Completion
                </span>
              </div>
              <span
                className={`text-xs font-bold tabular-nums ${
                  progressPct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                }`}
              >
                {filledCount} / {REQUIRED_FIELDS.length} required fields &nbsp;·&nbsp; {progressPct}%
              </span>
            </div>
            <Progress
              value={progressPct}
              className={`h-2 rounded-full transition-all duration-500 ${
                progressPct === 100 ? "[&>div]:bg-emerald-500" : ""
              }`}
            />
          </div>

          {/* ── Section: Assignment & Branch ───────────────────────────── */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Branch (Display only for Staff) */}
              <FormItem>
                <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Branch
                </FormLabel>
                <div className="premium-input-group">
                  <Network className="h-4 w-4 text-slate-500" />
                  <Input
                    value={branchName || "Staff Branch"}
                    readOnly
                    disabled
                    className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed font-semibold text-slate-700 dark:text-slate-200"
                  />
                </div>
              </FormItem>

              {/* Assign to Bulk Meter — Searchable Combobox */}
              <FormField
                control={form.control}
                name="assignedBulkMeterId"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Assign to Bulk Meter <span className="text-destructive">*</span>
                      </FormLabel>
                      {availableBulkMeters.length > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                          {availableBulkMeters.length} available
                        </span>
                      )}
                    </div>

                    <Popover open={bulkMeterComboboxOpen} onOpenChange={setBulkMeterComboboxOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={bulkMeterComboboxOpen}
                            disabled={isLoadingBulkMeters || form.formState.isSubmitting}
                            className={`w-full justify-between rounded-xl h-11 border transition-all ${
                              field.value
                                ? "border-primary/50 bg-primary/5 font-semibold text-primary"
                                : "border-slate-200 dark:border-slate-800 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Layers className="h-4 w-4 flex-shrink-0 text-primary" />
                              <span className="truncate">
                                {isLoadingBulkMeters
                                  ? "Loading bulk meters…"
                                  : selectedBmObj
                                  ? `${selectedBmObj.name} (${selectedBmObj.customerKeyNumber})`
                                  : "Search and select a Bulk Meter…"}
                              </span>
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[360px] sm:w-[420px] p-0 rounded-2xl shadow-xl" align="start">
                        <Command>
                          <CommandInput placeholder="Type meter name or key number…" className="h-10" />
                          <CommandList>
                            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                              No matching bulk meter found.
                            </CommandEmpty>
                            <CommandGroup heading="Available Bulk Meters">
                              {availableBulkMeters.map((bm) => (
                                <CommandItem
                                  key={bm.customerKeyNumber}
                                  value={`${bm.name} ${bm.customerKeyNumber} ${bm.specificArea || ""}`}
                                  onSelect={() => handleBulkMeterSelect(bm.customerKeyNumber)}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {bm.name}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      {bm.customerKeyNumber} {bm.specificArea ? `· ${bm.specificArea}` : ""}
                                    </span>
                                  </div>
                                  <Check
                                    className={`h-4 w-4 flex-shrink-0 text-primary transition-opacity ${
                                      field.value === bm.customerKeyNumber ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quick Helper / Persistent bulk meter switch */}
            <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="text-muted-foreground">
                Entering multiple customers under the same Bulk Meter?
              </span>
              <div className="flex items-center space-x-2">
                <Switch
                  id="keep-bulk-meter-staff"
                  checked={keepBulkMeterAfterSubmit}
                  onCheckedChange={setKeepBulkMeterAfterSubmit}
                />
                <Label htmlFor="keep-bulk-meter-staff" className="text-xs font-semibold cursor-pointer">
                  Keep selection on submit
                </Label>
              </div>
            </div>
          </div>

          {/* ── Lock Banner when Bulk Meter is NOT selected ───────────────── */}
          {!isBulkMeterSelected && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 transition-all duration-300">
              <Lock className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium">
                <strong>Form Locked:</strong> You must select a Bulk Meter above to unlock the rest of the customer entry form.
              </p>
            </div>
          )}

          {/* ── Remaining Form Content (Locked until Bulk Meter selected) ─── */}
          <div
            className={`space-y-8 transition-all duration-300 ${
              !isBulkMeterSelected ? "opacity-40 pointer-events-none filter blur-[0.3px]" : ""
            }`}
          >
            {/* Customer Identity Header with Auto-Generate */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Customer Identity</h4>
                <p className="text-xs text-muted-foreground">Unique keys & contract reference</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoGenerateKeys}
                disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                className="text-xs gap-1.5 h-8 border-primary/30 hover:border-primary font-semibold self-start sm:self-auto"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Auto-Generate Keys
              </Button>
            </div>

            {/* Customer Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Full Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <User className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Abebe Bekele"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerKeyNumber"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Cust. Key No. <span className="text-destructive">*</span>
                      </FormLabel>
                      <span className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold border border-slate-200 uppercase tracking-wider">
                        Key / Ext
                      </span>
                    </div>
                    <div className="premium-input-group">
                      <Hash className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., IND-12345678 or CUST-00123"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instKey"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        INST_KEY <span className="text-destructive">*</span>
                      </FormLabel>
                      <span className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold border border-slate-200 uppercase tracking-wider">
                        Inst / Ext
                      </span>
                    </div>
                    <div className="premium-input-group">
                      <Hash className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., INST-45678"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Contract No. <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Briefcase className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., CNT-2024-001"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Customer Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Layers className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {customerTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bookNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Book No. <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Book className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., BK-042"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ordinal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Ordinal <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Layers className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 5"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                            )
                          }
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meterSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Meter Size (inch) <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Settings className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ? String(field.value) : undefined}
                        disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {meterSizeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="NUMBER_OF_DIALS"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Number of Dials
                    </FormLabel>
                    <div className="premium-input-group">
                      <Settings className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 5"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                            )
                          }
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meterNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      METER_KEY <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Activity className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., MET-2822965"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="previousReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Previous Reading <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Activity className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 1234.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : parseFloat(e.target.value)
                            )
                          }
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Current Reading <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Activity className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 1289.50"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : parseFloat(e.target.value)
                            )
                          }
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Live consumption badge */}
            {consumption !== null && (
              <div
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-300 ${
                  consumption < 0
                    ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400"
                }`}
              >
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                {consumption < 0 ? (
                  <span>⚠️ Current reading is less than previous — please check values.</span>
                ) : (
                  <span>
                    Consumption: <strong>{consumption.toFixed(2)} m³</strong>
                  </span>
                )}
              </div>
            )}

            {/* Measurement Issue / Fault Checkbox */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasFaultStaff"
                  checked={hasFault}
                  onCheckedChange={(c) => {
                    const checked = !!c;
                    setHasFault(checked);
                    if (!checked) {
                      form.setValue("faultCode", undefined);
                    }
                  }}
                  disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                />
                <label htmlFor="hasFaultStaff" className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Measurement Issue / Meter Fault?
                </label>
              </div>

              {hasFault && (
                <FormField
                  control={form.control}
                  name="faultCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Fault Code <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select fault type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {faultCodesList.map((fc) => (
                            <SelectItem key={fc.code} value={fc.code}>
                              <span className="font-medium text-destructive">{fc.code}</span> - {fc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Location & Infrastructure */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Reading Month <span className="text-destructive">*</span>
                    </FormLabel>
                    <DatePicker
                      date={
                        field.value && isValid(parse(field.value, "yyyy-MM", new Date()))
                          ? parse(field.value, "yyyy-MM", new Date())
                          : undefined
                      }
                      setDate={(date) => field.onChange(date ? format(date, "yyyy-MM") : "")}
                      disabledTrigger={!isBulkMeterSelected || form.formState.isSubmitting}
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Specific Area <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Bole Medhanealem"
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Sub-City <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a Sub-City" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {subCityOptions.map((option) => (
                            <SelectItem key={String(option)} value={String(option)}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="woreda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Woreda <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a Woreda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {woredaOptions.map((option) => (
                            <SelectItem key={String(option)} value={String(option)}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
                {/* Sewerage Connection */}
                <FormField
                  control={form.control}
                  name="sewerageConnection"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Sewerage Conn. <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="premium-input-group">
                        <Droplets className="h-4 w-4" />
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                              <SelectValue placeholder="Select connection" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            {sewerageConnections.map((conn) => (
                              <SelectItem key={conn} value={conn}>
                                {conn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Latitude / X Coordinate */}
                <FormField
                  control={form.control}
                  name="xCoordinate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Latitude / X (Northing, ~9.0°)
                      </FormLabel>
                      <div className="premium-input-group">
                        <Crosshair className="h-4 w-4" />
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="e.g., 9.005401"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseFloat(e.target.value)
                              )
                            }
                            disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                            className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Longitude / Y Coordinate */}
                <FormField
                  control={form.control}
                  name="yCoordinate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Longitude / Y (Easting, ~38.7°)
                      </FormLabel>
                      <div className="premium-input-group">
                        <Crosshair className="h-4 w-4" />
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="e.g., 38.763611"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseFloat(e.target.value)
                              )
                            }
                            disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                            className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Z Coordinate */}
                <FormField
                  control={form.control}
                  name="zCoordinate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Z Coordinate (Altitude)
                      </FormLabel>
                      <div className="premium-input-group">
                        <Globe className="h-4 w-4" />
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="e.g., 2300"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : parseFloat(e.target.value)
                              )
                            }
                            disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                            className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            {/* ── Submit Button ─────────────────────────────────────────── */}
            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                className="w-full md:w-auto px-8 py-6 rounded-2xl shadow-lg hover:shadow-primary/20 transition-all duration-300 font-bold text-lg"
                disabled={!isBulkMeterSelected || form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Activity className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Data…
                  </>
                ) : (
                  "Submit Customer for Approval"
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}
