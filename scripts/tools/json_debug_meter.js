
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
        const detailed = await client.query('SELECT * FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1))', [targetId]);
        console.log(JSON.stringify(detailed.rows, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkMeters();
