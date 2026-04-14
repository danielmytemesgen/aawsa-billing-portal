import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkPopulation() {
    const { query } = await import('../lib/db');
    try {
        const bm: any = await query('SELECT COUNT(*) FROM bulk_meters');
        const ic: any = await query('SELECT COUNT(*) FROM individual_customers');
        const br: any = await query('SELECT COUNT(*) FROM branches');
        console.log(`Bulk Meters: ${bm[0].count}`);
        console.log(`Individual Customers: ${ic[0].count}`);
        console.log(`Branches: ${br[0].count}`);
    } catch (err) {
        console.error('Check failed:', err);
    }
}

checkPopulation();
