
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const params = {
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'aawsa_billing',
    port: Number(process.env.POSTGRES_PORT || 5432),
};

const pool = new Pool({
    ...params,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    console.log('Starting migration to alter BILLKEY column...');
    try {
        console.log('Dropping GENERATED property from BILLKEY...');
        // Try to handle both generated and identity
        try {
            await pool.query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP EXPRESSION;`);
            console.log('Dropped expression.');
        } catch (e) {
            console.log('DROP EXPRESSION failed (expected if not generated stored), trying DROP DEFAULT/IDENTITY...');
            try {
                await pool.query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP IDENTITY IF EXISTS;`);
            } catch (ignored) { }
            await pool.query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP DEFAULT;`);
        }

        console.log('Setting BILLKEY type to TEXT...');
        await pool.query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" TYPE TEXT;`);

        console.log('Successfully altered BILLKEY column.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
