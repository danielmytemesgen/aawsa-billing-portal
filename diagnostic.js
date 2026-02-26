
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
        console.log('Checking bills table...');
        const resBills = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'bills'
        `);
        console.log('Columns in bills table:');
        console.log(resBills.rows.map(r => r.column_name).join(', '));

        console.log('\nChecking bulk_meter_readings table...');
        const resReadings = await pool.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'bulk_meter_readings'
        `);
        console.log('Columns in bulk_meter_readings table:');
        console.log(resReadings.rows.map(r => r.column_name).join(', '));

        console.log('\nChecking some data in bills...');
        const resData = await pool.query('SELECT * FROM bills LIMIT 1');
        if (resData.rows.length > 0) {
            console.log('Sample bill record keys:');
            console.log(Object.keys(resData.rows[0]).join(', '));
        } else {
            console.log('No bills found in table.');
        }

    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        await pool.end();
    }
}

checkSchema();
