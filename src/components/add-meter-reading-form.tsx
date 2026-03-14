
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import * as z from "zod";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IndividualCustomer } from "@/app/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { getCurrentPosition, checkProximity, type Coordinates } from "@/lib/geo-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPin, Info, CheckCircle2, XCircle, Lock, Unlock } from "lucide-react";
import type { FaultCodeRow } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";

// Base schema for form fields
const formSchemaBase = z.object({
  meterType: z.enum(['individual_customer_meter', 'bulk_meter'], {
    required_error: "Please select a meter type.",
  }),
  entityId: z.string().min(1, "Please select a meter."),
  reading: z.coerce.number().min(0, "Reading must be a non-negative number."),
  date: z.date({
    required_error: "A date is required.",
  }),
  faultCode: z.string().optional(),
});

export type AddMeterReadingFormValues = z.infer<typeof formSchemaBase>;

interface AddMeterReadingFormProps {
  onSubmit: (values: AddMeterReadingFormValues) => void;
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  faultCodes: FaultCodeRow[];
  isLoading?: boolean;
  defaultValues?: Partial<AddMeterReadingFormValues>;
}

export function AddMeterReadingForm({ onSubmit, customers, bulkMeters, faultCodes, isLoading, defaultValues }: AddMeterReadingFormProps) {
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [isAcquiringLocation, setIsAcquiringLocation] = React.useState(false);
  const [proximityStatus, setProximityStatus] = React.useState<{ isWithinRange: boolean; distance: number } | null>(null);

  // Re-acquire location on mount or when requested
  const acquireLocation = React.useCallback(async () => {
    setIsAcquiringLocation(true);
    setLocationError(null);
    try {
      const pos = await getCurrentPosition();
      setUserLocation(pos);
    } catch (err: any) {
      setLocationError(err.message || "Could not acquire location.");
    } finally {
      setIsAcquiringLocation(false);
    }
  }, []);

  React.useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);

  // The final schema is built dynamically inside the component to include a refinement check.
  const formSchema = React.useMemo(() => {
    return formSchemaBase.refine(
      (data) => {
        let lastReading = -1;
        if (data.meterType === 'individual_customer_meter') {
          const customer = customers.find(c => c.customerKeyNumber === data.entityId);
          if (customer) lastReading = customer.currentReading;
        } else if (data.meterType === 'bulk_meter') {
          const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === data.entityId);
          if (bulkMeter) lastReading = bulkMeter.currentReading;
        }
        if (lastReading === -1) return true;
        return data.reading >= lastReading;
      },
      (data) => {
        let lastReading = 0;
        if (data.meterType === 'individual_customer_meter') {
          lastReading = customers.find(c => c.customerKeyNumber === data.entityId)?.currentReading ?? 0;
        } else {
          lastReading = bulkMeters.find(bm => bm.customerKeyNumber === data.entityId)?.currentReading ?? 0;
        }
        return {
          message: `Reading cannot be lower than the last reading (${lastReading.toFixed(2)}).`,
          path: ["reading"],
        }
      }
    );
  }, [customers, bulkMeters]);

  const form = useForm<AddMeterReadingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meterType: defaultValues?.meterType || 'individual_customer_meter',
      entityId: defaultValues?.entityId || "",
      reading: defaultValues?.reading || 0,
      date: defaultValues?.date || new Date(),
      faultCode: defaultValues?.faultCode || "",
    }
  });

  const selectedMeterType = form.watch("meterType");
  const selectedEntityId = form.watch("entityId");
  const selectedFaultCode = form.watch("faultCode");

  // Check proximity whenever location or selected meter changes
  React.useEffect(() => {
    if (!userLocation || !selectedEntityId) {
      setProximityStatus(null);
      return;
    }

    let targetCoords: Coordinates | null = null;
    if (selectedMeterType === 'individual_customer_meter') {
      const customer = customers.find(c => c.customerKeyNumber === selectedEntityId);
      if (customer?.xCoordinate && customer?.yCoordinate) {
        targetCoords = { latitude: customer.yCoordinate, longitude: customer.xCoordinate };
      }
    } else {
      const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === selectedEntityId);
      if (bulkMeter?.xCoordinate && bulkMeter?.yCoordinate) {
        targetCoords = { latitude: bulkMeter.yCoordinate, longitude: bulkMeter.xCoordinate };
      }
    }

    if (targetCoords) {
      const status = checkProximity(userLocation, targetCoords, 5); // 5 meters threshold
      setProximityStatus(status);
    } else {
      setProximityStatus(null);
    }
  }, [userLocation, selectedEntityId, selectedMeterType, customers, bulkMeters]);

  // Handle fault code selection - automatically set reading to previous reading
  React.useEffect(() => {
    if (selectedFaultCode && selectedEntityId) {
      let previousReading = 0;
      if (selectedMeterType === 'individual_customer_meter') {
        const customer = customers.find(c => c.customerKeyNumber === selectedEntityId);
        if (customer) previousReading = customer.currentReading;
      } else {
        const bulkMeter = bulkMeters.find(bm => bm.customerKeyNumber === selectedEntityId);
        if (bulkMeter) previousReading = bulkMeter.currentReading;
      }
      form.setValue("reading", previousReading);
    }
  }, [selectedFaultCode, selectedEntityId, selectedMeterType, customers, bulkMeters, form]);

  const selectedMeterInfo = React.useMemo(() => {
    if (!selectedEntityId) return null;
    if (selectedMeterType === 'individual_customer_meter') {
      return customers.find(c => c.customerKeyNumber === selectedEntityId);
    }
    return bulkMeters.find(bm => bm.customerKeyNumber === selectedEntityId);
  }, [selectedEntityId, selectedMeterType, customers, bulkMeters]);

  const availableMeters = React.useMemo(() => {
    if (selectedMeterType === 'individual_customer_meter') {
      return customers.map(c => ({
        value: c.customerKeyNumber,
        label: `${c.name} (Meter: ${c.meterNumber})`,
      }));
    }
    if (selectedMeterType === 'bulk_meter') {
      return bulkMeters.map(bm => ({
        value: bm.customerKeyNumber,
        label: `${bm.name} (Meter: ${bm.meterNumber})`,
      }));
    }
    return [];
  }, [selectedMeterType, customers, bulkMeters]);

  function handleSubmit(values: AddMeterReadingFormValues) {
    if (!proximityStatus?.isWithinRange) {
      return; // Safety check
    }
    onSubmit(values);
  }

  React.useEffect(() => {
    if (form.getFieldState('reading').isTouched) {
      form.trigger('reading');
    }
  }, [selectedEntityId, form]);

  const handleTabChange = (value: string) => {
    form.setValue('meterType', value as AddMeterReadingFormValues['meterType']);
    form.resetField('entityId');
    form.resetField('reading');
    form.clearErrors();
  };

  const isSubmitDisabled = isLoading ||
    !form.formState.isValid ||
    !proximityStatus?.isWithinRange ||
    isAcquiringLocation;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs
          defaultValue="individual_customer_meter"
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual_customer_meter">Individual Customer</TabsTrigger>
            <TabsTrigger value="bulk_meter">Bulk Meter</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Location Verification
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={acquireLocation}
              disabled={isAcquiringLocation}
              className="h-8 text-xs"
            >
              {isAcquiringLocation ? "Acquiring..." : "Refresh Location"}
            </Button>
          </div>

          {locationError ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Location Error</AlertTitle>
              <AlertDescription>
                {locationError}. Please enable location permissions to add a reading.
              </AlertDescription>
            </Alert>
          ) : isAcquiringLocation ? (
            <Alert>
              <Info className="h-4 w-4 animate-pulse" />
              <AlertDescription>Acquiring current location...</AlertDescription>
            </Alert>
          ) : proximityStatus ? (
            proximityStatus.isWithinRange ? (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>Location Verified</AlertTitle>
                <AlertDescription>
                  You are within {proximityStatus.distance.toFixed(2)}m of the meter location.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Too Far From Meter</AlertTitle>
                <AlertDescription>
                  You are {proximityStatus.distance.toFixed(2)}m away. You must be within 5m to record a reading.
                </AlertDescription>
              </Alert>
            )
          ) : selectedEntityId ? (
            <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Missing Meter Coordinates</AlertTitle>
              <AlertDescription>
                This meter does not have stored coordinates. Proximity validation cannot be performed.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Select a meter to verify your proximity.</AlertDescription>
            </Alert>
          )
          }
        </div>

        <FormField
          control={form.control}
          name="entityId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Meter</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoading || availableMeters.length === 0}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={availableMeters.length === 0 ? "No meters available for type" : "Select a meter"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableMeters.map((meter) => (
                    (meter.value !== undefined && String(meter.value).trim() !== "") ? (
                      <SelectItem key={String(meter.value)} value={String(meter.value)}>
                        {meter.label}
                      </SelectItem>
                    ) : null
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />


        {selectedMeterInfo && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Info className="h-3 w-3" /> Technical Information
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Meter Number</span>
                <span className="font-medium text-slate-900">{selectedMeterInfo.meterNumber || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Customer Key</span>
                <span className="font-medium text-slate-900">{selectedMeterInfo.customerKeyNumber}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-xs">Customer Name</span>
                <span className="font-medium text-slate-900">{selectedMeterInfo.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Category</span>
                <Badge variant="outline" className="mt-0.5">
                  {'customerType' in selectedMeterInfo ? selectedMeterInfo.customerType : selectedMeterInfo.chargeGroup}
                </Badge>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Diameter</span>
                <span className="font-medium text-slate-900">{selectedMeterInfo.meterSize}"</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-xs">Address</span>
                <span className="font-medium text-slate-900">
                  {selectedMeterInfo.subCity}, {selectedMeterInfo.woreda}, {selectedMeterInfo.specificArea}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Coordinates (Y, X)</span>
                <span className="font-medium text-slate-900">
                  {selectedMeterInfo.yCoordinate?.toFixed(6)}, {selectedMeterInfo.xCoordinate?.toFixed(6)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className={cn("space-y-6 transition-opacity duration-300", !proximityStatus?.isWithinRange && "opacity-50 pointer-events-none")}>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 pb-2 border-b">
            {!proximityStatus?.isWithinRange ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {proximityStatus?.isWithinRange ? "Form Unlocked" : "Form Locked (Proximity Required)"}
          </div>

          <FormField
            control={form.control}
            name="faultCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason of Code (Fault Code)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoading || !selectedEntityId}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a fault code (if any)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None / Normal</SelectItem>
                    {faultCodes.map((fc) => (
                      <SelectItem key={fc.code} value={fc.code}>
                        <div className="flex items-center gap-2">
                          <span>{fc.code} - {fc.description || fc.category || 'Fault'}</span>
                        </div>
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
            name="reading"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reading Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter reading value"
                    {...field}
                    disabled={isLoading || !selectedEntityId || (!!selectedFaultCode && selectedFaultCode !== 'none')}
                    className={selectedFaultCode && selectedFaultCode !== 'none' ? "bg-slate-50 font-medium text-slate-500" : ""}
                  />
                </FormControl>
                {selectedFaultCode && selectedFaultCode !== 'none' && (
                  <p className="text-xs text-blue-600 font-medium italic">
                    Reading auto-set to previous reading due to fault code.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date of Reading</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoading}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2000-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitDisabled}>
          {isLoading ? "Submitting..." : "Add Reading"}
        </Button>
      </form>
    </Form>
  );
}
