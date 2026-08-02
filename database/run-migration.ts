import { query } from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
// Load .env.local specifically
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/030_create_system_settings.sql'), 'utf8');
    await query(sql);
    console.log('Migration OK');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
