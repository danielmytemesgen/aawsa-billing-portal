const { Pool } = require('pg');
const p = new Pool({ host: 'localhost', user: 'postgres', password: 'Da@121212', database: 'aawsa_billing', port: 5432 });

async function test() {
    try {
        // Get a valid month first
        const monthsRes = await p.query("SELECT DISTINCT month_year FROM bills LIMIT 3");
        console.log('Available months:', monthsRes.rows.map(r => r.month_year));

        if (monthsRes.rows.length === 0) {
            console.log('No bills found in DB');
            return;
        }
        const month = monthsRes.rows[0].month_year;
        console.log('\nTesting query for month:', month);

        const res = await p.query(`
      SELECT b.*, bm.name, bm."phoneNumber", bm."contractNumber", bm."METER_KEY" as "meterNumber", bm."meterSize", bm."specificArea", bm."subCity", bm.woreda, bm.charge_group, bm.sewerage_connection
      FROM bills b
      JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      WHERE b.month_year = $1
    `, [month]);
        console.log('SUCCESS! Returned', res.rows.length, 'rows');
        if (res.rows.length > 0) {
            console.log('Sample row keys:', Object.keys(res.rows[0]).join(', '));
        }
    } catch (e) {
        console.error('QUERY FAILED:', e.message);
    } finally {
        await p.end();
    }
}
test();
