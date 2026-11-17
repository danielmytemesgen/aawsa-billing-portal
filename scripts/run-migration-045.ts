import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const client = new Client({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  user:     process.env.POSTGRES_USER     || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB       || 'aawsa_billing',
  port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to database.\n');

    // 1. Run migration 044 (normalize categories and descriptions first)
    const m044Path = join(process.cwd(), 'database/migrations/044_canonical_permissions_update.sql');
    if (existsSync(m044Path)) {
      console.log('Applying Migration 044 (Canonical Categories & Descriptions)...');
      await client.query(readFileSync(m044Path, 'utf8'));
      console.log('✅ Migration 044 applied.\n');
    }

    // 2. Run migration 045 (remediate unassigned permissions and role functional gaps)
    const m045Path = join(process.cwd(), 'database/migrations/045_comprehensive_role_permissions_remediation.sql');
    if (existsSync(m045Path)) {
      console.log('Applying Migration 045 (Comprehensive Role Permissions Remediation)...');
      await client.query(readFileSync(m045Path, 'utf8'));
      console.log('✅ Migration 045 applied.\n');
    }

    // 3. Check remaining unassigned permissions
    const unassigned = await client.query(`
      SELECT p.id, p.name, p.category 
      FROM permissions p 
      WHERE p.id NOT IN (SELECT DISTINCT permission_id FROM role_permissions)
      ORDER BY p.name;
    `);

    console.log(`========================================`);
    console.log(`UNASSIGNED PERMISSIONS REMAINING: ${unassigned.rows.length}`);
    if (unassigned.rows.length === 0) {
      console.log('🎉 100% of all registered permissions are now actively assigned!');
    } else {
      unassigned.rows.forEach(p => console.log(`  - ${p.name} [${p.category}]`));
    }
    console.log(`========================================\n`);

    // 4. Role summary table
    const rolesSummary = await client.query(`
      SELECT r.id, r.role_name, count(rp.permission_id) as permissions_assigned
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.role_name
      ORDER BY permissions_assigned DESC, r.id ASC;
    `);

    console.log('📊 Active Permissions by Role:');
    console.table(rolesSummary.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();

