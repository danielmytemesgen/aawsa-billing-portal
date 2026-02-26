/**
 * Calculates debt aging based on FIFO logic and historical bills.
 * Credit payments are assumed to have already been applied to the outstanding balance.
 * This function determines how the current outstanding balance is distributed across aging buckets.
 * 
 * @param outstandingBalance The current total outstanding balance before the new bill.
 * @param historicalBills Sorted list of historical bills (most recent first).
 */
export function calculateDebtAging(outstandingBalance: number, historicalBills: any[]) {
    let remainingOutstanding = outstandingBalance;
    let debit30 = 0;
    let debit30_60 = 0;
    let debit60 = 0;

    if (remainingOutstanding > 0.01) {
        // historicalBills is already sorted DESC by created_at (most recent first)
        if (historicalBills.length > 0) {
            const bill = historicalBills[0];
            // Use THISMONTHBILLAMT if it exists, otherwise fall back to TOTALBILLAMOUNT
            // This handles transitioning from old records to new ones.
            const monthlyAmount = bill.THISMONTHBILLAMT !== undefined && bill.THISMONTHBILLAMT !== null ? Number(bill.THISMONTHBILLAMT) : Number(bill.TOTALBILLAMOUNT);
            const unpaidRecent = monthlyAmount - Number(bill.amount_paid || 0);
            const amount = Math.min(remainingOutstanding, Math.max(0, unpaidRecent));
            debit30 = amount;
            remainingOutstanding -= amount;
        }
        if (historicalBills.length > 1 && remainingOutstanding > 0.01) {
            const bill = historicalBills[1];
            const monthlyAmount = bill.THISMONTHBILLAMT !== undefined && bill.THISMONTHBILLAMT !== null ? Number(bill.THISMONTHBILLAMT) : Number(bill.TOTALBILLAMOUNT);
            const unpaidPrevious = monthlyAmount - Number(bill.amount_paid || 0);
            const amount = Math.min(remainingOutstanding, Math.max(0, unpaidPrevious));
            debit30_60 = amount;
            remainingOutstanding -= amount;
        }
        if (remainingOutstanding > 0.01) {
            debit60 = remainingOutstanding;
        }
    }
    return { debit30, debit30_60, debit60 };
}
