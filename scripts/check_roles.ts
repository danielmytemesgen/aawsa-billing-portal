import { Pool } from 'pg';

const pool = new Pool({
    user: 'postgres',
    password: 'Da@121212',
    host: 'localhost',
    port: 5432,
    database: 'aawsa_billing'
});

async function main() {
    const res = await pool.query(`
SELECT r.role_name, p.name 
FROM role_permissions rp 
JOIN permissions p ON rp.permission_id = p.id 
JOIN roles r ON rp.role_id = r.id 
WHERE p.name = 'data_entry_access'
    `);
    console.log(res.rows);
    process.exit(0);
}
main();
