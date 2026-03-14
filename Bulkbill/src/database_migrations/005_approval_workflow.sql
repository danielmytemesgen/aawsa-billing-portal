-- Step 1: Alter the CHECK constraint to add new status values.
-- This approach is safer for existing TEXT columns.
-- First, drop the existing constraint if it exists.
-- The name 'individual_customers_status_check' is the default name Supabase assigns.
ALTER TABLE public.individual_customers
DROP CONSTRAINT IF EXISTS individual_customers_status_check;

-- Now, add a new constraint that includes all desired values.
ALTER TABLE public.individual_customers
ADD CONSTRAINT individual_customers_status_check
CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Pending Approval', 'Rejected'));


-- Step 2: Add new columns to the individual_customers table for tracking approvals
-- The 'IF NOT EXISTS' check ensures the script can be run multiple times without error.

-- Column to store the ID of the staff member who approved the record.
-- CORRECTED: Changed type from UUID to TEXT to match staff_members.id
ALTER TABLE public.individual_customers
ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Column to store the timestamp of when the approval happened.
ALTER TABLE public.individual_customers
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add a foreign key constraint to link 'approved_by' to the 'staff_members' table.
-- This ensures data integrity.
-- A check is added to avoid adding the constraint if it already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_approved_by_staff' AND conrelid = 'public.individual_customers'::regclass
  ) THEN
    ALTER TABLE public.individual_customers
    ADD CONSTRAINT fk_approved_by_staff
    FOREIGN KEY (approved_by)
    REFERENCES public.staff_members(id)
    ON DELETE SET NULL; -- If the approving staff member is deleted, keep the customer record but nullify the reference.
  END IF;
END$$;

-- Add a comment to the new column for clarity in database tools.
COMMENT ON COLUMN public.individual_customers.approved_by IS 'Foreign key referencing the staff member who approved this customer record.';
