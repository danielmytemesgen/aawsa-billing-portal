import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  console.log('--- Migration 033: Bulk Meter Difference Distributions & Apportionment Tables ---');

  const migrationPath = path.join(__dirname, '../database/migrations/033_bulk_difference_distribution.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 033 SQL...');
  await query(migrationSql);
  console.log('Migration 033 executed successfully.');

  // Verify tables and columns in information_schema
  const tables = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('bulk_difference_distributions', 'bulk_difference_apportionment_items');
  `);
  console.log('Created tables verified in database:', tables);

  const distCols = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bulk_difference_distributions'
    ORDER BY ordinal_position;
  `);
  console.log('bulk_difference_distributions columns count:', distCols.length);

  const itemCols = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bulk_difference_apportionment_items'
    ORDER BY ordinal_position;
  `);
  console.log('bulk_difference_apportionment_items columns count:', itemCols.length);

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration 033 failed:', err);
  process.exit(1);
});
