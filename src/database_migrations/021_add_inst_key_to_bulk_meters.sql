-- Migration: Add INST_KEY to bulk_meters
-- This migration adds the INST_KEY column to the bulk_meters table

ALTER TABLE bulk_meters ADD COLUMN "INST_KEY" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bulk_meters."INST_KEY" IS 'Installation Key or similar identifier for the bulk meter connection';
