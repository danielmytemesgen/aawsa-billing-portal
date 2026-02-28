const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.resolve(__dirname, '../.env');
let dbUrl = '';

try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const match = envFile.match(/^DATABASE_URL=(.*)$/m);
    if (match && match[1]) {
        dbUrl = match[1].trim();
    }
} catch (e) {
    console.error("Could not read .env file", e);
}

if (!dbUrl) {
    console.error("No DATABASE_URL found.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl
});

async function run() {
    try {
        const res = await pool.query(`
        SELECT p.name 
        FROM roles r 
        JOIN role_permissions rp ON r.id = rp.role_id 
        JOIN permissions p ON rp.permission_id = p.id 
        WHERE r.role_name = 'Admin';
    `);
        console.log("Admin permissions:", res.rows.map(r => r.name).join(', '));
    } catch (err) {
        console.error("Error checking permissions:", err);
    } finally {
        pool.end();
    }
}

run();
