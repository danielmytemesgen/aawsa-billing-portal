import { TariffInfo } from "./billing-calculations";

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
        for (let i = 0; i < historicalBills.length; i++) {
            if (remainingOutstanding <= 0.01) break;

            const bill = historicalBills[i];
            const monthlyBillAmt = Number(
                bill.THISMONTHBILLAMT ?? 
                (Number(bill.TOTALBILLAMOUNT || 0) - Number(bill.OUTSTANDINGAMT || 0) - Number(bill.PENALTYAMT || 0))
            );
            
            const amountPaid = Number(bill.amount_paid ?? bill.amountPaid ?? bill.AMOUNTPAID ?? 0);
            const monthlyAddition = monthlyBillAmt + Number(bill.PENALTYAMT || 0);
            const unpaidFromThisBill = Math.max(0, monthlyAddition - amountPaid);
            const amountForBucket = Math.min(remainingOutstanding, unpaidFromThisBill);

            if (amountForBucket <= 0.01) continue;

            billsWithDebtCount++;
            const billAgeMonths = getAgeMonths(bill);
            
            // To support multiple bills per month while still triggering tiered penalties,
            // we use the max of (date-based age) or (bill sequence count) for triggers.
            maxAgeMonths = Math.max(maxAgeMonths, billAgeMonths, billsWithDebtCount);
            
            cumulativePenaltyBase += amountForBucket;
            remainingOutstanding -= amountForBucket;

            // Bucket assignment based on real age
            if (billAgeMonths <= 1) {
                debit30 += amountForBucket;
            } else if (billAgeMonths === 2) {
                debit30_60 += amountForBucket;
            } else {
                debit60 += amountForBucket;
            }
        }

        // Calculate penalty based on maximum age if threshold is met
        if (maxAgeMonths >= threshold) {
            const applicableTier = [...tieredRates]
                .sort((a, b) => b.month - a.month)
                .find(t => maxAgeMonths >= t.month);

            const additionalRate = Number(applicableTier?.rate || 0);
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
