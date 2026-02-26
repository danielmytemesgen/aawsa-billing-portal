
const { query } = require('../src/lib/db');
require('dotenv').config({ path: '.env' });

async function migrate() {
    console.log('Starting migration to alter BILLKEY column...');
    try {
        // 1. Drop the generated constraint
        // Note: The specific syntax depends on how it was created (Identity vs Generated).
        // Common generic way to turn a generated column into a normal one in Postgres:

        console.log('Dropping GENERATED property from BILLKEY...');
        await query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP EXPRESSION;`);
        // If it was IDENTITY, it would be DROP IDENTITY. 
        // If it was DEFAULT, it would be DROP DEFAULT.
        // Based on "can only be updated to DEFAULT", it's likely GENERATED ALWAYS AS ... STORED.

        console.log('Setting BILLKEY type to TEXT...');
        await query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" TYPE TEXT;`);

        console.log('Successfully altered BILLKEY column.');
        process.exit(0);
    } catch (error) {
        // If DROP EXPRESSION failed, maybe it is an IDENTITY column?
        if (String(error).includes('is not a generated column')) {
            console.log('Not a generated expression column. Trying DROP IDENTITY...');
            try {
                await query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP IDENTITY IF EXISTS;`);
                await query(`ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP DEFAULT;`); // Just in case
                console.log('Successfully dropped identity/default.');
                process.exit(0);
            } catch (err2) {
                console.error('Failed to alter column via DROP IDENTITY:', err2);
                process.exit(1);
            }
        } else {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    }
}

migrate();
