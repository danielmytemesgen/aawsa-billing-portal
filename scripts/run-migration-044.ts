import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const client = new Client({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  user:     process.env.POSTGRES_USER     || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB       || 'aawsa_billing',
  port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to database.\n');

    const migrationFilePath = join(process.cwd(), 'database/migrations/044_canonical_permissions_update.sql');
    if (!existsSync(migrationFilePath)) {
      throw new Error(`Migration file not found at ${migrationFilePath}`);
    }

    const sql = readFileSync(migrationFilePath, 'utf8');
    console.log('Executing Migration 044 (Canonical Permissions & Descriptions Normalization)...');
    await client.query(sql);
    console.log('✅ Migration 044 executed successfully.\n');

    // Summary of categories in database
    const summary = await client.query(`
      SELECT category, count(*) AS count
      FROM permissions
      GROUP BY category
      ORDER BY count DESC;
    `);

    console.log('📊 Permissions Count by Canonical Category in Database:');
    summary.rows.forEach(r => {
      console.log(`  - ${r.category}: ${r.count} tokens`);
    });

    const total = await client.query('SELECT count(*) AS total FROM permissions');
    console.log(`\n🎉 Total Permissions in Database: ${total.rows[0].total}`);

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();

