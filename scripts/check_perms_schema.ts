
import dotenv from 'dotenv';
dotenv.config();

async function checkSchema() {
    const { query, closePool } = await import('../src/lib/db');
    try {
        console.log('Checking permissions table constraints...');
        const constraints = await query(`
            SELECT conname, contype, am.amname as method
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            LEFT JOIN pg_class i ON i.oid = c.conindid
            LEFT JOIN pg_am am ON am.oid = i.relam
            WHERE t.relname = 'permissions';
        `);
        console.log('Constraints:', JSON.stringify(constraints, null, 2));

        const columns = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'permissions';
        `);
        console.log('Columns:', JSON.stringify(columns, null, 2));

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await closePool();
    }
}

checkSchema();
