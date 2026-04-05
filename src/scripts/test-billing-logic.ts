
// Self-contained test script for billing logic
function calculateUsage(previous, current, dials = 6) {
    const prev = Number(previous) || 0;
    const curr = Number(current) || 0;
    const dialCount = Number(dials) || 6;
    if (curr >= prev) return curr - prev;
    const rolloverPoint = Math.pow(10, dialCount);
    return (rolloverPoint - prev) + curr;
}

function calculateDebtAging(outstandingBalance, historicalBills, threshold = 3) {
    let debit30 = 0;
    let debit30_60 = 0;
    let debit60 = 0;
    let remainingOutstanding = outstandingBalance;
    let maxAgeMonths = 0;

    for (let i = 0; i < historicalBills.length; i++) {
        if (remainingOutstanding <= 0.01) break;
        const bill = historicalBills[i];
        const unpaid = Math.max(0, bill.THISMONTHBILLAMT - (bill.amount_paid || 0));
        const amountForBucket = Math.min(remainingOutstanding, unpaid);
        if (amountForBucket <= 0) continue;

        const age = i + 1; // Simplified age for test
        maxAgeMonths = Math.max(maxAgeMonths, age);
        if (age === 1) debit30 += amountForBucket;
        else if (age === 2) debit30_60 += amountForBucket;
        else debit60 += amountForBucket;
        remainingOutstanding -= amountForBucket;
    }

    if (remainingOutstanding > 0.01) {
        debit60 += remainingOutstanding;
        maxAgeMonths = Math.max(maxAgeMonths, threshold);
    }
    return { debit30, debit30_60, debit60, maxAgeMonths };
}

console.log("--- Testing Meter Rollover ---");
console.log(`Normal: ${calculateUsage(100, 150, 5)} (Exp: 50)`);
console.log(`Rollover 5 and 99990->15: ${calculateUsage(99990, 15, 5)} (Exp: 25)`);
console.log(`Rollover 6 and 999990->20: ${calculateUsage(999990, 20, 6)} (Exp: 30)`);

console.log("\n--- Testing Debt Aging Bucketing ---");
const history = [{THISMONTHBILLAMT: 100}, {THISMONTHBILLAMT: 150}];
console.log("Aging fits (250):", calculateDebtAging(250, history));
console.log("Aging exceeds (1000):", calculateDebtAging(1000, history));
