import { AdditionalFee, safeParseJsonField, SewerageTier, TariffInfo, TariffTier } from "./billing-calculations";

// ─────────────────────────────────────────────────────────────────────────────
// Shared date utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the actual last day of a billing month as a date string (YYYY-MM-DD).
 * E.g. "2024-02" → "2024-02-29" (leap year), "2024-01" → "2024-01-31".
 * This replaces the previous hardcoded "-28" approximation used in billing.ts
 * and the "-31" approximation used in data-store.ts, unifying them.
 */
export function getEndDayOfMonth(monthYear: string): string {
    // Use the last day of the month by constructing day 0 of the following month
    const [year, month] = monthYear.split('-').map(Number);
    if (!year || !month) return `${monthYear}-28`; // fallback safeguard
    const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
    return `${monthYear}-${String(lastDay).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tariff normalisation — single source of defaults
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a raw DB tariff row into a typed TariffInfo with consistent defaults.
 * Centralises safe JSON parsing and default application so every code path
 * (server billing.ts, client data-store.ts) produces the same result.
 */
export function normalizeTariff(tariffRow: any): TariffInfo {
    let parsedDomesticVatThreshold = 15;
    if (tariffRow.domestic_vat_threshold_m3 !== undefined && tariffRow.domestic_vat_threshold_m3 !== null) {
        const n = Number(tariffRow.domestic_vat_threshold_m3);
        if (!Number.isNaN(n) && n >= 0) parsedDomesticVatThreshold = n;
    }

    return {
        customer_type: tariffRow.customer_type,
        effective_date: tariffRow.effective_date,
        tiers: safeParseJsonField<TariffTier[]>(tariffRow.tiers, 'tiers', 'array'),
        sewerage_tiers: safeParseJsonField<SewerageTier[]>(tariffRow.sewerage_tiers, 'sewerage_tiers', 'array'),
        maintenance_percentage: Number(tariffRow.maintenance_percentage ?? 0),
        sanitation_percentage: Number(tariffRow.sanitation_percentage ?? 0),
        meter_rent_prices: safeParseJsonField<{ [key: string]: number }>(tariffRow.meter_rent_prices, 'meter_rent_prices', 'object'),
        vat_rate: Number(tariffRow.vat_rate ?? 0),
        domestic_vat_threshold_m3: parsedDomesticVatThreshold,
        additional_fees: safeParseJsonField<AdditionalFee[]>(tariffRow.additional_fees, 'additional_fees', 'array'),
        // Strictly respect the database configuration
        fixed_tier_index: tariffRow.fixed_tier_index !== undefined && tariffRow.fixed_tier_index !== null
            ? Number(tariffRow.fixed_tier_index)
            : undefined,
        use_rule_of_three: Boolean(tariffRow.use_rule_of_three),
        // Penalty fields (passed through as-is; calculateDebtAging reads them)
        penalty_month_threshold: tariffRow.penalty_month_threshold !== undefined && tariffRow.penalty_month_threshold !== null
            ? Number(tariffRow.penalty_month_threshold)
            : undefined,
        bank_lending_rate: tariffRow.bank_lending_rate !== undefined && tariffRow.bank_lending_rate !== null
            ? Number(tariffRow.bank_lending_rate)
            : undefined,
        penalty_tiered_rates: Array.isArray(tariffRow.penalty_tiered_rates)
            ? tariffRow.penalty_tiered_rates
            : (typeof tariffRow.penalty_tiered_rates === 'string'
                ? safeParseJsonField<{ month: number; rate: number }[]>(tariffRow.penalty_tiered_rates, 'penalty_tiered_rates', 'array')
                : undefined),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bill data normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the "this month's bill" portion for any stored DomainBill / raw bill row.
 * Centralises the reconstruction formula so UI components, debt-aging, and
 * billing-history tables all compute the same value.
 *
 * Priority:
 *   1. Use THISMONTHBILLAMT if it is explicitly stored.
 *   2. Reconstruct as TOTALBILLAMOUNT − OUTSTANDINGAMT − PENALTYAMT.
 */
export function getMonthlyBillAmt(bill: any): number {
    if (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined) {
        return Number(bill.THISMONTHBILLAMT);
    }
    return Math.max(
        0,
        Number(bill.TOTALBILLAMOUNT || 0)
        - Number(bill.OUTSTANDINGAMT || 0)
        - Number(bill.PENALTYAMT || 0)
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Debt aging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates debt aging and penalties based on FIFO logic and historical bills.
 * Age is determined by the bill's actual month_year field, not array position,
 * so gaps in billing history are handled correctly.
 *
 * @param outstandingBalance The current total outstanding balance before the new bill.
 * @param historicalBills Sorted list of historical bills (most recent first).
 * @param tariff Optional tariff configuration to fetch penalty rates.
 * @param currentMonthYear The billing month being processed (e.g. "2024-05"). Defaults to now.
 */
export function calculateDebtAging(
    outstandingBalance: number,
    historicalBills: any[],
    tariff?: TariffInfo,
    currentMonthYear?: string
) {
    let debit30 = 0;    // Amount from 1 month old bill
    let debit30_60 = 0; // Amount from 2 months old bill
    let debit60 = 0;    // Sum of all amounts from 3+ months old bills
    let penaltyAmt = 0;

    // Default AAWSA penalty configuration if not provided in tariff
    const threshold = tariff?.penalty_month_threshold ?? 3;
    const bankRate = tariff?.bank_lending_rate ?? 0.15;
    const tieredRates = tariff?.penalty_tiered_rates || [
        { month: 3, rate: 0.00 },
        { month: 4, rate: 0.10 },
        { month: 5, rate: 0.15 },
        { month: 6, rate: 0.20 },
    ];

    // Determine reference month for age calculation
    const refDate = currentMonthYear
        ? new Date(`${currentMonthYear}-01`)
        : new Date();

    const getAgeMonths = (bill: any): number => {
        // Prefer month_year field (e.g. "2024-03"), fall back to created_at
        const raw = bill.month_year || bill.created_at;
        if (!raw) return 0;
        const billDate = new Date(typeof raw === 'string' && raw.length === 7 ? `${raw}-01` : raw);
        if (isNaN(billDate.getTime())) return 0;
        const yearDiff = refDate.getFullYear() - billDate.getFullYear();
        const monthDiff = refDate.getMonth() - billDate.getMonth();
        return Math.max(0, yearDiff * 12 + monthDiff);
    };

    if (outstandingBalance > 0.01 && historicalBills.length > 0) {
        let maxAgeMonths = 0;
        let cumulativePenaltyBase = 0;
        let remainingOutstanding = outstandingBalance;

        // Iterate through historical bills (most recent first, index 0 = newest)
        let billsWithDebtCount = 0;
        let totalUnpaidPenaltyFromHistory = 0;

        for (let i = 0; i < historicalBills.length; i++) {
            if (remainingOutstanding <= 0.01) break;

            const bill = historicalBills[i];
            const monthlyBillAmt = getMonthlyBillAmt(bill);
            const amountPaid = Number(bill.amount_paid ?? bill.amountPaid ?? bill.AMOUNTPAID ?? 0);
            
            // 1. Calculate unpaid Principal for this bill
            const unpaidPrincipal = Math.max(0, monthlyBillAmt - amountPaid);
            const principalForBucket = Math.min(remainingOutstanding, unpaidPrincipal);

            if (principalForBucket > 0.01) {
                billsWithDebtCount++;
                const billAgeMonths = getAgeMonths(bill);
                maxAgeMonths = Math.max(maxAgeMonths, billAgeMonths, billsWithDebtCount);
                
                // Add to penalty base (Principal ONLY)
                cumulativePenaltyBase += principalForBucket;

                // Principal bucket assignment
                if (billAgeMonths <= 1) {
                    debit30 += principalForBucket;
                } else if (billAgeMonths === 2) {
                    debit30_60 += principalForBucket;
                } else {
                    debit60 += principalForBucket;
                }
                remainingOutstanding -= principalForBucket;
            }

            // 2. Handle Penalty: Find ALL historical unpaid penalties
            // They are added to debit60 but NOT to cumulativePenaltyBase to prevent compounding.
            if (remainingOutstanding > 0.01) {
                const penaltyAmt = Number(bill.PENALTYAMT || 0);
                const paidAgainstPenalty = Math.max(0, amountPaid - monthlyBillAmt);
                const unpaid = Math.max(0, penaltyAmt - paidAgainstPenalty);
                
                if (unpaid > 0.01) {
                    const toAdd = Math.min(remainingOutstanding, unpaid);
                    totalUnpaidPenaltyFromHistory += toAdd;
                    remainingOutstanding -= toAdd;
                    // Note: We do NOT add toAdd to cumulativePenaltyBase here
                }
            }
        }

        // Add the sum of all historical unpaid penalties to the debit60 bucket
        debit60 += totalUnpaidPenaltyFromHistory;

        // Calculate penalty based on maximum age if threshold is met
        if (maxAgeMonths >= threshold) {
            const applicableTier = [...tieredRates]
                .sort((a, b) => b.month - a.month)
                .find(t => maxAgeMonths >= t.month);

            const additionalRate = Number(applicableTier?.rate || 0);
            const totalRate = bankRate + additionalRate;

            // Penalty is calculated ONLY on the cumulative principal base
            penaltyAmt = cumulativePenaltyBase * totalRate;
        }
    }

    return {
        debit30: Number(debit30.toFixed(2)),
        debit30_60: Number(debit30_60.toFixed(2)),
        debit60: Number(debit60.toFixed(2)),
        penaltyAmt: Number(penaltyAmt.toFixed(2))
    };
}
