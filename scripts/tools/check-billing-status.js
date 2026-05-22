const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  await client.connect();
  // Check the most recent 10 jobs to see status and progress
  const res = await client.query(`
    SELECT 
      id, 
      type, 
      status, 
      total_items, 
      processed_items, 
      month_year, 
      created_at, 
      updated_at,
      error_log
    FROM public.billing_jobs 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  
  if (res.rows.length === 0) {
    console.log("No billing jobs found.");
  } else {
    console.log(JSON.stringify(res.rows.map(row => ({
      ...row,
      progress: row.total_items > 0 ? `${((row.processed_items / row.total_items) * 100).toFixed(2)}%` : '0%'
    })), null, 2));
  }

  // Also check if there are any bills actually generated for March 2026
  const billCount = await client.query("SELECT COUNT(*) FROM bills WHERE month_year = '2026-03'");
  const meterCount = await client.query("SELECT COUNT(*) FROM bulk_meters");
  const customerCount = await client.query("SELECT COUNT(*) FROM individual_customers");

  console.log(`\n==========================================`);
  console.log(`Total Bills Generated for March 2026: ${billCount.rows[0].count}`);
  console.log(`Total Bulk Meters in System: ${meterCount.rows[0].count}`);
  console.log(`Total Individual Customers in System: ${customerCount.rows[0].count}`);
  console.log(`==========================================\n`);

  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
