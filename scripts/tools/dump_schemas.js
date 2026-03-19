const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'Da@121212',
    database: 'aawsa_billing',
    port: 5432
});

async function dumpSchemas() {
    const tables = ['bills', 'individual_customer_readings', 'bulk_meter_readings', 'payments', 'reports', 'notifications', 'fault_codes'];
    for (const table of tables) {
        const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
        console.log(`Table: ${table}`);
        console.log(res.rows.map(r => r.column_name).join(', '));
        console.log('-------------------');
    }
    pool.end();
}

dumpSchemas();
