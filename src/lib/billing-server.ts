"use server";

import { dbGetLatestApplicableTariff } from '@/lib/db-queries';
import type { CustomerType, SewerageConnection, BillCalculationResult, TariffInfo, TariffTier, SewerageTier, AdditionalFee } from './billing';
import { calculateBillFromTariff, safeParseJsonField } from './billing';

const getLiveTariffFromDB = async (customerType: CustomerType, date: string): Promise<TariffInfo | null> => {
  const tariff: any = await dbGetLatestApplicableTariff(customerType, date);
  if (!tariff) return null;

  const tiers = safeParseJsonField<TariffTier[]>(tariff.tiers, 'tiers', 'array');
  if (!tiers || tiers.length === 0) return null;

  return {
    customer_type: tariff.customer_type as CustomerType,
    effective_date: tariff.effective_date,
    tiers,
    sewerage_tiers: safeParseJsonField<SewerageTier[]>(tariff.sewerage_tiers, 'sewerage_tiers', 'array'),
    maintenance_percentage: tariff.maintenance_percentage,
    sanitation_percentage: tariff.sanitation_percentage,
    meter_rent_prices: safeParseJsonField<{ [key: string]: number }>(tariff.meter_rent_prices, 'meter_rent_prices', 'object'),
    vat_rate: tariff.vat_rate,
    domestic_vat_threshold_m3: tariff.domestic_vat_threshold_m3,
    additional_fees: safeParseJsonField<AdditionalFee[]>(tariff.additional_fees, 'additional_fees', 'array'),
  };
};

export async function calculateBill(
  CONS: number,
  customerType: CustomerType,
  sewerageConnection: SewerageConnection,
  meterSize: number,
  billingMonth: string
): Promise<BillCalculationResult> {
  // billingMonth is YYYY-MM. We can use YYYY-MM-01 as the lookup date.
  const dateForTariff = `${billingMonth}-01`;
  const tariffConfig = await getLiveTariffFromDB(customerType, dateForTariff);
  if (!tariffConfig) {
    // Return zeros if tariff missing
    return {
      totalBill: 0,
      baseWaterCharge: 0,
      maintenanceFee: 0,
      sanitationFee: 0,
      vatAmount: 0,
      meterRent: 0,
      sewerageCharge: 0,
      additionalFeesCharge: 0
    };
  }
  return calculateBillFromTariff(tariffConfig, CONS, meterSize, sewerageConnection);
}
