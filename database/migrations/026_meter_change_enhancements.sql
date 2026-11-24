-- Migration 026: Meter Change Enhancements
-- Adds meter physical specifications, closing consumption, and rollback/void tracking

ALTER TABLE meter_change_log 
  ADD COLUMN IF NOT EXISTS old_meter_size numeric,
  ADD COLUMN IF NOT EXISTS new_meter_size numeric,
  ADD COLUMN IF NOT EXISTS new_seal_number text,
  ADD COLUMN IF NOT EXISTS new_dial_count integer,
  ADD COLUMN IF NOT EXISTS closing_consumption numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by text,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE INDEX IF NOT EXISTS idx_mcl_status ON meter_change_log(status);
