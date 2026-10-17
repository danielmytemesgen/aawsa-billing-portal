import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  
  console.log('--- Migration 030: Fix Faulty Paid & Reconciled Bills ---');
  
  // 1. Audit before
  const beforeCountResult = await query(`
    SELECT COUNT(*) as count
    FROM bills
    WHERE deleted_at IS NULL
      AND (
        (LOWER(COALESCE(reconciliation_status, '')) = 'reconciled' AND (LOWER(COALESCE(payment_status::text, '')) = 'unpaid' OR COALESCE(amount_paid, 0) = 0))
        OR (LOWER(COALESCE(payment_status::text, '')) = 'paid' AND COALESCE(amount_paid, 0) = 0)
      );
  `);
  const beforeCount = Number(beforeCountResult[0]?.count || 0);
  console.log(`Found ${beforeCount} anomalous bill record(s) to fix.`);

  // 2. Read and apply SQL migration
  const migrationPath = path.join(__dirname, '../database/migrations/030_fix_faulty_paid_reconciliation.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 030 SQL...');
  await query(migrationSql);
  console.log('Migration executed successfully.');

  // 3. Audit after
  const afterCountResult = await query(`
    SELECT COUNT(*) as count
    FROM bills
    WHERE deleted_at IS NULL
      AND (
        (LOWER(COALESCE(reconciliation_status, '')) = 'reconciled' AND (LOWER(COALESCE(payment_status::text, '')) = 'unpaid' OR COALESCE(amount_paid, 0) = 0))
        OR (LOWER(COALESCE(payment_status::text, '')) = 'paid' AND COALESCE(amount_paid, 0) = 0)
      );
  `);
  const afterCount = Number(afterCountResult[0]?.count || 0);
  console.log(`Verification: Remaining anomalies = ${afterCount}.`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
