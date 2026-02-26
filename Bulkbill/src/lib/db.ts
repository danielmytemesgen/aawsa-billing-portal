


import { Pool } from 'pg';

let pool: Pool | undefined;

const params = {
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: Number(process.env.POSTGRES_PORT || 5432),
};

function getPool() {
  if (pool) return pool;

  pool = new Pool({
    ...params,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

export async function query(text: string, params?: any[]) {
  // console.log('Executing query:', text, params);
  const p = getPool();
  try {
    const res = await p.query(text, params || []);
    return res.rows;
  } catch (error) {
    try {
      console.error('Postgres query error', { text, params, error: (error && typeof error === 'object') ? Object.getOwnPropertyNames(error).reduce((acc: any, k) => { acc[k] = (error as any)[k]; return acc; }, {}) : String(error) });
    } catch (logErr) {
      // Fallback logging
    }
    throw new Error(`Postgres query failed: ${(error as Error).message}`);
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
