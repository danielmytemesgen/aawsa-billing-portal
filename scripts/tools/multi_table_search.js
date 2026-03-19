
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
        const targetId = 'C-000002789619';

        console.log('--- Bulk Meters Search ---');
        const bulk = await client.query('SELECT "customerKeyNumber", name FROM bulk_meters WHERE "customerKeyNumber" LIKE $1', [`%${targetId.slice(-6)}%`]);
        console.table(bulk.rows);

        console.log('--- Individual Customers Search ---');
        const ind = await client.query('SELECT "customerKeyNumber", name FROM individual_customers WHERE "customerKeyNumber" LIKE $1', [`%${targetId.slice(-6)}%`]);
        console.table(ind.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkMeters();
