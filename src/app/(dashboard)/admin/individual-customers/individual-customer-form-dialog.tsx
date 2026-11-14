
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
import { baseIndividualCustomerDataSchema, meterSizeOptions, subCityOptions, woredaOptions } from "@/app/(dashboard)/admin/data-entry/customer-data-entry-types";
import type { IndividualCustomer } from "./individual-customer-types";
import { individualCustomerStatuses } from "./individual-customer-types";
import { getBulkMeters, subscribeToBulkMeters, initializeBulkMeters, getBranches, subscribeToBranches, initializeBranches as initializeAdminBranches } from "@/lib/data-store";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse, isValid } from "date-fns";
import { customerTypes, sewerageConnections, paymentStatuses } from "@/lib/billing-calculations";
import type { Branch } from "../branches/branch-types";
import { Globe, Search, X, Check, ChevronsUpDown, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface BulkMeterOption {
  customerKeyNumber: string;
  name: string;
  contractNumber?: string | null;
  meterNumber?: string | null;
}

const individualCustomerFormObjectSchema = baseIndividualCustomerDataSchema.extend({
  status: z.enum(individualCustomerStatuses, { errorMap: () => ({ message: "Please select a valid status." }) }),
  paymentStatus: z.enum(paymentStatuses, { errorMap: () => ({ message: "Please select a valid payment status." }) }),
  branchId: z.string().optional(),
});

export type IndividualCustomerFormValues = z.infer<typeof individualCustomerFormObjectSchema>;

interface IndividualCustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: IndividualCustomerFormValues) => void;
  defaultValues?: IndividualCustomer | null;
  bulkMeters?: BulkMeterOption[];
  staffBranchName?: string;
}

const UNASSIGNED_BULK_METER_VALUE = "_SELECT_NONE_BULK_METER_";
const BRANCH_UNASSIGNED_VALUE = "_SELECT_BRANCH_INDIVIDUAL_DIALOG_";

export function IndividualCustomerFormDialog({ open, onOpenChange, onSubmit, defaultValues, bulkMeters: propBulkMeters, staffBranchName }: IndividualCustomerFormDialogProps) {
  const [dynamicBulkMeters, setDynamicBulkMeters] = React.useState<BulkMeterOption[]>(propBulkMeters || []);
  const [bulkMeterSearch, setBulkMeterSearch] = React.useState("");
  const [isBulkMeterPickerOpen, setIsBulkMeterPickerOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);
  const [isLoadingBulkMeters, setIsLoadingBulkMeters] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<any>(null);

  React.useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
  }, []);

  const userBranchId = currentUser?.branchId;
  const permissions: string[] = currentUser?.permissions || [];
  const isHeadOffice =
    !userBranchId ||
    userBranchId === 'all' ||
    permissions.includes('*') ||
    permissions.includes('all') ||
    permissions.includes('admin') ||
    permissions.includes('customers_view_all');

  const form = useForm<IndividualCustomerFormValues>({
    resolver: zodResolver(individualCustomerFormObjectSchema),
    defaultValues: {
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
      assignedBulkMeterId: UNASSIGNED_BULK_METER_VALUE,
      branchId: undefined,
      status: "Pending Approval",
      paymentStatus: "Unpaid",
      xCoordinate: undefined,
      yCoordinate: undefined,
      zCoordinate: undefined,
    },
  });

  React.useEffect(() => {
    if (!open) return;

    setIsLoadingBranches(true);
    initializeAdminBranches().then(() => {
      setAvailableBranches(getBranches());
      setIsLoadingBranches(false);
    });
    const unsubscribeAdminBranches = subscribeToBranches((updatedBranches) => {
      setAvailableBranches(updatedBranches);
      setIsLoadingBranches(false);
    });

    setIsLoadingBulkMeters(true);
    if (!propBulkMeters) {
      initializeBulkMeters().then(() => {
        const fetchedBms = getBulkMeters().map(bm => ({
          customerKeyNumber: bm.customerKeyNumber,
          name: bm.name,
          contractNumber: bm.contractNumber,
          meterNumber: bm.meterNumber,
        }));
        setDynamicBulkMeters(fetchedBms);
        setIsLoadingBulkMeters(false);
      });
    } else {
      setDynamicBulkMeters(propBulkMeters);
      setIsLoadingBulkMeters(false);
    }

    let unsubscribeBMs = () => { };
    if (!propBulkMeters) {
      unsubscribeBMs = subscribeToBulkMeters((updatedBulkMeters) => {
        setDynamicBulkMeters(updatedBulkMeters.map(bm => ({
          customerKeyNumber: bm.customerKeyNumber,
          name: bm.name,
          contractNumber: bm.contractNumber,
          meterNumber: bm.meterNumber,
        })));
        setIsLoadingBulkMeters(false);
      });
    }
    return () => {
      unsubscribeAdminBranches();
      unsubscribeBMs();
    }
  }, [propBulkMeters, open]);

  React.useEffect(() => {
    if (propBulkMeters) {
      const bms = [...propBulkMeters];
      const assignedId = defaultValues?.assignedBulkMeterId;
      if (
        assignedId &&
        assignedId !== UNASSIGNED_BULK_METER_VALUE &&
        !bms.some((b) => b.customerKeyNumber === assignedId)
      ) {
        const found = getBulkMeters().find((b) => b.customerKeyNumber === assignedId);
        if (found) {
          bms.unshift({
            customerKeyNumber: found.customerKeyNumber,
            name: found.name,
            contractNumber: found.contractNumber,
            meterNumber: found.meterNumber,
          });
        } else {
          bms.unshift({
            customerKeyNumber: assignedId,
            name: `${assignedId} (Current)`,
          });
        }
      }
      setDynamicBulkMeters(bms);
    }
  }, [propBulkMeters, defaultValues?.assignedBulkMeterId]);

  const filteredBulkMeters = React.useMemo(() => {
    if (!bulkMeterSearch.trim()) return dynamicBulkMeters;
    const term = bulkMeterSearch.toLowerCase().trim();
    return dynamicBulkMeters.filter((bm) => {
      const key = (bm.customerKeyNumber || "").toLowerCase();
      const name = (bm.name || "").toLowerCase();
      const contract = (bm.contractNumber || "").toLowerCase();
      const meterNo = (bm.meterNumber || "").toLowerCase();
      return (
        key.includes(term) ||
        name.includes(term) ||
        contract.includes(term) ||
        meterNo.includes(term)
      );
    });
  }, [dynamicBulkMeters, bulkMeterSearch]);

  React.useEffect(() => {
    const effectiveBranchId = defaultValues?.branchId || (!isHeadOffice && userBranchId ? userBranchId : undefined);
    if (defaultValues) {
      form.reset({
        name: defaultValues.name || "",
        customerKeyNumber: defaultValues.customerKeyNumber || "",
        instKey: defaultValues.instKey || "",
        contractNumber: defaultValues.contractNumber || "",
        customerType: defaultValues.customerType || undefined,
        bookNumber: defaultValues.bookNumber || "",
        ordinal: defaultValues.ordinal ?? undefined,
        NUMBER_OF_DIALS: defaultValues.NUMBER_OF_DIALS ?? undefined,
        meterSize: defaultValues.meterSize ?? undefined,
        meterNumber: defaultValues.meterNumber || "",
        previousReading: defaultValues.previousReading ?? undefined,
        currentReading: defaultValues.currentReading ?? undefined,
        month: defaultValues.month || "",
        specificArea: defaultValues.specificArea || "",
        subCity: defaultValues.subCity || "",
        woreda: defaultValues.woreda || "",
        sewerageConnection: defaultValues.sewerageConnection || undefined,
        assignedBulkMeterId: defaultValues.assignedBulkMeterId || UNASSIGNED_BULK_METER_VALUE,
        branchId: effectiveBranchId,
        status: defaultValues.status || "Active",
        paymentStatus: defaultValues.paymentStatus || "Unpaid",
        xCoordinate: defaultValues.xCoordinate ?? undefined,
        yCoordinate: defaultValues.yCoordinate ?? undefined,
        zCoordinate: defaultValues.zCoordinate ?? undefined,
      });
    } else {
      form.reset({
        name: "",
        customerKeyNumber: "",
        instKey: "",
        contractNumber: "",
        customerType: undefined,
        bookNumber: "",
        ordinal: undefined,
        NUMBER_OF_DIALS: undefined,
        meterSize: undefined,
        meterNumber: "",
        previousReading: undefined,
        currentReading: undefined,
        month: "",
        specificArea: "",
        subCity: staffBranchName || "",
        woreda: "",
        sewerageConnection: undefined,
        assignedBulkMeterId: UNASSIGNED_BULK_METER_VALUE,
        branchId: effectiveBranchId,
        status: "Pending Approval",
        paymentStatus: "Unpaid",
        xCoordinate: undefined,
        yCoordinate: undefined,
        zCoordinate: undefined,
      });
    }
  }, [defaultValues, form, open, staffBranchName, isHeadOffice, userBranchId]);

  const handleSubmit = (data: IndividualCustomerFormValues) => {
    const submissionData = {
      ...data,
      assignedBulkMeterId: data.assignedBulkMeterId === UNASSIGNED_BULK_METER_VALUE ? undefined : data.assignedBulkMeterId,
      branchId: !isHeadOffice && userBranchId ? userBranchId : (data.branchId === BRANCH_UNASSIGNED_VALUE ? undefined : data.branchId),
    };
    onSubmit(submissionData);
    onOpenChange(false);
  };

  const handleBulkMeterChange = (value: string | undefined) => {
    form.setValue("assignedBulkMeterId", value, { shouldDirty: true, shouldValidate: true });
  };

  const handleBranchChange = (branchIdValue: string) => {
    const selectedBranch = availableBranches.find(b => b.id === branchIdValue);
    if (selectedBranch) {
      form.setValue("branchId", selectedBranch.id);
    } else if (branchIdValue === BRANCH_UNASSIGNED_VALUE) {
      form.setValue("branchId", undefined);
    }
  };

  const xValue = form.watch("xCoordinate");
  const yValue = form.watch("yCoordinate");
  const hasCoordinates = !!(xValue && yValue);

  const openExternalMap = () => {
    if (hasCoordinates) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${xValue},${yValue}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {defaultValues ? "Update the details of the customer." : "Fill in the details to add a new customer."}
          </DialogDescription>
        </DialogHeader>        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isHeadOffice && userBranchId ? (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <Input 
                      value={availableBranches.find(b => b.id === userBranchId)?.name || "Current Branch"} 
                      readOnly 
                      disabled 
                      className="bg-slate-50 border-slate-200 text-slate-500 font-medium cursor-not-allowed" 
                    />
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
                name="assignedBulkMeterId"
                render={({ field }) => {
                  const isAssigned =
                    field.value && field.value !== UNASSIGNED_BULK_METER_VALUE;
                  const selectedBm = dynamicBulkMeters.find(
                    (bm) => bm.customerKeyNumber === field.value
                  );

                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Assign to Bulk Meter</FormLabel>
                      <Popover
                        open={isBulkMeterPickerOpen}
                        onOpenChange={(o) => {
                          setIsBulkMeterPickerOpen(o);
                          if (o) {
                            setTimeout(() => searchInputRef.current?.focus(), 80);
                          } else {
                            setBulkMeterSearch("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={isBulkMeterPickerOpen}
                              disabled={isLoadingBulkMeters}
                              className={cn(
                                "w-full h-10 px-3 justify-between font-normal text-left truncate border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
                                !isAssigned && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate flex-1">
                                {isLoadingBulkMeters ? (
                                  "Loading bulk meters..."
                                ) : isAssigned ? (
                                  selectedBm ? (
                                    <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                                      <span className="font-semibold">{selectedBm.customerKeyNumber}</span>
                                      <span className="text-muted-foreground">•</span>
                                      <span className="truncate">{selectedBm.name}</span>
                                    </span>
                                  ) : (
                                    field.value
                                  )
                                ) : (
                                  "None (Unassigned)"
                                )}
                              </span>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                {isAssigned && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBulkMeterChange(UNASSIGNED_BULK_METER_VALUE);
                                    }}
                                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-slate-900 cursor-pointer"
                                    title="Unassign bulk meter"
                                  >
                                    <X className="h-3 w-3" />
                                  </span>
                                )}
                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                              </div>
                            </Button>
                          </FormControl>
                        </PopoverTrigger>

                        <PopoverContent
                          className="w-[360px] sm:w-[420px] p-0 shadow-2xl z-[100] border-slate-200 dark:border-slate-800"
                          align="start"
                        >
                          {/* Search Header */}
                          <div className="flex items-center border-b px-3 py-2 gap-2 bg-slate-50 dark:bg-slate-900">
                            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                            <input
                              ref={searchInputRef}
                              value={bulkMeterSearch}
                              onChange={(e) => setBulkMeterSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (filteredBulkMeters.length > 0) {
                                    handleBulkMeterChange(filteredBulkMeters[0].customerKeyNumber);
                                    setIsBulkMeterPickerOpen(false);
                                    setBulkMeterSearch("");
                                  }
                                }
                              }}
                              placeholder="Search by Key (BM-...), Contract, or Name..."
                              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
                              autoComplete="off"
                            />
                            {bulkMeterSearch && (
                              <button
                                type="button"
                                onClick={() => setBulkMeterSearch("")}
                                className="text-muted-foreground hover:text-foreground p-0.5"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Options List */}
                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {/* Option: None / Unassigned */}
                            <button
                              type="button"
                              className={cn(
                                "w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between",
                                !isAssigned && "bg-blue-50/80 dark:bg-blue-950/40 font-semibold text-blue-700 dark:text-blue-300"
                              )}
                              onClick={() => {
                                handleBulkMeterChange(UNASSIGNED_BULK_METER_VALUE);
                                setIsBulkMeterPickerOpen(false);
                                setBulkMeterSearch("");
                              }}
                            >
                              <span className="italic text-muted-foreground">None (Unassigned)</span>
                              {!isAssigned && <Check className="h-4 w-4 text-blue-600" />}
                            </button>

                            {/* Filtered list */}
                            {filteredBulkMeters.length === 0 ? (
                              <div className="text-center py-6 px-4 text-xs text-muted-foreground">
                                No bulk meters match &ldquo;{bulkMeterSearch}&rdquo;.
                              </div>
                            ) : (
                              filteredBulkMeters.map((bm) => {
                                const isSelected = field.value === bm.customerKeyNumber;
                                return (
                                  <button
                                    key={bm.customerKeyNumber}
                                    type="button"
                                    className={cn(
                                      "w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-start justify-between gap-2",
                                      isSelected && "bg-blue-50/80 dark:bg-blue-950/40"
                                    )}
                                    onClick={() => {
                                      handleBulkMeterChange(bm.customerKeyNumber);
                                      setIsBulkMeterPickerOpen(false);
                                      setBulkMeterSearch("");
                                    }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("font-bold truncate text-slate-900 dark:text-slate-100", isSelected && "text-blue-700 dark:text-blue-300")}>
                                        {bm.name}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                          🔑 {bm.customerKeyNumber}
                                        </span>
                                        {bm.contractNumber && (
                                          <span className="text-slate-700 dark:text-slate-300">
                                            • Contract: <span className="font-semibold">{bm.contractNumber}</span>
                                          </span>
                                        )}
                                        {bm.meterNumber && (
                                          <span>• Meter: {bm.meterNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Footer Count */}
                          <div className="px-3 py-1.5 border-t bg-slate-50 dark:bg-slate-900 text-[10px] text-muted-foreground flex justify-between items-center">
                            <span>
                              {bulkMeterSearch
                                ? `Found ${filteredBulkMeters.length} matching`
                                : `Total: ${dynamicBulkMeters.length} bulk meters`}
                            </span>
                            <span className="italic">Type key or contract to search</span>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="customerKeyNumber" render={({ field }) => (<FormItem><div className="flex items-center justify-between"><FormLabel>Cust. Key No. <span className="text-destructive">*</span></FormLabel>{!defaultValues && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100 uppercase tracking-wider">Manual Entry</span>}</div><FormControl><Input {...field} disabled={!!defaultValues} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="instKey" render={({ field }) => (<FormItem><FormLabel>INST_KEY <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="e.g., INST-12345" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contractNumber" render={({ field }) => (<FormItem><FormLabel>Contract No. <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />

              <FormField control={form.control} name="customerType" render={({ field }) => (<FormItem><FormLabel>Customer Type <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{customerTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="bookNumber" render={({ field }) => (<FormItem><FormLabel>Book No. <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ordinal" render={({ field }) => (<FormItem><FormLabel>Ordinal <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="NUMBER_OF_DIALS" render={({ field }) => (<FormItem><FormLabel>Number of Dials</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />

              <FormField
                control={form.control}
                name="meterSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meter Size (inch) <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a size" />
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
              <FormField control={form.control} name="meterNumber" render={({ field }) => (<FormItem><FormLabel>METER_KEY <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="e.g., MET-2822965" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="previousReading" render={({ field }) => (<FormItem><FormLabel>Previous Reading <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />

              <FormField control={form.control} name="currentReading" render={({ field }) => (<FormItem><FormLabel>Current Reading <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="month" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Reading Month <span className="text-destructive">*</span></FormLabel><DatePicker date={field.value && isValid(parse(field.value, 'yyyy-MM', new Date())) ? parse(field.value, 'yyyy-MM', new Date()) : undefined} setDate={(date) => field.onChange(date ? format(date, "yyyy-MM") : "")} /><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="specificArea" render={({ field }) => (<FormItem><FormLabel>Specific Area <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />

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
                          option !== undefined && String(option).trim() !== "" ? (
                            <SelectItem key={String(option)} value={String(option)}>
                              {option}
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
                          option !== undefined && String(option).trim() !== "" ? (
                            <SelectItem key={String(option)} value={String(option)}>
                              {option}
                            </SelectItem>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="sewerageConnection" render={({ field }) => (<FormItem><FormLabel>Sewerage Conn. <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select connection" /></SelectTrigger></FormControl><SelectContent>{sewerageConnections.map(conn => (conn !== undefined && String(conn).trim() !== "" ? <SelectItem key={String(conn)} value={String(conn)}>{conn}</SelectItem> : null))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField
                control={form.control}
                name="xCoordinate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>X Coordinate (Optional)</FormLabel>
                      {hasCoordinates && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider transition-all"
                          onClick={openExternalMap}
                        >
                          <Globe className="h-3 w-3" />
                          View on Map
                        </Button>
                      )}
                    </div>
                    <FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="yCoordinate" render={({ field }) => (<FormItem><FormLabel>Y Coordinate (Optional)</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="zCoordinate" render={({ field }) => (<FormItem><FormLabel>Z Coordinate (Altitude)</FormLabel><FormControl><Input type="number" step="any" placeholder="e.g., 2300" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Customer Status <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value || "Pending Approval"}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{individualCustomerStatuses.map(status => (status !== undefined && String(status).trim() !== "" ? <SelectItem key={String(status)} value={String(status)}>{status}</SelectItem> : null))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="paymentStatus" render={({ field }) => (<FormItem><FormLabel>Payment Status <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger></FormControl><SelectContent>{paymentStatuses.map(status => (status !== undefined && String(status).trim() !== "" ? <SelectItem key={String(status)} value={String(status)}>{status}</SelectItem> : null))}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {defaultValues ? "Save Changes" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
