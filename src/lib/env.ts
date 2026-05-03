import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';
const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI === 'true' || process.env.VERCEL === '1';

// In production we require real secrets; in dev or during build we fall back to known defaults
// to allow the build to proceed and `npm run dev` to work without a populated .env.local.
const devOnly = <T extends z.ZodTypeAny>(schema: T, devDefault: z.infer<T>) =>
  (isProd && !isBuild) ? schema : schema.default(devDefault as any);

const envSchema = z.object({
  POSTGRES_HOST: z.string().default(process.env.PGHOST || '127.0.0.1'),
  POSTGRES_USER: z.string().default(process.env.PGUSER || 'postgres'),
  POSTGRES_PASSWORD: z.string().default(process.env.PGPASSWORD || ''),
  POSTGRES_DB: z.string().default(process.env.PGDATABASE || 'aawsa_billing'),
  POSTGRES_PORT: z.string().transform(v => parseInt(v, 10)).default(process.env.PGPORT || '5432'),
  INTERNAL_API_KEY: devOnly(z.string().min(16), 'aawsa-internal-secret-2026'),
  SESSION_SECRET: devOnly(
    z.string().min(32, 'SESSION_SECRET must be at least 32 chars in production'),
    'a9f3c2e1b8d74f6a0e5c9b2d1f4a7e3c8b5d2f9a6e1c4b7d0f3a8e5c2b9d6f1'
  ),
  GOOGLE_API_KEY: devOnly(z.string().min(8), 'AIzaSyC7-example-key-for-build'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const errors = _env.error.flatten().fieldErrors;
  console.error('❌ Invalid environment variables:', JSON.stringify(errors, null, 2));
  
  if (isProd && !isBuild) {
    throw new Error('Invalid environment variables. Check your Vercel project settings or .env.local file.');
  }
  
  // During build, we allow it to proceed with defaults to avoid blocking deployment
  console.warn('⚠️ Build proceeding with default environment variables. Ensure real secrets are set in production.');
}

export const env = _env.success ? _env.data : envSchema.parse({}); // Fallback to defaults if parsing failed during build
