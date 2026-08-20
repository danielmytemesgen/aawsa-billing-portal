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
import { Progress } from "@/components/ui/progress";
import { addBulkMeter as addBulkMeterToStore, initializeBulkMeters, initializeCustomers, getBranches, subscribeToBranches, initializeBranches as initializeAdminBranches, getBulkMeters } from "@/lib/data-store";
import { generateBulkMeterKeys } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse } from "date-fns";
import type { Branch } from "../branches/branch-types";
import { customerTypes, sewerageConnections } from "@/lib/billing-calculations";
import { 
  Hash, 
  Book, 
  Activity, 
  Calendar, 
  MapPin, 
  Settings, 
  Phone,
  Crosshair,
  Droplets,
  Package,
  GitBranch,
  Network,
  Globe,
  Layers,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

// Section header helper
const SectionHeader = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) => (
  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  </div>
);

// Required fields tracked for progress
const REQUIRED_FIELDS_BULK: (keyof BulkMeterDataEntryFormValues)[] = [
  "name", "customerKeyNumber", "instKey", "contractNumber",
  "meterNumber", "meterSize",
  "previousReading", "currentReading", "month",
  "specificArea", "subCity", "woreda",
  "chargeGroup", "sewerageConnection",
];

const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_BULK_METER_";

export function BulkMeterDataEntryForm() {
  const { toast } = useToast();
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);
  const [lockedBranchId, setLockedBranchId] = React.useState<string | null>(null);

  const form = useForm<BulkMeterDataEntryFormValues>({
    resolver: zodResolver(bulkMeterDataEntrySchema),
    defaultValues: {
      name: "",
      customerKeyNumber: "",
      instKey: "",
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
      routeKey: undefined,
      xCoordinate: undefined,
      yCoordinate: undefined,
      zCoordinate: undefined,
      ordinal: undefined,
    },
  });

  React.useEffect(() => {
    initializeCustomers();
    initializeBulkMeters();

    setIsLoadingBranches(true);
    initializeAdminBranches().then(() => {
      setAvailableBranches(getBranches());
      setIsLoadingBranches(false);
    });

    // Auto-generate keys for new entries
    const existingMeters = getBulkMeters();
    const { customerKey, instKey } = generateBulkMeterKeys(existingMeters);
    form.setValue("customerKeyNumber", customerKey);
    form.setValue("instKey", instKey);

    // Auto-lock branch for non-head-office users
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
        permissions.includes('bulk_meters_view_all');
      if (!isGlobal && branchId) {
        setLockedBranchId(branchId);
        form.setValue('branchId', branchId);
      }
    }

    const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
      setAvailableBranches(updatedBranches);
      setIsLoadingBranches(false);
    });
    return () => unsubscribeBranches();
  }, []);

  const watchedValues = form.watch();
  const xValue = watchedValues.xCoordinate;
  const yValue = watchedValues.yCoordinate;
  const prevReading = watchedValues.previousReading;
  const currReading = watchedValues.currentReading;
  const hasCoordinates = !!(xValue && yValue);

  const consumption = (currReading !== undefined && prevReading !== undefined && !isNaN(currReading) && !isNaN(prevReading))
    ? (currReading - prevReading)
    : null;

  // Progress
  const filledCount = REQUIRED_FIELDS_BULK.filter((f) => {
    const val = watchedValues[f];
    return val !== undefined && val !== "" && val !== null;
  }).length;
  const progressPct = Math.round((filledCount / REQUIRED_FIELDS_BULK.length) * 100);

  const openExternalMap = () => {
    if (hasCoordinates) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${xValue},${yValue}`, '_blank');
    }
  };


  async function onSubmit(data: BulkMeterDataEntryFormValues) {
    const result = await addBulkMeterToStore(data);

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
              <span className={`text-xs font-bold tabular-nums ${
                progressPct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
              }`}>
                {filledCount} / {REQUIRED_FIELDS_BULK.length} required fields &nbsp;·&nbsp; {progressPct}%
              </span>
            </div>
            <Progress
              value={progressPct}
              className={`h-2 rounded-full transition-all duration-500 ${
                progressPct === 100 ? "[&>div]:bg-emerald-500" : ""
              }`}
            />
          </div>

          {/* Section: Assignment */}
          <div>
            <SectionHeader icon={Network} title="Branch Assignment" description="Assign this bulk meter to an administrative branch" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assign to Branch</FormLabel>
                    <div className="premium-input-group">
                      <Network className="h-4 w-4" />
                      {lockedBranchId ? (
                        <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 w-full">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
                            {availableBranches.find(b => b.id === lockedBranchId)?.name || lockedBranchId}
                          </span>
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">Auto-assigned</span>
                        </div>
                      ) : (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || BRANCH_UNASSIGNED_VALUE}
                          disabled={isLoadingBranches || form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
                              <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : "Select a branch"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
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
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section: Meter Identity */}
          <div>
            <SectionHeader icon={Package} title="Meter Identity" description="Unique identifiers and contract information" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bulk Meter Name <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Package className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Enter bulk meter name" {...field} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" />
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
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cust. Key No. <span className="text-destructive">*</span></FormLabel>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100 uppercase tracking-wider">Auto-Generated</span>
                    </div>
                    <div className="premium-input-group">
                      <Hash className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Auto-generated" {...field} readOnly className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm cursor-not-allowed text-slate-500" />
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
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">INST_KEY <span className="text-destructive">*</span></FormLabel>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100 uppercase tracking-wider">Auto-Generated</span>
                    </div>
                    <div className="premium-input-group">
                      <Hash className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Auto-generated" {...field} readOnly className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm cursor-not-allowed text-slate-500" />
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contract Number <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Book className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Enter contract number" {...field} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section: Meter Specs */}
          <div>
            <SectionHeader icon={Settings} title="Meter Specifications" description="Technical specs including size and dial count" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="meterNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Meter Number <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Activity className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Enter meter number" {...field} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" />
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Meter Size (inch) <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Settings className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a meter size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {meterSizeOptions.map(option => (
                            <SelectItem key={String(option.value)} value={String(option.value)}>
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Number of Dials</FormLabel>
                    <div className="premium-input-group">
                      <Settings className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter number of dials"
                          {...field}
                          value={field.value ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            field.onChange(val === "" ? undefined : parseInt(val, 10));
                          }}
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

          {/* Section: Usage */}
          <div>
            <SectionHeader icon={Activity} title="Meter Readings" description="Enter the billing period readings" />
            {/* Live consumption hint */}
            {consumption !== null && (
              <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border ${
                consumption < 0
                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
              }`}>
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                {consumption < 0
                  ? <span>⚠️ Current reading is less than previous — please check values.</span>
                  : <span>Consumption: <strong>{consumption.toFixed(2)} m³</strong></span>
                }
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="previousReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Previous Reading <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Activity className="h-4 w-4" />
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Reading <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Activity className="h-4 w-4" />
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
                name="month"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Reading Month <span className="text-destructive">*</span></FormLabel>
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
            </div>
          </div>

          {/* Section: Location & Contact */}
          <div>
            <SectionHeader icon={MapPin} title="Location & Contact" description="Physical address and contact information" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="specificArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Specific Area <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Enter specific area" {...field} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" />
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sub-City <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a Sub-City" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {subCityOptions.map(option => (
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Woreda <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a Woreda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {woredaOptions.map(option => (
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phone Number</FormLabel>
                    <div className="premium-input-group">
                      <Phone className="h-4 w-4" />
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section: Infrastructure */}
          <div>
            <SectionHeader icon={Layers} title="Infrastructure & Billing" description="Sewerage, charge group, and route classification" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="chargeGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Charge Group <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Package className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue="Non-domestic"
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select charge group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {customerTypes.map((type) => (
                            <SelectItem key={String(type)} value={String(type)}>
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
                name="routeKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Route Key</FormLabel>
                    <div className="premium-input-group">
                      <GitBranch className="h-4 w-4" />
                      <FormControl>
                        <Input
                          placeholder="Enter route key"
                          {...field}
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
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ordinal</FormLabel>
                    <div className="premium-input-group">
                      <Layers className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter ordinal"
                          {...field}
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
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
                name="sewerageConnection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sewerage Connection <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Droplets className="h-4 w-4" />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue="No"
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select connection status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {sewerageConnections.map((type) => (
                            <SelectItem key={String(type)} value={String(type)}>
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
                name="xCoordinate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">X Coordinate (Optional)</FormLabel>
                      {hasCoordinates && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider transition-colors"
                          onClick={openExternalMap}
                        >
                          <Globe className="h-3 w-3" />
                          View on Map
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
                          onChange={e => {
                            const val = e.target.value;
                            field.onChange(val === "" ? undefined : parseFloat(val));
                          }}
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
                name="yCoordinate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Y Coordinate (Optional)</FormLabel>
                    <div className="premium-input-group">
                      <Crosshair className="h-4 w-4" />
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
                name="zCoordinate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Z Coordinate (Altitude)</FormLabel>
                    <div className="premium-input-group">
                      <Globe className="h-4 w-4" />
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 2300"
                          {...field}
                          value={field.value ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            field.onChange(val === "" ? undefined : parseFloat(val));
                          }}
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

          <div className="pt-6 flex justify-end">
            <Button 
              type="submit" 
              className="w-full md:w-auto px-8 py-6 rounded-2xl shadow-lg hover:shadow-primary/20 transition-all duration-300 font-bold text-lg" 
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Activity className="mr-2 h-5 w-5 animate-spin" /> 
                  Submitting Data...
                </>
              ) : "Submit Bulk Meter for Approval"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}
