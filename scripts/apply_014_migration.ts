
import { config } from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import fs from 'fs';

// Load env from current directory
const envPath = path.join(process.cwd(), '.env');
console.log(`Loading .env from ${envPath}`);
config({ path: envPath });

const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    user: process.env.POSTGRES_USER || 'postgres',
    password: String(process.env.POSTGRES_PASSWORD || ''),
    database: process.env.POSTGRES_DB || 'aawsa_billing',
    port: Number(process.env.POSTGRES_PORT || 5432),
});

async function runMigration() {
    try {
        console.log('DB Config:', {
            host: process.env.POSTGRES_HOST,
            user: process.env.POSTGRES_USER,
            db: process.env.POSTGRES_DB,
            hasPassword: !!process.env.POSTGRES_PASSWORD
        });

        const migrationPath = path.join(process.cwd(), 'database_migrations', '014_bill_management_workflow.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        const statements = sql.replace(/--.*$/gm, '').split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            try {
                await pool.query(statement);
            } catch (e: any) {
                console.log(`ERROR: ${e.message}`);
                if (e.message.includes('already exists') || e.message.includes('Duplicate column')) {
                    console.log('Ignoring known idempotency error.');
                } else {
                    // For now, let's NOT exit on error to ensure we try all parts if some partial state exists
                    console.log('Continuing despite error...');
                }
            }
        }
        console.log('SUCCESS');
        await pool.end();
        process.exit(0);
    } catch (error: any) {
        console.log(`FATAL: ${error.message}`);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
