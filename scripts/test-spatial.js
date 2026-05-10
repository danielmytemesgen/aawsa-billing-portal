require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'aawsa_billing',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function runCheck() {
    const client = await pool.connect();
    try {
        console.log('--- Starting DB Check ---');
        
        // 1. Get a test customer
        const custRes = await client.query('SELECT * FROM individual_customers LIMIT 1');
        const customer = custRes.rows[0];
        
        if (!customer) {
            console.log('No individual customers found in the database. Cannot run test.');
            return;
        }
        
        const customerKey = customer.customerKeyNumber;
        console.log(`Testing with Customer Key: ${customerKey}`);
        
        // 2. Simulate UPSERT spatial record action
        console.log('\nSimulating inserting spatial record for coordinates: (Lat: 9.03, Lng: 38.74)');
        
        const checkSql = 'SELECT id FROM spatial_records WHERE entity_id = $1 AND entity_type = $2';
        const checkRes = await client.query(checkSql, [customerKey, 'individual_customer']);
        const existing = checkRes.rows[0];
        
        const testLat = 9.03;
        const testLng = 38.74;

        if (existing) {
            console.log('Found existing spatial record. Updating...');
            await client.query(
                'UPDATE spatial_records SET x_coordinate = $1, y_coordinate = $2, updated_at = NOW() WHERE id = $3',
                [testLng, testLat, existing.id]
            );
        } else {
            console.log('No existing spatial record. Inserting...');
            await client.query(
                'INSERT INTO spatial_records (entity_id, entity_type, x_coordinate, y_coordinate) VALUES ($1, $2, $3, $4)',
                [customerKey, 'individual_customer', testLng, testLat]
            );
        }

        // 3. Verify it was saved correctly
        console.log('\nVerifying spatial_records table...');
        const verifyRes = await client.query('SELECT * FROM spatial_records WHERE entity_id = $1', [customerKey]);
        const spatialData = verifyRes.rows[0];
        
        if (spatialData) {
            console.log('✅ SUCCESS: Spatial data was found in the spatial_records table!');
            console.log(spatialData);
        } else {
            console.log('❌ ERROR: Spatial data was not found after insertion!');
        }
        
        // 4. Verify JOIN query logic used in application
        console.log('\nVerifying JOIN query logic used to fetch customers...');
        const joinRes = await client.query(`
            SELECT ic."customerKeyNumber", sr.x_coordinate, sr.y_coordinate
            FROM individual_customers ic
            LEFT JOIN spatial_records sr ON ic."customerKeyNumber" = sr.entity_id AND sr.entity_type = 'individual_customer'
            WHERE ic."customerKeyNumber" = $1
        `, [customerKey]);
        
        if (joinRes.rows[0]?.x_coordinate == testLng) {
            console.log('✅ SUCCESS: JOIN query correctly retrieves coordinates from spatial_records!');
            console.log(joinRes.rows[0]);
        } else {
            console.log('❌ ERROR: JOIN query failed to retrieve coordinates.');
        }

    } catch (err) {
        console.error('Error during check:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runCheck();
