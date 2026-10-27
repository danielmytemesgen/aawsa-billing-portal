import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspectColumns() {
    const { query } = await import('../lib/db');
    try {
        // Check credit_ledger columns
        const clCols: any = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'credit_ledger' 
            ORDER BY ordinal_position
        `);
        console.log('--- credit_ledger Table Columns ---');
        if (clCols.length === 0) {
            console.log('TABLE DOES NOT EXIST or has no columns');
        } else {
            clCols.forEach((c: any) => console.log(`${c.column_name} (${c.data_type})`));
        }

        // Check row count
        try {
            const cnt: any = await query(`SELECT COUNT(*) as cnt FROM credit_ledger`);
            console.log('\ncredit_ledger row count:', cnt[0]?.cnt);
        } catch (e: any) {
            console.log('credit_ledger count failed:', e.message);
        }

        // List all tables in the schema
        const tables: any = await query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        console.log('\n--- All Tables ---');
        tables.forEach((t: any) => console.log(t.table_name));

        process.exit(0);
    } catch (err) {
        console.error('Inspection failed:', err);
        process.exit(1);
    }
}

inspectColumns();
