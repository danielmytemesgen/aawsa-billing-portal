
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env vars
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function verifyColumns() {
    const { query, closePool } = await import('../src/lib/db');

    console.log('Testing write/read for new columns in table: bills');
    try {
        // 1. Fetch one existing bill to test against (if any) or skip
        const existingBills: any = await query('SELECT id FROM bills LIMIT 1');
        if (existingBills.length === 0) {
            console.log('No bills found to test update. Creating a dummy bill...');
            // Need to handle required fields for bills
            // For now, let's just try to describe the table again but with more details
            const colDetails: any = await query(`
                SELECT column_name, is_nullable, data_type, column_default
                FROM information_schema.columns 
                WHERE table_name = 'bills'
                AND column_name IN ('BILLKEY', 'CUSTOMERNAME', 'CUSTOMERTIN', 'CUSTOMERBRANCH', 'REASON', 'THISMONTHBILLAMT', 'PENALTYAMT', 'DRACCTNO', 'CRACCTNO');
            `);
            console.log('--- Detailed Column Info ---');
            console.log(JSON.stringify(colDetails, null, 2));
            return;
        }

        const testId = existingBills[0].id;
        console.log(`Testing with bill ID: ${testId}`);

        // Try to update one of the new fields
        await query(`
            UPDATE bills 
            SET "CUSTOMERNAME" = 'TEST_USER_XYZ', "REASON" = 'TEST_REASON_123'
            WHERE id = $1
        `, [testId]);

        const updated: any = await query('SELECT "BILLKEY", "CUSTOMERNAME", "REASON" FROM bills WHERE id = $1', [testId]);
        console.log('Verification Result:', JSON.stringify(updated[0], null, 2));

        if (updated[0].CUSTOMERNAME === 'TEST_USER_XYZ') {
            console.log('SUCCESS: Data was written and read back correctly.');
        } else {
            console.error('FAILURE: Data mismatch.');
        }

    } catch (error: any) {
        console.error('DATABASE ERROR:', error.message);
        if (error.message.includes('column') && error.message.includes('does not exist')) {
            console.error('CONFIRMED: The columns do NOT exist in this database.');
        }
    } finally {
        await closePool();
    }
}

verifyColumns();
