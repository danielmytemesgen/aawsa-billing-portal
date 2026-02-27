import { TariffInfo } from "./billing-calculations";

/**
 * Calculates debt aging and penalties based on FIFO logic and historical bills.
 * Credit payments are assumed to have already been applied to the outstanding balance.
 * This function determines how the current outstanding balance is distributed across aging buckets
 * and calculates any penalties applicable from the 3rd month onwards.
 * 
 * @param outstandingBalance The current total outstanding balance before the new bill.
 * @param historicalBills Sorted list of historical bills (most recent first).
 * @param tariff Optional tariff configuration to fetch penalty rates.
 */
export function calculateDebtAging(outstandingBalance: number, historicalBills: any[], tariff?: TariffInfo) {
    let remainingOutstanding = outstandingBalance;
    let debit30 = 0;
    let debit30_60 = 0;
    let debit60 = 0;
    let penaltyAmt = 0;

    // Default AAWSA penalty configuration if not provided in tariff
    const threshold = tariff?.penalty_month_threshold ?? 3;
    const bankRate = tariff?.bank_lending_rate ?? 0.15;
    const tieredRates = tariff?.penalty_tiered_rates || [
        { month: 3, rate: 0.00 }, // 15% bank rate only
        { month: 4, rate: 0.10 }, // 10% penalty + 15% bank rate = 25%
        { month: 5, rate: 0.15 }, // 15% penalty + 15% bank rate = 30%
        { month: 6, rate: 0.20 }, // 20% penalty + 15% bank rate = 35%
    ];

    if (remainingOutstanding > 0.01) {
        let maxAgeMonths = 0;
        let cumulativePenaltyBase = 0;

        // Iterate through historical bills to determine buckets and cumulative penalty base
        for (let i = 0; i < historicalBills.length; i++) {
            if (remainingOutstanding <= 0.01) break;

            const bill = historicalBills[i];
            const monthlyPrincipal = bill.THISMONTHBILLAMT !== undefined && bill.THISMONTHBILLAMT !== null
                ? Number(bill.THISMONTHBILLAMT)
                : Number(bill.TOTALBILLAMOUNT);

            // In the cumulative logic, Row 1 (debit30) shows the TOTAL outstanding at that time.
            // Row 2 (debit30_60) shows the previous total, etc.
            const billTotalOutstanding = Number(bill.TOTALBILLAMOUNT) || 0;
            const unpaidFromThisBill = Math.max(0, monthlyPrincipal - Number(bill.amount_paid || 0));
            const amountForAging = Math.min(remainingOutstanding, unpaidFromThisBill);

            if (amountForAging <= 0) continue;

            const billAgeMonths = i + 1;
            maxAgeMonths = Math.max(maxAgeMonths, billAgeMonths);

            // Assign cumulative totals to buckets as requested by UI scenario
            if (billAgeMonths === 1) {
                debit30 = billTotalOutstanding;
            } else if (billAgeMonths === 2) {
                debit30_60 = billTotalOutstanding;
            } else if (billAgeMonths === 3) {
                debit60 = billTotalOutstanding;
            }

            // Cumulative base sums the TOTAL outstanding values of the unpaid months
            cumulativePenaltyBase += billTotalOutstanding;
            remainingOutstanding -= amountForAging;
        }

        // Calculate penalty based on the CUMULATIVE scenario totals if threshold is met
        if (maxAgeMonths >= threshold) {
            const applicableTier = [...tieredRates]
                .sort((a, b) => b.month - a.month)
                .find(t => maxAgeMonths >= t.month);

            const additionalRate = applicableTier?.rate || 0;
            const totalRate = bankRate + additionalRate;

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
