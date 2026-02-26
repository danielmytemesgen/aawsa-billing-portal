/**
 * Calculates debt aging based on FIFO logic and historical bills.
 * Credit payments are assumed to have already been applied to the outstanding balance.
 * This function determines how the current outstanding balance is distributed across aging buckets.
 * 
 * @param outstandingBalance The current total outstanding balance before the new bill.
 * @param historicalBills Sorted list of historical bills (most recent first).
 */
function calculateDebtAging(outstandingBalance, historicalBills) {
    let remainingOutstanding = outstandingBalance;
    let debit30 = 0;
    let debit30_60 = 0;
    let debit60 = 0;

    if (remainingOutstanding > 0.01) {
        // historicalBills is already sorted DESC by created_at (most recent first)
        if (historicalBills.length > 0) {
            const unpaidRecent = Number(historicalBills[0].TOTALBILLAMOUNT) - Number(historicalBills[0].amount_paid || 0);
            const amount = Math.min(remainingOutstanding, Math.max(0, unpaidRecent));
            debit30 = amount;
            remainingOutstanding -= amount;
        }
        if (historicalBills.length > 1 && remainingOutstanding > 0.01) {
            const unpaidPrevious = Number(historicalBills[1].TOTALBILLAMOUNT) - Number(historicalBills[1].amount_paid || 0);
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


function runTest(name, balance, historicalBills, expected) {
    const result = calculateDebtAging(balance, historicalBills);
    const passed = JSON.stringify(result) === JSON.stringify(expected);
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) {
        console.log(`   Expected: ${JSON.stringify(expected)}`);
        console.log(`   Result:   ${JSON.stringify(result)}`);
    }
}

console.log("Starting Debt Aging Logic Verification...\n");

// Scenario 1: One fully unpaid bill
runTest("Scenario 1: One fully unpaid bill", 100,
    [{ TOTALBILLAMOUNT: 100, amount_paid: 0 }],
    { debit30: 100, debit30_60: 0, debit60: 0 }
);

// Scenario 2: One partially paid bill
runTest("Scenario 2: One partially paid bill", 60,
    [{ TOTALBILLAMOUNT: 100, amount_paid: 40 }],
    { debit30: 60, debit30_60: 0, debit60: 0 }
);

// Scenario 3: Multiple unpaid bills
runTest("Scenario 3: Multiple unpaid bills", 250,
    [
        { TOTALBILLAMOUNT: 100, amount_paid: 0 }, // 30 days
        { TOTALBILLAMOUNT: 100, amount_paid: 0 }, // 60 days
        { TOTALBILLAMOUNT: 100, amount_paid: 0 }  // >60 days
    ],
    { debit30: 100, debit30_60: 100, debit60: 50 }
);

// Scenario 4: Partial payment on multiple bills
runTest("Scenario 4: Partial payment on multiple bills", 150,
    [
        { TOTALBILLAMOUNT: 100, amount_paid: 20 }, // unpaid 80
        { TOTALBILLAMOUNT: 100, amount_paid: 50 }, // unpaid 50
        { TOTALBILLAMOUNT: 100, amount_paid: 0 }   // unpaid 100
    ],
    { debit30: 80, debit30_60: 50, debit60: 20 }
);

// Scenario 5: Older debt exceeding buckets
runTest("Scenario 5: Older debt exceeding buckets", 500,
    [
        { TOTALBILLAMOUNT: 100, amount_paid: 0 },
        { TOTALBILLAMOUNT: 100, amount_paid: 0 }
    ],
    { debit30: 100, debit30_60: 100, debit60: 300 }
);

// Scenario 6: No historical bills
runTest("Scenario 6: No historical bills", 100,
    [],
    { debit30: 0, debit30_60: 0, debit60: 100 }
);

console.log("\nVerification Complete.");
