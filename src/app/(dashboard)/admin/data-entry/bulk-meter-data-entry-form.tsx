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
  Globe
} from "lucide-react";

const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_BULK_METER_";

export function BulkMeterDataEntryForm() {
  const { toast } = useToast();
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);

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
      xCoordinate: undefined,
      yCoordinate: undefined,
      zCoordinate: undefined,
      ordinal: undefined,
    },
  });

  const xValue = form.watch("xCoordinate");
  const yValue = form.watch("yCoordinate");
  const hasCoordinates = !!(xValue && yValue);

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
          
          {/* Section: Assignment */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <GitBranch className="h-3.5 w-3.5" /> Assignment
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assign to Branch</FormLabel>
                    <div className="premium-input-group">
                      <Network className="h-4 w-4" />
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
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section: Meter Identity */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Package className="h-3.5 w-3.5" /> Bulk Meter Identity
              </span>
            </div>
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
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Settings className="h-3.5 w-3.5" /> Meter Specifications
              </span>
            </div>
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
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" /> Usage & Period
              </span>
            </div>
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
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <MapPin className="h-3.5 w-3.5" /> Location & Contact
              </span>
            </div>
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
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Crosshair className="h-3.5 w-3.5" /> Infrastructure & GPS
              </span>
            </div>
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
