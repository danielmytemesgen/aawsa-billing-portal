import { readFileSync } from 'fs';
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
  await client.connect();
  console.log('✅ Connected to DB\n');

  const sql = readFileSync(
    join(process.cwd(), 'database/migrations/036_gl_audit_tab_permissions.sql'),
    'utf8'
  );

  await client.query(sql);
  console.log('✅ Migration 036 applied\n');

  // Verify new permissions exist
  const perms = await client.query(`
    SELECT id, name, category, description
    FROM permissions
    WHERE name IN (
      'report:gl_audit_view',
      'report:gl_audit_view_all',
      'report:gl_audit_view_branch',
      'report:gl_audit_view_matrix',
      'report:gl_audit_view_anomaly'
    )
    ORDER BY name
  `);
  console.log('GL Audit permissions in DB:');
  perms.rows.forEach(r => console.log(`  ID=${r.id}  ${r.name}  [${r.category}]`));

  // Verify role assignments
  const roles = await client.query(`
    SELECT r.role_name, array_agg(p.name ORDER BY p.name) AS permissions
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.name LIKE 'report:gl_audit_%'
    GROUP BY r.role_name
    ORDER BY r.role_name
  `);
  console.log('\nRole → GL audit permission assignments:');
  roles.rows.forEach(r => console.log(`  ${r.role_name}: ${r.permissions.join(', ')}`));

  await client.end();
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });

