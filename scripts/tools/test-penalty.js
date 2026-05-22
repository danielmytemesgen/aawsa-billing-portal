
const { calculateDebtAging } = require('./src/lib/billing-utils');

// Mock data
const historicalBills = [
    { month_year: '2024-04', THISMONTHBILLAMT: 100, PENALTYAMT: 84.66, amountPaid: 0 },
    { month_year: '2024-03', THISMONTHBILLAMT: 100, PENALTYAMT: 34.24, amountPaid: 0 },
];

const outstandingBalance = 100 + 84.66 + 100 + 34.24; // Principals + both penalties

console.log("Testing with historical bills:");
console.log(JSON.stringify(historicalBills, null, 2));
console.log("Outstanding Balance:", outstandingBalance);

const result = calculateDebtAging(outstandingBalance, historicalBills, undefined, '2024-05');

console.log("\nResulting Buckets:");
console.log(result);

const expectedTotal = 100 + 84.66 + 100; // Recent penalty included, old one dropped
console.log("\nExpected Sum of Buckets (Recent Pen + Principals):", expectedTotal);
console.log("Actual Sum of Buckets:", result.debit30 + result.debit30_60 + result.debit60);

if (Math.abs((result.debit30 + result.debit30_60 + result.debit60) - expectedTotal) < 0.1) {
    console.log("\nSUCCESS: Logic correctly filtered old penalties.");
} else {
    console.log("\nFAILURE: Buckets still include old penalties or missed recent one.");
}
