const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'Da@121212',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: Number(process.env.POSTGRES_PORT) || 5432,
});

async function run() {
  const ind = await pool.query('SELECT "customerKeyNumber", "contractNumber", name, "paymentStatus", "currentReading" FROM individual_customers WHERE "customerKeyNumber" = $1 OR "contractNumber" = $2', ['7089321', '792303']);
  console.log('INDIVIDUAL MATCH:', ind.rows);

  const bm = await pool.query('SELECT "customerKeyNumber", "contractNumber", name, "paymentStatus", "currentReading" FROM bulk_meters WHERE "customerKeyNumber" = $1 OR "contractNumber" = $2', ['7089321', '792303']);
  console.log('BULK METER MATCH:', bm.rows);

  const bills = await pool.query('SELECT * FROM bills WHERE "customerKey" = $1 OR "CUSTOMERKEY" = $1 OR "customer_id" = $1', ['7089321']);
  console.log('BILLS MATCH:', bills.rows.length);

  await pool.end();
}

run().catch(console.error);
