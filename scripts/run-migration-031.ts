import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  console.log('--- Migration 031: Add Master Penalty Toggle to Tariffs ---');

  const migrationPath = path.join(__dirname, '../database/migrations/031_tariff_penalty_toggle.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 031 SQL...');
  await query(migrationSql);
  console.log('Migration executed successfully.');

  const check = await query(`SELECT customer_type, effective_date, penalty_enabled FROM tariffs LIMIT 5;`);
  console.log('Sample updated tariffs:', check);

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
