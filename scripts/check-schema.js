const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
pool.query(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('bills','payments','individual_customers','branches','bulk_meters') AND table_schema = 'public' ORDER BY table_name, ordinal_position`)
  .then(r => {
    const grouped = {};
    r.rows.forEach(x => {
      if (!grouped[x.table_name]) grouped[x.table_name] = [];
      grouped[x.table_name].push(`${x.column_name}:${x.data_type}`);
    });
    console.log(JSON.stringify(grouped, null, 2));
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
