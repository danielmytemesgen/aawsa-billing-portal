

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LibraryBig, ListChecks, PlusCircle, RotateCcw, DollarSign, Percent, Copy, Lock, Edit2, Trash2, Calendar, LayoutGrid, Info, ArrowUpRight, TrendingUp, Layers } from "lucide-react";
import type { TariffTier, TariffInfo, SewerageTier } from "@/lib/billing-calculations";
import {
  getTariff, initializeTariffs, subscribeToTariffs, updateTariff, addTariff
} from "@/lib/data-store";
import type { CustomerType } from "@/lib/billing";
import type { TariffRow } from "@/lib/actions";
import { TariffRateTable, type DisplayTariffRate } from "./tariff-rate-table";
import { TariffFormDialog, type TariffFormValues } from "./tariff-form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MeterRentDialog } from "./meter-rent-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { FeeEditDialog } from "./fee-edit-dialog";
import { AdditionalFeeDialog } from "./additional-fee-dialog";
import { AdditionalFee } from "@/lib/billing-calculations";
import { PenaltyDialog } from "./penalty-dialog";
import { NewVersionDialog, type NewVersionFormValues } from "./new-version-dialog";

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
  const [isNewVersionDialogOpen, setIsNewVersionDialogOpen] = React.useState(false);

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

  const handleUpdateFixedTierIndex = async (newIndex: number | null) => {
    if (!activeTariffInfo) return;
    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, {
      fixed_tier_index: newIndex
    } as any);
    if (result.success) {
      if (newIndex !== null) {
        toast({ title: "Tier Selection Updated", description: `Billing for ${currentTariffType} will now use Tier ${newIndex + 1} (${activeWaterTiers[newIndex]?.description || ''}).` });
      } else {
        toast({ title: "Override Cleared", description: `Billing for ${currentTariffType} has been reset to default rules.` });
      }
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const handleToggleRuleOfThree = async (enabled: boolean) => {
    if (!activeTariffInfo) return;
    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.effective_date!, {
      use_rule_of_three: enabled
    } as any);
    if (result.success) {
      toast({ title: "3m³ Rule Updated", description: `Minimum 3m³ adjustment is now ${enabled ? 'ENABLED' : 'DISABLED'} for ${currentTariffType}.` });
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const handleCreateNewVersion = async (data: NewVersionFormValues) => {
    if (!activeTariffInfo) return;

    const newEffectiveDate = data.effectiveDate;

    // Optional: Check if the selected date already exists for this category
    if (availableDates.includes(newEffectiveDate)) {
      toast({ variant: "destructive", title: "Creation Failed", description: `A tariff version already exists for ${newEffectiveDate}.` });
      return;
    }

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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 rotate-3 group-hover:rotate-6 transition-transform">
            <LibraryBig className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Tariff Management</h1>
            <p className="text-slate-500 font-medium">Configure water rates, fees, and charges for billing cycles.</p>
          </div>
        </div>
        {(hasPermission('tariffs_update') || hasPermission('tariffs_create')) && (
          <div className="flex gap-3 flex-wrap">
            {hasPermission('tariffs_create') && (
              <Button onClick={() => setIsNewVersionDialogOpen(true)} variant="outline" disabled={!activeTariffInfo || !isLatestTariff} className="h-11 border-slate-200 font-bold hover:bg-slate-50">
                <PlusCircle className="mr-2 h-4 w-4" /> New Version
              </Button>
            )}
            {hasPermission('tariffs_update') && (
              <Button onClick={() => setIsMeterRentDialogOpen(true)} variant="default" disabled={!activeTariffInfo || !isLatestTariff} className="h-11 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold px-6">
                <DollarSign className="mr-2 h-4 w-4" /> Manage Meter Rent
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats Header */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-md mb-3 inline-block">Effective Date</p>
                <p className="text-3xl font-black text-slate-900">{currentEffectiveDate}</p>
              </div>
              <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Calendar className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 flex items-center text-sm font-bold text-slate-500">
              {isLatestTariff ? (
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  Currently Active
                </span>
              ) : (
                <span className="text-amber-700 italic">Historical Archive</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-indigo-800 uppercase tracking-widest bg-indigo-100 px-3 py-1 rounded-md mb-3 inline-block">Tariff Category</p>
                <p className="text-3xl font-black text-slate-900">{currentTariffType}</p>
              </div>
              <div className="h-14 w-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <LayoutGrid className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 font-bold text-sm text-slate-500">
              Primary pricing model
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-violet-800 uppercase tracking-widest bg-violet-100 px-3 py-1 rounded-md mb-3 inline-block">Water Tiers</p>
                <p className="text-4xl font-black text-slate-900">{activeWaterTiers.length}</p>
              </div>
              <div className="h-14 w-14 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600">
                <TrendingUp className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-bold text-violet-700 italic">
              {currentTariffType === 'Domestic' || currentTariffType === 'rental domestic' 
                ? "Progressive pricing" 
                : "Total volume pricing"}
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-emerald-800 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-md mb-3 inline-block">Custom Fees</p>
                <p className="text-4xl font-black text-slate-900">{activeTariffInfo?.additional_fees?.length || 0}</p>
              </div>
              <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Percent className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5 text-sm font-bold text-emerald-700">
              Active extra charges
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center gap-6 bg-slate-50 border border-slate-200 p-6 rounded-3xl">
        <div className="space-y-2 flex-grow min-w-[200px]">
          <Label htmlFor="tariff-date" className="text-xs font-black uppercase text-slate-700 tracking-widest ml-1">Tariff Version</Label>
          <div className="flex items-center gap-2">
            <Select value={currentEffectiveDate} onValueChange={setCurrentEffectiveDate}>
              <SelectTrigger id="tariff-date" className="h-14 bg-white font-bold text-lg rounded-2xl border-slate-200 shadow-sm transition-all focus:ring-4 focus:ring-indigo-500/20">
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl font-bold text-lg">
                {availableDates.map(date => (
                  <SelectItem key={`tariff-date-${date}`} value={date} className="py-2">{date}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 flex-grow min-w-[200px]">
          <Label htmlFor="customer-category" className="text-xs font-black uppercase text-slate-700 tracking-widest ml-1">Customer Category</Label>
          <Select value={currentTariffType} onValueChange={(value) => setCurrentTariffType(value as any)}>
            <SelectTrigger id="customer-category" className="h-14 bg-white font-bold text-lg rounded-2xl border-slate-200 shadow-sm transition-all focus:ring-4 focus:ring-indigo-500/20">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl font-bold text-lg">
              <SelectItem value="Domestic" className="py-2">Domestic</SelectItem>
              <SelectItem value="Non-domestic" className="py-2">Non-domestic</SelectItem>
              <SelectItem value="rental Non domestic" className="py-2">Rental Non-domestic</SelectItem>
              <SelectItem value="rental domestic" className="py-2">Rental Domestic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isDataLoading ? <p>Loading tariffs...</p> : !activeTariffInfo ?
        (<Card className="shadow-lg mt-4 border-dashed border-amber-500"><CardHeader><CardTitle className="text-amber-600">No Tariff Found</CardTitle><CardDescription>There is no tariff data for {currentTariffType} effective on {currentEffectiveDate}.</CardDescription></CardHeader></Card>) : (
          <>
            <Card className="shadow-2xl border-none bg-white overflow-hidden rounded-3xl transition-shadow hover:shadow-indigo-100/50">
              <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
              <CardHeader className="pb-6 bg-slate-50/50 border-b">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                      <ListChecks className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900">Water Tariff Rates</CardTitle>
                      <CardDescription className="font-bold text-slate-500 mt-0.5">
                        {currentTariffType} Pricing Spectrum • {activeTariffInfo?.effective_date}
                      </CardDescription>
                    </div>
                  </div>
                  {canUpdateTariffs && (
                    <Button onClick={() => handleAddTier('water')} className="h-11 bg-blue-600 hover:bg-blue-700 font-bold px-6 rounded-xl shadow-lg shadow-blue-100">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Water Tier
                    </Button>
                  )}
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  {currentTariffType === 'Domestic'
                    ? "Progressive tiers ensure equitable pricing based on consumption volume."
                    : "Non-domestic rates are applied based on total monthly volume."
                  }
                </p>
              </CardHeader>
              <CardContent className="pt-8">
                <TariffRateTable
                  rates={activeWaterTiers}
                  onEdit={(rate) => handleEditTier(rate, 'water')}
                  onDelete={(rate) => handleDeleteTier(rate, 'water')}
                  currency="ETB"
                  canUpdate={canUpdateTariffs}
                />
              </CardContent>
            </Card>

            {/* Advanced Billing Rules Selector - fixed tiers and 3m3 rule */}
            {activeTariffInfo && (
              <Card className="shadow-2xl border-none bg-white overflow-hidden rounded-3xl transition-shadow hover:shadow-violet-100/50">
                <div className="h-2 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
                <CardHeader className="pb-6 bg-slate-50/50 border-b">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600">
                        <Layers className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-black text-slate-900">Advanced Billing Rules</CardTitle>
                        <CardDescription className="font-bold text-slate-500 mt-0.5">
                          Configure usage thresholds and rate overrides for {currentTariffType}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-8 pb-6 space-y-10">
                  {/* Rule of 3 Toggle */}
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">Rule of 3 (Minimum 3m³ Usage)</h4>
                        <Badge className={activeTariffInfo.use_rule_of_three !== false ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200"}>
                          {activeTariffInfo.use_rule_of_three !== false ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        When enabled, consumption of 0, 1, or 2 m³ will be automatically billed as 3 m³.
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Label htmlFor="rule-of-three-toggle" className="text-sm font-black uppercase tracking-wider text-slate-400">
                        {activeTariffInfo.use_rule_of_three !== false ? "Enabled" : "Disabled"}
                      </Label>
                      <Switch
                        id="rule-of-three-toggle"
                        checked={activeTariffInfo.use_rule_of_three !== false}
                        onCheckedChange={handleToggleRuleOfThree}
                        disabled={!canUpdateTariffs}
                      />
                    </div>
                  </div>

                  {/* Fixed Tier Override */}
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <h4 className="text-lg font-black text-slate-900">Fixed Tier Rate Override</h4>
                        <p className="text-sm font-bold text-slate-500">
                          Force all customers to bill at a single flat tier rate instead of progressive tiers
                        </p>
                      </div>
                      {canUpdateTariffs && activeTariffInfo.fixed_tier_index !== undefined && activeTariffInfo.fixed_tier_index !== null && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 px-5 rounded-xl border-red-200 text-red-600 font-black hover:bg-red-50"
                          onClick={() => handleUpdateFixedTierIndex(null)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Clear Override
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {activeWaterTiers.map((tier, index) => {
                        const currentIndex = activeTariffInfo.fixed_tier_index !== undefined && activeTariffInfo.fixed_tier_index !== null
                          ? Number(activeTariffInfo.fixed_tier_index)
                          : null;
                        const isSelected = currentIndex !== null && index === currentIndex;
                        return (
                          <button
                            key={tier.id}
                            onClick={() => canUpdateTariffs && handleUpdateFixedTierIndex(index)}
                            disabled={!canUpdateTariffs}
                            className={`group relative p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100'
                                : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                            } ${!canUpdateTariffs ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className={`absolute top-3 right-3 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-violet-500 bg-violet-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black mb-3 ${
                              isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-violet-100 group-hover:text-violet-700'
                            }`}>
                              {index + 1}
                            </div>
                            <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                              isSelected ? 'text-violet-700' : 'text-slate-500'
                            }`}>Tier {index + 1}</p>
                            <p className={`text-lg font-black ${
                              isSelected ? 'text-violet-900' : 'text-slate-800'
                            }`}>{tier.rate.toFixed(2)} ETB</p>
                            <p className={`text-xs font-bold mt-1 ${
                              isSelected ? 'text-violet-600' : 'text-slate-400'
                            }`}>per m³ · {tier.minConsumption}–{tier.maxConsumption} m³</p>
                            {isSelected && (
                              <span className="mt-3 inline-block text-[10px] font-black uppercase tracking-widest bg-violet-600 text-white px-2.5 py-1 rounded-lg">
                                Active Override
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {activeWaterTiers.length === 0 && (
                      <p className="text-center text-sm text-slate-400 font-bold py-8">Add water tiers above first to enable tier selection.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-2xl border-none bg-white overflow-hidden rounded-3xl transition-shadow hover:shadow-emerald-100/50">
              <div className="h-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" />
              <CardHeader className="pb-6 bg-slate-50/50 border-b">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Percent className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900">Fees & Utility Charges</CardTitle>
                    <CardDescription className="font-bold text-slate-500 mt-0.5">
                      Operational Surcharges • {activeTariffInfo?.effective_date}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-10 pt-8">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h4 className="text-base font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                       <LayoutGrid className="h-5 w-5" /> Standard Surcharges
                    </h4>
                    <div className="grid gap-4">
                      {[
                        { label: "Maintenance Fee", field: "maintenance_percentage", value: activeTariffInfo.maintenance_percentage, icon: RotateCcw, color: "blue" },
                        { label: "Sanitation Fee", field: "sanitation_percentage", value: activeTariffInfo.sanitation_percentage, icon: Trash2, color: "emerald" },
                      ].map((item) => (
                        <div key={item.field} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-200 hover:bg-white hover:shadow-lg transition-all group">
                          <div className="flex items-center gap-5">
                            <div className={`h-12 w-12 rounded-xl bg-${item.color}-100 flex items-center justify-center text-${item.color}-700 group-hover:scale-110 transition-transform`}>
                              <item.icon className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-600 uppercase mb-1">{item.label}</p>
                              <p className="text-2xl font-black text-slate-900">{(item.value * 100).toFixed(0)}% <span className="text-sm font-bold text-slate-500 ml-1">of Base Charge</span></p>
                            </div>
                          </div>
                          {canUpdateTariffs && (
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" className="h-10 w-10 bg-white shadow-sm hover:text-indigo-600 rounded-xl border border-slate-200" onClick={() => handleOpenFeeDialog(item.field as any, item.label)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-10 w-10 bg-white shadow-sm hover:text-red-600 rounded-xl border border-slate-200" onClick={() => handleResetFee(item.field as any, item.label)}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Meter Rent Special Item */}
                      <div className="flex items-center justify-between p-5 rounded-3xl bg-indigo-50 border border-indigo-200 hover:bg-white hover:shadow-lg transition-all group">
                        <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-xl bg-indigo-200 flex items-center justify-center text-indigo-800 group-hover:scale-110 transition-transform shadow-sm">
                            <DollarSign className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-600 uppercase mb-1">Meter Rent Fee</p>
                            <p className="text-base font-bold text-indigo-700 italic">Multi-tier specialized pricing</p>
                          </div>
                        </div>
                        {canUpdateTariffs && (
                          <Button size="sm" variant="outline" className="h-10 px-5 bg-white rounded-xl border-indigo-300 font-black text-indigo-700 hover:bg-indigo-100 shadow-sm" onClick={() => setIsMeterRentDialogOpen(true)}>
                            Configure Rates
                          </Button>
                        )}
                      </div>

                      {/* Penalty Special Item */}
                      <div className="flex items-center justify-between p-5 rounded-3xl bg-amber-50 border border-amber-200 hover:bg-white hover:shadow-lg transition-all group">
                        <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-xl bg-amber-200 flex items-center justify-center text-amber-800 group-hover:scale-110 transition-transform shadow-sm">
                            <Info className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-600 uppercase mb-1">Penalty Logic</p>
                            <p className="text-base font-bold text-amber-900 leading-tight">Threshold: <span className="font-black text-amber-600">Month {activeTariffInfo.penalty_month_threshold || 3}</span></p>
                            <p className="text-xs font-bold text-amber-600 uppercase mt-1 tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-md inline-block">Bank Rate + Tiered Matrix</p>
                          </div>
                        </div>
                        {canUpdateTariffs && (
                          <Button size="sm" variant="outline" className="h-10 px-5 bg-white rounded-xl border-amber-300 font-black text-amber-700 hover:bg-amber-100 shadow-sm" onClick={() => setIsPenaltyDialogOpen(true)}>
                            Modify Rules
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center pr-2">
                       <h4 className="text-base font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                         <PlusCircle className="h-5 w-5" /> Additional Custom Fees
                      </h4>
                      {canUpdateTariffs && (
                        <Button onClick={() => handleOpenAdditionalFeeDialog()} variant="ghost" size="sm" className="h-10 px-4 text-indigo-700 font-black hover:bg-indigo-100/50 text-xs uppercase tracking-widest rounded-xl">
                          <PlusCircle className="mr-2 h-4 w-4" /> New Custom Fee
                        </Button>
                      )}
                    </div>
                    {activeTariffInfo.additional_fees && activeTariffInfo.additional_fees.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeTariffInfo.additional_fees.map((fee, idx) => (
                          <div key={`custom-fee-${idx}`} className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br transition-all duration-300 opacity-5 -mr-12 -mt-12 rounded-full group-hover:scale-[3] ${fee.type === 'percentage' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600'}`} />
                            <div className="flex justify-between items-start relative z-10">
                              <div>
                                <p className="font-black text-lg text-slate-900 mb-2">{fee.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-black text-indigo-700">
                                    {fee.type === 'percentage' ? `${(fee.value * 100).toFixed(1)}%` : `${fee.value} ETB`}
                                  </span>
                                  <Badge variant="outline" className="text-xs uppercase font-black px-2 py-0.5 border-slate-300 bg-white/80 shadow-sm text-slate-500 tracking-widest">
                                    {fee.type === 'percentage' ? "of Subtotal" : "Flat Rate"}
                                  </Badge>
                                </div>
                              </div>
                              {canUpdateTariffs && (
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button size="icon" variant="ghost" className="h-10 w-10 hover:text-indigo-700 bg-slate-50 border border-slate-200 rounded-xl shadow-sm" onClick={() => handleOpenAdditionalFeeDialog(fee, idx)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-10 w-10 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-xl shadow-sm" onClick={() => handleDeleteAdditionalFee(idx)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-slate-500 p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center bg-slate-50/80">
                        No additional custom fees defined for this category.
                      </div>
                    )}

                    {/* VAT Section Integrated */}
                    <div className="mt-8 p-8 bg-[#f8f9fc] rounded-3xl text-slate-900 shadow-sm relative overflow-hidden group border border-slate-200">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100 blur-[100px] -mr-32 -mt-32 group-hover:bg-indigo-200/50 transition-all duration-700 pointer-events-none" />
                      <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-4">
                          <div className="flex items-center gap-5">
                            <div className="bg-slate-900 px-4 py-2 rounded-2xl flex items-center justify-center shadow-md">
                              <span className="font-extrabold text-sm tracking-widest text-white">VAT</span>
                            </div>
                            <span className="text-6xl font-black tracking-tight text-slate-900">{(activeTariffInfo.vat_rate * 100).toFixed(0)}%</span>
                          </div>
                          <div className="space-y-3 pt-2">
                            <p className="text-sm font-bold text-slate-700 flex items-center gap-3">
                              <span className="h-2 w-2 bg-indigo-500 rounded-full" />
                              {currentTariffType === 'Domestic' || currentTariffType === 'rental domestic'
                                ? `Threshold trigger: > ${activeTariffInfo.domestic_vat_threshold_m3 || 0} m³ consumption`
                                : "Universal application across all bills"
                              }
                            </p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] italic font-mono pt-1">Revenue Compliance Standard</p>
                          </div>
                        </div>
                        {canUpdateTariffs && (
                          <div className="flex flex-col gap-3">
                            <Button size="icon" variant="ghost" className="h-11 w-11 bg-white/10 hover:bg-white hover:text-slate-900 border-none rounded-xl" onClick={() => handleOpenFeeDialog('vat_rate', 'VAT Rate')}>
                              <Edit2 className="h-5 w-5" />
                            </Button>
                            {currentTariffType === 'Domestic' && (
                              <Button size="icon" variant="ghost" className="h-11 w-11 bg-white/10 hover:bg-white hover:text-slate-900 border-none rounded-xl" title="Edit Threshold" onClick={() => handleOpenFeeDialog('domestic_vat_threshold_m3', 'VAT Threshold', false)}>
                                <ListChecks className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sewerage Fee Integrated at Bottom */}
                <div className="pt-10 border-t border-slate-100 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 shadow-sm border border-blue-200">
                        <ArrowUpRight className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-900">Sewerage Utility Matrix</h4>
                        <p className="text-sm font-bold text-slate-500 mt-1">Treatment and maintenance surcharge structure</p>
                      </div>
                    </div>
                    {canUpdateTariffs && (
                      <Button onClick={() => handleAddTier('sewerage')} variant="outline" className="h-11 px-6 rounded-xl border-slate-300 font-black text-slate-700 hover:bg-slate-100 shadow-sm">
                        <PlusCircle className="mr-2 h-5 w-5" /> Add Sewerage Tier
                      </Button>
                    )}
                  </div>
                  <div className="bg-slate-50/50 p-1 rounded-3xl border border-slate-100 overflow-hidden">
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
                  This action cannot be undone. Tier: &quot;{rateToDelete?.tier.description}&quot;
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

          <NewVersionDialog
            open={isNewVersionDialogOpen}
            onOpenChange={setIsNewVersionDialogOpen}
            onSubmit={handleCreateNewVersion}
          />
        </>
      )}
    </div>
  );
}
