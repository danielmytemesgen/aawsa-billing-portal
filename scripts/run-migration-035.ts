import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  console.log('--- Migration 035: GL Financial & Audit Report Granular Permissions ---');

  const migrationPath = path.join(__dirname, '../database/migrations/035_gl_report_granular_permissions.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 035 SQL...');
  await query(migrationSql);
  console.log('Migration 035 executed successfully.');

  // Verify permissions in database
  const res = await query(`
    SELECT id, name, category, description 
    FROM permissions 
    WHERE name LIKE '%gl_audit%'
    ORDER BY id;
  `);
  console.log('Verified GL audit permissions in database:', res);

  const roleAssignments = await query(`
    SELECT r.role_name, p.name as permission_name
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.name LIKE '%gl_audit%'
    ORDER BY r.role_name, p.name;
  `);
  console.log('Role assignments for GL audit permissions:', roleAssignments);

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration 035 failed:', err);
  process.exit(1);
});

