-- Migration 041: Add 'Pending Amendment' status to bulk_meters and individual_customers
-- This status is used when an approver sends a record back for corrections before final approval.

-- Drop and recreate the bulk_meters status check constraint
ALTER TABLE bulk_meters DROP CONSTRAINT IF EXISTS bulk_meters_status_check;
ALTER TABLE bulk_meters ADD CONSTRAINT bulk_meters_status_check
  CHECK (status = ANY (ARRAY[
    'Active'::text,
    'Maintenance'::text,
    'Pending Approval'::text,
    'Pending Amendment'::text,
    'Rejected'::text
  ]));

-- Drop and recreate the individual_customers status check constraint
ALTER TABLE individual_customers DROP CONSTRAINT IF EXISTS individual_customers_status_check;
ALTER TABLE individual_customers ADD CONSTRAINT individual_customers_status_check
  CHECK (status = ANY (ARRAY[
    'Active'::text,
    'Inactive'::text,
    'Suspended'::text,
    'Pending Approval'::text,
    'Pending Amendment'::text,
    'Rejected'::text
  ]));

