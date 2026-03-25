const fs = require('fs');
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
  const sql = fs.readFileSync(path.join(__dirname, 'database/migrations/030_create_system_settings.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration OK');
  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
