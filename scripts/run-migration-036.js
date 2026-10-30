const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const client = new Client({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  user:     process.env.POSTGRES_USER     || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB       || 'aawsa_billing',
  port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  await client.connect();
  console.log('✅ Connected\n');

  const sql = fs.readFileSync(path.join(process.cwd(), 'database/migrations/036_gl_audit_tab_permissions.sql'), 'utf8');
  await client.query(sql);
  console.log('✅ Migration 036 applied\n');

  const perms = await client.query(`
    SELECT id, name, category FROM permissions
    WHERE name LIKE 'report:gl_audit%' ORDER BY name
  `);
  console.log('GL Audit permissions:');
  perms.rows.forEach(r => console.log(`  ${r.id}  ${r.name}  [${r.category}]`));

  const roles = await client.query(`
    SELECT r.role_name, array_agg(p.name ORDER BY p.name) AS perms
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.name LIKE 'report:gl_audit%'
    GROUP BY r.role_name ORDER BY r.role_name
  `);
  console.log('\nRole assignments:');
  roles.rows.forEach(r => console.log(`  ${r.role_name}: ${r.perms.join(', ')}`));

  await client.end();
}

run().catch(e => { console.error('Error:', e.message, e.stack); process.exit(1); });

