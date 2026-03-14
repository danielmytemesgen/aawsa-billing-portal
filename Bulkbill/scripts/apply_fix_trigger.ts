import { query, closePool } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function applyFix() {
    const filePath = path.join(__dirname, '../src/database_migrations/014_fix_bulk_meters_trigger.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
        console.log('Applying trigger fix...');
        await query(sql);
        console.log('Fix applied successfully.');
    } catch (error) {
        console.error('Failed to apply fix:', error);
    } finally {
        await closePool();
    }
}

applyFix();
