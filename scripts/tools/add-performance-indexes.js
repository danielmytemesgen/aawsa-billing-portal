const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from workspace root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  console.log('Connecting to database...');
  await client.connect();

  console.log('Creating database indexes for performance tuning...');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bills_customer_month 
    ON bills("CUSTOMERKEY", month_year) 
    WHERE deleted_at IS NULL;
  `);
  console.log('- Created idx_bills_customer_month');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bills_indiv_month 
    ON bills(individual_customer_id, month_year) 
    WHERE deleted_at IS NULL;
  `);
  console.log('- Created idx_bills_indiv_month');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_readings_cust_date 
    ON individual_customer_readings("CUST_KEY", "READING_DATE") 
    WHERE deleted_at IS NULL;
  `);
  console.log('- Created idx_readings_cust_date');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bulk_readings_cust_date 
    ON bulk_meter_readings("CUST_KEY", "READING_DATE") 
    WHERE deleted_at IS NULL;
  `);
  console.log('- Created idx_bulk_readings_cust_date');

  console.log('All indexes created successfully!');
  await client.end();
}

run().catch(e => {
  console.error('Failed to create indexes:', e);
  process.exit(1);
});
