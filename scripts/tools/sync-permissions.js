const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

const PERMISSIONS = [
    { name: 'dashboard_view_all', category: 'Dashboard' },
    { name: 'dashboard_view_branch', category: 'Dashboard' },
    { name: 'customers_view_all', category: 'Customer Management' },
    { name: 'customers_view_branch', category: 'Customer Management' },
    { name: 'customers_create', category: 'Customer Management' },
    { name: 'customers_create_restricted', category: 'Customer Management' },
    { name: 'customers_update', category: 'Customer Management' },
    { name: 'customers_delete', category: 'Customer Management' },
    { name: 'customers_approve', category: 'Customer Management' },
    { name: 'bulk_meters_view_all', category: 'Bulk Meter Management' },
    { name: 'bulk_meters_view_branch', category: 'Bulk Meter Management' },
    { name: 'bulk_meters_create', category: 'Bulk Meter Management' },
    { name: 'bulk_meters_create_restricted', category: 'Bulk Meter Management' },
    { name: 'bulk_meters_update', category: 'Bulk Meter Management' },
    { name: 'bulk_meters_delete', category: 'Bulk Meter Management' },
    { name: 'bulk_meters_approve', category: 'Bulk Meter Management' },
    { name: 'staff_view', category: 'Staff Management' },
    { name: 'staff_view_all', category: 'Staff Management' },
    { name: 'staff_view_branch', category: 'Staff Management' },
    { name: 'staff_create', category: 'Staff Management' },
    { name: 'staff_update', category: 'Staff Management' },
    { name: 'staff_delete', category: 'Staff Management' },
    { name: 'branches_view', category: 'Branch Management' },
    { name: 'branches_create', category: 'Branch Management' },
    { name: 'branches_update', category: 'Branch Management' },
    { name: 'branches_delete', category: 'Branch Management' },
    { name: 'permissions_view', category: 'Permissions' },
    { name: 'settings_view', category: 'Settings' },
    { name: 'settings_manage', category: 'Settings' },
    { name: 'reports_generate_all', category: 'Reporting' },
    { name: 'reports_generate_branch', category: 'Reporting' },
    { name: 'bill:manage_all', category: 'Bill Management' },
    { name: 'bill:view_branch', category: 'Bill Management' },
    { name: 'bill:view_drafts', category: 'Bill Management' },
    { name: 'bill:view_pending', category: 'Bill Management' },
    { name: 'bill:view_approved', category: 'Bill Management' },
    { name: 'bill:view_paid', category: 'Bill Management' },
    { name: 'bill:view_awaiting_payment', category: 'Bill Management' },
    { name: 'bill:view_overdue', category: 'Bill Management' },
    { name: 'bill:create', category: 'Bill Management' },
    { name: 'bill:update', category: 'Bill Management' },
    { name: 'bill:delete', category: 'Bill Management' },
    { name: 'bill:approve', category: 'Bill Management' },
    { name: 'bill:post', category: 'Bill Management' },
    { name: 'bill:send', category: 'Bill Management' },
    { name: 'bill:rework', category: 'Bill Management' },
    { name: 'billing:close_cycle', category: 'Bill Management' },
    { name: 'meter_readings_view_all', category: 'Meter Readings' },
    { name: 'meter_readings_view_branch', category: 'Meter Readings' },
    { name: 'meter_readings_create', category: 'Meter Readings' },
    { name: 'meter_readings_update', category: 'Meter Readings' },
    { name: 'meter_readings_delete', category: 'Meter Readings' },
    { name: 'meter_readings_analytics_view', category: 'Meter Readings' },
    { name: 'data_entry_access', category: 'Data Entry' },
    { name: 'notifications_view', category: 'Notifications' },
    { name: 'notifications_view_all', category: 'Notifications' },
    { name: 'notifications_manage', category: 'Notifications' },
    { name: 'notifications_create', category: 'Notifications' },
    { name: 'knowledge_base_view', category: 'Knowledge Base' },
    { name: 'knowledge_base_manage', category: 'Knowledge Base' },
    { name: 'routes_view_all', category: 'Route Management' },
    { name: 'routes_view_assigned', category: 'Route Management' },
    { name: 'payments_view', category: 'Bill Management' },
    { name: 'payments_create', category: 'Bill Management' },
    { name: 'payments_delete', category: 'Bill Management' },
    { name: 'tariffs_view', category: 'Settings' },
    { name: 'tariffs_manage', category: 'Settings' }
];

async function sync() {
  try {
    await client.connect();
    console.log('Connected to database.');

    for (const perm of PERMISSIONS) {
      const checkRes = await client.query(
        'SELECT id FROM permissions WHERE name = $1',
        [perm.name]
      );

      if (checkRes.rows.length === 0) {
        await client.query(
          'INSERT INTO permissions (name, category) VALUES ($1, $2)',
          [perm.name, perm.category]
        );
        console.log(`Added permission: ${perm.name} (${perm.category})`);
      } else {
        // Optionally update category if it's different?
        // For now, just skip.
        console.log(`Permission already exists: ${perm.name}`);
      }
    }

    console.log('All permissions synced successfully.');
  } catch (err) {
    console.error('Error syncing permissions:', err);
  } finally {
    await client.end();
  }
}

sync();
