-- Migration: Add INST_KEY to individual_customers
-- This migration adds the INST_KEY column to the individual_customers table

ALTER TABLE individual_customers ADD COLUMN "INST_KEY" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN individual_customers."INST_KEY" IS 'Installation Key or similar identifier for the customer connection';
