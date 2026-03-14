"use server";

import { dbGetTariffByTypeAndYear } from '@/lib/db-queries';
import type { CustomerType, SewerageConnection, BillCalculationResult, TariffInfo, TariffTier, SewerageTier } from './billing';
import { calculateBillFromTariff, safeParseJsonField } from './billing';

const getLiveTariffFromDB = async (type: CustomerType, year: number): Promise<TariffInfo | null> => {
  const tariff: any = await dbGetTariffByTypeAndYear(type, year);
  if (!tariff) return null;

  const tiers = safeParseJsonField<TariffTier[]>(tariff.tiers, 'tiers', 'array');
  if (!tiers || tiers.length === 0) return null;

  return {
    customer_type: tariff.customer_type as CustomerType,
    year: tariff.year,
    tiers,
    sewerage_tiers: safeParseJsonField<SewerageTier[]>(tariff.sewerage_tiers, 'sewerage_tiers', 'array'),
    maintenance_percentage: tariff.maintenance_percentage,
    sanitation_percentage: tariff.sanitation_percentage,
    meter_rent_prices: safeParseJsonField<{ [key: string]: number }>(tariff.meter_rent_prices, 'meter_rent_prices', 'object'),
    vat_rate: tariff.vat_rate,
    domestic_vat_threshold_m3: tariff.domestic_vat_threshold_m3,
  };
};

export async function calculateBill(
  usageM3: number,
  customerType: CustomerType,
  sewerageConnection: SewerageConnection,
  meterSize: number,
  billingMonth: string
): Promise<BillCalculationResult> {
  const year = parseInt(billingMonth.split('-')[0], 10);
  const tariffConfig = await getLiveTariffFromDB(customerType, year);
  if (!tariffConfig) {
    // Return zeros if tariff missing
    return { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, vatAmount: 0, meterRent: 0, sewerageCharge: 0 };
  }
  return calculateBillFromTariff(tariffConfig, usageM3, meterSize, sewerageConnection);
}
