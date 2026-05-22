const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the workspace root
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
  
  console.log('Adding soft-delete columns to bulk_meter_readings...');
  await client.query(`
    ALTER TABLE public.bulk_meter_readings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.bulk_meter_readings ADD COLUMN IF NOT EXISTS deleted_by UUID;
  `);
  
  console.log('Soft-delete columns verified/added successfully!');
  await client.end();
}

run().catch(e => {
  console.error('Error applying database patch:', e);
  process.exit(1);
});
