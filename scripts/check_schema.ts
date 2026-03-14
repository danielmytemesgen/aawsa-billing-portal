
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env vars
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log('Loading .env.local');
    dotenv.config({ path: envPath });
} else {
    console.log('.env.local not found, trying .env');
    dotenv.config();
}

async function checkSchema() {
    const { query, closePool } = await import('../src/lib/db');

    console.log('Checking columns for table: bills');
    try {
        const rows: any = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bills'
            ORDER BY ordinal_position;
        `);

        console.log('--- Columns in bills table ---');
        rows.forEach((row: any) => {
            console.log(`${row.column_name} (${row.data_type})`);
        });
        console.log('------------------------------');

        const newFields = ["BILLKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON", "THISMONTHBILLAMT", "PENALTYAMT", "DRACCTNO", "CRACCTNO"];
        const existingFields = rows.map((r: any) => r.column_name);

        const missing = newFields.filter(f => !existingFields.includes(f));
        if (missing.length === 0) {
            console.log('SUCCESS: All new fields are present in the database.');
        } else {
            console.error('ERROR: The following fields are MISSING:', missing);
        }

    } catch (error) {
        console.error('Failed to query schema:', error);
    } finally {
        await closePool();
    }
}

checkSchema();
