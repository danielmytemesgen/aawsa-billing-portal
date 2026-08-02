require('dotenv').config({ path: './.env.production' });
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT || 5432),
});

async function main() {
  const client = await pool.connect();
  try {
    const email = process.env.TEST_CSV_USER_EMAIL || 'csvtester@local';
    const password = process.env.TEST_CSV_USER_PASSWORD || 'Test1234';
    // Check if exists
    const exists = await client.query('SELECT id FROM staff_members WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
    if (exists.rows.length > 0) {
      console.log('Test staff already exists:', email);
      return { email, password };
    }

    const id = randomUUID();
    const now = new Date();
    await client.query(
      `INSERT INTO staff_members (id, name, email, password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, 'CSV Test User', email, password, 'Head Office Management', now, now]
    );
    console.log('Created test staff:', email);
    return { email, password };
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('Error creating test staff:', e); process.exit(1); });
