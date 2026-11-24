-- Migration 025: Create Meter Change Log table and indexes
-- Tracks all meter change operations (old meter serial, final reading, new meter serial, opening reading)

CREATE TABLE IF NOT EXISTS meter_change_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meter_type text NOT NULL CHECK (meter_type IN ('individual', 'bulk')),
  customer_key_number text NOT NULL,
  old_meter_number text NOT NULL,
  old_meter_closing_reading numeric NOT NULL DEFAULT 0,
  new_meter_number text NOT NULL,
  new_meter_opening_reading numeric NOT NULL DEFAULT 0,
  change_date date NOT NULL,
  notes text,
  performed_by text,
  performed_by_email text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcl_customer_key ON meter_change_log(customer_key_number);
CREATE INDEX IF NOT EXISTS idx_mcl_change_date ON meter_change_log(change_date DESC);
CREATE INDEX IF NOT EXISTS idx_mcl_meter_type ON meter_change_log(meter_type);

-- Add permissions to system permissions table if exists
INSERT INTO permissions (name, description, category)
VALUES 
  ('meter_change_view', 'View meter change audit history and logs', 'Operations'),
  ('meter_change_create', 'Perform meter replacements and update records', 'Operations'),
  ('meter_change_manage', 'Full management of meter changes and audits', 'Operations')
ON CONFLICT (name) DO NOTHING;
