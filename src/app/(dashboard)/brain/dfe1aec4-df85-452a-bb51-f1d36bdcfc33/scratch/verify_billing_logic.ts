import { getMonthlyBillAmt } from "../../../../../lib/billing-utils";

/**
 * MOCK DATA
 */
const mockBills = [
    {
        name: "Standard Case",
        TOTALBILLAMOUNT: 1500,
        OUTSTANDINGAMT: 500,
        PENALTYAMT: 50,
        THISMONTHBILLAMT: null,
        expected: 950 // 1500 - 500 - 50
    },
    {
        name: "Missing Penalty Case",
        TOTALBILLAMOUNT: 1000,
        OUTSTANDINGAMT: 200,
        PENALTYAMT: 0,
        THISMONTHBILLAMT: null,
        expected: 800 // 1000 - 200 - 0
    },
    {
        name: "Explicit Monthly Case",
        TOTALBILLAMOUNT: 2000,
        OUTSTANDINGAMT: 1000,
        PENALTYAMT: 100,
        THISMONTHBILLAMT: 850,
        expected: 850 // Should favor THISMONTHBILLAMT if present
    },
    {
        name: "Zero Total Case",
        TOTALBILLAMOUNT: 0,
        OUTSTANDINGAMT: 0,
        PENALTYAMT: 0,
        THISMONTHBILLAMT: null,
        expected: 0
    }
];

console.log("--- BILL RECONSTRUCTION VERIFICATION ---");
let allPassed = true;

mockBills.forEach(bill => {
    const calculated = getMonthlyBillAmt(bill);
    const passed = calculated === bill.expected;
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${bill.name}`);
    console.log(`    Input: Total=${bill.TOTALBILLAMOUNT}, Arrears=${bill.OUTSTANDINGAMT}, Penalty=${bill.PENALTYAMT}, MonthlyField=${bill.THISMONTHBILLAMT}`);
    console.log(`    Expected: ${bill.expected}, Result: ${calculated}`);
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log("\nSUCCESS: All billing reconstruction edge cases passed parity test.");
} else {
    console.log("\nFAILURE: One or more cases failed.");
}
