const path = require('path');
const dotenv = require('dotenv');

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
      instances: 'max', // Utilize all CPU cores in cluster mode
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
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

