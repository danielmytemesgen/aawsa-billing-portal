
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'aawsa_billing',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
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
