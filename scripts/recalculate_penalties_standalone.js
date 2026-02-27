const { Client } = require('pg');
require('dotenv').config();

// Simple version of the logic from src/lib/billing-utils.ts and actions.ts
// to update existing bills with the new penalty rules.

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        // 1. Fetch all bills
        const billsRes = await client.query('SELECT * FROM bills WHERE deleted_at IS NULL');
        const bills = billsRes.rows;
        console.log(`Found ${bills.length} bills.`);

        const bankRate = 0.15; // 15% bank rate
        let updatedCount = 0;

        for (const bill of bills) {
            const customerKey = bill.CUSTOMERKEY || bill.individual_customer_id;
            if (!customerKey) continue;

            // 2. Fetch older bills for this meter to reconstruct outstanding
            const olderBillsRes = await client.query(
                'SELECT * FROM bills WHERE ("CUSTOMERKEY" = $1 OR "individual_customer_id" = $1) AND created_at < $2 AND deleted_at IS NULL ORDER BY created_at DESC',
                [customerKey, bill.created_at]
            );
            const olderBills = olderBillsRes.rows;

            const reconstructedOutstanding = olderBills.reduce((sum, b) => {
                const monthlyAmt = (b.THISMONTHBILLAMT !== null && b.THISMONTHBILLAMT !== undefined)
                    ? Number(b.THISMONTHBILLAMT)
                    : Number(b.TOTALBILLAMOUNT);
                const unpaid = Math.max(0, monthlyAmt - Number(b.amount_paid || 0));
                return sum + unpaid;
            }, 0);

            // 3. New Penalty Logic: 15% of reconstructedOutstanding
            // (Plus tiered additions if we wanted to be 100% precise with the utility, 
            // but for the "initial penalty" the user mentioned, it's 15% of total)
            const penaltyAmt = parseFloat((reconstructedOutstanding * bankRate).toFixed(2));

            const currentMonthBill = (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined)
                ? Number(bill.THISMONTHBILLAMT)
                : Number(bill.TOTALBILLAMOUNT);

            const newTotalPayable = parseFloat((currentMonthBill + reconstructedOutstanding + penaltyAmt).toFixed(2));

            // 4. Update if changed
            if (Number(bill.PENALTYAMT) !== penaltyAmt || Number(bill.TOTALBILLAMOUNT) !== newTotalPayable) {
                await client.query(
                    'UPDATE bills SET "PENALTYAMT" = $1, "TOTALBILLAMOUNT" = $2, "OUTSTANDINGAMT" = $3 WHERE id = $4',
                    [penaltyAmt, newTotalPayable, reconstructedOutstanding, bill.id]
                );
                updatedCount++;
            }
        }

        console.log(`Successfully updated ${updatedCount} bills with new penalty logic.`);
    } catch (err) {
        console.error("Error running penalty update:", err);
    } finally {
        await client.end();
    }
}

run();
