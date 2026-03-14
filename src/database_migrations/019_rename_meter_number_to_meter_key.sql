-- Migration: Rename meterNumber to METER_KEY
-- This migration renames the meterNumber column to METER_KEY in bulk_meters and individual_customers tables
-- The new format for METER_KEY is: XXX-XXXXXXX (e.g., MET-2822965)

-- Rename column in bulk_meters table
ALTER TABLE bulk_meters RENAME COLUMN "meterNumber" TO "METER_KEY";

-- Rename column in individual_customers table  
ALTER TABLE individual_customers RENAME COLUMN "meterNumber" TO "METER_KEY";

-- Update unique constraints if needed
-- Note: PostgreSQL automatically updates constraints when renaming columns

-- Add comment for documentation
COMMENT ON COLUMN bulk_meters."METER_KEY" IS 'Meter key identifier in format XXX-XXXXXXX (e.g., MET-2822965)';
COMMENT ON COLUMN individual_customers."METER_KEY" IS 'Meter key identifier in format XXX-XXXXXXX (e.g., MET-2822965)';
