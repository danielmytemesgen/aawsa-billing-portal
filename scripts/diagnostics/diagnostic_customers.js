
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
        console.log('--- INDIVIDUAL_CUSTOMERS TABLE ---');
        const resInd = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'individual_customers' ORDER BY column_name
        `);
        console.log(resInd.rows.map(r => r.column_name).join('\n'));

        console.log('\n--- BULK_METERS TABLE ---');
        const resBulk = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'bulk_meters' ORDER BY column_name
        `);
        console.log(resBulk.rows.map(r => r.column_name).join('\n'));

    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        await pool.end();
    }
}

checkSchema();
