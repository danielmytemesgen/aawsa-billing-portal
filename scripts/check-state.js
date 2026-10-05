require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: String(process.env.POSTGRES_PASSWORD),
  database: process.env.POSTGRES_DB,
  port: 5432,
});

async function main() {
  const b = await pool.query('SELECT id, "CUSTOMERKEY", individual_customer_id, status, month_year, "THISMONTHBILLAMT", "TOTALBILLAMOUNT" FROM bills WHERE "CUSTOMERKEY" ILIKE \'%55176736%\' OR individual_customer_id ILIKE \'%55176736%\'');
  console.log('Bills matches:', b.rows);

  await pool.end();
}

main().catch(console.error);
