import { dbGetLatestApplicableTariff } from '@/lib/db-queries';
import {
    TariffInfo,
    TariffTier,
    SewerageTier,
    BillCalculationResult,
    CustomerType,
    SewerageConnection,
    PaymentStatus,
    safeParseJsonField,
    calculateBillFromTariff,
    AdditionalFee
} from './billing-calculations';

// Re-export types for backward compatibility, though consumers should update imports over time
export * from './billing-calculations';

const getLiveTariffFromDB = async (type: CustomerType, date: string): Promise<TariffInfo | null> => {
    const tariff: any = await dbGetLatestApplicableTariff(type, date);
    if (!tariff) {
        console.warn(`No applicable tariff found for ${type} on or before ${date}. Bill calculation cannot proceed.`);
        return null;
    }

    const tiers = safeParseJsonField<TariffTier[]>(tariff.tiers, 'tiers', 'array');
    if (!tiers || tiers.length === 0) {
        console.error(`Tariff found for ${type} on ${tariff.effective_date} has no valid tiers defined.`);
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
        effective_date: tariff.effective_date,
        tiers: tiers,
        sewerage_tiers: safeParseJsonField<SewerageTier[]>(tariff.sewerage_tiers, 'sewerage_tiers', 'array'),
        maintenance_percentage: tariff.maintenance_percentage,
        sanitation_percentage: tariff.sanitation_percentage,
        meter_rent_prices: safeParseJsonField<{ [key: string]: number }>(tariff.meter_rent_prices, 'meter_rent_prices', 'object'),
        vat_rate: tariff.vat_rate,
        domestic_vat_threshold_m3: parsedDomesticVatThreshold,
        additional_fees: safeParseJsonField<AdditionalFee[]>(tariff.additional_fees, 'additional_fees', 'array'),
    };
};

export async function calculateBill(
    CONS: number,
    customerType: CustomerType,
    sewerageConnection: SewerageConnection,
    meterSize: number,
    billingMonth: string, // e.g., "2024-05"
    sewerageCONS?: number,
    baseWaterChargeCONS?: number
): Promise<BillCalculationResult> {
    const emptyResult: BillCalculationResult = {
        totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0,
        sanitationFee: 0, vatAmount: 0, meterRent: 0, sewerageCharge: 0,
        additionalFeesCharge: 0
    };

    if (CONS < 0 || !customerType || !billingMonth || typeof billingMonth !== 'string' || !billingMonth.match(/^\d{4}-\d{2}$/)) {
        console.error(`Invalid input for bill calculation. Usage: ${CONS}, Type: ${customerType}, Month: ${billingMonth}`);
        return emptyResult;
    }

    // Use the last day of the month as the reference date for finding the applicable tariff
    const lookupDate = `${billingMonth}-28`; // Safe approximation or use real end of month
    const tariffConfig = await getLiveTariffFromDB(customerType, lookupDate);

    if (!tariffConfig) {
        console.warn(`Tariff information for customer type "${customerType}" for date ${lookupDate} not found. Bill will be 0.`);
        return emptyResult;
    }

    return calculateBillFromTariff(tariffConfig, CONS, meterSize, sewerageConnection, sewerageCONS, baseWaterChargeCONS);
}
