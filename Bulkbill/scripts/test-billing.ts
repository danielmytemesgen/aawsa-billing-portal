import { calculateBillFromTariff, calculateBill, type TariffInfo } from '../src/lib/billing';

async function runTests() {
  const domesticTariff: TariffInfo = {
    customer_type: 'Domestic',
    year: 2025,
    tiers: [
      { rate: 5, limit: 5 },
      { rate: 8, limit: 14 },
      { rate: 10, limit: 'Infinity' },
    ],
    sewerage_tiers: [
      { rate: 0.5, limit: 5 },
      { rate: 1.0, limit: 'Infinity' },
    ],
    maintenance_percentage: 0.01,
    sanitation_percentage: 0.07,
    meter_rent_prices: { '0.5': 37, '0.75': 45 },
    vat_rate: 0.15,
    domestic_vat_threshold_m3: 15,
  };

  const nonDomesticTariff: TariffInfo = {
    customer_type: 'Non-domestic',
    year: 2025,
    tiers: [
      { rate: 6, limit: 5 },
      { rate: 9, limit: 14 },
      { rate: 12, limit: 'Infinity' },
    ],
    sewerage_tiers: [
      { rate: 1, limit: 'Infinity' },
    ],
    maintenance_percentage: 0.01,
    sanitation_percentage: 0.10,
    meter_rent_prices: { '1': 50 },
    vat_rate: 0.15,
    domestic_vat_threshold_m3: 0, // unused for non-domestic
  };

  console.log('--- Domestic tests ---');
  const domCases = [3, 10, 16];
  for (const usage of domCases) {
    const res = calculateBillFromTariff(domesticTariff, usage, 0.5, 'No');
    console.log(`Usage ${usage} m3 =>`, res);
  }

  console.log('\n--- Non-domestic tests ---');
  const nonDomCases = [3, 10, 20];
  for (const usage of nonDomCases) {
    const res = calculateBillFromTariff(nonDomesticTariff, usage, 1, 'Yes');
    console.log(`Usage ${usage} m3 =>`, res);
  }

  // Also test calculateBill (which fetches tariff by year) but we can't hit DB here easily.
}

runTests().catch(err => { console.error(err); process.exit(1); });
