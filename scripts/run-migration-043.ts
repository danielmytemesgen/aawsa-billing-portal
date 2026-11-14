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

const INLINE_MIGRATION_SQL = `
-- Migration 043: Granular Invoice Generator RBAC Permissions
INSERT INTO permissions (name, description, category)
VALUES
  ('invoice:view',               'Access the Invoice Generator page',                                    'Invoices'),
  ('invoice:print',              'Print individual or batch invoices',                                   'Invoices'),
  ('invoice:export_csv',         'Export invoice data to CSV format',                                    'Invoices'),
  ('invoice:export_excel',       'Export invoice data to Excel format',                                  'Invoices'),
  ('invoice:batch',              'Access the Batch Invoices tab to view and select invoices in bulk',    'Invoices'),
  ('invoice:customer_statement', 'Access the Customer Statements tab for per-customer invoice lookup',   'Invoices')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category;

-- Step 2: Global Admin Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'admin', 'system administrator', 'staff admin', 'head office management'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:export_csv',
    'invoice:export_excel',
    'invoice:batch',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

-- Step 3: Manager / Approver roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'branch manager', 'manager', 'supervisor', 'approver'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:batch',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

-- Step 4: Billing Officers & Clerks
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'billing officer', 'data encoder', 'staff', 'clerk'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:batch'
  )
ON CONFLICT DO NOTHING;

-- Step 5: Cashiers & Tellers
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'cashier', 'teller', 'payment collector'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

-- Step 6: Auditors & Inspectors
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'auditor', 'inspector', 'gl auditor'
)
  AND p.name IN (
    'invoice:view',
    'invoice:batch',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;
`;

async function run() {
  await client.connect();
  console.log('✅ Connected to DB\n');

  const migrationFilePath = join(process.cwd(), 'database/migrations/043_invoice_permissions.sql');
  const sql = existsSync(migrationFilePath)
    ? readFileSync(migrationFilePath, 'utf8')
    : INLINE_MIGRATION_SQL;

  await client.query(sql);
  console.log('✅ Migration 043 applied\n');

  // Verify new permissions exist
  const perms = await client.query(`
    SELECT id, name, category, description
    FROM permissions
    WHERE name LIKE 'invoice:%'
    ORDER BY name
  `);
  console.log('Invoice permissions in DB:');
  perms.rows.forEach(r => console.log(`  ID=${r.id}  ${r.name}  [${r.category}]`));

  // Verify role assignments
  const roles = await client.query(`
    SELECT r.role_name, array_agg(p.name ORDER BY p.name) AS permissions
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.name LIKE 'invoice:%'
    GROUP BY r.role_name
    ORDER BY r.role_name
  `);
  console.log('\nRole assignments in DB:');
  roles.rows.forEach(r => console.log(`  ${r.role_name}: ${r.permissions.join(', ')}`));

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
