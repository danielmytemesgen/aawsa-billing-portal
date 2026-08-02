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
    // NOTE: The permissions table uses column "name", roles table uses column "role_name"
    let permRes = await client.query('SELECT id FROM permissions WHERE name = $1', ['tariffs_manage']);
    let permId;
    if (permRes.rows.length === 0) {
      console.log('Permission tariffs_manage not found. Inserting it...');
      const insertRes = await client.query(
        'INSERT INTO permissions (name, description, category) VALUES ($1, $2, $3) RETURNING id',
        ['tariffs_manage', 'Manage tariff versions, tiers, and fees', 'Tariff Management']
      );
      permId = insertRes.rows[0].id;
      console.log(`Inserted tariffs_manage with id: ${permId}`);
    } else {
      permId = permRes.rows[0].id;
      console.log(`Permission tariffs_manage already exists with id: ${permId}`);
    }

    // 2. Get ALL roles that should have this permission (Admin + Head Office Management)
    const rolesToGrant = ['Admin', 'Head Office Management'];

    for (const roleName of rolesToGrant) {
      // NOTE: roles table uses "role_name" column, not "name"
      const roleRes = await client.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
      if (roleRes.rows.length === 0) {
        console.log(`Role "${roleName}" not found in roles table. Skipping...`);
        continue;
      }
      const roleId = roleRes.rows[0].id;

      // 3. Assign permission to role if not already assigned
      const mappingRes = await client.query(
        'SELECT role_id FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
        [roleId, permId]
      );

      if (mappingRes.rows.length === 0) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [roleId, permId]
        );
        console.log(`SUCCESS! Granted tariffs_manage to "${roleName}" role.`);
      } else {
        console.log(`"${roleName}" already has tariffs_manage permission. No changes needed.`);
      }
    }

    console.log('\nDone! You may need to log out and log back in for changes to take effect.');

  } catch (err) {
    console.error('Database Error:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

grantPermissions();
