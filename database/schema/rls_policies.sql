-- =================================================================
-- RLS POLICIES FOR AAWSA BILLING APP (PUBLIC ACCESS)
-- =================================================================
--
-- This script sets up Row Level Security (RLS) policies to allow
-- public access to the meter reading tables.
--
-- **ACTION REQUIRED**: Run this code in your Supabase SQL Editor.
-- Go to Database -> SQL Editor -> "New query" and paste this entire script.
--
-- This is necessary for the current direct-database login system to
-- function correctly, as it operates without a formal Supabase auth session.
--

-- ----------------------------------------
-- Policies for: individual_customer_readings
-- ----------------------------------------

-- 1. Enable RLS on the table if it's not already
ALTER TABLE public.individual_customer_readings ENABLE ROW LEVEL SECURITY;

-- 2. Drop old/conflicting policies for a clean setup
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow public read access" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow public insert access" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow public update access" ON public.individual_customer_readings;
DROP POLICY IF EXISTS "Allow public delete access" ON public.individual_customer_readings;

-- 3. Create new policies for PUBLIC access
CREATE POLICY "Allow public read access"
ON public.individual_customer_readings FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access"
ON public.individual_customer_readings FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access"
ON public.individual_customer_readings FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access"
ON public.individual_customer_readings FOR DELETE TO public USING (true);


-- ----------------------------------------
-- Policies for: bulk_meter_readings
-- ----------------------------------------

-- 1. Enable RLS on the table if it's not already
ALTER TABLE public.bulk_meter_readings ENABLE ROW LEVEL SECURITY;

-- 2. Drop old/conflicting policies
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow public read access" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow public insert access" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow public update access" ON public.bulk_meter_readings;
DROP POLICY IF EXISTS "Allow public delete access" ON public.bulk_meter_readings;

-- 3. Create new policies for PUBLIC access
CREATE POLICY "Allow public read access"
ON public.bulk_meter_readings FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access"
ON public.bulk_meter_readings FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access"
ON public.bulk_meter_readings FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access"
ON public.bulk_meter_readings FOR DELETE TO public USING (true);

-- End of script.
