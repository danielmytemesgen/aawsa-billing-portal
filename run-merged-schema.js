const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'Da@121212',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function main() {
  console.log('Reading database/FULL_DUMP_PORTABLE.sql...');
  const sql = fs.readFileSync(path.join(__dirname, 'database/FULL_DUMP_PORTABLE.sql'), 'utf8');

  console.log('Executing SQL schema...');
  try {
    await pool.query(sql);
    console.log('✅ SQL schema executed successfully without errors!');
  } catch (err) {
    console.error('❌ SQL execution failed:', err);
  } finally {
    await pool.end();
  }
}

main();
