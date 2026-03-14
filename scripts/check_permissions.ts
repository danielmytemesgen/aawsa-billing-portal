
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

async function check() {
    try {
        console.log('Checking permissions...');
        const res = await pool.query(`
            SELECT r.role_name, p.name 
            FROM role_permissions rp 
            JOIN roles r ON rp.role_id = r.id 
            JOIN permissions p ON rp.permission_id = p.id 
            WHERE p.name LIKE 'bill:%'
        `);
        console.log(JSON.stringify(res.rows, null, 2));

        console.log('Checking available roles...');
        const roles = await pool.query('SELECT * FROM roles');
        console.log(JSON.stringify(roles.rows, null, 2));

        await pool.end();
    } catch (e) {
        console.error(e);
        await pool.end();
    }
}
check();
