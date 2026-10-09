import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const { query } = await import('../src/lib/db');
  
  console.log('Applying database indexes for meter readings...');
  
  await query(`
    CREATE INDEX IF NOT EXISTS idx_ic_readings_date_deleted 
      ON individual_customer_readings ("READING_DATE" DESC, deleted_at) 
      WHERE deleted_at IS NULL;
  `);
  console.log('✓ idx_ic_readings_date_deleted');

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ic_readings_cust_key 
      ON individual_customer_readings ("CUST_KEY");
  `);
  console.log('✓ idx_ic_readings_cust_key');

  await query(`
    CREATE INDEX IF NOT EXISTS idx_bm_readings_date_deleted 
      ON bulk_meter_readings ("READING_DATE" DESC, deleted_at) 
      WHERE deleted_at IS NULL;
  `);
  console.log('✓ idx_bm_readings_date_deleted');

  await query(`
    CREATE INDEX IF NOT EXISTS idx_bm_readings_cust_key 
      ON bulk_meter_readings ("CUST_KEY");
  `);
  console.log('✓ idx_bm_readings_cust_key');

  await query(`
    CREATE INDEX IF NOT EXISTS idx_reading_photos_reading_id 
      ON meter_reading_photos (reading_id);
  `);
  console.log('✓ idx_reading_photos_reading_id');

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ind_cust_key 
      ON individual_customers ("customerKeyNumber");
  `);
  console.log('✓ idx_ind_cust_key');

  await query(`
    CREATE INDEX IF NOT EXISTS idx_bulk_meters_cust_key 
      ON bulk_meters ("customerKeyNumber");
  `);
  console.log('✓ idx_bulk_meters_cust_key');

  console.log('All indexes applied successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to apply indexes:', err);
  process.exit(1);
});
