
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'Da@121212',
    database: 'aawsa_billing',
    port: 5432,
});

async function checkSchema() {
    try {
        console.log('--- BILLS TABLE ---');
        const resBills = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'bills' ORDER BY column_name
        `);
        console.log(resBills.rows.map(r => r.column_name).join('\n'));

        console.log('\n--- BULK_METER_READINGS TABLE ---');
        const resReadings = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'bulk_meter_readings' ORDER BY column_name
        `);
        console.log(resReadings.rows.map(r => r.column_name).join('\n'));

    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        await pool.end();
    }
}

checkSchema();
