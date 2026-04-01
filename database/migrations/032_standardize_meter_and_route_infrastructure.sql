-- Migration: 032_standardize_meter_and_route_infrastructure.sql
-- Description: Standardizes column naming across bulk_meters and individual_customers to align with MRT and readings schema.

-- 1. Standardize BULK_METERS table
DO $$ 
BEGIN 
    -- Add METER_KEY if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulk_meters' AND column_name='METER_KEY') THEN
        ALTER TABLE public.bulk_meters ADD COLUMN "METER_KEY" VARCHAR(100);
        -- Sync from meterNumber if METER_KEY is newly added
        UPDATE public.bulk_meters SET "METER_KEY" = "meterNumber" WHERE "METER_KEY" IS NULL;
    END IF;

    -- Add ROUTE_KEY if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulk_meters' AND column_name='ROUTE_KEY') THEN
        ALTER TABLE public.bulk_meters ADD COLUMN "ROUTE_KEY" VARCHAR(100);
        -- Sync from routeKey if it exists (camelCase)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulk_meters' AND column_name='routeKey') THEN
            UPDATE public.bulk_meters SET "ROUTE_KEY" = "routeKey" WHERE "ROUTE_KEY" IS NULL;
        END IF;
    END IF;

    -- Add ROUND_KEY if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulk_meters' AND column_name='ROUND_KEY') THEN
        ALTER TABLE public.bulk_meters ADD COLUMN "ROUND_KEY" VARCHAR(100);
    END IF;
END $$;

-- 2. Standardize INDIVIDUAL_CUSTOMERS table
DO $$ 
BEGIN 
    -- Add METER_KEY if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='individual_customers' AND column_name='METER_KEY') THEN
        ALTER TABLE public.individual_customers ADD COLUMN "METER_KEY" VARCHAR(100);
        -- Sync from meterNumber if METER_KEY is newly added
        UPDATE public.individual_customers SET "METER_KEY" = "meterNumber" WHERE "METER_KEY" IS NULL;
    END IF;

    -- Add ROUTE_KEY if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='individual_customers' AND column_name='ROUTE_KEY') THEN
        ALTER TABLE public.individual_customers ADD COLUMN "ROUTE_KEY" VARCHAR(100);
    END IF;

    -- Add ROUND_KEY if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='individual_customers' AND column_name='ROUND_KEY') THEN
        ALTER TABLE public.individual_customers ADD COLUMN "ROUND_KEY" VARCHAR(100);
    END IF;
END $$;

-- 3. Create Indexes for new columns to speed up lookups/searches
CREATE INDEX IF NOT EXISTS idx_bulk_meters_meter_key ON public.bulk_meters("METER_KEY");
CREATE INDEX IF NOT EXISTS idx_bulk_meters_route_key ON public.bulk_meters("ROUTE_KEY");
CREATE INDEX IF NOT EXISTS idx_individual_customers_meter_key ON public.individual_customers("METER_KEY");
CREATE INDEX IF NOT EXISTS idx_individual_customers_route_key ON public.individual_customers("ROUTE_KEY");
