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
import { Progress } from "@/components/ui/progress";
import {
  addCustomer as addCustomerToStore,
  getBulkMeters,
  subscribeToBulkMeters,
  initializeBulkMeters,
  initializeCustomers,
  getBranches,
  subscribeToBranches,
  initializeBranches as initializeAdminBranches,
} from "@/lib/data-store";
import type { Branch } from "../branches/branch-types";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse, isValid } from "date-fns";
import { customerTypes, sewerageConnections, paymentStatuses } from "@/lib/billing-calculations";
import { individualCustomerStatuses } from "../individual-customers/individual-customer-types";

import {
  User,
  Hash,
  Book,
  Layers,
  Activity,
  MapPin,
  Droplets,
  Settings,
  CreditCard,
  Briefcase,
  Network,
  Crosshair,
  Globe,
  TrendingUp,
  CheckCircle2,
  Lock,
} from "lucide-react";

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) => (
  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  </div>
);

// ─── Schema & types ────────────────────────────────────────────────────────────
const FormSchemaForAdminDataEntry = baseIndividualCustomerDataSchema.extend({
  assignedBulkMeterId: z
    .string({ required_error: "Assigning to a Bulk Meter is mandatory." })
    .min(1, { message: "Assigning to a Bulk Meter is mandatory." })
    .refine((val) => val !== "_SELECT_NONE_BULK_METER_", {
      message: "Assigning to a Bulk Meter is mandatory.",
    }),
  status: z.enum(individualCustomerStatuses, {
    errorMap: () => ({ message: "Please select a valid status." }),
  }),
  paymentStatus: z.enum(paymentStatuses, {
    errorMap: () => ({ message: "Please select a valid payment status." }),
  }),
});
type AdminDataEntryFormValues = z.infer<typeof FormSchemaForAdminDataEntry>;

// Required field names used for progress counting
const REQUIRED_FIELDS: (keyof AdminDataEntryFormValues)[] = [
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
  "status",
  "paymentStatus",
];

const UNASSIGNED_BULK_METER_VALUE = "_SELECT_NONE_BULK_METER_";
const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_INDIVIDUAL_";

// ─── Component ────────────────────────────────────────────────────────────────
export function IndividualCustomerDataEntryForm() {
  const { toast } = useToast();
  const [availableBulkMeters, setAvailableBulkMeters] = React.useState<
    { customerKeyNumber: string; name: string }[]
  >([]);
  const [isLoadingBulkMeters, setIsLoadingBulkMeters] = React.useState(true);
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);
  // Tracks the locked branch for branch-scoped (non-head-office) users
  const [lockedBranchId, setLockedBranchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsLoadingBulkMeters(true);
    Promise.all([
      initializeBulkMeters(),
      initializeCustomers(),
      initializeAdminBranches(),
    ]).then(() => {
      setAvailableBulkMeters(
        getBulkMeters().map((bm) => ({
          customerKeyNumber: bm.customerKeyNumber,
          name: bm.name,
        }))
      );
      setIsLoadingBulkMeters(false);
      setAvailableBranches(getBranches());
      setIsLoadingBranches(false);
    });

    const unsubscribeBMs = subscribeToBulkMeters((updated) => {
      setAvailableBulkMeters(
        updated.map((bm) => ({ customerKeyNumber: bm.customerKeyNumber, name: bm.name }))
      );
      setIsLoadingBulkMeters(false);
    });
    const unsubscribeBranches = subscribeToBranches((updated) => {
      setAvailableBranches(updated);
      setIsLoadingBranches(false);
    });
    return () => {
      unsubscribeBMs();
      unsubscribeBranches();
    };
  }, []);

  const form = useForm<AdminDataEntryFormValues>({
    resolver: zodResolver(FormSchemaForAdminDataEntry),
    defaultValues: {
      assignedBulkMeterId: "",
      branchId: undefined,
      name: "",
      customerKeyNumber: "",
      instKey: "",
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
      status: "Pending Approval",
      paymentStatus: "Unpaid",
      xCoordinate: undefined,
      yCoordinate: undefined,
      zCoordinate: undefined,
    },
  });

  // Auto-lock branch for non-head-office users
  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      const branchId = user?.branchId;
      const permissions: string[] = user?.permissions || [];
      const isGlobal =
        !branchId ||
        branchId === 'all' ||
        permissions.includes('*') ||
        permissions.includes('all') ||
        permissions.includes('admin') ||
        permissions.includes('customers_view_all');
      if (!isGlobal && branchId) {
        setLockedBranchId(branchId);
        // Pre-fill the form field
        form.setValue('branchId', branchId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ── Live watchers ────────────────────────────────────────────────────────────
  const watchedValues = form.watch();
  const xValue = watchedValues.xCoordinate;
  const yValue = watchedValues.yCoordinate;
  const prevReading = watchedValues.previousReading;
  const currReading = watchedValues.currentReading;
  const hasCoordinates = !!(xValue && yValue);

  // Lock state check: Bulk Meter MUST be selected to unlock the form
  const isBulkMeterSelected =
    !!watchedValues.assignedBulkMeterId &&
    watchedValues.assignedBulkMeterId !== "" &&
    watchedValues.assignedBulkMeterId !== UNASSIGNED_BULK_METER_VALUE;

  const consumption =
    currReading !== undefined &&
    prevReading !== undefined &&
    !isNaN(currReading) &&
    !isNaN(prevReading)
      ? currReading - prevReading
      : null;

  // ── Field completion progress ────────────────────────────────────────────────
  const filledCount = REQUIRED_FIELDS.filter((field) => {
    const val = watchedValues[field];
    return (
      val !== undefined &&
      val !== "" &&
      val !== null &&
      val !== UNASSIGNED_BULK_METER_VALUE
    );
  }).length;
  const progressPct = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openExternalMap = () => {
    if (hasCoordinates) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${xValue},${yValue}`,
        "_blank"
      );
    }
  };

  const handleBulkMeterChange = (value: string | undefined) => {
    form.setValue("assignedBulkMeterId", value || "", { shouldValidate: true });
  };

  const handleBranchChange = (branchIdValue: string) => {
    const selectedBranch = availableBranches.find((b) => b.id === branchIdValue);
    if (selectedBranch) {
      form.setValue("branchId", selectedBranch.id);
    } else if (branchIdValue === BRANCH_UNASSIGNED_VALUE) {
      form.setValue("branchId", undefined);
    }
  };

  async function onSubmit(data: AdminDataEntryFormValues) {
    const submissionData = {
      ...data,
      assignedBulkMeterId:
        data.assignedBulkMeterId === UNASSIGNED_BULK_METER_VALUE
          ? undefined
          : data.assignedBulkMeterId,
      branchId:
        data.branchId === BRANCH_UNASSIGNED_VALUE ? undefined : data.branchId,
    };

    const result = await addCustomerToStore(submissionData);
    if (result.success && result.data) {
      toast({
        title: "Data Entry Submitted",
        description: `Customer "${result.data.name}" has been recorded successfully.`,
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description:
          result.message || "Could not record customer data. Please check for errors.",
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="h-[calc(100vh-280px)] pr-4">
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
                  progressPct === 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-primary"
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

          {/* ── Section: Assignment (Mandatory Step 1) ─────────────────── */}
          <div>
            <SectionHeader
              icon={Network}
              title="Assignment"
              description="Assign this customer to a Bulk Meter to unlock the form"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assign to Bulk Meter — MANDATORY */}
              <FormField
                control={form.control}
                name="assignedBulkMeterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Assign to Bulk Meter <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="premium-input-group">
                      <Layers className="h-4 w-4 text-primary" />
                      <Select
                        onValueChange={handleBulkMeterChange}
                        value={field.value || undefined}
                        disabled={isLoadingBulkMeters || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-primary/40 dark:border-primary/40 bg-primary/5 focus:ring-primary">
                            <SelectValue
                              placeholder={
                                isLoadingBulkMeters
                                  ? "Loading Bulk Meters…"
                                  : "Select a Bulk Meter (Required)"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {availableBulkMeters.length === 0 && !isLoadingBulkMeters && (
                            <SelectItem value="no-bms-available" disabled>
                              No bulk meters available
                            </SelectItem>
                          )}
                          {availableBulkMeters.map((bm) => (
                            <SelectItem key={bm.customerKeyNumber} value={bm.customerKeyNumber}>
                              {bm.name} ({bm.customerKeyNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Assign to Branch */}
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Assign to Branch
                    </FormLabel>
                    <div className="premium-input-group">
                      <Network className="h-4 w-4" />
                      {lockedBranchId ? (
                        /* Branch-scoped user: show locked branch, not a selector */
                        <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 w-full">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
                            {availableBranches.find(b => b.id === lockedBranchId)?.name || lockedBranchId}
                          </span>
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">Auto-assigned</span>
                        </div>
                      ) : (
                        <Select
                          onValueChange={handleBranchChange}
                          value={field.value || BRANCH_UNASSIGNED_VALUE}
                          disabled={isLoadingBranches || form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
                              <SelectValue
                                placeholder={isLoadingBranches ? "Loading branches…" : "Select a branch"}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            <SelectItem value={BRANCH_UNASSIGNED_VALUE}>None</SelectItem>
                            {availableBranches.map((branch) =>
                              branch?.id ? (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ) : null
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              !isBulkMeterSelected
                ? "opacity-40 pointer-events-none filter blur-[0.3px]"
                : ""
            }`}
          >
            {/* ── Section: Customer Identity ─────────────────────────────── */}
            <div>
              <SectionHeader
                icon={User}
                title="Customer Identity"
                description="Core identification fields — obtained from the external billing system"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Full Name */}
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
                {/* Customer Key Number */}
                <FormField
                  control={form.control}
                  name="customerKeyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Cust. Key No. <span className="text-destructive">*</span>
                        </FormLabel>
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200 uppercase tracking-wider">
                          From Ext. System
                        </span>
                      </div>
                      <div className="premium-input-group">
                        <Hash className="h-4 w-4" />
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., CUST-00123"
                            disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                            className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* INST_KEY */}
                <FormField
                  control={form.control}
                  name="instKey"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          INST_KEY <span className="text-destructive">*</span>
                        </FormLabel>
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200 uppercase tracking-wider">
                          From Ext. System
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
                {/* Contract Number */}
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
                {/* Customer Type */}
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
              </div>
            </div>

            {/* ── Section: Meter Details ─────────────────────────────────── */}
            <div>
              <SectionHeader
                icon={Settings}
                title="Meter Details"
                description="Physical meter specifications and reference numbers"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* METER_KEY */}
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
                {/* Book Number */}
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
                {/* Ordinal */}
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
                {/* Number of Dials */}
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
                {/* Meter Size */}
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
              </div>
            </div>

            {/* ── Section: Meter Readings ────────────────────────────────── */}
            <div>
              <SectionHeader
                icon={Activity}
                title="Meter Readings"
                description="Enter the billing period readings — current must be ≥ previous"
              />

              {/* Live consumption badge */}
              {consumption !== null && (
                <div
                  className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-300 ${
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Previous Reading */}
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
                {/* Current Reading */}
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
                {/* Reading Month */}
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
              </div>
            </div>

            {/* ── Section: Location ─────────────────────────────────────── */}
            <div>
              <SectionHeader
                icon={MapPin}
                title="Location"
                description="Geographic and administrative location of the meter"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Specific Area */}
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
                {/* Sub-City */}
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
                          value={field.value}
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
                {/* Woreda */}
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
                          value={field.value}
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
                {/* X Coordinate */}
                <FormField
                  control={form.control}
                  name="xCoordinate"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          X Coordinate (Lat)
                        </FormLabel>
                        {hasCoordinates && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider transition-all"
                            onClick={openExternalMap}
                            disabled={!isBulkMeterSelected}
                          >
                            <Globe className="h-3 w-3" />
                            Map
                          </Button>
                        )}
                      </div>
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
                {/* Y Coordinate */}
                <FormField
                  control={form.control}
                  name="yCoordinate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Y Coordinate (Long)
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
            </div>

            {/* ── Section: Administrative ────────────────────────────────── */}
            <div>
              <SectionHeader
                icon={CreditCard}
                title="Administrative"
                description="Account status and payment classification"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Customer Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Customer Status <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="premium-input-group">
                        <Activity className="h-4 w-4" />
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            {individualCustomerStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Payment Status */}
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Payment Status <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="premium-input-group">
                        <CreditCard className="h-4 w-4" />
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!isBulkMeterSelected || form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                              <SelectValue placeholder="Select payment status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            {paymentStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Submit Button ─────────────────────────────────────────── */}
            <div className="pt-6 flex justify-end">
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
