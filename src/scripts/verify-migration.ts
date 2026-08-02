import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verifyMigration() {
    const { query } = await import('../lib/db');
    try {
        const countRes: any = await query('SELECT COUNT(*) FROM bills');
        console.log(`Total bills: ${countRes[0].count}`);

        const partitions: any = await query(`
            SELECT
                nmsp_parent.nspname AS parent_schema,
                parent.relname      AS parent_name,
                nmsp_child.nspname  AS child_schema,
                child.relname       AS child_name
            FROM pg_inherits
                JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
                JOIN pg_class child             ON pg_inherits.inhrelid  = child.oid
                JOIN pg_namespace nmsp_parent   ON nmsp_parent.oid  = parent.relnamespace
                JOIN pg_namespace nmsp_child    ON nmsp_child.oid   = child.relnamespace
            WHERE parent.relname = 'bills';
        `);
        console.log('--- Partitions ---');
        partitions.forEach((p: any) => console.log(p.child_name));

        const sample: any = await query('SELECT month_year FROM bills LIMIT 5');
        console.log('--- Sample Months ---');
        sample.forEach((s: any) => console.log(s.month_year));

    } catch (err) {
        console.error('Verification failed:', err);
    }
}

verifyMigration();
