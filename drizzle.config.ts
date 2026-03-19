import { defineConfig } from 'drizzle-kit';
import { env } from './src/lib/env';

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: env.POSTGRES_HOST,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    port: env.POSTGRES_PORT,
    ssl: env.POSTGRES_HOST !== '127.0.0.1' && env.POSTGRES_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
  },
});
