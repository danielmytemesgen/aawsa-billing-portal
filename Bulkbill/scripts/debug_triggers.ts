import { query, closePool } from '../src/lib/db';

async function listTriggers() {
    const sql = `
    SELECT 
        trigger_name,
        event_manipulation,
        event_object_table,
        action_statement,
        action_timing
    FROM 
        information_schema.triggers
    WHERE 
        event_object_table = 'bulk_meters';
  `;

    try {
        console.log('Fetching triggers for bulk_meters...');
        const result: any = await query(sql);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Failed to fetch triggers:', error);
    } finally {
        await closePool();
    }
}

listTriggers();
