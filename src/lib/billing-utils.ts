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

    if (outstandingBalance > 0.01 && historicalBills.length > 0) {
        let maxAgeMonths = 0;
        let cumulativePenaltyBase = 0;
        let remainingOutstanding = outstandingBalance;

        // Iterate through historical bills (most recent first, index 0 = newest)
        for (let i = 0; i < historicalBills.length; i++) {
            if (remainingOutstanding <= 0.01) break;

            const bill = historicalBills[i];
            // Use the monthly bill amount (this period's charge only, not accumulated)
            const monthlyBillAmt = Number(bill.THISMONTHBILLAMT ?? bill.TOTALBILLAMOUNT ?? 0);
            const amountPaid = Number(bill.amount_paid || 0);
            const unpaidFromThisBill = Math.max(0, monthlyBillAmt - amountPaid);
            const amountForBucket = Math.min(remainingOutstanding, unpaidFromThisBill);

            if (amountForBucket <= 0) continue;

            const billAgeMonths = i + 1; // 1 = most recent, 2 = previous, etc.
            maxAgeMonths = Math.max(maxAgeMonths, billAgeMonths);
            cumulativePenaltyBase += amountForBucket;
            remainingOutstanding -= amountForBucket;

            // Bucket assignment: each bucket holds ONLY its own month's amount
            if (billAgeMonths === 1) {
                debit30 += amountForBucket;
            } else if (billAgeMonths === 2) {
                debit30_60 += amountForBucket;
            } else {
                // 3 months and older all go into the 60+ bucket
                debit60 += amountForBucket;
            }
        }

        // Calculate penalty based on maximum age if threshold is met
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
