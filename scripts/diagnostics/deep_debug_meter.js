
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

        // Detailed search including soft-deleted ones
        const detailed = await client.query('SELECT "customerKeyNumber", name, status, deleted_at, LENGTH("customerKeyNumber") as len FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1))', [targetId]);
        console.log(`\nDetailed match for ${targetId} (including potential deleted):`);
        console.table(detailed.rows);

        if (detailed.rows.length > 0) {
            const row = detailed.rows[0];
            console.log('Hex representation of customerKeyNumber:');
            console.log(Buffer.from(row.customerKeyNumber).toString('hex'));

            console.log('Hex representation of targetId:');
            console.log(Buffer.from(targetId).toString('hex'));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkMeters();
