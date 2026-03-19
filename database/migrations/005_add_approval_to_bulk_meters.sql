-- Comprehensive Migration to fix staff_members.id type and all related foreign key constraints.
-- This version handles RLS policies and all dependent tables.

BEGIN;

-- ===================================================================
-- STEP 1: Drop all potentially problematic Foreign Key constraints.
-- ===================================================================

-- Drop RLS policy on staff_members first as it depends on the primary key
DROP POLICY IF EXISTS "Allow individual user to read their own data" ON public.staff_members;

-- Drop FKs from tables referencing staff_members.id
ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS staff_members_role_id_fkey;
ALTER TABLE public.individual_customer_readings DROP CONSTRAINT IF EXISTS individual_customer_readings_reader_staff_id_fkey;
ALTER TABLE public.bulk_meter_readings DROP CONSTRAINT IF EXISTS bulk_meter_readings_reader_staff_id_fkey;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_processed_by_staff_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_generated_by_staff_id_fkey;
ALTER TABLE public.bulk_meters DROP CONSTRAINT IF EXISTS fk_bulk_meters_approved_by_staff;
ALTER TABLE public.individual_customers DROP CONSTRAINT IF EXISTS individual_customers_approved_by_fkey;
ALTER TABLE public.individual_customers DROP CONSTRAINT IF EXISTS fk_approved_by_staff; -- Drop old FK name if it exists


-- ===================================================================
-- STEP 2: Alter all relevant columns to UUID type.
-- This is the core fix to ensure type compatibility.
-- ===================================================================

-- Alter the primary key of staff_members
ALTER TABLE public.staff_members ALTER COLUMN id TYPE uuid USING id::uuid;

-- Alter the foreign key columns in all dependent tables
ALTER TABLE public.individual_customer_readings ALTER COLUMN reader_staff_id TYPE uuid USING reader_staff_id::uuid;
ALTER TABLE public.bulk_meter_readings ALTER COLUMN reader_staff_id TYPE uuid USING reader_staff_id::uuid;
ALTER TABLE public.payments ALTER COLUMN processed_by_staff_id TYPE uuid USING processed_by_staff_id::uuid;
ALTER TABLE public.reports ALTER COLUMN generated_by_staff_id TYPE uuid USING generated_by_staff_id::uuid;

-- Add the new approval columns to bulk_meters correctly typed.
ALTER TABLE public.bulk_meters ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.bulk_meters ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Ensure the existing approved_by column on individual_customers is also UUID.
ALTER TABLE public.individual_customers ALTER COLUMN approved_by TYPE uuid USING approved_by::uuid;


-- ===================================================================
-- STEP 3: Re-create all Foreign Key constraints with correct types.
-- ===================================================================

-- Re-create FK for staff_members to roles
ALTER TABLE public.staff_members ADD CONSTRAINT staff_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;

-- Re-create RLS policy on staff_members
CREATE POLICY "Allow individual user to read their own data"
ON public.staff_members
FOR SELECT
USING (auth.uid() = id);

-- Re-create FK for individual_customer_readings to staff_members
ALTER TABLE public.individual_customer_readings ADD CONSTRAINT individual_customer_readings_reader_staff_id_fkey FOREIGN KEY (reader_staff_id) REFERENCES public.staff_members(id) ON DELETE SET NULL;

-- Re-create FK for bulk_meter_readings to staff_members
ALTER TABLE public.bulk_meter_readings ADD CONSTRAINT bulk_meter_readings_reader_staff_id_fkey FOREIGN KEY (reader_staff_id) REFERENCES public.staff_members(id) ON DELETE SET NULL;

-- Re-create FK for payments to staff_members
ALTER TABLE public.payments ADD CONSTRAINT payments_processed_by_staff_id_fkey FOREIGN KEY (processed_by_staff_id) REFERENCES public.staff_members(id) ON DELETE SET NULL;

-- Re-create FK for reports to staff_members
ALTER TABLE public.reports ADD CONSTRAINT reports_generated_by_staff_id_fkey FOREIGN KEY (generated_by_staff_id) REFERENCES public.staff_members(id) ON DELETE SET NULL;

-- Re-create the FK for individual_customers approvals.
ALTER TABLE public.individual_customers ADD CONSTRAINT individual_customers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff_members(id) ON DELETE SET NULL;

-- Add the new FK for bulk_meters approvals.
ALTER TABLE public.bulk_meters ADD CONSTRAINT fk_bulk_meters_approved_by_staff FOREIGN KEY (approved_by) REFERENCES public.staff_members(id) ON DELETE SET NULL;


COMMIT;
