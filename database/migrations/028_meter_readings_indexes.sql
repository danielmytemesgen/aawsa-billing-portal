-- Migration 028: High-performance indexes for Meter Readings Management
-- Accelerates paginated reads, date filtering, search, and count queries

CREATE INDEX IF NOT EXISTS idx_ic_readings_date_deleted 
  ON individual_customer_readings ("READING_DATE" DESC, deleted_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ic_readings_cust_key 
  ON individual_customer_readings ("CUST_KEY");

CREATE INDEX IF NOT EXISTS idx_bm_readings_date_deleted 
  ON bulk_meter_readings ("READING_DATE" DESC, deleted_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bm_readings_cust_key 
  ON bulk_meter_readings ("CUST_KEY");

CREATE INDEX IF NOT EXISTS idx_reading_photos_reading_id 
  ON meter_reading_photos (reading_id);

CREATE INDEX IF NOT EXISTS idx_ind_cust_key 
  ON individual_customers ("customerKeyNumber");

CREATE INDEX IF NOT EXISTS idx_bulk_meters_cust_key 
  ON bulk_meters ("customerKeyNumber");
