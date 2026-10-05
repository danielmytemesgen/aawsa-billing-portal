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
  const r1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'individual_customer_readings' ORDER BY ordinal_position");
  console.log('INDIVIDUAL_CUSTOMER_READINGS COLUMNS:', r1.rows.map(r => r.column_name));

  const r2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'individual_customers' ORDER BY ordinal_position");
  console.log('INDIVIDUAL_CUSTOMERS COLUMNS:', r2.rows.map(r => r.column_name));

  await pool.end();
}

run().catch(console.error);
