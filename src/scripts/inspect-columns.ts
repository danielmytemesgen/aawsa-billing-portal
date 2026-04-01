import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspectBillsColumns() {
    const { query } = await import('../lib/db');
    try {
        const columns: any = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bills' 
            ORDER BY ordinal_position
        `);
        console.log('--- Bills Table Columns ---');
        columns.forEach((c: any) => console.log(`${c.column_name} (${c.data_type})`));
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspectBillsColumns();
