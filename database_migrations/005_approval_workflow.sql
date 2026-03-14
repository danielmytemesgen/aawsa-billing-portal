-- This script modifies the individual_customers table to support an approval workflow.

-- Step 1: Drop the existing status constraint to redefine it.
-- A name for the constraint is assumed here ('individual_customers_status_check').
-- If your constraint has a different name, you may need to update it.
-- You can find the name by inspecting the table constraints in the Supabase UI.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'individual_customers_status_check' AND conrelid = 'public.individual_customers'::regclass
  ) THEN
    ALTER TABLE public.individual_customers DROP CONSTRAINT individual_customers_status_check;
  END IF;
END$$;


-- Step 2: Re-add the status constraint with the new values.
-- This ensures existing data remains valid while allowing new statuses.
ALTER TABLE public.individual_customers
ADD CONSTRAINT individual_customers_status_check
CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Pending Approval', 'Rejected'));


-- Step 3: Add new columns to the individual_customers table for tracking approvals.
-- The 'IF NOT EXISTS' check ensures these columns are only added once.

-- Column to store the ID of the staff member who approved the record.
-- Data type is UUID to match the staff_members.id column.
ALTER TABLE public.individual_customers
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Column to store the timestamp of when the approval happened.
ALTER TABLE public.individual_customers
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Step 4: Add a foreign key constraint to link 'approved_by' to the 'staff_members' table.
-- This ensures data integrity. A check prevents adding the constraint if it already exists.
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

-- Step 5: Add comments to the new columns for clarity in database tools.
COMMENT ON COLUMN public.individual_customers.approved_by IS 'Foreign key referencing the staff member who approved this customer record.';
COMMENT ON COLUMN public.individual_customers.approved_at IS 'The timestamp when the customer record was approved.';
