const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'Da@121212',
    database: process.env.POSTGRES_DATABASE || 'aawsa_billing',
    port: process.env.POSTGRES_PORT || 5432,
});

async function checkColumns() {
    const tables = [
        'bills',
        'individual_customer_readings',
        'bulk_meter_readings',
        'payments',
        'reports',
        'notifications',
        'knowledge_base_articles',
        'fault_codes'
    ];

    for (const table of tables) {
        console.log(`--- Table: ${table} ---`);
        try {
            const res = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 
                AND (column_name = 'deleted_at' OR column_name = 'deleted_by')
            `, [table]);
            if (res.rows.length === 0) {
                console.log('No soft-delete columns found.');
            } else {
                res.rows.forEach(row => console.log(`Found: ${row.column_name}`));
            }
        } catch (err) {
            console.error(`Error checking table ${table}:`, err.message);
        }
        console.log('');
    }
    await pool.end();
}

checkColumns();
