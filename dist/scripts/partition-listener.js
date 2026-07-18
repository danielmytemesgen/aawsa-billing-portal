import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';
import { env } from '../lib/env';
async function main() {
    const pool = new Pool({
        host: env.POSTGRES_HOST,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DB,
        port: env.POSTGRES_PORT,
    });
    const client = await pool.connect();
    console.log('Listening for partition creation notifications (channel: create_reading_partition)');
    client.on('notification', async (msg) => {
        try {
            if (msg.channel !== 'create_reading_partition')
                return;
            const payload = msg.payload || '{}';
            const data = JSON.parse(payload);
            const table = data.table;
            const month = data.month; // YYYY-MM
            if (!table || !month) {
                console.warn('Invalid partition notification payload:', payload);
                return;
            }
            const partitionName = `${table}_${month.replace('-', '_')}`;
            console.log('Request to ensure partition:', partitionName, 'for table', table, 'month', month);
            const sql = `DO $do$\nDECLARE pn text := format('%I_%s', $1, replace($2, '-', '_'));\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = pn AND n.nspname = 'public') THEN\n    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES IN (%L)', pn, $1, $2);\n  END IF;\nEND\n$do$;`;
            await pool.query(sql, [table, month]);
            console.log('Partition ensured:', partitionName);
        }
        catch (err) {
            console.error('Error handling partition notification:', err);
        }
    });
    await client.query('LISTEN create_reading_partition');
    // keep process alive
    process.on('SIGINT', async () => {
        console.log('Shutting down partition listener');
        await client.release();
        await pool.end();
        process.exit(0);
    });
}
main().catch((err) => {
    console.error('Partition listener failed:', err);
    process.exit(1);
});
