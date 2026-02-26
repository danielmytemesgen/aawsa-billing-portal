-- Migration: 022_update_bulk_readings_schema.sql
-- Description: Recreates bulk_meter_readings table with expanded columns to match individual_customer_readings features.

-- Drop the old table
DROP TABLE IF EXISTS public.bulk_meter_readings CASCADE;

-- Recreate the table with new schema
CREATE TABLE public.bulk_meter_readings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- READ_PROC_ID is generated based on ID
    "READ_PROC_ID" TEXT GENERATED ALWAYS AS ('BM' || id::text) STORED,
    
    -- New Columns matching individual_customer_readings
    "ROUND_KEY" TEXT,
    "WALK_ORDER" INTEGER,
    "INST_KEY" TEXT,
    "INST_TYPE_CODE" TEXT,
    "CUST_KEY" TEXT, -- Corresponds to Bulk Meter Customer Key Number
    "CUST_NAME" TEXT,
    "DISPLAY_ADDRESS" TEXT,
    "BRANCH_NAME" TEXT,
    "METER_KEY" TEXT,
    "PREVIOUS_READING" NUMERIC(12,3),
    "LAST_READING_DATE" TIMESTAMP WITH TIME ZONE,
    "NUMBER_OF_DIALS" INTEGER,
    "METER_DIAMETER" NUMERIC,
    "SHADOW_PCNT" NUMERIC,
    "MIN_USAGE_QTY" NUMERIC,
    "MIN_USAGE_AMOUNT" NUMERIC,
    "CHARGE_GROUP" TEXT,
    "USAGE_CODE" TEXT,
    "SELL_CODE" TEXT,
    "FREQUENCY" TEXT,
    "SERVICE_CODE" TEXT,
    "SHADOW_USAGE" NUMERIC,
    "ESTIMATED_READING" NUMERIC,
    "ESTIMATED_READING_LOW" NUMERIC,
    "ESTIMATED_READING_HIGH" NUMERIC,
    "ESTIMATED_READING_IND" TEXT,
    
    -- Critical Fields
    "METER_READING" NUMERIC(12,3) NOT NULL, -- Core value
    "READING_DATE" TIMESTAMP WITH TIME ZONE DEFAULT now(),
    "METER_READER_CODE" TEXT,
    "FAULT_CODE" TEXT,
    "SERVICE_BILLED_UP_TO_DATE" DATE,
    "METER_MULTIPLY_FACTOR" NUMERIC,
    
    -- Location / Device Info
    "LATITUDE" NUMERIC,
    "LONGITUDE" NUMERIC,
    "ALTITUDE" NUMERIC,
    "PHONE_NUMBER" TEXT,
    
    -- Status / Error logging
    "isSuccess" BOOLEAN,
    "error" TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID -- retaining tracking of who uploaded
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bulk_readings_cust_key ON public.bulk_meter_readings("CUST_KEY");
CREATE INDEX IF NOT EXISTS idx_bulk_readings_meter_key ON public.bulk_meter_readings("METER_KEY");
CREATE INDEX IF NOT EXISTS idx_bulk_readings_date ON public.bulk_meter_readings("READING_DATE");
