import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  console.log('--- Migration 047: Knowledge Base PDF Attachment & Soft Delete Columns ---');

  const migrationPath = join(process.cwd(), 'database/migrations/047_knowledge_base_pdf_attachment.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 047 SQL...');
  await query(migrationSql);
  console.log('✅ Migration 047 executed successfully.');

  // Verify columns in knowledge_base_articles
  const cols = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'knowledge_base_articles'
    ORDER BY ordinal_position;
  `);
  console.log('Current knowledge_base_articles columns in DB:', cols);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
