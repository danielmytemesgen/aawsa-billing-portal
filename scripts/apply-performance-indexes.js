const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'Da@121212',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

const statements = [
  `CREATE INDEX IF NOT EXISTS idx_bills_dashboard_agg ON bills (month_year, status, payment_status, branch_id) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills (created_at) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_bills_customerkey ON bills ("CUSTOMERKEY", month_year) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_bills_ind_customer ON bills (individual_customer_id, month_year) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_ind_customers_branch_status ON individual_customers (branch_id, status) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_ind_customers_created_at ON individual_customers (created_at) WHERE deleted_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_bulk_meters_branch_status ON bulk_meters (branch_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_bulk_meters_created_at ON bulk_meters ("createdAt");`,
  `CREATE INDEX IF NOT EXISTS idx_bm_readings_cust_date ON bulk_meter_readings ("CUST_KEY", "READING_DATE");`
];

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    for (const sql of statements) {
      try {
        await client.query(sql);
        console.log('Applied:', sql.slice(0, 60) + '...');
      } catch (e) {
        console.warn('Skipped/Warning:', e.message);
      }
    }
    console.log('Performance indexes application completed.');
  } catch (err) {
    console.error('Error connecting:', err);
  } finally {
    await client.end();
  }
}

run();
