-- Create the tariffs table if it does not exist.
-- This table will store all billing parameters, making the system configurable.
CREATE TABLE IF NOT EXISTS public.tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_type TEXT NOT NULL,
    year INT NOT NULL,
    tiers JSONB NOT NULL,
    maintenance_percentage REAL NOT NULL DEFAULT 0.01,
    sanitation_percentage REAL NOT NULL,
    sewerage_rate_per_m3 REAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_type, year)
);

-- Create a trigger to automatically update the updated_at timestamp.
CREATE OR REPLACE TRIGGER set_tariffs_updated_at
BEFORE UPDATE ON public.tariffs
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Seeding data for the years 2021, 2022, 2023, 2024, and 2025.
-- This script uses an ON CONFLICT clause to prevent errors if the data already exists.
-- It will either insert new data or update existing rows if the customer_type and year match.

DO $$
DECLARE
    -- Correct tier structure based on the user-provided database screenshot.
    -- This structure applies to both Domestic and Non-domestic customer types.
    -- The last tier with limit 56 implies usage above this will also use this rate.
    correct_tiers JSONB := '[
        {"rate": 10.21, "limit": 5},
        {"rate": 17.87, "limit": 14},
        {"rate": 33.19, "limit": 23},
        {"rate": 51.07, "limit": 32},
        {"rate": 61.28, "limit": 41},
        {"rate": 71.49, "limit": 50},
        {"rate": 81.71, "limit": 56}
    ]';
    
    -- Define other billing parameters.
    domestic_sanitation_percentage REAL := 0.07;
    nondomestic_sanitation_percentage REAL := 0.10;
    domestic_sewerage_rate REAL := 6.25;
    nondomestic_sewerage_rate REAL := 12.50;
    
    -- Loop through the specified years to insert/update tariff data.
    year_to_process INT;
BEGIN
    FOR year_to_process IN 2021..2025 LOOP
        -- Insert or update for "Domestic" customer type
        INSERT INTO public.tariffs (customer_type, year, tiers, sanitation_percentage, sewerage_rate_per_m3)
        VALUES (
            'Domestic', 
            year_to_process, 
            correct_tiers, 
            domestic_sanitation_percentage,
            domestic_sewerage_rate
        )
        ON CONFLICT (customer_type, year) 
        DO UPDATE SET
            tiers = EXCLUDED.tiers,
            sanitation_percentage = EXCLUDED.sanitation_percentage,
            sewerage_rate_per_m3 = EXCLUDED.sewerage_rate_per_m3,
            updated_at = NOW();

        -- Insert or update for "Non-domestic" customer type
        INSERT INTO public.tariffs (customer_type, year, tiers, sanitation_percentage, sewerage_rate_per_m3)
        VALUES (
            'Non-domestic', 
            year_to_process, 
            correct_tiers, 
            nondomestic_sanitation_percentage,
            nondomestic_sewerage_rate
        )
        ON CONFLICT (customer_type, year) 
        DO UPDATE SET
            tiers = EXCLUDED.tiers,
            sanitation_percentage = EXCLUDED.sanitation_percentage,
            sewerage_rate_per_m3 = EXCLUDED.sewerage_rate_per_m3,
            updated_at = NOW();
    END LOOP;
END $$;
