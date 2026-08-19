const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'Da@121212',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

const PERMISSIONS = [
  { name: 'credit_view_all', category: 'Credit & Deposit', description: 'View credit / deposit ledger across all branches' },
  { name: 'credit_view_branch', category: 'Credit & Deposit', description: 'View credit / deposit ledger within assigned branch' },
  { name: 'credit_create', category: 'Credit & Deposit', description: 'Add credit / deposit on bulk meters' },
  { name: 'credit_void', category: 'Credit & Deposit', description: 'Void recorded credit / deposit on bulk meters' },
];

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    for (const p of PERMISSIONS) {
      const existing = await client.query('SELECT id FROM permissions WHERE name = $1', [p.name]);
      let permId;
      if (existing.rows.length === 0) {
        const ins = await client.query(
          'INSERT INTO permissions (name, category, description) VALUES ($1, $2, $3) RETURNING id',
          [p.name, p.category, p.description]
        );
        permId = ins.rows[0].id;
        console.log('Created permission:', p.name, 'with ID:', permId);
      } else {
        permId = existing.rows[0].id;
        console.log('Permission already exists:', p.name, 'ID:', permId);
      }

      // Grant to Admin and Head Office Management roles
      const rolesRes = await client.query("SELECT id, role_name FROM roles WHERE role_name ILIKE '%Admin%' OR role_name ILIKE '%Head Office%'");
      for (const r of rolesRes.rows) {
        const rpCheck = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [r.id, permId]);
        if (rpCheck.rows.length === 0) {
          await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [r.id, permId]);
          console.log('Granted', p.name, 'to role:', r.role_name);
        }
      }
    }

    console.log('Successfully synced all credit permissions!');
  } catch (err) {
    console.error('Error syncing credit permissions:', err);
  } finally {
    await client.end();
  }
}

run();
