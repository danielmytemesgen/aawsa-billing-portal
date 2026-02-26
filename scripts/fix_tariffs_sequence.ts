import { query, closePool } from '../src/lib/db';

async function fixTariffSequence() {
    try {
        console.log('Fetching max ID from tariffs...');
        const result: any = await query('SELECT MAX(id) as max_id FROM tariffs');
        const maxId = result[0]?.max_id || 0;
        console.log(`Max ID is ${maxId}`);

        const nextId = maxId + 1;
        console.log(`Resetting sequence to ${nextId}...`);

        // For identity columns, we use ALTER TABLE ... ALTER COLUMN ... RESTART WITH ...
        const sql = `ALTER TABLE tariffs ALTER COLUMN id RESTART WITH ${nextId}`;
        await query(sql);

        console.log('Sequence reset successfully.');
    } catch (error) {
        console.error('Failed to fix sequence:', error);
    } finally {
        await closePool();
    }
}

fixTariffSequence();
