import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

// In production we require real secrets; in dev we fall back to known defaults
// so `npm run dev` works without a populated .env.local.
const devOnly = <T extends z.ZodTypeAny>(schema: T, devDefault: z.infer<T>) =>
  isProd ? schema : schema.default(devDefault as any);

const envSchema = z.object({
  POSTGRES_HOST: z.string().default('127.0.0.1'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),
  POSTGRES_DB: z.string().default('aawsa_billing'),
  POSTGRES_PORT: z.string().transform(v => parseInt(v, 10)).default('5432'),
  INTERNAL_API_KEY: devOnly(z.string().min(16), 'aawsa-internal-secret-2026'),
  SESSION_SECRET: devOnly(
    z.string().min(32, 'SESSION_SECRET must be at least 32 chars in production'),
    'a9f3c2e1b8d74f6a0e5c9b2d1f4a7e3c8b5d2f9a6e1c4b7d0f3a8e5c2b9d6f1'
  ),
  GOOGLE_API_KEY: devOnly(z.string().min(8), 'AIzaSyC7-example-key-for-build'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid environment variables. Check your .env.local file.');
}

export const env = _env.data;
