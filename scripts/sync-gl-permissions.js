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

// ── Permission definitions ───────────────────────────────────────────────────
const GL_PERMISSIONS = [
  { name: 'report:gl_audit_view',              category: 'Finance',        description: 'View GL Financial & Audit Report' },
  { name: 'report:gl_audit_view_all',          category: 'Finance',        description: 'View All Branches in GL Financial & Audit Report (System-Wide)' },
  { name: 'report:gl_audit_view_branch',       category: 'Finance',        description: 'View Assigned Branch Only in GL Financial & Audit Report (Branch-Specific)' },
  { name: 'report:gl_monthly_summary_by_code', category: 'Finance',        description: 'GL Monthly Summary by Account Code (System-Wide)' },
  { name: 'report:gl_finance_monthly',         category: 'Finance',        description: 'GL Finance Monthly Report (System-Wide)' },
  { name: 'report:gl_finance_yearly',          category: 'Finance',        description: 'GL Finance Yearly / Annual Report (System-Wide)' },
  { name: 'report:branch_gl_finance_monthly',  category: 'Branch Report',  description: 'Branch GL Finance Monthly Report (Own Branch Only)' },
  { name: 'report:branch_gl_finance_yearly',   category: 'Branch Report',  description: 'Branch GL Finance Yearly / Annual Report (Own Branch Only)' },
];

// ── Role access matrix ───────────────────────────────────────────────────────
//  GLOBAL  → Admin, Head Office Management, Staff admin
//  BRANCH  → Staff Management, Staff, Data encoder, reader supervisor
const ROLE_MATRIX = {
  globalRoles: ['Admin', 'Head Office Management', 'Staff admin'],
  branchRoles: ['Staff Management', 'Staff', 'Data encoder', 'reader supervisor'],
};

const GLOBAL_PERMS  = ['report:gl_audit_view', 'report:gl_audit_view_all', 'report:gl_monthly_summary_by_code', 'report:gl_finance_monthly', 'report:gl_finance_yearly'];
const BRANCH_PERMS  = ['report:gl_audit_view', 'report:gl_audit_view_branch', 'report:branch_gl_finance_monthly', 'report:branch_gl_finance_yearly'];

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.\n');

    // Step 1: Upsert all GL permissions
    const permMap = new Map();
    for (const p of GL_PERMISSIONS) {
      const existing = await client.query('SELECT id FROM permissions WHERE name = $1', [p.name]);
      let permId;
      if (existing.rows.length === 0) {
        const ins = await client.query(
          'INSERT INTO permissions (name, category, description) VALUES ($1, $2, $3) RETURNING id',
          [p.name, p.category, p.description]
        );
        permId = ins.rows[0].id;
        console.log('✅ Created permission:', p.name, '→ ID:', permId);
      } else {
        permId = existing.rows[0].id;
        console.log('✔  Permission exists:', p.name, '→ ID:', permId);
        // Update description if changed
        await client.query(
          'UPDATE permissions SET category = $1, description = $2 WHERE id = $3',
          [p.category, p.description, permId]
        );
      }
      permMap.set(p.name, permId);
    }

    // Step 2: Assign permissions to global roles
    console.log('\n── Global Roles (System-Wide GL access) ──');
    for (const roleName of ROLE_MATRIX.globalRoles) {
      const roleRes = await client.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
      if (roleRes.rows.length === 0) { console.log(`  ⚠  Role not found: "${roleName}" — skipping`); continue; }
      const roleId = roleRes.rows[0].id;
      for (const pName of GLOBAL_PERMS) {
        const permId = permMap.get(pName);
        const check = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permId]);
        if (check.rows.length === 0) {
          await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permId]);
          console.log(`  ✅ Granted ${pName} → ${roleName}`);
        } else {
          console.log(`  ✔  Already has ${pName} → ${roleName}`);
        }
      }
      // Remove branch-scoped perms from global roles (they don't need double assignment)
      for (const pName of BRANCH_PERMS) {
        const permId = permMap.get(pName);
        const del = await client.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permId]);
        if (del.rowCount > 0) {
          console.log(`  🧹 Removed branch-perm ${pName} from global role ${roleName}`);
        }
      }
    }

    // Step 3: Assign branch-scoped permissions to branch roles
    // Also remove any global perms accidentally assigned to branch-only roles
    console.log('\n── Branch Roles (Own-Branch GL access only) ──');
    for (const roleName of ROLE_MATRIX.branchRoles) {
      const roleRes = await client.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
      if (roleRes.rows.length === 0) { console.log(`  ⚠  Role not found: "${roleName}" — skipping`); continue; }
      const roleId = roleRes.rows[0].id;
      for (const pName of BRANCH_PERMS) {
        const permId = permMap.get(pName);
        const check = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permId]);
        if (check.rows.length === 0) {
          await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permId]);
          console.log(`  ✅ Granted ${pName} → ${roleName}`);
        } else {
          console.log(`  ✔  Already has ${pName} → ${roleName}`);
        }
      }
      // Remove global GL perms from branch-only roles (enforce restriction)
      for (const pName of GLOBAL_PERMS) {
        const permId = permMap.get(pName);
        const del = await client.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permId]);
        if (del.rowCount > 0) {
          console.log(`  🔒 Revoked global perm ${pName} from branch role ${roleName}`);
        }
      }
    }

    console.log('\n✅ GL permission sync complete!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();

export {};
