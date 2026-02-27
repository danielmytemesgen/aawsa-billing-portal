const { calculateDebtAging } = require('./src/lib/billing-utils');

// Mock data from user screenshot
// Outstanding = 666.18
// Column labels: DEBIT_30, DEBIT_30_60, DEBIT_60
// Row 1: 333.09, 222.06, 111.03. Penalty=49.96.
// Row 2: 222.06, 111.03, nil. Penalty=33.31.
// Row 3: 111.03, nil, nil. Penalty=16.65.
// Note: 111.03 seems to be the monthly bill amount (THISMONTHBILLAMT).

const outstandingBalance = 666.18;
const historicalBills = [
    { THISMONTHBILLAMT: 111.03, TOTALBILLAMOUNT: 333.09, amount_paid: 0 }, // Bill from Month-1 (at least 1 month old debt)
    { THISMONTHBILLAMT: 111.03, TOTALBILLAMOUNT: 222.06, amount_paid: 0 }, // Bill from Month-2
    { THISMONTHBILLAMT: 111.03, TOTALBILLAMOUNT: 111.03, amount_paid: 0 }  // Bill from Month-3
];
const tariff = {
    penalty_month_threshold: 3,
    bank_lending_rate: 0.15,
    penalty_tiered_rates: [
        { month: 3, rate: 0.00 },
        { month: 4, rate: 0.10 }
    ]
};

console.log('Testing with maxAgeMonths calculation...');
const result = calculateDebtAging(outstandingBalance, historicalBills, tariff);
console.log('Result:', JSON.stringify(result, null, 2));
console.log('Expected for 15% rate: 666.18 * 0.15 =', (666.18 * 0.15).toFixed(2));
