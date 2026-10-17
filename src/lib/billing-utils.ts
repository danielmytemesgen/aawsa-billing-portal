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
// Penalty Policy Guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * System-wide guard for penalty values.
 * When the Penalty Policy Engine is OFF (`penaltyEnabled = false`), ANY
 * penalty value — whether freshly calculated or read from the database —
 * MUST be clamped to exactly 0.
 *
 * Usage:
 *   const penalty = getPenaltyValue(Number(bill.PENALTYAMT || 0), isPenaltyEnabled);
 *
 * @param rawPenalty  The raw penalty value (from DB or calculation).
 * @param penaltyEnabled  Whether the penalty engine is currently ON (true) or OFF (false).
 * @returns 0 when OFF, otherwise the raw value unchanged.
 */
export function getPenaltyValue(rawPenalty: number, penaltyEnabled: boolean): number {
    return penaltyEnabled ? rawPenalty : 0;
}

/**
 * Inspects a list of tariffs and determines whether the penalty policy engine
 * is enabled based on the most recent effective tariff. Defaults to true.
 */
export function isPenaltyEngineEnabled(tariffs?: any[] | null): boolean {
    if (!tariffs || tariffs.length === 0) return true;
    const sorted = [...tariffs].sort(
        (a, b) => new Date(b.effective_date || 0).getTime() - new Date(a.effective_date || 0).getTime()
    );
    const latest = sorted[0];
    return latest?.penalty_enabled !== undefined && latest?.penalty_enabled !== null
        ? Boolean(latest.penalty_enabled)
        : true;
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
        use_rule_of_three: tariffRow.use_rule_of_three !== undefined && tariffRow.use_rule_of_three !== null
            ? (typeof tariffRow.use_rule_of_three === 'boolean' ? tariffRow.use_rule_of_three : Boolean(Number(tariffRow.use_rule_of_three)))
            : true,
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
        penalty_enabled: tariffRow.penalty_enabled !== undefined && tariffRow.penalty_enabled !== null
            ? (typeof tariffRow.penalty_enabled === 'boolean' ? tariffRow.penalty_enabled : Boolean(Number(tariffRow.penalty_enabled)))
            : true,
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
 *   1. Use THISMONTHBILLAMT if it is explicitly stored and > 0.
 *   2. Reconstruct from itemized components (water + sewerage + maintenance +
 *      sanitation + meter_rent + vat + additional_fees_charge) when available.
 *   3. Fallback: TOTALBILLAMOUNT − OUTSTANDINGAMT − PENALTYAMT.
 */
export function getMonthlyBillAmt(bill: any): number {
    if (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined && Number(bill.THISMONTHBILLAMT) > 0) {
        return Number(bill.THISMONTHBILLAMT);
    }
    // Reconstruct from itemized components if available
    const water = Number(bill.base_water_charge || 0);
    const sewer = Number(bill.sewerage_charge || 0);
    const maint = Number(bill.maintenance_fee || 0);
    const sanit = Number(bill.sanitation_fee || 0);
    const rent = Number(bill.meter_rent || 0);
    const vat = Number(bill.vat_amount || 0);
    const addFee = Number(bill.additional_fees_charge || 0);
    const sum = water + sewer + maint + sanit + rent + vat + addFee;
    if (sum > 0) {
        return Number(sum.toFixed(2));
    }
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
    const isPenaltyEnabled = tariff?.penalty_enabled ?? true;
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
        // Prefer month_year/monthYear field (e.g. "2024-03"), fall back to created_at/createdAt/billPeriodEndDate
        const raw = bill.month_year || bill.monthYear || bill.created_at || bill.createdAt || bill.billPeriodEndDate;
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
            // When penalty_enabled is false, historical stored penalties are also ignored.
            if (isPenaltyEnabled && remainingOutstanding > 0.01) {
                const rawHistoricalPenalty = Number(bill.PENALTYAMT || 0);
                const paidAgainstPenalty = Math.max(0, amountPaid - monthlyBillAmt);
                const unpaid = Math.max(0, rawHistoricalPenalty - paidAgainstPenalty);
                
                if (unpaid > 0.01) {
                    const toAdd = Math.min(remainingOutstanding, unpaid);
                    totalUnpaidPenaltyFromHistory += toAdd;
                    remainingOutstanding -= toAdd;
                    // Note: We do NOT add toAdd to cumulativePenaltyBase here
                }
            }
        }

        // Fix: Ensure any remaining outstanding balance older than the fetched history
        // is not lost and is properly accounted for in the debit60 (60+ days) bucket.
        if (remainingOutstanding > 0.01) {
            debit60 += remainingOutstanding;
            if (maxAgeMonths >= threshold) {
                cumulativePenaltyBase += remainingOutstanding;
            }
            remainingOutstanding = 0;
        }

        // Add the sum of all historical unpaid penalties to the debit60 bucket
        debit60 += totalUnpaidPenaltyFromHistory;

        // Calculate penalty based on maximum age if threshold is met and penalty is enabled
        if (isPenaltyEnabled && maxAgeMonths >= threshold) {
            const applicableTier = [...tieredRates]
                .sort((a, b) => b.month - a.month)
                .find(t => maxAgeMonths >= t.month);

            const additionalRate = Number(applicableTier?.rate || 0);
            const totalRate = bankRate + additionalRate;

            // Penalty is calculated ONLY on the cumulative principal base
            penaltyAmt = cumulativePenaltyBase * totalRate;
        } else {
            penaltyAmt = 0;
        }
    }

    return {
        debit30: Number(debit30.toFixed(2)),
        debit30_60: Number(debit30_60.toFixed(2)),
        debit60: Number(debit60.toFixed(2)),
        penaltyAmt: Number(penaltyAmt.toFixed(2))
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Outstanding Reconstruction Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconstructs the outstanding balance for a given bill from the billing history.
 * Prefers stored OUTSTANDINGAMT; falls back to FIFO history reconstruction with
 * penalty-aware monthly increments and partial payment deduction.
 *
 * @param billToRender   The bill whose outstanding balance is needed
 * @param billIndex      Index of billToRender in history (0 = most recent, or -1 if unknown)
 * @param history        Full billing history, sorted most-recent first
 * @param isPenaltyOn    Whether the penalty engine is currently enabled
 */
export function reconstructOutstandingForBill(
    billToRender: any,
    billIndex: number,
    history: any[],
    isPenaltyOn: boolean
): number {
    if (!billToRender) return 0;

    if (billToRender.OUTSTANDINGAMT !== null && billToRender.OUTSTANDINGAMT !== undefined) {
        return Number(billToRender.OUTSTANDINGAMT);
    }

    const getUnpaidIncrement = (b: any) => {
        if (!b) return 0;
        if (b.status === 'Deleted' || b.status === 'Void' || b.status === 'Reversed') return 0;
        if (b.paymentStatus === 'Paid') return 0;
        const penaltyPortion = getPenaltyValue(Number(b.PENALTYAMT || 0), isPenaltyOn);
        const monthlyPortion = (b.THISMONTHBILLAMT !== null && b.THISMONTHBILLAMT !== undefined)
            ? Number(b.THISMONTHBILLAMT)
            : (Number(b.TOTALBILLAMOUNT) - Number(b.OUTSTANDINGAMT ?? 0) - penaltyPortion);

        const totalThisMonth = monthlyPortion + penaltyPortion;
        const paidTowardsThisMonth = Math.max(0, Number(b.amountPaid || 0) - Number(b.OUTSTANDINGAMT ?? 0));
        return Math.max(0, totalThisMonth - paidTowardsThisMonth);
    };

    let reconstructedOutstanding = 0;

    if (billIndex !== -1 && billIndex < history.length - 1) {
        for (let j = billIndex + 1; j < history.length; j++) {
            reconstructedOutstanding += getUnpaidIncrement(history[j]);
        }
        const oldestIndex = history.length - 1;
        reconstructedOutstanding += Number(history[oldestIndex]?.balanceCarriedForward || 0);
    } else if (billIndex === history.length - 1) {
        reconstructedOutstanding = Number(billToRender.balanceCarriedForward || 0);
    } else if (history.length > 0) {
        // If billIndex was -1 (not found in history array directly)
        for (const b of history) {
            if (b.id !== billToRender.id && (!billToRender.monthYear || !b.monthYear || b.monthYear < billToRender.monthYear)) {
                reconstructedOutstanding += getUnpaidIncrement(b);
            }
        }
        const oldestIndex = history.length - 1;
        reconstructedOutstanding += Number(history[oldestIndex]?.balanceCarriedForward || 0);
    }

    return Number(reconstructedOutstanding.toFixed(2));
}
