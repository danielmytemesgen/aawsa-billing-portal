-- Create the tariffs table to store billing rates
CREATE TABLE IF NOT EXISTS public.tariffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_type text NOT NULL UNIQUE,
    tiers jsonb NOT NULL,
    maintenance_percentage numeric NOT NULL,
    sanitation_percentage numeric NOT NULL,
    sewerage_rate_per_m3 numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read access" ON public.tariffs;
CREATE POLICY "Allow public read access" ON public.tariffs
FOR SELECT USING (true);

-- Allow admins to update, checking the role from the JWT
DROP POLICY IF EXISTS "Allow admin update access" ON public.tariffs;
CREATE POLICY "Allow admin update access" ON public.tariffs
FOR UPDATE USING ((SELECT (auth.jwt() ->> 'user_role')::text) = 'Admin')
WITH CHECK ((SELECT (auth.jwt() ->> 'user_role')::text) = 'Admin');


-- Function to seed default tariff data if it doesn't exist
CREATE OR REPLACE FUNCTION seed_default_tariffs()
RETURNS void AS $$
BEGIN
    -- Seed Domestic Tariff
    INSERT INTO public.tariffs (customer_type, tiers, maintenance_percentage, sanitation_percentage, sewerage_rate_per_m3)
    VALUES (
        'Domestic',
        '[
            {"limit": 5, "rate": 10.21},
            {"limit": 14, "rate": 17.87},
            {"limit": 23, "rate": 33.19},
            {"limit": 32, "rate": 51.07},
            {"limit": 41, "rate": 61.28},
            {"limit": 50, "rate": 71.49},
            {"limit": "Infinity", "rate": 81.71}
        ]',
        0.01,
        0.07,
        6.25
    ) ON CONFLICT (customer_type) DO NOTHING;

    -- Seed Non-domestic Tariff
    INSERT INTO public.tariffs (customer_type, tiers, maintenance_percentage, sanitation_percentage, sewerage_rate_per_m3)
    VALUES (
        'Non-domestic',
        '[
            {"limit": 5, "rate": 10.21},
            {"limit": 14, "rate": 17.87},
            {"limit": 23, "rate": 33.19},
            {"limit": 32, "rate": 51.07},
            {"limit": 41, "rate": 61.28},
            {"limit": 50, "rate": 71.49},
            {"limit": "Infinity", "rate": 81.71}
        ]',
        0.01,
        0.10,
        8.75
    ) ON CONFLICT (customer_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Execute the seed function
SELECT seed_default_tariffs();
