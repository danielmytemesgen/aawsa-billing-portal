import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  console.log('--- Migration 048: Call Center Permissions & Tables ---');

  const migrationPath = join(process.cwd(), 'database/migrations/048_call_center_permissions.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 048 SQL...');
  await query(migrationSql);
  console.log('✅ Migration 048 executed successfully.');

  // Verify permissions
  const perms = await query(`
    SELECT name, category FROM permissions WHERE name LIKE 'callcenter:%'
  `);
  console.log('Seeded Call Center permissions in DB:', perms);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
