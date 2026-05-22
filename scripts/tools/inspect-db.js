const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function inspect() {
  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'permissions'
    `);

    console.log('Permissions Table Schema:');
    console.table(res.rows);

  } catch (err) {
    console.error('Error inspecting database:', err);
  } finally {
    await client.end();
  }
}

inspect();
