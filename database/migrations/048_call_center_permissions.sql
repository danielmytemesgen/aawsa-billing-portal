-- Migration 048: Call Center Permissions & Tables
-- Upserts Call Center RBAC permissions and assigns them to Admin, Management, and Call Center roles.

-- 1. Upsert Permissions
INSERT INTO permissions (name, description, category)
VALUES
  ('callcenter:access',       'Access the AAWSA Call Center workspace and caller inquiry console', 'Customer Support & Help Desk'),
  ('callcenter:view_all',     'Monitor caller interaction history across all authority branches',    'Customer Support & Help Desk'),
  ('callcenter:view_branch',  'Access call logs for customers assigned to the agent branch',       'Customer Support & Help Desk'),
  ('callcenter:log_call',     'Record customer inquiries, caller identity, and resolution notes',   'Customer Support & Help Desk'),
  ('callcenter:dispatch_sms', 'Instantly resend bill details and payment reference SMS to caller', 'Customer Support & Help Desk'),
  ('callcenter:supervisor',   'Call Center Supervisor oversight, queue metrics, and escalations',   'Customer Support & Help Desk')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category;

-- 2. Ensure Call Center Roles exist in the roles registry
INSERT INTO roles (role_name, description)
VALUES
  ('Call Center Operator',   'Hotline customer inquiry, caller 360 lookup, interaction logging & SMS dispatch'),
  ('Call Center Supervisor', 'Call center queue monitoring, escalated inquiries, performance audit & supervisor controls')
ON CONFLICT (role_name) DO NOTHING;

-- 3. Grant full Call Center permissions to Admin, System Administrator & Head Office Management roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE (
  LOWER(TRIM(r.role_name)) IN (
    'admin', 'system administrator', 'staff admin', 'head office management', 'head office'
  )
  OR LOWER(TRIM(r.role_name)) LIKE '%head office%'
)
AND p.name LIKE 'callcenter:%'
ON CONFLICT DO NOTHING;

-- 4. Grant full Call Center permissions to Call Center Supervisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('call center supervisor', 'callcenter supervisor')
AND p.name LIKE 'callcenter:%'
ON CONFLICT DO NOTHING;

-- 5. Grant operational Call Center permissions to Call Center Operator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('call center operator', 'callcenter operator')
AND p.name IN ('callcenter:access', 'callcenter:view_branch', 'callcenter:log_call', 'callcenter:dispatch_sms')
ON CONFLICT DO NOTHING;

-- 6. Create call_center_logs table
CREATE TABLE IF NOT EXISTS call_center_logs (
    id SERIAL PRIMARY KEY,
    call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    caller_phone TEXT NOT NULL,
    caller_name TEXT,
    customer_key_number TEXT,
    branch_name TEXT,
    call_type TEXT NOT NULL DEFAULT 'inbound',
    category TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    resolution_status TEXT NOT NULL DEFAULT 'resolved_on_call',
    notes TEXT,
    agent_id TEXT,
    agent_email TEXT NOT NULL,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
    sms_sent BOOLEAN DEFAULT false,
    sentiment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure column exists if table was previously created without sentiment
ALTER TABLE call_center_logs ADD COLUMN IF NOT EXISTS sentiment TEXT;

-- 7. Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_call_center_phone ON call_center_logs(caller_phone);
CREATE INDEX IF NOT EXISTS idx_call_center_customer_key ON call_center_logs(customer_key_number);
CREATE INDEX IF NOT EXISTS idx_call_center_created_at ON call_center_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_center_sentiment ON call_center_logs(sentiment);
CREATE INDEX IF NOT EXISTS idx_call_center_agent_email ON call_center_logs(agent_email);
