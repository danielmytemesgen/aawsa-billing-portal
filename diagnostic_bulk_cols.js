const { Pool } = require('pg');
const p = new Pool({ host: 'localhost', user: 'postgres', password: 'Da@121212', database: 'aawsa_billing', port: 5432 });
p.query("SELECT column_name FROM information_schema.columns WHERE table_name='bulk_meters' ORDER BY ordinal_position")
    .then(r => {
        console.log('--- BULK_METERS TABLE COLUMNS ---');
        console.log(r.rows.map(x => x.column_name).join('\n'));
        return p.end();
    })
    .catch(e => { console.error(e); p.end(); });
