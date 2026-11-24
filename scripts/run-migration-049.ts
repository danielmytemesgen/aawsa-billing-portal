import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  console.log('--- Migration 049: Call Center Enhancements (Sentiment) ---');

  const migrationPath = join(process.cwd(), 'database/migrations/049_call_center_enhancements.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 049 SQL...');
  await query(migrationSql);
  console.log('✅ Migration 049 executed successfully.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
