require('dotenv').config({ path: './.env.production' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT || 5432),
});

async function main() {
  const client = await pool.connect();
  try {
    // 1) Find recent posted bill
    const res = await client.query(`SELECT * FROM bills WHERE status = 'Posted' ORDER BY updated_at DESC LIMIT 1`);
    const bill = res.rows[0];
    if (!bill) {
      console.error('No posted bill found.');
      return;
    }
    console.log('Selected bill:', bill.BILLKEY || bill.bill_number || bill.id);

    const amount = Number(bill.TOTALBILLAMOUNT || bill.amount_paid || 0);
    const now = new Date();

    // 2) Update bill
    const upd = await client.query(
      `UPDATE bills SET payment_status = 'Paid', status = 'Posted', amount_paid = GREATEST(COALESCE(amount_paid,0), $1), "OUTSTANDINGAMT" = 0.00, last_payment_date = $2, reconciliation_status = $3, payment_channel = $4, bank_ref = $5, updated_at = NOW() WHERE id = $6 RETURNING id, "BILLKEY", payment_status, amount_paid, reconciliation_status, bank_ref`,
      [amount, now, 'reconciled', 'Cash', 'TEST-CSV-VERIF', bill.id]
    );
    console.log('Update result:', upd.rows[0]);

    // 3) Inspect payments columns to choose compatible INSERT
    const colsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'payments'`);
    const cols = colsRes.rows.map(r => r.column_name);
    const hasBillMonth = cols.includes('bill_month_year');

    if (hasBillMonth) {
      const pay = await client.query(
        `INSERT INTO payments (bill_id, bill_month_year, individual_customer_id, bulk_meter_id, amount_paid, payment_method, transaction_reference, processed_by_staff_id, payment_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [bill.id, bill.month_year, bill.individual_customer_id || null, bill.CUSTOMERKEY || null, amount, 'Cash', 'TEST-CSV-VERIF', null, now, 'CSV Payment Update: Recon=reconciled']
      );
      console.log('Inserted payment id:', pay.rows[0]?.id);
    } else {
      const pay = await client.query(
        `INSERT INTO payments (bill_id, individual_customer_id, bulk_meter_id, amount_paid, payment_method, transaction_reference, processed_by_staff_id, payment_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [bill.id, bill.individual_customer_id || null, bill.CUSTOMERKEY || null, amount, 'Cash', 'TEST-CSV-VERIF', null, now, 'CSV Payment Update: Recon=reconciled']
      );
      console.log('Inserted payment id:', pay.rows[0]?.id);
    }

    // 4) Verify recent payments for bill (pick only existing columns)
    const desiredCols = ['id','bill_id','bulk_meter_id','individual_customer_id','amount_paid','payment_method','transaction_reference','payment_date','created_at'];
    const available = cols; // from earlier
    const selCols = desiredCols.filter(c => available.includes(c));
    const payments = await client.query(`SELECT ${selCols.join(', ')} FROM payments WHERE bill_id = $1 ORDER BY ${available.includes('created_at') ? 'created_at' : (available.includes('payment_date') ? 'payment_date' : 'id')} DESC LIMIT 10`, [bill.id]);
    console.log('Recent payments for bill:', payments.rows);

    // 5) Show updated bill
    const updated = await client.query(`SELECT id, "BILLKEY", payment_status, reconciliation_status, amount_paid, bank_ref, last_payment_date FROM bills WHERE id = $1`, [bill.id]);
    console.log('Updated bill row:', updated.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });
