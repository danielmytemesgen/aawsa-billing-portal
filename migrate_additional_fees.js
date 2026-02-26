
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'Da@121212',
    database: 'aawsa_billing',
    port: 5432,
});

async function migrate() {
    try {
        console.log('Running migration: adding additional_fees column...');
        await pool.query("ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS additional_fees JSONB DEFAULT '[]'::jsonb;");
        console.log('Migration successful.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
