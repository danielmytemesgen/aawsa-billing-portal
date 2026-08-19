"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import * as z from "zod";
import * as React from "react";
import { useToast } from "@/hooks/use-toast";

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
import type { IndividualCustomer } from "@/app/(dashboard)/admin/individual-customers/individual-customer-types";
import type { BulkMeter } from "@/app/(dashboard)/admin/bulk-meters/bulk-meter-types";
import { getCurrentPosition, checkProximity, getGpsSignalInfo, triggerProximityHaptic, sortMetersByDistance, type Coordinates } from "@/lib/geo-utils";
import { checkDeviceHealth, type DeviceHealthStatus } from "@/lib/offline-db";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPin, Info, CheckCircle2, XCircle, Lock, Unlock, Loader2, Camera, Upload, AlertCircle, Search, Compass, BatteryCharging, HardDrive } from "lucide-react";
import type { FaultCodeRow } from "@/lib/action-types";
import { Badge } from "@/components/ui/badge";
import { upsertSpatialRecord } from "@/lib/data-store";
import { Camera as CameraIcon, X } from "lucide-react";
import { compressImage, extractImageMetadata, type ImageExifMetadata } from "@/lib/image-utils";
import { usePermissions } from "@/hooks/use-permissions";
import { canCreateMeterReadingForType } from "@/lib/meter-reading-permissions";

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
  capturedCoordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
  }).optional(),
  meterPhoto: z.string().optional(),
});

export type AddMeterReadingFormValues = z.infer<typeof formSchemaBase>;

interface AddMeterReadingFormProps {
  onSubmit: (values: AddMeterReadingFormValues) => void;
  customers: IndividualCustomer[];
  bulkMeters: BulkMeter[];
  faultCodes: FaultCodeRow[];
  isLoading?: boolean;
  defaultValues?: Partial<AddMeterReadingFormValues>;
  initialLocation?: Coordinates | null;
}

function AddMeterReadingForm({ onSubmit, customers, bulkMeters, faultCodes, isLoading, defaultValues, initialLocation }: AddMeterReadingFormProps) {
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(initialLocation || null);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [isAcquiringLocation, setIsAcquiringLocation] = React.useState(false);
  const [liveAccuracy, setLiveAccuracy] = React.useState<number | null>(null); // live GPS accuracy in meters
  const [proximityStatus, setProximityStatus] = React.useState<{ isWithinRange: boolean; distance: number; bypassed?: boolean } | null>(null);
  const [isCapturingInitialLocation, setIsCapturingInitialLocation] = React.useState(false);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [capturedPhoto, setCapturedPhoto] = React.useState<string | null>(null);
  const [photoExif, setPhotoExif] = React.useState<ImageExifMetadata | null>(null);
  const [sortByNearest, setSortByNearest] = React.useState(true);
  const [deviceHealth, setDeviceHealth] = React.useState<DeviceHealthStatus | null>(null);
  const [isBypassed, setIsBypassed] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('meter_reading_location_bypassed') === 'true';
    }
    return false;
  });

  const isFormUnlocked = isBypassed || Boolean(proximityStatus?.isWithinRange) || Boolean(locationError) || !userLocation;

  // ── Searchable meter picker state ──────────────────────────────────────────
  const [meterSearch, setMeterSearch] = React.useState("");
  const [meterPickerOpen, setMeterPickerOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const readingInputRef = React.useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const acquireLocation = React.useCallback(async () => {
    setIsAcquiringLocation(true);
    setLocationError(null);
    setLiveAccuracy(null);
    try {
      const pos = await getCurrentPosition((accuracy) => {
        // Live progress callback — updates signal quality bar while GPS locks in
        setLiveAccuracy(accuracy);
      });
      setUserLocation(pos);
      setLiveAccuracy(pos.accuracy ?? null);
    } catch (err: any) {
      setLocationError(err.message || "Could not acquire location.");
    } finally {
      setIsAcquiringLocation(false);
    }
  }, []);

  // Check device health (battery & storage usage) on mount
  React.useEffect(() => {
    checkDeviceHealth().then(status => setDeviceHealth(status)).catch(() => {});
  }, []);



  React.useEffect(() => {
    if (initialLocation) {
      setUserLocation(initialLocation);
    } else {
      acquireLocation();
    }
  }, [acquireLocation, initialLocation]);

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
        };
      }
    );
  }, [customers, bulkMeters]);

  const { hasPermission } = usePermissions();

  const canCreateBulk = React.useMemo(() => {
    return canCreateMeterReadingForType(hasPermission, 'bulk');
  }, [hasPermission]);

  const canCreateIndividual = React.useMemo(() => {
    return canCreateMeterReadingForType(hasPermission, 'individual');
  }, [hasPermission]);

  const initialMeterType = React.useMemo(() => {
    if (defaultValues?.meterType) {
      if (defaultValues.meterType === 'bulk_meter' && canCreateBulk) return 'bulk_meter';
      if (defaultValues.meterType === 'individual_customer_meter' && canCreateIndividual) return 'individual_customer_meter';
    }
    if (canCreateBulk && !canCreateIndividual) return 'bulk_meter';
    return 'individual_customer_meter';
  }, [defaultValues, canCreateBulk, canCreateIndividual]);

  const form = useForm<AddMeterReadingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meterType: initialMeterType,
      entityId: defaultValues?.entityId || "",
      reading: defaultValues?.reading || 0,
      date: defaultValues?.date || new Date(),
      faultCode: defaultValues?.faultCode || "",
      meterPhoto: undefined,
    }
  });

  const selectedMeterType = form.watch("meterType");
  const selectedEntityId = form.watch("entityId");
  const selectedFaultCode = form.watch("faultCode");
  const currentReadingValue = form.watch("reading");
  const [anomalyWarning, setAnomalyWarning] = React.useState<string | null>(null);

  const hasCurrentTypePermission = selectedMeterType === 'bulk_meter' ? canCreateBulk : canCreateIndividual;

  React.useEffect(() => {
    if (!defaultValues?.meterType) {
      if (canCreateBulk && !canCreateIndividual && selectedMeterType !== 'bulk_meter') {
        form.setValue("meterType", "bulk_meter");
      } else if (canCreateIndividual && !canCreateBulk && selectedMeterType !== 'individual_customer_meter') {
        form.setValue("meterType", "individual_customer_meter");
      }
    }
  }, [canCreateBulk, canCreateIndividual, defaultValues, selectedMeterType, form]);

  // ── Live previous reading context ──────────────────────────────────────────
  const previousReading = React.useMemo(() => {
    if (!selectedEntityId) return null;
    if (selectedMeterType === 'individual_customer_meter') {
      return customers.find(c => c.customerKeyNumber === selectedEntityId)?.currentReading ?? null;
    }
    return bulkMeters.find(bm => bm.customerKeyNumber === selectedEntityId)?.currentReading ?? null;
  }, [selectedEntityId, selectedMeterType, customers, bulkMeters]);

  const consumption = React.useMemo(() => {
    if (previousReading === null || currentReadingValue === undefined || currentReadingValue === null) return null;
    return currentReadingValue - previousReading;
  }, [currentReadingValue, previousReading]);

  // Adaptive anomaly threshold: bulk meters get a higher threshold
  const anomalyThreshold = selectedMeterType === 'bulk_meter' ? 500 : 100;

  React.useEffect(() => {
    if (!selectedEntityId || currentReadingValue === undefined || currentReadingValue === null) {
      setAnomalyWarning(null);
      return;
    }
    const usage = (currentReadingValue ?? 0) - (previousReading ?? 0);
    if (usage > anomalyThreshold && (!selectedFaultCode || selectedFaultCode === 'none')) {
      setAnomalyWarning(`Exceptionally high usage (${usage.toFixed(1)} m³). Please double-check the meter dial.`);
    } else {
      setAnomalyWarning(null);
    }
  }, [currentReadingValue, selectedEntityId, previousReading, selectedFaultCode, anomalyThreshold]);

  const handleBypassLocation = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('meter_reading_location_bypassed', 'true');
    }
    setIsBypassed(true);
    setLocationError(null);
    setProximityStatus({ isWithinRange: true, distance: 0, bypassed: true });
  }, []);

  React.useEffect(() => {
    if (isBypassed) {
      setProximityStatus({ isWithinRange: true, distance: 0, bypassed: true });
      return;
    }
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
      const status = checkProximity(userLocation, targetCoords, 15);
      if (status.isWithinRange && !proximityStatus?.isWithinRange) {
        triggerProximityHaptic();
      }
      setProximityStatus(status);
      setIsCapturingInitialLocation(false);
      form.setValue('capturedCoordinates', undefined);
    } else {
      setProximityStatus(null);
    }
  }, [userLocation, selectedEntityId, selectedMeterType, customers, bulkMeters, form, proximityStatus?.isWithinRange, isBypassed]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const [compressedDataUrl, metadata] = await Promise.all([
        compressImage(file),
        extractImageMetadata(file)
      ]);
      setCapturedPhoto(compressedDataUrl);
      setPhotoExif(metadata);
      form.setValue('meterPhoto', compressedDataUrl);
      toast({
        title: "Photo Attached",
        description: metadata.hasLocationData
          ? "Meter proof photo attached with EXIF GPS location verified."
          : "Meter proof photo compressed and attached."
      });
    } catch (error) {
      toast({ title: "Error", description: "Could not process photo file.", variant: "destructive" });
    } finally {
      setIsCompressing(false);
    }
  };

  const removePhoto = () => {
    setCapturedPhoto(null);
    form.setValue('meterPhoto', undefined);
  };

  const handleCaptureInitialLocation = async () => {
    if (userLocation && selectedEntityId) {
      setIsSaving(true);
      try {
        const entityType = selectedMeterType === 'individual_customer_meter' ? 'individual_customer' : 'bulk_meter';
        const result = await upsertSpatialRecord(selectedEntityId, entityType, userLocation);
        if (result.success) {
          setIsCapturingInitialLocation(true);
          setProximityStatus({ isWithinRange: true, distance: 0 });
          toast({ title: "Position Captured", description: "Current location saved as meter position." });
        } else {
          toast({ title: "Save Failed", description: result.message || "Could not save meter position.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    } else {
      toast({ title: "Action unavailable", description: "Please acquire location and select a meter first.", variant: "destructive" });
    }
  };

  React.useEffect(() => {
    if (selectedFaultCode && selectedEntityId && previousReading !== null) {
      form.setValue("reading", previousReading);
    }
  }, [selectedFaultCode, selectedEntityId, previousReading, form]);

  const selectedMeterInfo = React.useMemo(() => {
    if (!selectedEntityId) return null;
    if (selectedMeterType === 'individual_customer_meter') {
      return customers.find(c => c.customerKeyNumber === selectedEntityId);
    }
    return bulkMeters.find(bm => bm.customerKeyNumber === selectedEntityId);
  }, [selectedEntityId, selectedMeterType, customers, bulkMeters]);

  // ── Searchable & Distance-Sorted meter list ──────────────────────────────
  const allMeters = React.useMemo(() => {
    let list: Array<{ value: string; label: string; sub?: string; address: string; xCoordinate?: number | null; yCoordinate?: number | null; distanceMeters?: number }> = [];

    if (selectedMeterType === 'individual_customer_meter') {
      list = customers.map(c => ({
        value: c.customerKeyNumber,
        label: c.name,
        sub: c.meterNumber,
        address: [c.subCity, c.woreda].filter(Boolean).join(', '),
        xCoordinate: c.xCoordinate,
        yCoordinate: c.yCoordinate,
      }));
    } else {
      list = bulkMeters.map(bm => ({
        value: bm.customerKeyNumber,
        label: bm.name,
        sub: bm.meterNumber,
        address: [bm.subCity, bm.woreda].filter(Boolean).join(', '),
        xCoordinate: bm.xCoordinate,
        yCoordinate: bm.yCoordinate,
      }));
    }

    if (sortByNearest && userLocation) {
      return sortMetersByDistance(list, userLocation);
    }
    return list;
  }, [selectedMeterType, customers, bulkMeters, sortByNearest, userLocation]);

  const filteredMeters = React.useMemo(() => {
    const q = meterSearch.trim().toLowerCase();
    if (!q) return allMeters.slice(0, 80); // show first 80 when no search
    return allMeters.filter(m =>
      m.label.toLowerCase().includes(q) ||
      String(m.sub || '').toLowerCase().includes(q) ||
      String(m.value || '').toLowerCase().includes(q) ||
      m.address.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [allMeters, meterSearch]);

  function handleSubmit(values: AddMeterReadingFormValues) {
    if (!hasCurrentTypePermission) {
      toast({ title: "Permission Denied", description: "You do not have permission to submit this reading.", variant: "destructive" });
      return;
    }
    if (!proximityStatus?.isWithinRange) return;
    const finalValues = {
      ...values,
      capturedCoordinates: userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy
      } : undefined
    };
    onSubmit(finalValues);
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
    form.resetField('capturedCoordinates');
    setIsCapturingInitialLocation(false);
    setMeterSearch("");
    form.clearErrors();
  };

  const photoRequired = false;
  const photoMissing = false;

  const isSubmitDisabled = isLoading ||
    !form.formState.isValid ||
    !proximityStatus?.isWithinRange ||
    isAcquiringLocation ||
    isCompressing ||
    photoMissing ||
    !hasCurrentTypePermission;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">

        {/* ── Meter Type Tabs ── */}
        <Tabs
          value={selectedMeterType}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual_customer_meter" disabled={!canCreateIndividual}>
              Individual Customer {!canCreateIndividual && "🔒"}
            </TabsTrigger>
            <TabsTrigger value="bulk_meter" disabled={!canCreateBulk}>
              Bulk Meter {!canCreateBulk && "🔒"}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Permission Alert Banner ── */}
        {!hasCurrentTypePermission && (
          <Alert variant="destructive" className="py-2.5 px-3.5 text-xs flex items-center gap-2 rounded-lg border-red-200 bg-red-50 text-red-900">
            <Lock className="h-4 w-4 shrink-0 text-red-600" />
            <div>
              <AlertTitle className="text-xs font-bold mb-0.5">Permission Restricted</AlertTitle>
              <AlertDescription className="text-[11px] text-red-700">
                You do not have permission to create {selectedMeterType === 'bulk_meter' ? 'Bulk Meter' : 'Individual Customer'} readings.
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* ── Searchable Meter Picker ── */}
        <FormField
          control={form.control}
          name="entityId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                <span>Select Meter</span>
                {allMeters.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">{allMeters.length} available</span>
                )}
              </FormLabel>
              <Popover
                open={meterPickerOpen}
                onOpenChange={(o) => {
                  setMeterPickerOpen(o);
                  if (o) setTimeout(() => searchInputRef.current?.focus(), 50);
                  else setMeterSearch("");
                }}
              >
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={meterPickerOpen}
                      disabled={isLoading || allMeters.length === 0}
                      className={cn(
                        "w-full h-11 justify-between font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value
                        ? (() => {
                          const m = allMeters.find(x => x.value === field.value);
                          return m ? `${m.label} — ${m.sub}` : field.value;
                        })()
                        : allMeters.length === 0
                        ? "No meters available"
                        : "Search and select a meter…"
                      }
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[440px] p-0 shadow-xl" align="start">
                  {/* Search box */}
                  <div className="flex items-center border-b px-3 py-2 gap-2">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      ref={searchInputRef}
                      value={meterSearch}
                      onChange={e => setMeterSearch(e.target.value)}
                      placeholder="Search by name, meter no., or address…"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      autoComplete="off"
                    />
                    {meterSearch && (
                      <button type="button" onClick={() => setMeterSearch("")} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Results */}
                  <div className="max-h-64 overflow-y-auto">
                    {filteredMeters.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-6">No meters match your search.</p>
                    ) : (
                      filteredMeters.map(m => (
                        <button
                          key={String(m.value)}
                          type="button"
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-start gap-3",
                            field.value === m.value && "bg-blue-50 hover:bg-blue-50"
                          )}
                          onClick={() => {
                            field.onChange(String(m.value));
                            setMeterPickerOpen(false);
                            setMeterSearch("");
                            // Auto-focus reading field after meter selection
                            setTimeout(() => readingInputRef.current?.focus(), 80);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-semibold truncate", field.value === m.value && "text-blue-700")}>{m.label}</p>
                            <p className="text-xs text-muted-foreground truncate">M# {m.sub} · {m.address}</p>
                          </div>
                          {field.value === m.value && (
                            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  {!meterSearch && allMeters.length > 80 && (
                    <p className="text-xs text-center text-muted-foreground py-2 border-t">
                      Showing first 80 — type to search all {allMeters.length}
                    </p>
                  )}
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Previous Reading Context Panel ── */}
        {selectedMeterInfo && previousReading !== null && (
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Meter Info</span>
              <Badge variant="outline" className="text-xs">
                {'customerType' in selectedMeterInfo ? selectedMeterInfo.customerType : selectedMeterInfo.chargeGroup}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-white border border-slate-200 px-2 py-2">
                <p className="text-[10px] text-slate-500 font-medium">Customer Key</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{selectedMeterInfo.customerKeyNumber}</p>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 px-2 py-2">
                <p className="text-[10px] text-slate-500 font-medium">Meter #</p>
                <p className="text-xs font-bold text-slate-700 mt-1 break-all">{selectedMeterInfo.meterNumber || 'N/A'}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              📍 {selectedMeterInfo.subCity}, {selectedMeterInfo.woreda}, {selectedMeterInfo.specificArea}
            </p>
          </div>
        )}

        {/* ── Device Health Safety Alert ── */}
        {deviceHealth && (deviceHealth.isLowBatteryWarning || deviceHealth.isHighStorageWarning) && (
          <Alert className="bg-amber-50 border-amber-300 text-amber-900 py-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <AlertTitle className="text-xs font-bold">Device Health Warning</AlertTitle>
            <AlertDescription className="text-[11px] space-y-1 mt-1">
              {deviceHealth.isLowBatteryWarning && (
                <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <BatteryCharging className="h-3.5 w-3.5 text-amber-600" />
                  Battery low ({deviceHealth.batteryLevelPct}%). Plug in device before starting a long route.
                </p>
              )}
              {deviceHealth.isHighStorageWarning && (
                <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <HardDrive className="h-3.5 w-3.5 text-amber-600" />
                  Local storage usage high ({deviceHealth.storageUsageMb} MB). Sync pending items to free up space.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Location Verification ── */}
        <div className="space-y-3">
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
              {isAcquiringLocation ? "Acquiring..." : "Refresh"}
            </Button>
          </div>

          {locationError ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Location Error</AlertTitle>
              <AlertDescription className="text-xs space-y-2">
                <p>{locationError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBypassLocation}
                  className="w-full bg-white text-red-700 border-red-200 hover:bg-red-50 font-bold text-xs"
                >
                  <Unlock className="mr-2 h-4 w-4" /> Bypass (Indoor / Offline)
                </Button>
              </AlertDescription>
            </Alert>
          ) : isBypassed ? (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/80 border-blue-200 text-blue-900 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <Unlock className="h-4 w-4 text-blue-600" />
                <span>Bypassed (Indoor / Offline Mode)</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-blue-700 underline p-0"
                onClick={() => {
                  if (typeof window !== 'undefined') localStorage.removeItem('meter_reading_location_bypassed');
                  setIsBypassed(false);
                  acquireLocation();
                }}
              >
                Re-check GPS
              </Button>
            </div>
          ) : isAcquiringLocation ? (
            <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    {liveAccuracy !== null ? 'Improving GPS accuracy…' : 'Acquiring GPS signal…'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {liveAccuracy !== null
                      ? `Current accuracy: ±${Math.round(liveAccuracy)} m — ${getGpsSignalInfo(liveAccuracy).label}`
                      : 'Waiting for satellite lock…'}
                  </p>
                </div>
                {liveAccuracy !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    getGpsSignalInfo(liveAccuracy).color
                  } border border-current bg-white`}>
                    {getGpsSignalInfo(liveAccuracy).label}
                  </span>
                )}
              </div>
              {/* Live GPS signal strength bar */}
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    liveAccuracy !== null ? getGpsSignalInfo(liveAccuracy).bgColor : 'bg-blue-300 animate-pulse'
                  }`}
                  style={{ width: liveAccuracy !== null ? `${getGpsSignalInfo(liveAccuracy).progress}%` : '30%' }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Step outdoors or near a window for the best signal.
              </p>
            </div>
          ) : proximityStatus ? (
            <div className="space-y-2">
              <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={cn(
                    "h-full transition-all duration-700 ease-out",
                    proximityStatus.isWithinRange ? "bg-emerald-500" : proximityStatus.distance < 20 ? "bg-amber-400" : "bg-blue-400"
                  )}
                  style={{ width: `${Math.max(5, Math.min(100, (1 - (proximityStatus.distance / 50)) * 100))}%` }}
                />
              </div>
              <div className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border text-sm transition-all",
                proximityStatus.isWithinRange
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              )}>
                {proximityStatus.isWithinRange
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  : <MapPin className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
                }
                <div className="flex-1">
                  <p className="text-xs font-bold">
                    {proximityStatus.bypassed ? "Bypassed (Offline)" :
                      proximityStatus.isWithinRange ? "Ready to Record" :
                      `Move ${Math.round(Math.max(0, proximityStatus.distance - 5))}m closer`}
                  </p>
                  <p className="text-[10px] opacity-70">{proximityStatus.distance.toFixed(1)}m from meter</p>
                </div>
                {!proximityStatus.isWithinRange && !proximityStatus.bypassed && (
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-[10px] text-amber-600 font-semibold"
                    onClick={() => setProximityStatus({ isWithinRange: true, distance: proximityStatus.distance, bypassed: true })}
                  >
                    Bypass
                  </Button>
                )}
              </div>
            </div>
          ) : selectedEntityId ? (
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-xs font-bold uppercase">New Meter — GPS Setup Required</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-[11px]">Stand next to the meter and capture its GPS position, or bypass location.</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCaptureInitialLocation}
                    disabled={!userLocation || isSaving}
                    className="flex-1 bg-white text-blue-700 border-blue-300 hover:bg-blue-50 font-bold text-xs"
                  >
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                    {isSaving ? "Saving…" : "Set Meter GPS"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBypassLocation}
                    className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 font-bold text-xs"
                  >
                    <Unlock className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                    Bypass
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="p-3 border-2 border-dashed rounded-lg bg-slate-50/50 flex items-center justify-center gap-2 text-slate-400">
              <MapPin className="h-4 w-4" />
              <p className="text-xs font-medium">Select a meter to begin verification</p>
            </div>
          )}
        </div>

        {/* ── Reading Fields (unlocked if proximity OK, bypassed, location error, or new meter) ── */}
        <div className={cn("space-y-5 transition-opacity duration-300", !isFormUnlocked && "opacity-40 pointer-events-none")}>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 pb-1 border-b">
            {isFormUnlocked ? <Unlock className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5" />}
            {isFormUnlocked ? "Form unlocked — ready to enter reading" : "Form locked — proximity check required"}
          </div>

          {/* Fault Code */}
          <FormField
            control={form.control}
            name="faultCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fault Code <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoading || !selectedEntityId}>
                  <FormControl>
                    <SelectTrigger className="h-11 sm:h-10">
                      <SelectValue placeholder="None / Normal reading" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None / Normal</SelectItem>
                    {faultCodes.map((fc) => (
                      <SelectItem key={fc.code} value={fc.code}>
                        {fc.code} — {fc.description || fc.category || 'Fault'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Reading Value — prominent, auto-focused */}
          <FormField
            control={form.control}
            name="reading"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  <span>Reading Value (m³)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Enter current meter reading"
                    {...field}
                    ref={(el) => {
                      // Merge react-hook-form ref + our focus ref
                      field.ref(el);
                      (readingInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                    }}
                    disabled={isLoading || !selectedEntityId || (!!selectedFaultCode && selectedFaultCode !== 'none')}
                    className={cn(
                      "h-14 text-xl font-bold tracking-wide",
                      selectedFaultCode && selectedFaultCode !== 'none' ? "bg-slate-50 text-slate-400" : "",
                      consumption !== null && consumption < 0 ? "border-rose-400 focus-visible:ring-rose-400" : "",
                      consumption !== null && consumption > anomalyThreshold ? "border-amber-400 focus-visible:ring-amber-400" : "",
                    )}
                    onKeyDown={(e) => {
                      // Enter key submits if form is valid
                      if (e.key === 'Enter' && !isSubmitDisabled) {
                        e.preventDefault();
                        form.handleSubmit(handleSubmit)();
                      }
                    }}
                  />
                </FormControl>
                {selectedFaultCode && selectedFaultCode !== 'none' && (
                  <p className="text-xs text-blue-600 font-medium italic">
                    Auto-set to previous reading due to fault code.
                  </p>
                )}
                {anomalyWarning && (
                  <Alert className="mt-2 bg-amber-50 text-amber-900 border-amber-200 py-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 text-xs font-bold">Anomaly Detected</AlertTitle>
                    <AlertDescription className="text-amber-700 text-xs">{anomalyWarning}</AlertDescription>
                  </Alert>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of Reading */}
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
                        variant="outline"
                        className={cn(
                          "w-full h-11 sm:h-10 pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isLoading}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Photo capture */}
          <div className={cn(
            "space-y-2 rounded-xl p-3 transition-all duration-300",
            photoMissing
              ? "border-2 border-rose-400 bg-rose-50/60"
              : photoRequired && capturedPhoto
              ? "border-2 border-emerald-400 bg-emerald-50/40"
              : "border border-transparent"
          )}>
            <div className="flex items-center justify-between">
              <FormLabel className="font-semibold text-slate-700">
                Meter Proof Photo <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </FormLabel>
              {capturedPhoto && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Photo attached
                </span>
              )}
            </div>



            {!capturedPhoto ? (
              <div className="grid grid-cols-2 gap-2">
                <input ref={cameraInputRef} id="camera-photo-upload" name="camera-photo-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={isLoading || !selectedEntityId || isCompressing} />
                <input ref={fileInputRef} id="file-photo-upload" name="file-photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isLoading || !selectedEntityId || isCompressing} />
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-20 border-dashed flex flex-col gap-1.5 rounded-xl transition-all",
                    photoMissing
                      ? "border-rose-400 bg-white hover:bg-rose-50 hover:border-rose-500"
                      : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/30"
                  )}
                  disabled={isLoading || !selectedEntityId || isCompressing}
                  onClick={async () => {
                    let hasCamera = true;
                    if (typeof window !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
                      try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        hasCamera = devices.some(d => d.kind === 'videoinput');
                      } catch { /* ignore */ }
                    }
                    if (!hasCamera) {
                      toast({ title: "Camera Not Detected", description: "Use 'Upload File' instead.", variant: "destructive" });
                    } else {
                      cameraInputRef.current?.click();
                    }
                  }}
                >
                  {isCompressing ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : <CameraIcon className={cn("h-6 w-6", photoMissing ? "text-rose-500" : "text-blue-600")} />}
                  <span className={cn("text-xs font-semibold", photoMissing ? "text-rose-600" : "text-slate-600")}>Camera</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-20 border-dashed flex flex-col gap-1.5 rounded-xl transition-all",
                    photoMissing
                      ? "border-rose-400 bg-white hover:bg-rose-50 hover:border-rose-500"
                      : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30"
                  )}
                  disabled={isLoading || !selectedEntityId || isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isCompressing ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : <Upload className={cn("h-6 w-6", photoMissing ? "text-rose-500" : "text-indigo-600")} />}
                  <span className={cn("text-xs font-semibold", photoMissing ? "text-rose-600" : "text-slate-600")}>Upload File</span>
                </Button>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
                <img src={capturedPhoto} alt="Meter proof" className="w-full h-48 object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-white text-xs font-semibold">Proof photo attached</span>
                  </div>
                  {photoExif?.hasLocationData && (
                    <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> EXIF GPS Verified
                    </Badge>
                  )}
                </div>
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md" onClick={removePhoto}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Submit ── */}
        <Button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full h-12 font-bold text-base text-white shadow-md transition-all bg-emerald-600 hover:bg-emerald-700"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
          ) : (
            <><CheckCircle2 className="mr-2 h-4 w-4" /> Save Reading</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Tip: Press <kbd className="px-1.5 py-0.5 rounded border text-xs bg-slate-100">Enter</kbd> in the reading field to submit
        </p>
      </form>
    </Form>
  );
}

export { AddMeterReadingForm };
