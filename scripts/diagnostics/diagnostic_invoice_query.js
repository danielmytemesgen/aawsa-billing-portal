const { Pool } = require('pg');
const p = new Pool({ host: 'localhost', user: 'postgres', password: 'Da@121212', database: 'aawsa_billing', port: 5432 });

async function test() {
    // First get 2 meter keys
    const keysRes = await p.query('SELECT "customerKeyNumber" FROM bulk_meters LIMIT 2');
    const keys = keysRes.rows.map(r => r.customerKeyNumber);
    console.log('Testing with keys:', keys);

    if (keys.length === 0) {
        console.log('No bulk meters found');
        await p.end();
        return;
    }

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `
    SELECT DISTINCT ON (b."CUSTOMERKEY")
      b.*,
      bm.name,
      bm."phoneNumber",
      bm."contractNumber",
      bm."METER_KEY" as "meterNumber",
      bm."meterSize",
      bm."specificArea",
      bm."subCity",
      bm.woreda,
      bm.charge_group,
      bm.sewerage_connection,
      bm.branch_id,
      bm."approved_by",
      bm."approved_at"
    FROM bills b
    JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
    WHERE b."CUSTOMERKEY" IN (${placeholders})
    ORDER BY b."CUSTOMERKEY", b.month_year DESC, b.created_at DESC
  `;

    const res = await p.query(sql, keys);
    console.log('SUCCESS - Rows returned:', res.rows.length);
    res.rows.forEach(row => {
        console.log(' -', row.name, '| month:', row.month_year, '| TOTAL:', row.TOTALBILLAMOUNT, '| OUTSTANDING:', row.OUTSTANDINGAMT);
    });
    await p.end();
}
test().catch(e => { console.error('FAILED:', e.message); p.end(); });
