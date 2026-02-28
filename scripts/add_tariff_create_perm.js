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
      INSERT INTO permissions (name, description, module) 
      VALUES ('tariffs_create', 'Create new tariff versions', 'Tariff Management')
      ON CONFLICT (name) DO NOTHING
      RETURNING *;
    `);
        if (res.rowCount > 0) {
            console.log("Permission inserted successfully:", res.rows[0]);
        } else {
            console.log("Permission already exists.");
        }
    } catch (err) {
        console.error("Error inserting permission:", err);
    } finally {
        pool.end();
    }
}

run();
