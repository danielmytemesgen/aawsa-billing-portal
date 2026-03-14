import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { query, closePool } from '../src/lib/db';

async function checkColumns() {
    try {
        console.log('Checking staff_members columns...');
        const rows = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'staff_members';
    `);
        console.log('Columns:', rows);
    } catch (err) {
        console.error('Failed to check columns:', err);
    } finally {
        await closePool();
    }
}

checkColumns();
