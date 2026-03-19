

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


import { 
  User, 
  Hash, 
  Book, 
  Layers, 
  Activity, 
  Calendar, 
  MapPin, 
  Droplets, 
  Settings, 
  CreditCard,
  Briefcase,
  GitBranch,
  Network
} from "lucide-react";

const FormSchemaForAdminDataEntry = baseIndividualCustomerDataSchema.extend({
  status: z.enum(individualCustomerStatuses, { errorMap: () => ({ message: "Please select a valid status." }) }),
  paymentStatus: z.enum(paymentStatuses, { errorMap: () => ({ message: "Please select a valid payment status." }) }),
});
type AdminDataEntryFormValues = z.infer<typeof FormSchemaForAdminDataEntry>;


const UNASSIGNED_BULK_METER_VALUE = "_SELECT_NONE_BULK_METER_";
const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_INDIVIDUAL_";

export function IndividualCustomerDataEntryForm() {
  const { toast } = useToast();
  const [availableBulkMeters, setAvailableBulkMeters] = React.useState<{ customerKeyNumber: string, name: string }[]>([]);
  const [isLoadingBulkMeters, setIsLoadingBulkMeters] = React.useState(true);
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);


  React.useEffect(() => {
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
      status: "Active",
      paymentStatus: "Unpaid",
    },
  });

  async function onSubmit(data: AdminDataEntryFormValues) {
    const submissionData = {
      ...data,
      assignedBulkMeterId: data.assignedBulkMeterId === UNASSIGNED_BULK_METER_VALUE ? undefined : data.assignedBulkMeterId,
      branchId: data.branchId === BRANCH_UNASSIGNED_VALUE ? undefined : data.branchId,
    };

    const result = await addCustomerToStore(submissionData);
    if (result.success && result.data) {
      toast({
        title: "Data Entry Submitted",
        description: `Data for individual customer ${result.data.name} has been successfully recorded and is pending approval.`,
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
                        onValueChange={(value) => handleBranchChange(value)}
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
              <FormField
                control={form.control}
                name="assignedBulkMeterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assign to Bulk Meter</FormLabel>
                    <div className="premium-input-group">
                      <Layers className="h-4 w-4" />
                      <Select
                        onValueChange={handleBulkMeterChange}
                        value={field.value}
                        disabled={isLoadingBulkMeters || form.formState.isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
                            <SelectValue placeholder={isLoadingBulkMeters ? "Loading..." : "None"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
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
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section: Basic Identity */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <User className="h-3.5 w-3.5" /> Customer Identity
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <User className="h-4 w-4" />
                    <FormControl><Input {...field} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerKeyNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cust. Key No. <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Hash className="h-4 w-4" />
                    <FormControl><Input {...field} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="instKey" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">INST_KEY <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Hash className="h-4 w-4" />
                    <FormControl><Input {...field} placeholder="e.g., INST-12345" disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contractNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contract No. <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Briefcase className="h-4 w-4" />
                    <FormControl><Input {...field} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Type <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Layers className="h-4 w-4" />
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl><SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">{customerTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Section: Meter Details */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Activity className="h-3.5 w-3.5" /> Meter Specifications
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="meterNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">METER_KEY <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Activity className="h-4 w-4" />
                    <FormControl><Input {...field} placeholder="e.g., MET-2822965" disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bookNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Book No. <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Book className="h-4 w-4" />
                    <FormControl><Input {...field} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ordinal" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ordinal <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Layers className="h-4 w-4" />
                    <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="NUMBER_OF_DIALS" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Number of Dials</FormLabel>
                  <div className="premium-input-group">
                    <Settings className="h-4 w-4" />
                    <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={form.control}
                name="meterSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Meter Size (inch) <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <Settings className="h-4 w-4" />
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select a size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {meterSizeOptions.map(option => (
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

          {/* Section: Readings */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" /> Usage & Period
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="previousReading" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Previous Reading <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Activity className="h-4 w-4" />
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currentReading" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Reading <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Activity className="h-4 w-4" />
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="month" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Reading Month <span className="text-destructive">*</span></FormLabel>
                  <DatePicker 
                    date={field.value && isValid(parse(field.value, "yyyy-MM", new Date())) ? parse(field.value, "yyyy-MM", new Date()) : undefined} 
                    setDate={(date) => field.onChange(date ? format(date, "yyyy-MM") : "")} 
                    disabledTrigger={form.formState.isSubmitting} 
                  />
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Section: Location */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <MapPin className="h-3.5 w-3.5" /> Location & Services
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="specificArea" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Specific Area <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <MapPin className="h-4 w-4" />
                    <FormControl><Input {...field} disabled={form.formState.isSubmitting} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={form.control}
                name="subCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sub-City <span className="text-destructive">*</span></FormLabel>
                    <div className="premium-input-group">
                      <MapPin className="h-4 w-4" />
                      <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                        <FormControl><SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><SelectValue placeholder="Select a Sub-City" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                          {subCityOptions.map(option => <SelectItem key={String(option)} value={String(option)}>{option}</SelectItem>)}
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
                      <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                        <FormControl><SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><SelectValue placeholder="Select a Woreda" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                          {woredaOptions.map(option => <SelectItem key={String(option)} value={String(option)}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="sewerageConnection" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sewerage Conn. <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Droplets className="h-4 w-4" />
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl><SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><SelectValue placeholder="Select connection" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">{sewerageConnections.map(conn => <SelectItem key={conn} value={conn}>{conn}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Section: Administrative */}
          <div>
            <div className="form-section-divider">
              <span className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <Settings className="h-3.5 w-3.5" /> Administrative
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Status <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <Activity className="h-4 w-4" />
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl><SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">{individualCustomerStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Status <span className="text-destructive">*</span></FormLabel>
                  <div className="premium-input-group">
                    <CreditCard className="h-4 w-4" />
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl><SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><SelectValue placeholder="Select payment status" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">{paymentStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
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
              ) : "Submit Customer for Approval"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}
