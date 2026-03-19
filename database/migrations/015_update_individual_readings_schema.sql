-- Migration: 015_update_individual_readings_schema.sql
-- Description: Recreates individual_customer_readings table with expanded columns and READ_PROC_ID generation.

-- Drop the old table (and any dependent foreign keys if strict, but CASCADE should handle it if set up)
DROP TABLE IF EXISTS public.individual_customer_readings CASCADE;

-- Recreate the table with new schema
CREATE TABLE public.individual_customer_readings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- READ_PROC_ID is generated based on ID
    "READ_PROC_ID" TEXT GENERATED ALWAYS AS ('BK' || id::text) STORED,
    
    -- New Columns from User Request
    "ROUND_KEY" TEXT,
    "WALK_ORDER" INTEGER,
    "INST_KEY" TEXT,
    "INST_TYPE_CODE" TEXT,
    "CUST_KEY" TEXT,
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
    
    -- Critical Fields (mapped to old schema concepts where possible)
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
    
    -- Foreign Keys handling (Optional: Link back to customers if needed)
    -- Assuming "CUST_KEY" corresponds to "individual_customers"."customerKeyNumber"
    -- We'll add a FK constraint if data integrity is strictly required, but for CSV imports often loose coupling is safer initially.
    -- Choosing loose coupling for now to strictly follow the column list request without complex dependencies.
    created_by UUID -- retaining tracking of who uploaded if needed, though not in user list, good for system.
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_readings_cust_key ON public.individual_customer_readings("CUST_KEY");
CREATE INDEX IF NOT EXISTS idx_readings_meter_key ON public.individual_customer_readings("METER_KEY");
CREATE INDEX IF NOT EXISTS idx_readings_date ON public.individual_customer_readings("READING_DATE");
