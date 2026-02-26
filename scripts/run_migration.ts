
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env vars BEFORE importing db
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log('Loading .env.local');
    dotenv.config({ path: envPath });
} else {
    console.log('.env.local not found, trying .env');
    dotenv.config();
}

// Dynamic import to ensure env vars are loaded
async function runMigration() {
    const { query, closePool } = await import('../src/lib/db');

    const migrationPath = path.join(process.cwd(), 'database_migrations', '020_reorder_bills_columns.sql');
    console.log(`Reading migration file from: ${migrationPath}`);

    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Executing SQL migration...');

        // Execute the SQL
        await query(sql);

        console.log('Migration executed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await closePool();
    }
}

runMigration();
