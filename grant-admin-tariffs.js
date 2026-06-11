const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load production environment variables
dotenv.config({ path: path.join(__dirname, '.env.production') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function grantPermissions() {
  try {
    await client.connect();
    console.log('Connected to Production Database.');

    // 1. Ensure 'tariffs_manage' permission exists
    let permRes = await client.query('SELECT id FROM permissions WHERE name = $1', ['tariffs_manage']);
    let permId;
    if (permRes.rows.length === 0) {
      console.log('Permission tariffs_manage not found. Inserting it...');
      const insertRes = await client.query(
        'INSERT INTO permissions (name, category) VALUES ($1, $2) RETURNING id',
        ['tariffs_manage', 'Settings']
      );
      permId = insertRes.rows[0].id;
    } else {
      permId = permRes.rows[0].id;
    }

    // 2. Get the Administrator role
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'Administrator' OR name = 'admin' LIMIT 1");
    if (roleRes.rows.length === 0) {
      console.log('Could not find Administrator role. Please check your roles table.');
      return;
    }
    const roleId = roleRes.rows[0].id;

    // 3. Assign permission to role
    const mappingRes = await client.query(
      'SELECT id FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
      [roleId, permId]
    );

    if (mappingRes.rows.length === 0) {
      await client.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, permId]
      );
      console.log('SUCCESS! Granted tariffs_manage to Administrator role.');
    } else {
      console.log('Administrator already has tariffs_manage permission assigned.');
    }

  } catch (err) {
    console.error('Database Error:', err);
  } finally {
    await client.end();
  }
}

grantPermissions();
