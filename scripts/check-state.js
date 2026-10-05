require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: String(process.env.POSTGRES_PASSWORD),
  database: process.env.POSTGRES_DB,
  port: 5432,
});

async function main() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const rb = await pool.query(`
    SELECT id, entity_type, entity_name, deleted_at, original_data
    FROM recycle_bin
    WHERE original_data::text ILIKE '%81769022%' OR original_data::text ILIKE '%1791188612%'
    LIMIT 2
  `);
  console.log('Recycle bin matches:', rb.rows.length);

  const billsAll = await pool.query(`
    SELECT count(*), month_year
    FROM bills
    GROUP BY month_year
  `);
  console.log('Bills in bills table by month:', billsAll.rows);

  await pool.end();
}

main().catch(console.error);
