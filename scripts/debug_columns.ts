import { query, closePool } from '../src/lib/db';

async function listColumns() {
    const sql = `
    SELECT 
        column_name
    FROM 
        information_schema.columns
    WHERE 
        table_name = 'bulk_meters';
  `;

    try {
        console.log('Fetching columns for bulk_meters...');
        const result: any = await query(sql);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Failed to fetch columns:', error);
    } finally {
        await closePool();
    }
}

listColumns();
