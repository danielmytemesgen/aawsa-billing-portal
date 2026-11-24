-- Migration 042: Add amendment_reason column to bulk_meters and individual_customers
-- Stores the reason tag selected by the approver when sending a record back for amendment.
-- Staff members can see this reason directly on the record, not just in notifications.

ALTER TABLE bulk_meters
  ADD COLUMN IF NOT EXISTS amendment_reason text;

ALTER TABLE individual_customers
  ADD COLUMN IF NOT EXISTS amendment_reason text;

