import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspectBillsColumns() {
    const { query } = await import('../lib/db');
    try {
        const columns: any = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bulk_meters' 
            ORDER BY ordinal_position
        `);
        console.log('--- bulk_meters Table Columns ---');
        columns.forEach((c: any) => console.log(`${c.column_name} (${c.data_type})`));
        process.exit(0);
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspectBillsColumns();




