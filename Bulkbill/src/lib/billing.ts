import { dbGetTariffByTypeAndYear } from '@/lib/db-queries';
import {
    TariffInfo,
    TariffTier,
    SewerageTier,
    BillCalculationResult,
    CustomerType,
    SewerageConnection,
    PaymentStatus,
    safeParseJsonField,
    calculateBillFromTariff
} from './billing-calculations';

// Re-export types for backward compatibility, though consumers should update imports over time
export * from './billing-calculations';

const getLiveTariffFromDB = async (type: CustomerType, year: number): Promise<TariffInfo | null> => {
    const tariff: any = await dbGetTariffByTypeAndYear(type, year);
    if (!tariff) {
        console.warn(`Tariff for ${type}/${year} not found in the database. Bill calculation cannot proceed.`);
        return null;
    }

    const tiers = safeParseJsonField<TariffTier[]>(tariff.tiers, 'tiers', 'array');
    if (!tiers || tiers.length === 0) {
        console.error(`Tariff for ${type}/${year} has no valid tiers defined.`);
        return null;
    }

    // Normalize domestic VAT threshold: if not provided or invalid, default to 15 m3
    let parsedDomesticVatThreshold = 15;
    if (tariff.domestic_vat_threshold_m3 !== undefined && tariff.domestic_vat_threshold_m3 !== null) {
        const n = Number(tariff.domestic_vat_threshold_m3);
        if (!Number.isNaN(n) && n >= 0) parsedDomesticVatThreshold = n;
    }

    return {
        customer_type: tariff.customer_type as CustomerType,
        year: tariff.year,
        tiers: tiers,
        sewerage_tiers: safeParseJsonField<SewerageTier[]>(tariff.sewerage_tiers, 'sewerage_tiers', 'array'),
        maintenance_percentage: tariff.maintenance_percentage,
        sanitation_percentage: tariff.sanitation_percentage,
        meter_rent_prices: safeParseJsonField<{ [key: string]: number }>(tariff.meter_rent_prices, 'meter_rent_prices', 'object'),
        vat_rate: tariff.vat_rate,
        domestic_vat_threshold_m3: parsedDomesticVatThreshold,
    };
};

export async function calculateBill(
    usageM3: number,
    customerType: CustomerType,
    sewerageConnection: SewerageConnection,
    meterSize: number,
    billingMonth: string, // e.g., "2024-05"
    sewerageUsageM3?: number,
    baseWaterChargeUsageM3?: number
): Promise<BillCalculationResult> {
    const emptyResult: BillCalculationResult = { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, vatAmount: 0, meterRent: 0, sewerageCharge: 0 };

    if (usageM3 < 0 || !customerType || !billingMonth || typeof billingMonth !== 'string' || !billingMonth.match(/^\d{4}-\d{2}$/)) {
        console.error(`Invalid input for bill calculation. Usage: ${usageM3}, Type: ${customerType}, Month: ${billingMonth}`);
        return emptyResult;
    }

    const year = parseInt(billingMonth.split('-')[0], 10);
    const tariffConfig = await getLiveTariffFromDB(customerType, year);

    if (!tariffConfig) {
        console.warn(`Tariff information for customer type "${customerType}" for year ${year} not found. Bill will be 0.`);
        return emptyResult;
    }

    return calculateBillFromTariff(tariffConfig, usageM3, meterSize, sewerageConnection, sewerageUsageM3, baseWaterChargeUsageM3);
}
