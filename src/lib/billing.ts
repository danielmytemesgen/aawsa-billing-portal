import { dbGetLatestApplicableTariff } from '@/lib/db-queries';
import {
    BillCalculationResult,
    CustomerType,
    SewerageConnection,
    calculateBillFromTariff,
} from './billing-calculations';
import { getEndDayOfMonth, normalizeTariff } from './billing-utils';

// Re-export types for backward compatibility, though consumers should update imports over time
export * from './billing-calculations';

const getLiveTariffFromDB = async (type: CustomerType, date: string) => {
    const tariff: any = await dbGetLatestApplicableTariff(type, date);
    if (!tariff) {
        console.warn(`No applicable tariff found for ${type} on or before ${date}. Bill calculation cannot proceed.`);
        return null;
    }

    const normalized = normalizeTariff(tariff);
    if (!normalized.tiers || normalized.tiers.length === 0) {
        console.error(`Tariff found for ${type} on ${tariff.effective_date} has no valid tiers defined.`);
        return null;
    }

    return normalized;
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
        additionalFeesCharge: 0, effectiveUsage: CONS < 0 ? 0 : CONS
    };

    if (!customerType || !billingMonth || typeof billingMonth !== 'string' || !billingMonth.match(/^\d{4}-\d{2}$/)) {
        console.error(`Invalid input for bill calculation. Usage: ${CONS}, Type: ${customerType}, Month: ${billingMonth}`);
        return emptyResult;
    }

    // Negative consumption means individual sub-meter readings exceed bulk meter reading.
    // This is a data integrity problem (bad reading, meter rollover, or data entry error).
    // We must NOT silently return a zero bill — throw so the caller can surface the issue.
    if (CONS < 0) {
        throw new Error(
            `Negative consumption detected (${CONS} m³) for ${customerType} in ${billingMonth}. ` +
            `Individual sub-meter usage exceeds bulk meter reading. ` +
            `Please verify meter readings before generating a bill.`
        );
    }

    // Use the actual last day of the month to find the applicable tariff.
    // This replaces the previous '-28' hard-code which could miss tariffs starting on the 29th-31st.
    const lookupDate = getEndDayOfMonth(billingMonth);
    const tariffConfig = await getLiveTariffFromDB(customerType, lookupDate);

    if (!tariffConfig) {
        console.warn(`Tariff information for customer type "${customerType}" for date ${lookupDate} not found. Bill will be 0.`);
        return emptyResult;
    }

    return calculateBillFromTariff(tariffConfig, CONS, meterSize, sewerageConnection, sewerageCONS, baseWaterChargeCONS);
}
