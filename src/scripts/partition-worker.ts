import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function ensureFuturePartitions() {
    const { query } = await import('../lib/db');
    console.log('--- Checking for Future Bill Partitions ---');

    try {
        const now = new Date();
        // Check for next 12 months
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const partitionName = `bills_${monthStr.replace('-', '_')}`;

            const checkRes: any = await query(`
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = $1 AND n.nspname = 'public'
            `, [partitionName]);

            if (checkRes.length === 0) {
                console.log(`Creating missing partition: ${partitionName} for ${monthStr}`);
                await query(`
                    CREATE TABLE IF NOT EXISTS ${partitionName}
                    PARTITION OF bills
                    FOR VALUES IN ('${monthStr}')
                `);
            } else {
                // console.log(`Partition ${partitionName} already exists.`);
            }
        }
        console.log('--- Partition check complete. ---');
    } catch (err) {
        console.error('Partition worker failed:', err);
    }
}

// If run directly
if (require.main === module || !require.main) {
    ensureFuturePartitions();
}

export { ensureFuturePartitions };
