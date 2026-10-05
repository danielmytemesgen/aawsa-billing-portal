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
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bills' ORDER BY ordinal_position");
  console.log('BILLS COLUMNS:', res.rows.map(r => r.column_name));
  await pool.end();
}

run().catch(console.error);
