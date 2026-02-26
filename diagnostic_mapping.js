const { Pool } = require('pg');
const pool = new Pool({
    host: '127.0.0.1',
    user: 'postgres',
    password: '',
    database: 'aawsa_billing',
    port: 5432
});

async function run() {
    try {
        console.log('--- Branches ---');
        const branches = await pool.query('SELECT name FROM branches');
        console.table(branches.rows);

        console.log('--- Unique CUSTOMERBRANCH in Bills ---');
        const billBranches = await pool.query('SELECT DISTINCT "CUSTOMERBRANCH" FROM bills LIMIT 20');
        console.table(billBranches.rows);

        console.log('--- Latest month_year in Bills ---');
        const latestMonth = await pool.query('SELECT month_year, COUNT(*) FROM bills GROUP BY month_year ORDER BY month_year DESC LIMIT 5');
        console.table(latestMonth.rows);

        console.log('--- Bills for recent months and their branch mapping ---');
        const mappingCheck = await pool.query(`
            SELECT 
                b.name as branch_name,
                COUNT(bi.id) as bill_count
            FROM branches b
            LEFT JOIN bills bi ON b.name = bi."CUSTOMERBRANCH"
            GROUP BY b.name
        `);
        console.table(mappingCheck.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
