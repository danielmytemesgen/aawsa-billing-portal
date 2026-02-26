-- Create the tariffs table
CREATE TABLE IF NOT EXISTS public.tariffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_type text NOT NULL,
    year integer NOT NULL,
    tiers jsonb NOT NULL,
    maintenance_percentage numeric DEFAULT 0.01 NOT NULL,
    sanitation_percentage numeric NOT NULL,
    sewerage_rate_per_m3 numeric NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (customer_type, year)
);

-- Upsert function for tariffs table
CREATE OR REPLACE FUNCTION upsert_tariff(
    p_customer_type text,
    p_year integer,
    p_tiers jsonb,
    p_maintenance_percentage numeric,
    p_sanitation_percentage numeric,
    p_sewerage_rate_per_m3 numeric
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.tariffs (customer_type, year, tiers, maintenance_percentage, sanitation_percentage, sewerage_rate_per_m3)
    VALUES (p_customer_type, p_year, p_tiers, p_maintenance_percentage, p_sanitation_percentage, p_sewerage_rate_per_m3)
    ON CONFLICT (customer_type, year)
    DO UPDATE SET
        tiers = EXCLUDED.tiers,
        maintenance_percentage = EXCLUDED.maintenance_percentage,
        sanitation_percentage = EXCLUDED.sanitation_percentage,
        sewerage_rate_per_m3 = EXCLUDED.sewerage_rate_per_m3;
END;
$$ LANGUAGE plpgsql;

-- Corrected Domestic Tariff Data for 2021-2025 based on screenshot
-- Tiers: 0-7, 8-20, 21-35, 36-50, >50
DO $$
BEGIN
    FOR year_val IN 2021..2025 LOOP
        PERFORM upsert_tariff(
            'Domestic',
            year_val,
            '{"tiers": [{"rate": 10.21, "limit": 7}, {"rate": 17.87, "limit": 20}, {"rate": 21.87, "limit": 35}, {"rate": 24.37, "limit": 50}, {"rate": 26.87, "limit": "Infinity"}]}',
            0.01,
            0.07,
            6.25
        );
    END LOOP;
END;
$$;


-- Corrected Non-domestic Tariff Data for 2021-2025 based on screenshot
-- Tiers: 0-15, >15
DO $$
BEGIN
    FOR year_val IN 2021..2025 LOOP
        PERFORM upsert_tariff(
            'Non-domestic',
            year_val,
            '{"tiers": [{"rate": 22.12, "limit": 15}, {"rate": 25.62, "limit": "Infinity"}]}',
            0.01,
            0.10,
            12.50
        );
    END LOOP;
END;
$$;

-- Enable Row Level Security
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tariffs
DROP POLICY IF EXISTS "Allow public read access to tariffs" ON public.tariffs;
CREATE POLICY "Allow public read access to tariffs" ON public.tariffs FOR SELECT USING (true);

-- Allow admin write access to tariffs
DROP POLICY IF EXISTS "Allow admins full access to tariffs" ON public.tariffs;
CREATE POLICY "Allow admins full access to tariffs" ON public.tariffs FOR ALL
USING (true)
WITH CHECK (
  (SELECT role FROM public.staff_members WHERE id = auth.uid()) = 'Admin'
);
