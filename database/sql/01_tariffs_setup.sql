-- #################################################################
-- ### 1. TARIFFS TABLE SETUP
-- #################################################################

-- Create the tariffs table
CREATE TABLE public.tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_type TEXT NOT NULL,
    tier_description TEXT NOT NULL,
    consumption_limit NUMERIC NOT NULL,
    rate_per_m3 NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for clarity
COMMENT ON TABLE public.tariffs IS 'Stores the tariff tiers for different customer types.';
COMMENT ON COLUMN public.tariffs.customer_type IS 'e.g., ''Domestic'' or ''Non-domestic''';
COMMENT ON COLUMN public.tariffs.consumption_limit IS 'The upper consumption limit for this tier in m³. Use a large number for infinity.';
COMMENT ON COLUMN public.tariffs.rate_per_m3 IS 'The price per cubic meter for this consumption tier.';


-- #################################################################
-- ### 2. METER RENTS TABLE SETUP
-- #################################################################

-- Create the meter_rents table
CREATE TABLE public.meter_rents (
    meter_size NUMERIC PRIMARY KEY,
    rent_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for clarity
COMMENT ON TABLE public.meter_rents IS 'Stores the monthly rent price based on meter size.';
COMMENT ON COLUMN public.meter_rents.meter_size IS 'The size of the meter in inches (e.g., 0.5, 0.75, 1).';
COMMENT ON COLUMN public.meter_rents.rent_price IS 'The monthly rental price in the default currency (e.g., ETB).';


-- #################################################################
-- ### 3. ROW LEVEL SECURITY (RLS) POLICIES
-- #################################################################

-- Enable RLS on both tables
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_rents ENABLE ROW LEVEL SECURITY;

-- --- Policies for `tariffs` table ---

-- 1. Allow authenticated users to read all tariffs
CREATE POLICY "Allow authenticated read access on tariffs"
ON public.tariffs
FOR SELECT
TO authenticated
USING (true);

-- 2. Allow users with the 'Admin' role to perform all actions
CREATE POLICY "Allow admins full access on tariffs"
ON public.tariffs
FOR ALL
TO authenticated
USING ((SELECT role FROM public.staff_members WHERE id = auth.uid()::text) = 'Admin')
WITH CHECK ((SELECT role FROM public.staff_members WHERE id = auth.uid()::text) = 'Admin');


-- --- Policies for `meter_rents` table ---

-- 1. Allow authenticated users to read all meter rents
CREATE POLICY "Allow authenticated read access on meter_rents"
ON public.meter_rents
FOR SELECT
TO authenticated
USING (true);

-- 2. Allow users with the 'Admin' role to perform all actions
CREATE POLICY "Allow admins full access on meter_rents"
ON public.meter_rents
FOR ALL
TO authenticated
USING ((SELECT role FROM public.staff_members WHERE id = auth.uid()::text) = 'Admin')
WITH CHECK ((SELECT role FROM public.staff_members WHERE id = auth.uid()::text) = 'Admin');


-- #################################################################
-- ### 4. INSERT DEFAULT DATA
-- #################################################################

-- --- Insert default Meter Rent data ---
INSERT INTO public.meter_rents (meter_size, rent_price) VALUES
(0.5, 15),
(0.75, 20),
(1, 33),
(1.25, 36),
(1.5, 57),
(2, 98),
(2.5, 112),
(3, 148),
(4, 177),
(5, 228),
(6, 259);


-- --- Insert default Domestic Tariff data ---
-- Using 999999 as a representation for Infinity
INSERT INTO public.tariffs (customer_type, tier_description, consumption_limit, rate_per_m3) VALUES
('Domestic', 'Tier 1: 1-5 m³', 5, 10.21),
('Domestic', 'Tier 2: 6-14 m³', 14, 17.87),
('Domestic', 'Tier 3: 15-23 m³', 23, 33.19),
('Domestic', 'Tier 4: 24-32 m³', 32, 51.07),
('Domestic', 'Tier 5: 33-41 m³', 41, 61.28),
('Domestic', 'Tier 6: 42-50 m³', 50, 71.49),
('Domestic', 'Tier 7: 51-56 m³', 56, 81.71),
('Domestic', 'Tier 8: Above 56 m³', 999999, 81.71);


-- --- Insert default Non-domestic Tariff data ---
-- Using 999999 as a representation for Infinity
INSERT INTO public.tariffs (customer_type, tier_description, consumption_limit, rate_per_m3) VALUES
('Non-domestic', 'Tier 1: 1-5 m³', 5, 10.21),
('Non-domestic', 'Tier 2: 6-14 m³', 14, 17.87),
('Non-domestic', 'Tier 3: 15-23 m³', 23, 33.19),
('Non-domestic', 'Tier 4: 24-32 m³', 32, 51.07),
('Non-domestic', 'Tier 5: 33-41 m³', 41, 61.28),
('Non-domestic', 'Tier 6: 42-50 m³', 50, 71.49),
('Non-domestic', 'Tier 7: 51-56 m³', 56, 81.71),
('Non-domestic', 'Tier 8: Above 56 m³', 999999, 81.71);
