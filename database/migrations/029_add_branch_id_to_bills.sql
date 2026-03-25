-- Migration: Add branch_id to bills table and populate it
-- 1. Add branch_id column
ALTER TABLE bills ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- 2. Populate branch_id for bulk meter bills
UPDATE bills b
SET branch_id = bm.branch_id
FROM bulk_meters bm
WHERE b."CUSTOMERKEY" = bm."customerKeyNumber"
AND b.branch_id IS NULL;

-- 3. Populate branch_id for individual customer bills
UPDATE bills b
SET branch_id = ic.branch_id
FROM individual_customers ic
WHERE b.individual_customer_id = ic."customerKeyNumber"
AND b.branch_id IS NULL;

-- 4. Create an index for performance
CREATE INDEX IF NOT EXISTS idx_bills_branch_id ON bills(branch_id);
