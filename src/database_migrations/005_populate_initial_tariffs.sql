-- Migration to populate tariffs with historical and current rates (2021-2025)
-- Based on provided tariff rate sheet

-- 1. Schema Migration: Ensure the table has the correct columns
-- Add effective_date if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tariffs' AND column_name='effective_date') THEN
        ALTER TABLE public.tariffs ADD COLUMN effective_date DATE;
    END IF;
END $$;

-- Add JSONB columns for tiers and metadata if they don't exist
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS year; -- Drop old year column
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS sewerage_tiers JSONB;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS meter_rent_prices JSONB;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS domestic_vat_threshold_m3 NUMERIC DEFAULT 25;

-- Ensure constraints are updated
ALTER TABLE public.tariffs DROP CONSTRAINT IF EXISTS tariffs_customer_type_year_key;
ALTER TABLE public.tariffs DROP CONSTRAINT IF EXISTS tariffs_customer_type_effective_date_key;
ALTER TABLE public.tariffs ADD CONSTRAINT tariffs_customer_type_effective_date_key UNIQUE (customer_type, effective_date);

-- Clear existing tariffs to avoid constraint violations
DELETE FROM public.tariffs;

-- Domestic Tariffs
INSERT INTO public.tariffs (customer_type, effective_date, tiers, sewerage_tiers, maintenance_percentage, sanitation_percentage, vat_rate, domestic_vat_threshold_m3, meter_rent_prices)
VALUES 
-- 2021
('Domestic', '2021-01-01', 
    '[{"rate": 10.35, "limit": 7}, {"rate": 15.15, "limit": 15}, {"rate": 17.65, "limit": 30}, {"rate": 20.35, "limit": 50}, {"rate": 22.85, "limit": 75}, {"rate": 25.45, "limit": 100}, {"rate": 28.1, "limit": 150}, {"rate": 31.25, "limit": "Infinity"}]',
    '[{"rate": 4, "limit": 50}, {"rate": 7, "limit": "Infinity"}]',
    0.01, 0.07, 0.15, 25,
    '{"1/2": 32, "3/4": 52, "1": 74, "1 1/4": 158, "1 1/2": 222, "2": 308, "3": 395, "4": 490, "5": 612, "6": 782, "8": 1022, "10": 1335, "12": 1740}'
),
-- 2022 (Same as 2021 in sheet)
('Domestic', '2022-01-01', 
    '[{"rate": 10.35, "limit": 7}, {"rate": 15.15, "limit": 15}, {"rate": 17.65, "limit": 30}, {"rate": 20.35, "limit": 50}, {"rate": 22.85, "limit": 75}, {"rate": 25.45, "limit": 100}, {"rate": 28.1, "limit": 150}, {"rate": 31.25, "limit": "Infinity"}]',
    '[{"rate": 4, "limit": 50}, {"rate": 7, "limit": "Infinity"}]',
    0.01, 0.07, 0.15, 25,
    '{"1/2": 32, "3/4": 52, "1": 74, "1 1/4": 158, "1 1/2": 222, "2": 308, "3": 395, "4": 490, "5": 612, "6": 782, "8": 1022, "10": 1335, "12": 1740}'
),
-- 2023 (Updated rates)
('Domestic', '2023-01-01', 
    '[{"rate": 11.23, "limit": 7}, {"rate": 16.45, "limit": 15}, {"rate": 19.15, "limit": 30}, {"rate": 22.10, "limit": 50}, {"rate": 24.80, "limit": 75}, {"rate": 27.60, "limit": 100}, {"rate": 30.50, "limit": 150}, {"rate": 33.90, "limit": "Infinity"}]',
    '[{"rate": 4.5, "limit": 50}, {"rate": 8, "limit": "Infinity"}]',
    0.01, 0.07, 0.15, 25,
    '{"1/2": 35, "3/4": 56, "1": 80, "1 1/4": 170, "1 1/2": 240, "2": 330, "3": 420, "4": 520, "5": 650, "6": 830, "8": 1100, "10": 1400, "12": 1850}'
);

-- Non-domestic Tariffs
INSERT INTO public.tariffs (customer_type, effective_date, tiers, sewerage_tiers, maintenance_percentage, sanitation_percentage, vat_rate, meter_rent_prices)
VALUES 
-- 2021
('Non-domestic', '2021-01-01', 
    '[{"rate": 13.50, "limit": 10}, {"rate": 17.65, "limit": 30}, {"rate": 20.35, "limit": 50}, {"rate": 24.05, "limit": 100}, {"rate": 27.45, "limit": "Infinity"}]',
    '[{"rate": 5, "limit": "Infinity"}]',
    0.01, 0.1, 0.15,
    '{"1/2": 45, "3/4": 65, "1": 95, "1 1/4": 200, "1 1/2": 280, "2": 380, "3": 480, "4": 600}'
),
-- 2022
('Non-domestic', '2022-01-01', 
    '[{"rate": 13.50, "limit": 10}, {"rate": 17.65, "limit": 30}, {"rate": 20.35, "limit": 50}, {"rate": 24.05, "limit": 100}, {"rate": 27.45, "limit": "Infinity"}]',
    '[{"rate": 5, "limit": "Infinity"}]',
    0.01, 0.1, 0.15,
    '{"1/2": 45, "3/4": 65, "1": 95, "1 1/4": 200, "1 1/2": 280, "2": 380, "3": 480, "4": 600}'
);

-- Rental Domestic
INSERT INTO public.tariffs (customer_type, effective_date, tiers, sewerage_tiers, maintenance_percentage, sanitation_percentage, vat_rate, domestic_vat_threshold_m3)
VALUES 
('rental domestic', '2021-01-01', 
    '[{"rate": 8.50, "limit": "Infinity"}]',
    '[]',
    0.01, 0.07, 0.15, 25
);

-- Rental Non-domestic
INSERT INTO public.tariffs (customer_type, effective_date, tiers, sewerage_tiers, maintenance_percentage, sanitation_percentage, vat_rate)
VALUES 
('rental Non domestic', '2021-01-01', 
    '[{"rate": 15.20, "limit": "Infinity"}]',
    '[{"rate": 6, "limit": "Infinity"}]',
    0.01, 0.07, 0.15
);
