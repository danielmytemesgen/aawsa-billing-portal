const path = require('path');
const dotenv = require('dotenv');
const isWindows = process.platform === 'win32';

// Load environment variables from .env files sequentially
// (dotenv won't overwrite already-defined keys, prioritizing production envs)
dotenv.config({ path: path.join(__dirname, '.env.production') });
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'aawsa-billing-web',
      script: path.join(__dirname, '.next/standalone/server.js'),
      instances: isWindows ? 1 : 'max',
      exec_mode: isWindows ? 'fork' : 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
        PUBLIC_SERVER_IP: process.env.PUBLIC_SERVER_IP,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || `http://${process.env.PUBLIC_SERVER_IP || 'localhost'}:${process.env.PORT || 3000}`,
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

