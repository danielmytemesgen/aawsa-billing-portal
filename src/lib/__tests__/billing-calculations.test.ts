import { describe, it, expect } from 'vitest';
import { calculateBillFromTariff, TariffInfo } from '@/lib/billing-calculations';

describe('calculateBillFromTariff', () => {
  it('calculates components correctly for a simple domestic tariff', () => {
    const tariff: TariffInfo = {
      customer_type: 'Domestic',
      effective_date: '2024-01-01',
      tiers: [{ rate: 10, limit: 'Infinity' }],
      sewerage_tiers: [],
      maintenance_percentage: 0.1,
      sanitation_percentage: 0.05,
      meter_rent_prices: {},
      vat_rate: 0,
      domestic_vat_threshold_m3: 15,
      additional_fees: [],
      // optional fields
      fixed_tier_index: undefined,
      use_rule_of_three: false,
    } as unknown as TariffInfo;

    const res = calculateBillFromTariff(tariff, 5, 1, 'No');
    // baseWaterCharge = 5 * 10 = 50
    // maintenance = 5
    // sanitation = 2.5
    // totalBill = 57.5
    expect(res.baseWaterCharge).toBeCloseTo(50);
    expect(res.maintenanceFee).toBeCloseTo(5);
    expect(res.sanitationFee).toBeCloseTo(2.5);
    expect(res.totalBill).toBeCloseTo(57.5);
  });

  it('applies rule of three when configured', () => {
    const tariff: TariffInfo = {
      customer_type: 'Domestic',
      effective_date: '2024-01-01',
      tiers: [{ rate: 10, limit: 'Infinity' }],
      sewerage_tiers: [],
      maintenance_percentage: 0.1,
      sanitation_percentage: 0.05,
      meter_rent_prices: {},
      vat_rate: 0,
      domestic_vat_threshold_m3: 15,
      additional_fees: [],
      fixed_tier_index: undefined,
      use_rule_of_three: true,
    } as unknown as TariffInfo;

    const res = calculateBillFromTariff(tariff, 1, 1, 'No');
    // effective usage becomes 3
    // base = 3 * 10 = 30, maintenance = 3, sanitation = 1.5 => total = 34.5
    expect(res.totalBill).toBeCloseTo(34.5);
  });

  it('uses the selected fixed tier rate as a flat override for all customer types', () => {
    const tariff: TariffInfo = {
      customer_type: 'Domestic',
      effective_date: '2024-01-01',
      tiers: [{ rate: 5, limit: 10 }, { rate: 15, limit: 'Infinity' }],
      sewerage_tiers: [],
      maintenance_percentage: 0.1,
      sanitation_percentage: 0.05,
      meter_rent_prices: {},
      vat_rate: 0,
      domestic_vat_threshold_m3: 15,
      additional_fees: [],
      fixed_tier_index: 1,
      use_rule_of_three: false,
    } as unknown as TariffInfo;

    const domesticResult = calculateBillFromTariff(tariff, 20, 1, 'No');
    const nonDomesticResult = calculateBillFromTariff({ ...tariff, customer_type: 'Non-domestic' }, 20, 1, 'No');

    expect(domesticResult.baseWaterCharge).toBeCloseTo(300);
    expect(domesticResult.totalBill).toBeCloseTo(345);
    expect(nonDomesticResult.baseWaterCharge).toBeCloseTo(300);
    expect(nonDomesticResult.totalBill).toBeCloseTo(345);
  });
});
