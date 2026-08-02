import 'dotenv/config';
import { query, closePool } from '../src/lib/db';
import { dbBatchUpdatePaymentsFromCsv } from '../src/lib/db-queries';

async function main() {
  console.log('Using .env from project root (dotenv loaded)');

  // 1) Find a candidate bill to test with
  let rows: any = await query(`SELECT * FROM bills WHERE status = 'Posted' ORDER BY updated_at DESC LIMIT 1`);
  const bill = rows && rows[0];
  if (!bill) {
    console.error('No posted bills found to test against. Aborting.');
    await closePool();
    process.exit(1);
  }

  console.log('Selected bill:', bill.BILLKEY || bill.bill_number || bill.id);

  // 2) Prepare a test CSV-like record
  const record = {
    billKey: bill.BILLKEY || bill.bill_number || bill.id,
    customerKey: bill.CUSTOMERKEY || bill.individual_customer_id || null,
    customerName: bill.CUSTOMERNAME || null,
    amount: Number(bill.TOTALBILLAMOUNT || bill.amount_paid || 0),
    paymentDate: new Date().toISOString(),
    reconciliationStatus: 'reconciled',
    paymentChannel: 'Cash',
    bankRef: 'TEST-CSV-VERIF',
  };

  console.log('Invoking dbBatchUpdatePaymentsFromCsv with a single test record...');
  try {
    const result = await dbBatchUpdatePaymentsFromCsv([record], null as any);
    console.log('dbBatchUpdatePaymentsFromCsv result:', result);
  } catch (err: any) {
    console.error('Error running CSV update:', err?.message || err);
  }

  // 3) Verify payments rows for the bill
  try {
    const payments = await query(`SELECT p.id, p.bill_id, p.bulk_meter_id, p.individual_customer_id, p.amount_paid, p.payment_method, p.transaction_reference, p.created_at FROM payments p WHERE p.bill_id = $1 ORDER BY p.created_at DESC LIMIT 10`, [bill.id]);
    console.log('Recent payments for bill:', payments);
  } catch (err: any) {
    console.error('Error querying payments:', err?.message || err);
  }

  // 4) Print updated bill state
  try {
    const updated = await query(`SELECT id, "BILLKEY", payment_status, reconciliation_status, amount_paid, bank_ref, last_payment_date FROM bills WHERE id = $1`, [bill.id]);
    console.log('Updated bill row:', updated[0]);
  } catch (err: any) {
    console.error('Error querying bill:', err?.message || err);
  }

  await closePool();
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
