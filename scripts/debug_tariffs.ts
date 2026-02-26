import { query, closePool } from '../src/lib/db';

async function verifyTariffsSchemaDetails() {
    const sql = `
    SELECT 
        column_name, 
        data_type, 
        column_default,
        is_identity,
        identity_generation
    FROM 
        information_schema.columns 
    WHERE 
        table_name = 'tariffs';
  `;

    const constraintsSql = `
    SELECT
        tc.constraint_name, 
        tc.constraint_type, 
        kcu.column_name
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
    WHERE 
        tc.table_name = 'tariffs';
  `;

    try {
        console.log('Fetching detailed columns for tariffs...');
        const result: any = await query(sql);
        console.log(JSON.stringify(result, null, 2));

        console.log('Fetching constraints for tariffs...');
        const result2: any = await query(constraintsSql);
        console.log(JSON.stringify(result2, null, 2));
    } catch (error) {
        console.error('Failed to fetch details:', error);
    } finally {
        await closePool();
    }
}

verifyTariffsSchemaDetails();
