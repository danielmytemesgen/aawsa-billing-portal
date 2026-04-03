import { z } from 'zod';

const envSchema = z.object({
  POSTGRES_HOST: z.string().default('127.0.0.1'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),
  POSTGRES_DB: z.string().default('aawsa_billing'),
  POSTGRES_PORT: z.string().transform(v => parseInt(v, 10)).default('5432'),
  INTERNAL_API_KEY: z.string().default('aawsa-internal-secret-2026'),
  SESSION_SECRET: z.string().default('a9f3c2e1b8d74f6a0e5c9b2d1f4a7e3c8b5d2f9a6e1c4b7d0f3a8e5c2b9d6f1'),
  GOOGLE_API_KEY: z.string().default('AIzaSyC7-example-key-for-build'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid environment variables. Check your .env.local file.');
}

export const env = _env.data;
