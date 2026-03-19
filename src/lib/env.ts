import { z } from 'zod';

const envSchema = z.object({
  POSTGRES_HOST: z.string().default('127.0.0.1'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),
  POSTGRES_DB: z.string().default('aawsa_billing'),
  POSTGRES_PORT: z.string().transform(v => parseInt(v, 10)).default('5432'),
  INTERNAL_API_KEY: z.string().default('aawsa-internal-secret-2026'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid environment variables. Check your .env.local file.');
}

export const env = _env.data;
