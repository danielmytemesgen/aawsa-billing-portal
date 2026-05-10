const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Use environment variables for DB connection
const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
    user: process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || 'aawsa_billing',
    port: parseInt(process.env.POSTGRES_PORT || process.env.PGPORT || '5432', 10),
    ssl: (process.env.POSTGRES_HOST || process.env.PGHOST) && 
         !['localhost', '127.0.0.1'].includes(process.env.POSTGRES_HOST || process.env.PGHOST) 
         ? { rejectUnauthorized: false } : false
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Spatial Data Migration ---');
        
        // 1. Create spatial_records table
        console.log('1. Creating spatial_records table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS spatial_records (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entity_id VARCHAR(255) NOT NULL,
                entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('individual_customer', 'bulk_meter')),
                x_coordinate DECIMAL(18, 10),
                y_coordinate DECIMAL(18, 10),
                z_coordinate DECIMAL(18, 10),
                captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_spatial_entity ON spatial_records(entity_id, entity_type);
        `);

        // 2. Migrate individual_customers data
        console.log('2. Migrating individual_customers data...');
        const custResult = await client.query(`
            INSERT INTO spatial_records (entity_id, entity_type, x_coordinate, y_coordinate, z_coordinate)
            SELECT "customerKeyNumber", 'individual_customer', x_coordinate, y_coordinate, z_coordinate
            FROM individual_customers
            WHERE x_coordinate IS NOT NULL OR y_coordinate IS NOT NULL OR z_coordinate IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        console.log(`   Migrated ${custResult.rowCount} individual customer records.`);

        // 3. Migrate bulk_meters data
        console.log('3. Migrating bulk_meters data...');
        const bulkResult = await client.query(`
            INSERT INTO spatial_records (entity_id, entity_type, x_coordinate, y_coordinate, z_coordinate)
            SELECT "customerKeyNumber", 'bulk_meter', x_coordinate, y_coordinate, z_coordinate
            FROM bulk_meters
            WHERE x_coordinate IS NOT NULL OR y_coordinate IS NOT NULL OR z_coordinate IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        console.log(`   Migrated ${bulkResult.rowCount} bulk meter records.`);

        console.log('--- Migration completed successfully ---');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
