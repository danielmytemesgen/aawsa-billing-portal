


import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { env } from './env';

let pool: Pool | undefined;

function getPool() {
  if (pool) return pool;

  const params = {
    host: env.POSTGRES_HOST,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    port: env.POSTGRES_PORT,
  };

  pool = new Pool({
    ...params,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl: env.POSTGRES_HOST !== '127.0.0.1' && env.POSTGRES_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
  });
  return pool;
}

export const db = drizzle(getPool(), { schema });

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

export async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
