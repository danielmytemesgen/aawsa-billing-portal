const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');

    // Grant branches_view permission to the Staff Management role
    const result = await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.role_name = 'Staff Management' AND p.name = 'branches_view'
      ON CONFLICT DO NOTHING
      RETURNING *
    `);

    if (result.rows.length > 0) {
      console.log('Successfully granted branches_view permission to the Staff Management role.');
    } else {
      console.log('branches_view permission was already granted to the Staff Management role or role/permission not found.');
    }

  } catch (err) {
    console.error('Error granting permission:', err);
  } finally {
    await client.end();
  }
}

run();
