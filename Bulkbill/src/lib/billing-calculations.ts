
export const customerTypes = ["Domestic", "Non-domestic", "rental Non domestic", "rental domestic"] as const;
export type CustomerType = (typeof customerTypes)[number];

export const sewerageConnections = ["Yes", "No"] as const;
export type SewerageConnection = (typeof sewerageConnections)[number];

export const paymentStatuses = ['Paid', 'Unpaid', 'Pending'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export interface TariffTier {
    rate: number;
    limit: number | "Infinity";
}

export interface SewerageTier {
    rate: number;
    limit: number | "Infinity";
}

export interface TariffInfo {
    customer_type: CustomerType;
    year: number;
    tiers: TariffTier[];
    sewerage_tiers: SewerageTier[];
    maintenance_percentage: number;
    sanitation_percentage: number;
    meter_rent_prices: { [key: string]: number; };
    vat_rate: number;
    domestic_vat_threshold_m3: number;
}

export interface BillCalculationResult {
    totalBill: number;
    baseWaterCharge: number;
    maintenanceFee: number;
    sanitationFee: number;
    vatAmount: number;
    meterRent: number;
    sewerageCharge: number;
    waterTierBreakdown?: Array<{ start: number; end: number | typeof Infinity; usage: number; rate: number; charge: number }>;
    sewerageTierBreakdown?: Array<{ start: number; end: number | typeof Infinity; usage: number; rate: number; charge: number }>;
}

export const safeParseJsonField = <T>(field: any, fieldName: string, expectedType: 'array' | 'object'): T => {
    const fallback: any = expectedType === 'array' ? [] : {};
    if (field === null || field === undefined) {
        console.warn(`Tariff field '${fieldName}' is null or undefined. Using fallback.`);
        return fallback as T;
    }
    if (typeof field === 'object') {
        if (expectedType === 'array' && !Array.isArray(field)) {
            console.error(`Tariff field '${fieldName}' was expected to be an array but is an object.`);
            return fallback as T;
        }
        if (expectedType === 'object' && Array.isArray(field)) {
            console.error(`Tariff field '${fieldName}' was expected to be an object but is an array.`);
            return fallback as T;
        }
        return field as T;
    }
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            if (expectedType === 'array' && Array.isArray(parsed)) return parsed as T;
            if (expectedType === 'object' && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T;
            console.error(`Tariff field '${fieldName}' JSON string parsed to the wrong type.`);
            return fallback as T;
        } catch (e) {
            console.error(`Failed to parse JSON for ${fieldName}:`, e);
            return fallback as T;
        }
    }
    console.error(`Tariff field '${fieldName}' has an unexpected type: ${typeof field}`);
    return fallback as T;
};

/**
 * Pure calculation function that performs bill calculation given a full TariffInfo
 */
export function calculateBillFromTariff(
    tariffConfig: TariffInfo,
    usageM3: number,
    meterSize: number,
    sewerageConnection: SewerageConnection,
    sewerageUsageM3?: number,
    baseWaterChargeUsageM3?: number
): BillCalculationResult {
    const emptyResult: BillCalculationResult = { totalBill: 0, baseWaterCharge: 0, maintenanceFee: 0, sanitationFee: 0, vatAmount: 0, meterRent: 0, sewerageCharge: 0 };

    const usageForBaseWaterCharge = baseWaterChargeUsageM3 !== undefined ? baseWaterChargeUsageM3 : usageM3;
    if (usageForBaseWaterCharge < 0) return emptyResult;

    const sortedTiers = (tariffConfig.tiers || []).sort((a, b) => {
        const limitA = a.limit === "Infinity" ? Infinity : Number(a.limit);
        const limitB = b.limit === "Infinity" ? Infinity : Number(b.limit);
        return limitA - limitB;
    });

    if (sortedTiers.length === 0) return emptyResult;

    let baseWaterCharge = 0;
    const customerType = tariffConfig.customer_type;

    if (customerType === 'Domestic') {
        let remainingUsage = usageForBaseWaterCharge;
        let lastLimit = 0;
        for (const tier of sortedTiers) {
            if (remainingUsage <= 0) break;
            const tierLimit = tier.limit === "Infinity" ? Infinity : Number(tier.limit);
            const tierRate = Number(tier.rate);
            const tierBlockSize = tierLimit - lastLimit;
            const usageInThisTier = Math.min(remainingUsage, tierBlockSize);
            baseWaterCharge += usageInThisTier * tierRate;
            remainingUsage -= usageInThisTier;
            lastLimit = tierLimit;
        }
    } else if (customerType === 'rental domestic' || customerType === 'rental Non domestic') {
        if (sortedTiers.length >= 4) {
            const fourthTierRate = Number(sortedTiers[3].rate);
            baseWaterCharge = Number(usageForBaseWaterCharge) * fourthTierRate;
        } else if (sortedTiers.length > 0) {
            // Fallback if less than 4 tiers are defined, use the highest tier.
            const highestTierRate = Number(sortedTiers[sortedTiers.length - 1].rate);
            baseWaterCharge = Number(usageForBaseWaterCharge) * highestTierRate;
        }
    } else if (customerType === 'Non-domestic') {
        let applicableRate = 0;
        for (const tier of sortedTiers) {
            const tierLimit = tier.limit === "Infinity" ? Infinity : Number(tier.limit);
            applicableRate = Number(tier.rate);
            if (usageForBaseWaterCharge <= tierLimit) break;
        }
        baseWaterCharge = Number(usageForBaseWaterCharge) * Number(applicableRate);
    }

    const maintenanceFee = (tariffConfig.maintenance_percentage || 0) * baseWaterCharge;
    const sanitationFee = (tariffConfig.sanitation_percentage || 0) * baseWaterCharge;

    let vatAmount = 0;
    if ((customerType === 'Domestic' || customerType === 'rental domestic') && usageM3 > tariffConfig.domestic_vat_threshold_m3) {
        vatAmount = baseWaterCharge * (tariffConfig.vat_rate || 0);
    } else if (customerType === 'Non-domestic' || customerType === 'rental Non domestic') {
        vatAmount = baseWaterCharge * (tariffConfig.vat_rate || 0);
    }

    const meterRentPrices = tariffConfig.meter_rent_prices || {};
    // Robust meter rent lookup: keys in DB may be '0.75', '3/4', '3/4"', '1', etc.
    const meterSizeStringKey = String(meterSize);
    const parseNumericKey = (k: string) => {
        if (!k) return NaN;
        const cleaned = k.replace(/[^0-9.\/-]/g, '').trim();
        // handle fraction like 3/4
        if (/^\d+\/\d+$/.test(cleaned)) {
            const [a, b] = cleaned.split('/').map(Number);
            if (b) return a / b;
        }
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : NaN;
    };

    const keys = Object.keys(meterRentPrices || {});
    let meterRent = 0;

    // 1) exact string match
    if (meterRentPrices[meterSizeStringKey] !== undefined) {
        meterRent = Number(meterRentPrices[meterSizeStringKey]) || 0;
    } else {
        // 2) try numeric key match by parsing keys
        const target = Number(meterSize);
        let bestMatch: { key: string; num: number } | null = null;
        for (const k of keys) {
            const num = parseNumericKey(k);
            if (!Number.isNaN(num)) {
                if (Math.abs(num - target) < 1e-6) { bestMatch = { key: k, num }; break; }
                if (!bestMatch) bestMatch = { key: k, num };
            }
        }
        if (bestMatch && meterRentPrices[bestMatch.key] !== undefined) {
            meterRent = Number(meterRentPrices[bestMatch.key]) || 0;
        } else {
            // 3) try common fraction labels (e.g., 0.75 -> '3/4')
            const fractionMap: Record<string, string> = {
                '0.5': '1/2', '0.75': '3/4', '1.25': '1 1/4', '1.5': '1 1/2', '2.5': '2 1/2'
            };
            const fracLabel = fractionMap[String(meterSize)];
            if (fracLabel && meterRentPrices[fracLabel] !== undefined) {
                meterRent = Number(meterRentPrices[fracLabel]) || 0;
            }
        }
    }

    const usageForSewerage = sewerageUsageM3 !== undefined ? sewerageUsageM3 : usageM3;
    let sewerageCharge = 0;
    if (sewerageConnection === "Yes" && tariffConfig.sewerage_tiers && tariffConfig.sewerage_tiers.length > 0) {
        const sortedSewerageTiers = tariffConfig.sewerage_tiers.sort((a, b) => (a.limit === "Infinity" ? Infinity : Number(a.limit)) - (b.limit === "Infinity" ? Infinity : Number(b.limit)));
        if (customerType === 'Domestic' || customerType === 'rental domestic') {
            let remainingUsage = usageForSewerage;
            let lastLimit = 0;
            for (const tier of sortedSewerageTiers) {
                if (remainingUsage <= 0) break;
                const tierLimit = tier.limit === "Infinity" ? Infinity : Number(tier.limit);
                const tierRate = Number(tier.rate);
                const tierBlockSize = tierLimit - lastLimit;
                const usageInThisTier = Math.min(remainingUsage, tierBlockSize);
                sewerageCharge += usageInThisTier * tierRate;
                remainingUsage -= usageInThisTier;
                lastLimit = tierLimit;
            }
        } else { // This will correctly handle 'Non-domestic' and 'rental Non domestic'
            let applicableRate = 0;
            for (const tier of sortedSewerageTiers) {
                const tierLimit = tier.limit === "Infinity" ? Infinity : Number(tier.limit);
                applicableRate = Number(tier.rate);
                if (usageForSewerage <= tierLimit) break;
            }
            sewerageCharge = Number(usageForSewerage) * Number(applicableRate);
        }
    }

    const totalBill = baseWaterCharge + maintenanceFee + sanitationFee + vatAmount + meterRent + sewerageCharge;

    return {
        totalBill: parseFloat(totalBill.toFixed(2)),
        baseWaterCharge: parseFloat(baseWaterCharge.toFixed(2)),
        maintenanceFee: parseFloat(maintenanceFee.toFixed(2)),
        sanitationFee: parseFloat(sanitationFee.toFixed(2)),
        vatAmount: parseFloat(vatAmount.toFixed(2)),
        meterRent: parseFloat(meterRent.toFixed(2)),
        sewerageCharge: parseFloat(sewerageCharge.toFixed(2)),
    };
}
