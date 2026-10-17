import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  const res: any = await query(`
    SELECT id, "CUSTOMERKEY", month_year, "PREVREAD", "CURRREAD", "CONS", difference_usage,
           debit_30, debit_30_60, debit_60, "PENALTYAMT", "OUTSTANDINGAMT", "THISMONTHBILLAMT", "TOTALBILLAMOUNT", payment_status, status
    FROM bills
    WHERE "CUSTOMERKEY" ILIKE '%93492395%'
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  console.log('BILLS FOR BM-93492395:', JSON.stringify(res, null, 2));

  const tariffs: any = await query(`
    SELECT id, customer_type, effective_date, penalty_enabled, penalty_month_threshold, bank_lending_rate
    FROM tariffs
    ORDER BY effective_date DESC;
  `);
  console.log('ALL TARIFFS:', JSON.stringify(tariffs, null, 2));
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
