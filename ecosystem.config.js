const path = require('path');
const dotenv = require('dotenv');
const isWindows = process.platform === 'win32';

// Load environment variables from .env files sequentially
// (dotenv won't overwrite already-defined keys, prioritizing production envs)
dotenv.config({ path: path.join(__dirname, '.env.production') });
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Auto-detect HTTPS mode: if cert and key files are configured, use the HTTPS wrapper
const useHttps = !!(process.env.HTTPS_CERT_FILE && process.env.HTTPS_KEY_FILE);
const serverScript = useHttps
  ? path.join(__dirname, '.next/standalone/server-https.js')
  : path.join(__dirname, '.next/standalone/server.js');

if (useHttps) {
  console.log('[ecosystem] HTTPS mode enabled — using server-https.js');
  console.log(`[ecosystem] Cert: ${process.env.HTTPS_CERT_FILE}`);
  console.log(`[ecosystem] Key : ${process.env.HTTPS_KEY_FILE}`);
} else {
  console.log('[ecosystem] HTTP mode — using server.js (set HTTPS_CERT_FILE + HTTPS_KEY_FILE to enable HTTPS)');
}

module.exports = {
  apps: [
    {
      name: 'aawsa-billing-web',
      script: serverScript,
      instances: isWindows ? 1 : 'max',
      exec_mode: isWindows ? 'fork' : 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || (useHttps ? 443 : 3000),
        HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
        PUBLIC_SERVER_IP: process.env.PUBLIC_SERVER_IP,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || `${useHttps ? 'https' : 'http'}://${process.env.PUBLIC_SERVER_IP || 'localhost'}${!useHttps ? ':3000' : ''}`,
        // HTTPS certificate paths (only used when HTTPS mode is active)
        HTTPS_CERT_FILE: process.env.HTTPS_CERT_FILE || '',
        HTTPS_KEY_FILE:  process.env.HTTPS_KEY_FILE  || '',
        // Database & Auth
        POSTGRES_HOST: process.env.POSTGRES_HOST,
        POSTGRES_PORT: process.env.POSTGRES_PORT,
        POSTGRES_USER: process.env.POSTGRES_USER,
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
        POSTGRES_DB: process.env.POSTGRES_DB,
        SESSION_SECRET: process.env.SESSION_SECRET,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      }
    }
  ]
};

