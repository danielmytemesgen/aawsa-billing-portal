
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const params = {
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'aawsa_billing',
    port: Number(process.env.POSTGRES_PORT || 5432),
};

const pool = new Pool({
    ...params,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const generateBillKey = (billId) => {
    const idHex = (billId || "").replace(/-/g, '').substring(0, 8);
    const idNumeric = parseInt(idHex, 16);
    return isNaN(idNumeric) ? "BBPT-0000000000" : `BBPT-${String(idNumeric).padStart(10, '0')}`;
};

async function backfill() {
    console.log('Starting BILLKEY backfill...');
    try {
        const res = await pool.query('SELECT id, "BILLKEY" FROM bills');
        const bills = res.rows;
        console.log(`Found ${bills.length} bills.`);

        let updatedCount = 0;
        for (const bill of bills) {
            // Update if no key OR if key starts with BBT- (old format)
            if (!bill.BILLKEY || bill.BILLKEY.startsWith('BBT-')) {
                const newKey = generateBillKey(bill.id);
                if (newKey !== bill.BILLKEY) {
                    await pool.query('UPDATE bills SET "BILLKEY" = $1 WHERE id = $2', [newKey, bill.id]);
                    updatedCount++;
                    if (updatedCount % 100 === 0) console.log(`Updated ${updatedCount} bills...`);
                }
            }
        }

        console.log(`Backfill complete. Updated ${updatedCount} bills.`);
        process.exit(0);
    } catch (error) {
        console.error('Backfill failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

backfill();
