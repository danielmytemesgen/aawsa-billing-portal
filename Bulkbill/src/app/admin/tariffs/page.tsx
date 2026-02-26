

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LibraryBig, ListChecks, PlusCircle, RotateCcw, DollarSign, Percent, Copy, Lock } from "lucide-react";
import type { TariffTier, TariffInfo, SewerageTier } from "@/lib/billing-calculations";
import {
  getTariff, initializeTariffs, subscribeToTariffs, updateTariff, addTariff
} from "@/lib/data-store";
import { TariffRateTable, type DisplayTariffRate } from "./tariff-rate-table";
import { TariffFormDialog, type TariffFormValues } from "./tariff-form-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeterRentDialog } from "./meter-rent-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";

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

const getDisplayTiersFromData = (tariffInfo?: TariffInfo, tierType: 'water' | 'sewerage' = 'water'): DisplayTariffRate[] => {
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

  const [currentYear, setCurrentYear] = React.useState<number>(new Date().getFullYear());
  const [currentTariffType, setCurrentTariffType] = React.useState<'Domestic' | 'Non-domestic' | 'rental Non domestic' | 'rental domestic'>('Domestic');
  const [allTariffs, setAllTariffs] = React.useState<TariffInfo[]>([]);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  const [editingTierType, setEditingTierType] = React.useState<'water' | 'sewerage' | null>(null);
  const [editingRate, setEditingRate] = React.useState<DisplayTariffRate | null>(null);

  const [rateToDelete, setRateToDelete] = React.useState<{ tier: DisplayTariffRate, type: 'water' | 'sewerage' } | null>(null);

  const [isMeterRentDialogOpen, setIsMeterRentDialogOpen] = React.useState(false);

  const activeTariffInfo = React.useMemo(() => {
    return allTariffs.find(t => t.customer_type === currentTariffType && t.year === currentYear);
  }, [allTariffs, currentTariffType, currentYear]);

  const activeWaterTiers = getDisplayTiersFromData(activeTariffInfo, 'water');
  const activeSewerageTiers = getDisplayTiersFromData(activeTariffInfo, 'sewerage');
  const yearOptions = React.useMemo(() => generateYearOptions(), []);

  // Prefer a parsed version of the currently selected tariff (some sources store JSON fields as strings)
  const parsedActiveTariff = getTariff(currentTariffType, currentYear);

  const canUpdateTariffs = hasPermission('tariffs_update');

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

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.year, newTariffInfo as any);
    if (result.success) {
      toast({ title: "Tariff Updated", description: `${currentTariffType} ${type} tariff rates for ${currentYear} have been saved.` });
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

  const handleSaveMeterRents = async (newPrices: { [key: string]: number }) => {
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

    const result = await updateTariff(activeTariffInfo.customer_type, activeTariffInfo.year, updatePayload as any);

    if (result.success) {
      toast({ title: "Meter Rent Prices Updated", description: `New prices for ${currentYear} have been saved.` });
      setIsMeterRentDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const handleCreateNewYearTariff = async () => {
    if (!activeTariffInfo) {
      toast({ variant: "destructive", title: "Cannot Create Tariff", description: `No base tariff found for ${currentTariffType} in ${currentYear} to copy from.` });
      return;
    }

    const newYear = currentYear + 1;
    const existingTariffForNewYear = allTariffs.find(t => t.customer_type === currentTariffType && t.year === newYear);

    if (existingTariffForNewYear) {
      toast({ variant: "destructive", title: "Tariff Already Exists", description: `A tariff for ${currentTariffType} in ${newYear} already exists. Please select it from the dropdown to edit.` });
      return;
    }

    const newTariffData: Omit<TariffInfo, 'id'> = {
      ...activeTariffInfo,
      year: newYear,
    };

    const result = await addTariff(newTariffData as any);

    if (result.success) {
      toast({ title: "New Tariff Created", description: `Successfully created tariff for ${currentTariffType} for the year ${newYear}, copied from ${currentYear}.` });
      setCurrentYear(newYear); // Switch to the new year
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
        {canUpdateTariffs && (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleCreateNewYearTariff} variant="outline" disabled={!activeTariffInfo}>
              <Copy className="mr-2 h-4 w-4" /> Copy to {currentYear + 1}
            </Button>
            <Button onClick={() => setIsMeterRentDialogOpen(true)} variant="default" disabled={!activeTariffInfo}>
              <DollarSign className="mr-2 h-4 w-4" /> Manage Meter Rent
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tariff-year">Select Year</Label>
          <Select
            value={String(currentYear)}
            onValueChange={(value) => setCurrentYear(Number(value))}
          >
            <SelectTrigger id="tariff-year" className="w-full md:w-[200px]">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        (<Card className="shadow-lg mt-4 border-dashed border-amber-500"><CardHeader><CardTitle className="text-amber-600">No Tariff Found</CardTitle><CardDescription>There is no tariff data for {currentTariffType} for the year {currentYear}. You can create one by copying settings from another year.</CardDescription></CardHeader></Card>) : (
          <>
            <Card className="shadow-lg mt-4">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-6 w-6 text-primary" />
                    <CardTitle>Current Water Tariff Rates ({currentTariffType} - {currentYear})</CardTitle>
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
                  <CardTitle>Fees &amp; Charges ({currentTariffType} - {currentYear})</CardTitle>
                </div>
                <CardDescription>
                  Additional fees and taxes applied during bill calculation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <span className="text-muted-foreground">Maintenance Fee</span>
                      <span className="font-semibold">{(activeTariffInfo.maintenance_percentage * 100).toFixed(0)}% of Base Water Charge</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <span className="text-muted-foreground">Sanitation Fee</span>
                      <span className="font-semibold">{(activeTariffInfo.sanitation_percentage * 100).toFixed(0)}% of Base Water Charge</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                      <span className="text-muted-foreground">Meter Rent Fee</span>
                      <span className="font-semibold text-muted-foreground italic">Varies by meter size. Managed via "Manage Meter Rent" button.</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/50 border border-primary/20">
                      <div className="flex-1 pr-4">
                        <span className="text-muted-foreground">VAT</span>
                        {currentTariffType === 'Domestic' && (
                          <p className="text-xs text-muted-foreground italic">For Domestic customers, VAT only applies if consumption is &gt; {activeTariffInfo.domestic_vat_threshold_m3} m³.</p>
                        )}
                      </div>
                      <span className="font-semibold text-primary text-right">{(activeTariffInfo.vat_rate * 100).toFixed(0)}%</span>
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
            onSubmit={handleSaveMeterRents}
            defaultPrices={activeTariffInfo.meter_rent_prices as { [key: string]: number }}
            currency="ETB"
            year={currentYear}
            canUpdate={canUpdateTariffs}
          />
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
        </>
      )}
    </div>
  );
}
