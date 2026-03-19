
const { Client } = require('pg');
require('dotenv').config();

async function checkMeters() {
    const client = new Client({
        host: process.env.POSTGRES_HOST || '127.0.0.1',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        database: process.env.POSTGRES_DB || 'aawsa_billing',
        port: Number(process.env.POSTGRES_PORT || 5432),
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const targetId = 'C-000002789619';

        // Check for exact match
        const exact = await client.query('SELECT "customerKeyNumber", name, status, deleted_at FROM bulk_meters WHERE "customerKeyNumber" = $1', [targetId]);
        console.log(`\nExact match for ${targetId}:`);
        console.table(exact.rows);

        // Check for case-insensitive match or trim issues
        const flexible = await client.query('SELECT "customerKeyNumber", name FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1))', [targetId]);
        console.log(`\nFlexible match for ${targetId}:`);
        console.table(flexible.rows);

        // List some existing IDs to see the format
        const sample = await client.query('SELECT "customerKeyNumber", name FROM bulk_meters WHERE deleted_at IS NULL LIMIT 5');
        console.log('\nSample of valid IDs in DB:');
        console.table(sample.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkMeters();
