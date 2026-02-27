

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LibraryBig, ListChecks, PlusCircle, RotateCcw, DollarSign, Percent, Copy, Lock, Edit2, Trash2 } from "lucide-react";
import type { TariffTier, TariffInfo, SewerageTier } from "@/lib/billing-calculations";
import {
  getTariff, initializeTariffs, subscribeToTariffs, updateTariff, addTariff
} from "@/lib/data-store";
import type { CustomerType } from "@/lib/billing";
import type { TariffRow } from "@/lib/actions";
import { TariffRateTable, type DisplayTariffRate } from "./tariff-rate-table";
import { TariffFormDialog, type TariffFormValues } from "./tariff-form-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MeterRentDialog } from "./meter-rent-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { FeeEditDialog } from "./fee-edit-dialog";
import { AdditionalFeeDialog } from "./additional-fee-dialog";
import { AdditionalFee } from "@/lib/billing-calculations";
import { PenaltyDialog } from "./penalty-dialog";

const mapTariffTierToDisplay = (tier: TariffTier | SewerageTier, index: number, prevTier?: TariffTier | SewerageTier): DisplayTariffRate => {
  // Coerce tier.limit to a numeric value or numeric Infinity for display logic.
  const limitValue: number | typeof Infinity = (tier.limit === 'Infinity' || tier.limit === Infinity) ? Infinity : Number(tier.limit);

  let minConsumption: number;
  if (index === 0) {
    minConsumption = 1;
  } else if (prevTier) {
    const prevLimit = (prevTier.limit === 'Infinity' || prevTier.limit === Infinity) ? Infinity : Number(prevTier.limit);
    minConsumption = prevLimit === Infinity ? Infinity : Math.floor(prevLimit) + 1;
  } else {
    minConsumption = 1;
  }

  const isInfinity = limitValue === Infinity;
  const maxConsumptionDisplay = isInfinity ? 'Above' : String(Math.floor(limitValue as number));
  const minConsumptionDisplay = minConsumption === Infinity ? 'N/A' : String(minConsumption);

  const prevLimitForDesc = prevTier ? Math.floor(((prevTier.limit === 'Infinity' || prevTier.limit === Infinity) ? Infinity : Number(prevTier.limit)) as number) : 0;
  const description = isInfinity
    ? `Tier ${index + 1}: Above ${prevLimitForDesc} m³`
    : `Tier ${index + 1}: ${minConsumptionDisplay} - ${maxConsumptionDisplay} m³`;

  return {
    id: `tier-${index}-${tier.rate}-${String(tier.limit)}`,
    description,
    minConsumption: minConsumptionDisplay,
    maxConsumption: maxConsumptionDisplay,
    rate: Number(tier.rate),
    originalLimit: limitValue,
    originalRate: Number(tier.rate),
  };
};

// Normalize tiers stored in different shapes (array, object with numeric keys,
// JSON string, single object). Coerce numeric strings to numbers and map
// special Infinity representations to the string "Infinity" so downstream
// logic can detect it.
const normalizeTiers = (raw: any): Array<TariffTier | SewerageTier> => {
  if (!raw) return [];

  // If it's already an array, clone it
  if (Array.isArray(raw)) {
    return raw.map((t) => normalizeTierItem(t));
  }

  // If it's a string, try to parse JSON
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((t: any) => normalizeTierItem(t));
      return [normalizeTierItem(parsed)];
    } catch (e) {
      // not JSON — cannot normalize
      return [];
    }
  }

  // If it's an object with numeric keys (like {0: {...}, 1: {...}}), take values
  if (typeof raw === 'object') {
    // If it's already a tier-like object (has rate/limit), wrap into array
    if ('rate' in raw || 'limit' in raw) {
      return [normalizeTierItem(raw)];
    }

    try {
      const vals = Object.values(raw || {});
      if (vals.length > 0) return vals.map((t) => normalizeTierItem(t));
    } catch (e) {
      return [];
    }
  }

  return [];
};

const normalizeTierItem = (t: any): any => {
  if (!t || typeof t !== 'object') return t;

  const out: any = { ...t };
  // Normalize limit
  if (out.limit === null || out.limit === undefined) {
    out.limit = 0;
  }
  if (typeof out.limit === 'string') {
    const s = out.limit.trim();
    if (s === 'Infinity' || s.toLowerCase() === 'infinity' || s.toLowerCase() === 'above') {
      out.limit = Infinity;
    } else if (!isNaN(Number(s))) {
      out.limit = Number(s);
    }
  }
  if (typeof out.limit === 'number' && !Number.isFinite(out.limit)) {
    out.limit = Infinity;
  }

  // Normalize rate
  if (typeof out.rate === 'string') {
    const r = out.rate.trim();
    if (!isNaN(Number(r))) out.rate = Number(r);
  }

  return out;
};

const getDisplayTiersFromData = (tariffInfo: TariffInfo | null | undefined, tierType: 'water' | 'sewerage' = 'water'): DisplayTariffRate[] => {
  if (!tariffInfo) return [];

  const raw = tierType === 'sewerage' ? tariffInfo.sewerage_tiers : tariffInfo.tiers;
  const tiersToMap = normalizeTiers(raw);
  if (!tiersToMap || tiersToMap.length === 0) return [];

  let previousTier: TariffTier | SewerageTier | undefined;
  return tiersToMap.map((tier, index) => {
    const displayTier = mapTariffTierToDisplay(tier, index, previousTier);
    previousTier = tier as any;
    return displayTier;
  });
};

const generateYearOptions = () => {
  const years = [];
  for (let i = 2021; i <= 2050; i++) {
    years.push(i);
  }
  return years;
};


export default function TariffManagementPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [currentEffectiveDate, setCurrentEffectiveDate] = React.useState<string>("2021-01-01");
  const [currentTariffType, setCurrentTariffType] = React.useState<'Domestic' | 'Non-domestic' | 'rental Non domestic' | 'rental domestic'>('Domestic');
  const [allTariffs, setAllTariffs] = React.useState<TariffRow[]>([]);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  const [editingTierType, setEditingTierType] = React.useState<'water' | 'sewerage' | null>(null);
  const [editingRate, setEditingRate] = React.useState<DisplayTariffRate | null>(null);

  const [rateToDelete, setRateToDelete] = React.useState<{ tier: DisplayTariffRate, type: 'water' | 'sewerage' } | null>(null);

  const [isMeterRentDialogOpen, setIsMeterRentDialogOpen] = React.useState(false);
  const [isAdditionalFeeDialogOpen, setIsAdditionalFeeDialogOpen] = React.useState(false);
  const [editingAdditionalFee, setEditingAdditionalFee] = React.useState<{ fee: AdditionalFee, index: number } | null>(null);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = React.useState(false);
  const [feeDialogConfig, setFeeDialogConfig] = React.useState<{
    title: string;
    description: string;
    label: string;
    fieldName: keyof TariffInfo;
    defaultValue: number;
    isPercentage: boolean;
  } | null>(null);
  const [isPenaltyDialogOpen, setIsPenaltyDialogOpen] = React.useState(false);

  // Get unique effective dates for the current tariff type
  const availableDates = React.useMemo(() => {
    const dates = allTariffs
      .filter(t => t.customer_type === currentTariffType && t.effective_date)
      .map(t => t.effective_date)
      .sort((a, b) => b.localeCompare(a));
    return Array.from(new Set(dates));
  }, [allTariffs, currentTariffType]);

  // If currentEffectiveDate is not in availableDates, pick the latest one
  React.useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(currentEffectiveDate)) {
      setCurrentEffectiveDate(availableDates[0]);
    }
  }, [availableDates, currentEffectiveDate]);

  const activeTariffInfo = React.useMemo(() => {
    const rawTariff = allTariffs.find(t => t.customer_type === currentTariffType && t.effective_date === currentEffectiveDate);
    if (!rawTariff) return null;
    return getTariff(rawTariff.customer_type as CustomerType, rawTariff.effective_date);
  }, [allTariffs, currentTariffType, currentEffectiveDate]);

  const activeWaterTiers = activeTariffInfo ? getDisplayTiersFromData(activeTariffInfo, 'water') : [];
  const activeSewerageTiers = activeTariffInfo ? getDisplayTiersFromData(activeTariffInfo, 'sewerage') : [];

  const isLatestTariff = availableDates.length > 0 && currentEffectiveDate === availableDates[0];
  const canUpdateTariffs = hasPermission('tariffs_update') && isLatestTariff;

  React.useEffect(() => {
    setIsDataLoading(true);
    initializeTariffs().then((tariffs) => {
      setAllTariffs(tariffs as any); // Type assertion needed for now
      setIsDataLoading(false);
    });

    const unsubscribe = subscribeToTariffs(setAllTariffs as any);
    return () => unsubscribe();
  }, []);

  const handleTierUpdate = async (newTiers: (TariffTier | SewerageTier)[], type: 'water' | 'sewerage') => {
    if (!activeTariffInfo) return;

    const newTariffInfo: Partial<TariffInfo> = type === 'water'
      ? { tiers: newTiers as TariffTier[] }
      : { sewerage_tiers: newTiers as SewerageTier[] };

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, newTariffInfo as any);
    if (result.success) {
      toast({ title: "Tariff Updated", description: `${currentTariffType} ${type} tariff rates effective ${currentEffectiveDate} have been saved.` });
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };


  const handleAddTier = (type: 'water' | 'sewerage') => {
    setEditingRate(null);
    setEditingTierType(type);
  };

  const handleEditTier = (rate: DisplayTariffRate, type: 'water' | 'sewerage') => {
    setEditingRate(rate);
    setEditingTierType(type);
  };

  const handleDeleteTier = (rate: DisplayTariffRate, type: 'water' | 'sewerage') => {
    setRateToDelete({ tier: rate, type });
  };

  const confirmDelete = () => {
    if (rateToDelete && activeTariffInfo) {
      const tiersToUpdate = rateToDelete.type === 'water' ? activeWaterTiers : activeSewerageTiers;
      const newRatesList = tiersToUpdate
        .filter(r => r.id !== rateToDelete.tier.id)
        .map(dt => ({ rate: dt.originalRate, limit: dt.originalLimit }))
        .sort((a, b) => (a.limit as number) - (b.limit as number));

      handleTierUpdate(newRatesList, rateToDelete.type);
      toast({ title: `Tariff Tier Deleted`, description: `Tier "${rateToDelete.tier.description}" has been removed.` });
      setRateToDelete(null);
    }
  };

  const handleSubmitTierForm = (data: TariffFormValues) => {
    if (!editingTierType) return;
    const newRateValue = parseFloat(data.rate);
    const newMaxConsumptionValue = data.maxConsumption === "Infinity" ? Infinity : parseFloat(data.maxConsumption);

    let updatedTiers: (TariffTier | SewerageTier)[];
    const tiersToUpdate = editingTierType === 'water' ? activeWaterTiers : activeSewerageTiers;

    if (editingRate) {
      updatedTiers = tiersToUpdate.map(r =>
        r.id === editingRate.id
          ? { rate: newRateValue, limit: newMaxConsumptionValue }
          : { rate: r.originalRate, limit: r.originalLimit }
      );
    } else {
      updatedTiers = [
        ...tiersToUpdate.map(r => ({ rate: r.originalRate, limit: r.originalLimit })),
        { rate: newRateValue, limit: newMaxConsumptionValue }
      ];
    }

    updatedTiers.sort((a, b) => (a.limit as number) - (b.limit as number));
    handleTierUpdate(updatedTiers, editingTierType);

    setEditingTierType(null);
    setEditingRate(null);
  };

  const handleUpdateMeterRent = async (newPrices: { [key: string]: number }) => {
    if (!activeTariffInfo) {
      toast({ variant: "destructive", title: "Error", description: "No active tariff selected to save meter rents." });
      return;
    }

    // coerce values to numbers (form returns numbers but be defensive)
    const normalizedPrices: { [key: string]: number } = Object.entries(newPrices).reduce((acc, [k, v]) => {
      const num = typeof v === 'number' ? v : Number(v);
      acc[k] = Number.isFinite(num) ? num : 0;
      return acc;
    }, {} as { [key: string]: number });

    const updatePayload: Partial<TariffInfo> = {
      meter_rent_prices: normalizedPrices,
    };

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, updatePayload as any);

    if (result.success) {
      toast({ title: "Meter Rent Prices Updated", description: `New prices for ${currentEffectiveDate} have been saved.` });
      setIsMeterRentDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const handleOpenAdditionalFeeDialog = (fee?: AdditionalFee, index?: number) => {
    setEditingAdditionalFee(fee !== undefined && index !== undefined ? { fee, index } : null);
    setIsAdditionalFeeDialogOpen(true);
  };

  const handleUpdateAdditionalFee = async (fee: AdditionalFee) => {
    if (!activeTariffInfo) return;

    let updatedFees = [...(activeTariffInfo.additional_fees || [])];
    if (editingAdditionalFee !== null) {
      updatedFees[editingAdditionalFee.index] = fee;
    } else {
      updatedFees.push(fee);
    }

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, {
      additional_fees: updatedFees
    } as any);

    if (result.success) {
      toast({
        title: editingAdditionalFee ? "Fee Updated" : "Fee Added",
        description: `Successfully ${editingAdditionalFee ? "updated" : "added"} the additional fee "${fee.name}".`
      });
      setIsAdditionalFeeDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Operation Failed", description: result.message });
    }
  };

  const handleDeleteAdditionalFee = async (index: number) => {
    if (!activeTariffInfo) return;

    const feeToDelete = activeTariffInfo.additional_fees[index];
    const updatedFees = activeTariffInfo.additional_fees.filter((_, i) => i !== index);

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, {
      additional_fees: updatedFees
    } as any);

    if (result.success) {
      toast({ title: "Fee Deleted", description: `Successfully removed the additional fee "${feeToDelete.name}".` });
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
  };

  const handleOpenFeeDialog = (fieldName: keyof TariffInfo, title: string, isPercentage: boolean = true) => {
    if (!activeTariffInfo) return;

    let defaultValue = activeTariffInfo[fieldName] as number;
    if (isPercentage) {
      defaultValue = defaultValue * 100; // Convert to percentage for display
    }

    setFeeDialogConfig({
      title: `Edit ${title}`,
      description: `Adjust the ${title} value for ${currentTariffType} tariffs effective ${currentEffectiveDate}.`,
      label: title,
      fieldName,
      defaultValue,
      isPercentage,
    });
    setIsFeeDialogOpen(true);
  };

  const handleUpdateFee = async (fieldName: keyof TariffInfo, value: number, isPercentage: boolean) => {
    if (!activeTariffInfo) return;

    let finalValue = value;
    if (isPercentage) {
      finalValue = value / 100; // Convert back to decimal for storage
    }

    const updatePayload: Partial<TariffInfo> = {
      [fieldName]: finalValue,
    };

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, updatePayload as any);

    if (result.success) {
      toast({ title: "Fee Updated", description: `${feeDialogConfig?.title} has been updated.` });
      setIsFeeDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const handleResetFee = async (fieldName: keyof TariffInfo, feeName: string) => {
    if (!activeTariffInfo) return;

    // Determine a sensible default for resetting. For percentages, 0. For thresholds, 0.
    let resetValue: number;
    switch (fieldName) {
      case 'maintenance_percentage':
      case 'sanitation_percentage':
      case 'vat_rate':
        resetValue = 0; // Or a system default if one exists
        break;
      case 'domestic_vat_threshold_m3':
        resetValue = 0;
        break;
      default:
        resetValue = 0;
    }

    const updatePayload: Partial<TariffInfo> = {
      [fieldName]: resetValue,
    };

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, updatePayload as any);

    if (result.success) {
      toast({ title: "Fee Reset", description: `${feeName} has been reset to its default value.` });
    } else {
      toast({ variant: "destructive", title: "Reset Failed", description: result.message });
    }
  };

  const handleUpdatePenalty = async (values: {
    penalty_month_threshold: number;
    bank_lending_rate: number;
    penalty_tiered_rates: { month: number; rate: number }[];
  }) => {
    if (!activeTariffInfo) return;

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, values as any);

    if (result.success) {
      toast({ title: "Penalty Configuration Updated", description: "The new penalty rates have been saved successfully." });
      setIsPenaltyDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const handleCreateNewVersion = async () => {
    if (!activeTariffInfo) return;

    // Default to next month's 1st
    const nextDate = new Date(currentEffectiveDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const newEffectiveDate = nextDate.toISOString().split('T')[0];

    const result = await addTariff({
      ...activeTariffInfo,
      effective_date: newEffectiveDate,
    });

    if (result.success) {
      toast({ title: "New Tariff Version Created", description: `Successfully created a new version effective ${newEffectiveDate}.` });
      setCurrentEffectiveDate(newEffectiveDate);
    } else {
      toast({ variant: "destructive", title: "Creation Failed", description: result.message });
    }
  };


  if (!hasPermission('tariffs_view')) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <CardDescription>You do not have the required permissions to view this page.</CardDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LibraryBig className="h-8 w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Tariff Management</h1>
        </div>
        {(hasPermission('tariffs_update') || hasPermission('tariffs_create')) && (
          <div className="flex gap-2 flex-wrap">
            {hasPermission('tariffs_create') && (
              <Button onClick={handleCreateNewVersion} variant="outline" disabled={!activeTariffInfo || !isLatestTariff}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Version
              </Button>
            )}
            {hasPermission('tariffs_update') && (
              <Button onClick={() => setIsMeterRentDialogOpen(true)} variant="default" disabled={!activeTariffInfo || !isLatestTariff}>
                <DollarSign className="mr-2 h-4 w-4" /> Manage Meter Rent
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tariff-date">Tariff Version (Effective Date)</Label>
          <div className="flex items-center gap-2">
            <Select
              value={currentEffectiveDate}
              onValueChange={setCurrentEffectiveDate}
            >
              <SelectTrigger id="tariff-date" className="w-full md:w-[200px]">
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(date => (
                  <SelectItem key={`tariff-date-${date}`} value={date}>{date}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLatestTariff ? (
              <Badge variant="default" className="text-xs">Active (Latest)</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Historical (Read-Only)</Badge>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-category">Select Customer Category</Label>
          <Select
            value={currentTariffType}
            onValueChange={(value) => setCurrentTariffType(value as 'Domestic' | 'Non-domestic' | 'rental Non domestic' | 'rental domestic')}
          >
            <SelectTrigger id="customer-category" className="w-full md:w-[200px]">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Domestic">Domestic</SelectItem>
              <SelectItem value="Non-domestic">Non-domestic</SelectItem>
              <SelectItem value="rental Non domestic">rental Non domestic</SelectItem>
              <SelectItem value="rental domestic">rental domestic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isDataLoading ? <p>Loading tariffs...</p> : !activeTariffInfo ?
        (<Card className="shadow-lg mt-4 border-dashed border-amber-500"><CardHeader><CardTitle className="text-amber-600">No Tariff Found</CardTitle><CardDescription>There is no tariff data for {currentTariffType} effective on {currentEffectiveDate}.</CardDescription></CardHeader></Card>) : (
          <>
            <Card className="shadow-lg mt-4">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-6 w-6 text-primary" />
                    <CardTitle>Current Water Tariff Rates ({currentTariffType} - {activeTariffInfo?.effective_date || ''})</CardTitle>
                  </div>
                  {canUpdateTariffs && (
                    <Button onClick={() => handleAddTier('water')} size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Water Tier
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {currentTariffType === 'Domestic'
                    ? "These rates are used for calculating domestic water bills. Rates are applied progressively."
                    : "These rates are used for calculating non-domestic water bills. The single applicable rate is determined by the total consumption."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TariffRateTable
                  rates={activeWaterTiers}
                  onEdit={(rate) => handleEditTier(rate, 'water')}
                  onDelete={(rate) => handleDeleteTier(rate, 'water')}
                  currency="ETB"
                  canUpdate={canUpdateTariffs}
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Percent className="h-6 w-6 text-primary" />
                  <CardTitle>Fees &amp; Charges ({currentTariffType} - {activeTariffInfo?.effective_date || ''})</CardTitle>
                </div>
                <CardDescription>
                  Additional fees and taxes applied during bill calculation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-sm">Maintenance Fee</span>
                        <span className="font-semibold">{(activeTariffInfo.maintenance_percentage * 100).toFixed(0)}% of Base Water Charge</span>
                      </div>
                      {canUpdateTariffs && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenFeeDialog('maintenance_percentage', 'Maintenance Fee')}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleResetFee('maintenance_percentage', 'Maintenance Fee')}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-sm">Sanitation Fee</span>
                        <span className="font-semibold">{(activeTariffInfo.sanitation_percentage * 100).toFixed(0)}% of Base Water Charge</span>
                      </div>
                      {canUpdateTariffs && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenFeeDialog('sanitation_percentage', 'Sanitation Fee')}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleResetFee('sanitation_percentage', 'Sanitation Fee')}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-sm">Meter Rent Fee</span>
                        <span className="font-semibold text-xs italic text-muted-foreground">Managed via "Manage Meter Rent"</span>
                      </div>
                      {canUpdateTariffs && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setIsMeterRentDialogOpen(true)}>
                          Configure
                        </Button>
                      )}
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-sm">Penalty Calculation</span>
                        <span className="font-semibold">Starts at Month {activeTariffInfo.penalty_month_threshold || 3}</span>
                        <span className="text-xs text-muted-foreground">Rate: {((activeTariffInfo.bank_lending_rate || 0.15) * 100).toFixed(0)}% bank + tiered rates</span>
                      </div>
                      {canUpdateTariffs && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setIsPenaltyDialogOpen(true)}>
                          Configure
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Additional Custom Fees</h4>
                      {canUpdateTariffs && (
                        <Button onClick={() => handleOpenAdditionalFeeDialog()} size="sm" variant="outline">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Fee
                        </Button>
                      )}
                    </div>
                    {activeTariffInfo.additional_fees && activeTariffInfo.additional_fees.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeTariffInfo.additional_fees.map((fee, idx) => (
                          <div key={`custom-fee-${idx}`} className="p-3 border rounded-md group bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-semibold text-sm">{fee.name}</div>
                                <div className="text-primary font-bold">
                                  {fee.type === 'percentage' ? `${(fee.value * 100).toFixed(1)}%` : `${fee.value} ETB`}
                                  <span className="text-xs text-muted-foreground font-normal ml-1">
                                    {fee.type === 'percentage' ? "of base charge" : "fixed"}
                                  </span>
                                </div>
                              </div>
                              {canUpdateTariffs && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpenAdditionalFeeDialog(fee, idx)}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteAdditionalFee(idx)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic p-2 border border-dashed rounded-md text-center">
                        No additional custom fees defined.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mt-6">
                    <div className="p-3 border rounded-md relative group">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">VAT</span>
                            <span className="text-primary font-bold">{(activeTariffInfo.vat_rate * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {currentTariffType === 'Domestic' || currentTariffType === 'rental domestic'
                              ? `VAT only applies if consumption is > ${activeTariffInfo.domestic_vat_threshold_m3 || 0} m³.`
                              : "VAT applies to all bills for this category."
                            }
                          </p>
                        </div>
                        {canUpdateTariffs && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenFeeDialog('vat_rate', 'VAT Rate')}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {currentTariffType === 'Domestic' && (
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit Threshold" onClick={() => handleOpenFeeDialog('domestic_vat_threshold_m3', 'VAT Threshold', false)}>
                                <ListChecks className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Sewerage Fee (if applicable)</h4>
                      {canUpdateTariffs && (
                        <Button onClick={() => handleAddTier('sewerage')} size="sm" variant="outline">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Sewerage Tier
                        </Button>
                      )}
                    </div>
                    <TariffRateTable
                      rates={activeSewerageTiers}
                      onEdit={(rate) => handleEditTier(rate, 'sewerage')}
                      onDelete={(rate) => handleDeleteTier(rate, 'sewerage')}
                      currency="ETB"
                      canUpdate={canUpdateTariffs}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

      {activeTariffInfo && (
        <>
          <TariffFormDialog
            open={!!editingTierType}
            onOpenChange={(open) => !open && setEditingTierType(null)}
            onSubmit={handleSubmitTierForm}
            defaultValues={editingRate ? {
              description: editingRate.description,
              maxConsumption: editingRate.originalLimit === Infinity ? "Infinity" : String(editingRate.originalLimit),
              rate: String(editingRate.originalRate)
            } : null}
            currency="ETB"
            tierType={editingTierType}
            canUpdate={canUpdateTariffs}
          />

          <MeterRentDialog
            open={isMeterRentDialogOpen}
            onOpenChange={setIsMeterRentDialogOpen}
            onSubmit={handleUpdateMeterRent}
            defaultPrices={activeTariffInfo.meter_rent_prices as { [key: string]: number }}
            currency="ETB"
            year={currentEffectiveDate}
            canUpdate={canUpdateTariffs}
          />

          <AdditionalFeeDialog
            open={isAdditionalFeeDialogOpen}
            onOpenChange={setIsAdditionalFeeDialogOpen}
            onSubmit={handleUpdateAdditionalFee}
            initialData={editingAdditionalFee?.fee}
            isEditing={!!editingAdditionalFee}
          />

          {feeDialogConfig && (
            <FeeEditDialog
              open={isFeeDialogOpen}
              onOpenChange={setIsFeeDialogOpen}
              onSubmit={(value) => handleUpdateFee(feeDialogConfig.fieldName, value, feeDialogConfig.isPercentage)}
              title={feeDialogConfig.title}
              description={feeDialogConfig.description}
              label={feeDialogConfig.label}
              defaultValue={feeDialogConfig.defaultValue}
              isPercentage={feeDialogConfig.isPercentage}
              canUpdate={canUpdateTariffs}
            />
          )}
          <AlertDialog open={!!rateToDelete} onOpenChange={(open) => !open && setRateToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this tier?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Tier: "{rateToDelete?.tier.description}"
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setRateToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Tier</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <PenaltyDialog
            open={isPenaltyDialogOpen}
            onOpenChange={setIsPenaltyDialogOpen}
            onSubmit={handleUpdatePenalty}
            defaultValues={{
              penalty_month_threshold: activeTariffInfo.penalty_month_threshold || 3,
              bank_lending_rate: activeTariffInfo.bank_lending_rate || 0.15,
              penalty_tiered_rates: activeTariffInfo.penalty_tiered_rates || [
                { month: 3, rate: 0.00 },
                { month: 4, rate: 0.10 },
                { month: 5, rate: 0.15 },
                { month: 6, rate: 0.20 }
              ]
            }}
            canUpdate={canUpdateTariffs}
          />
        </>
      )}
    </div>
  );
}
