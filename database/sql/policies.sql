-- =================================================================
-- Row Level Security (RLS) Policies for AAWSA Billing App
-- =================================================================
-- To apply these policies, navigate to the SQL Editor in your Supabase
-- dashboard (Database > SQL Editor) and run the queries below.
--
-- These are starter policies that grant broad access to any
-- authenticated user. You can make these more restrictive later
-- (e.g., only allowing staff from a specific branch to insert readings).
-- =================================================================


-- =================================================================
-- Policies for: individual_customer_readings
-- =================================================================

-- 1. First, enable Row Level Security on the table
ALTER TABLE public.individual_customer_readings ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for SELECT, INSERT, UPDATE, DELETE

-- Policy: Allow any authenticated user to read all readings.
CREATE POLICY "Allow authenticated read access on individual readings"
ON public.individual_customer_readings FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow any authenticated user to insert new readings.
CREATE POLICY "Allow authenticated insert access on individual readings"
ON public.individual_customer_readings FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow any authenticated user to update readings.
CREATE POLICY "Allow authenticated update access on individual readings"
ON public.individual_customer_readings FOR UPDATE
TO authenticated
USING (true);

-- Policy: Allow any authenticated user to delete readings.
CREATE POLICY "Allow authenticated delete access on individual readings"
ON public.individual_customer_readings FOR DELETE
TO authenticated
USING (true);


-- =================================================================
-- Policies for: bulk_meter_readings
-- =================================================================

-- 1. First, enable Row Level Security on the table
ALTER TABLE public.bulk_meter_readings ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for SELECT, INSERT, UPDATE, DELETE

-- Policy: Allow any authenticated user to read all bulk readings.
CREATE POLICY "Allow authenticated read access on bulk readings"
ON public.bulk_meter_readings FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow any authenticated user to insert new bulk readings.
CREATE POLICY "Allow authenticated insert access on bulk readings"
ON public.bulk_meter_readings FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow any authenticated user to update bulk readings.
CREATE POLICY "Allow authenticated update access on bulk readings"
ON public.bulk_meter_readings FOR UPDATE
TO authenticated
USING (true);

-- Policy: Allow any authenticated user to delete bulk readings.
CREATE POLICY "Allow authenticated delete access on bulk readings"
ON public.bulk_meter_readings FOR DELETE
TO authenticated
USING (true);

-- =================================================================
-- NOTE: If you encounter similar errors for other tables, you can
--       use these policies as a template. Just replace the table
--       name (e.g., public.individual_customer_readings) with the
--       name of the other table.
-- =================================================================
