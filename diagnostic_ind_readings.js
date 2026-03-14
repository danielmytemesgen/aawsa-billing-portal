
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
        console.log('--- INDIVIDUAL_CUSTOMER_READINGS TABLE ---');
        const res = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'individual_customer_readings' ORDER BY column_name
        `);
        console.log(res.rows.map(r => r.column_name).join('\n'));

    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        await pool.end();
    }
}

checkSchema();
