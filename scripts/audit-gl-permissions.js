const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  await client.connect();

  // 1. All GL permissions
  const perms = await client.query(
    "SELECT id, name, category, description FROM permissions WHERE name LIKE 'report:gl_%' OR name LIKE 'report:branch_gl_%' ORDER BY name"
  );
  console.log('\n══════ GL Permissions in DB ══════');
  perms.rows.forEach(r => console.log(`  [${r.id}] ${r.name}  (${r.category})`));

  // 2. Role assignments
  const assigns = await client.query(
    "SELECT r.role_name, p.name AS permission FROM roles r JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE p.name LIKE 'report:gl_%' OR p.name LIKE 'report:branch_gl_%' ORDER BY r.role_name, p.name"
  );
  console.log('\n══════ Role → GL Permission Assignments ══════');
  if (assigns.rows.length === 0) {
    console.log('  ⚠  No assignments found!');
  } else {
    assigns.rows.forEach(r => console.log(`  ${r.role_name}  →  ${r.permission}`));
  }

  // 3. All roles (to verify names)
  const roles = await client.query('SELECT id, role_name FROM roles ORDER BY role_name');
  console.log('\n══════ All Roles ══════');
  roles.rows.forEach(r => console.log(`  [${r.id}] ${r.role_name}`));

  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
