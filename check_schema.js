
const { query } = require('./src/lib/db');

async function checkSchema() {
    try {
        const rows = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bills'
        `);
        console.log('Columns in bills table:');
        console.table(rows);
    } catch (e) {
        console.error('Error checking schema:', e);
    } finally {
        process.exit();
    }
}

checkSchema();
