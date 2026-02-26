
import { config } from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

config({ path: path.join(process.cwd(), '.env') });

const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    user: process.env.POSTGRES_USER || 'postgres',
    password: String(process.env.POSTGRES_PASSWORD || ''),
    database: process.env.POSTGRES_DB || 'aawsa_billing',
    port: Number(process.env.POSTGRES_PORT || 5432),
});

async function assign() {
    try {
        console.log('Assigning permissions...');

        // 1. Get Role IDs
        const rolesRes = await pool.query("SELECT id, role_name FROM roles WHERE role_name IN ('Admin', 'Staff', 'Manager', 'Account Clerk', 'Team Leader', 'Cashier', 'Staff Management')");
        const roles = rolesRes.rows;
        const adminRole = roles.find(r => r.role_name === 'Admin');
        const staffRole = roles.find(r => r.role_name === 'Staff') || roles.find(r => r.role_name === 'Account Clerk'); // Fallback
        const managerRole = roles.find(r => r.role_name === 'Manager') || roles.find(r => r.role_name === 'Team Leader');

        console.log('Found roles:', { admin: adminRole?.id, staff: staffRole?.id, manager: managerRole?.id });

        if (!adminRole) console.warn('Admin role not found!');
        if (!staffRole) console.warn('Staff/Account Clerk role not found!');
        if (!managerRole) console.warn('Manager/Team Leader role not found!');

        // 2. Get Permission IDs
        const permsRes = await pool.query("SELECT id, name FROM permissions WHERE name LIKE 'bill:%'");
        const perms = permsRes.rows;
        const allBillPerms = perms.map(p => p.id);
        const draftPerms = perms.filter(p => ['bill:create', 'bill:view_drafts', 'bill:submit', 'bill:rework'].includes(p.name)).map(p => p.id);
        const approvePerms = perms.filter(p => ['bill:approve', 'bill:post', 'bill:view_drafts'].includes(p.name)).map(p => p.id); // Managers need view_drafts too usually to see them? No, view_drafts is for own. Maybe view_pending?
        // Actually, let's give Admin ALL.

        // 3. Assign to Admin
        if (adminRole && allBillPerms.length > 0) {
            for (const pid of allBillPerms) {
                await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [adminRole.id, pid]);
            }
            console.log('Assigned ALL bill permissions to Admin');
        }

        // 4. Assign to Staff (Creator)
        if (staffRole && draftPerms.length > 0) {
            for (const pid of draftPerms) {
                await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [staffRole.id, pid]);
            }
            console.log('Assigned draft permissions to Staff');
        }

        // 5. Assign to Manager (Approver)
        if (managerRole && approvePerms.length > 0) {
            for (const pid of approvePerms) {
                await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [managerRole.id, pid]);
            }
            console.log('Assigned approve permissions to Manager');
        }

        await pool.end();
    } catch (e) {
        console.error(e);
        await pool.end();
    }
}
assign();
