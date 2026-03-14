import { Pool } from 'pg';

const pool = new Pool({
    user: 'postgres',
    password: 'Da@121212',
    host: 'localhost',
    port: 5432,
    database: 'aawsa_billing'
});

async function main() {
    console.log("Adding data_entry_access to Admin, Head Office Management, and Staff Management...");

    // 1. Get the permission ID for data_entry_access
    const permRes = await pool.query(`SELECT id FROM permissions WHERE name = 'data_entry_access'`);
    if (permRes.rows.length === 0) {
        console.error("data_entry_access permission not found in DB!");
        process.exit(1);
    }
    const permId = permRes.rows[0].id;
    console.log(`Permission ID: ${permId}`);

    // 2. Get role IDs
    const rolesRes = await pool.query(`SELECT id, role_name FROM roles`);
    const roles = rolesRes.rows;

    // 3. Insert role_permissions if not exists
    for (const role of roles) {
        if (['Admin', 'Staff Management', 'Head Office Management'].includes(role.role_name)) {
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_id) 
                VALUES ($1, $2) 
                ON CONFLICT (role_id, permission_id) DO NOTHING
            `, [role.id, permId]);
            console.log(`Added data_entry_access to ${role.role_name}`);
        }
    }

    console.log("Done!");
    process.exit(0);
}

main().catch(console.error);
