-- 021_support_tickets.sql
-- Support Ticket & Customer Service Module Schema

CREATE TABLE IF NOT EXISTS ticket_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL,
  customer_key TEXT NOT NULL,
  customer_type TEXT DEFAULT 'individual',
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id INT REFERENCES ticket_categories(id) ON DELETE SET NULL,
  category_name TEXT,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Pending Customer', 'Resolved', 'Closed')),
  assigned_to UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  assigned_staff_name TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  escalation_level INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff', 'system')),
  sender_id TEXT,
  sender_name TEXT,
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  uploaded_by_type TEXT DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES support_tickets(id) ON DELETE CASCADE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  was_resolved BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_escalation_rules (
  id SERIAL PRIMARY KEY,
  priority TEXT NOT NULL UNIQUE,
  first_response_sla_hours INT NOT NULL DEFAULT 4,
  resolution_sla_hours INT NOT NULL DEFAULT 24,
  escalate_to_supervisor_hours INT NOT NULL DEFAULT 24,
  escalate_to_headoffice_hours INT NOT NULL DEFAULT 48,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Categories if empty
INSERT INTO ticket_categories (name, description)
VALUES 
  ('Billing Dispute', 'Issues related to water bills, excessive charges, calculation errors or disputed payments'),
  ('Meter Issue', 'Broken meter, faulty dials, inaccessible meters, or meter leakage'),
  ('Service Request', 'Request for new meter connection, relocation, reconnection or meter calibration'),
  ('Water Quality', 'Complaints regarding water pressure, discoloration, odor, or contamination'),
  ('Connection/Disconnection', 'Inquiries or requests regarding supply disconnection, reconnection, or valve operations'),
  ('General Inquiry', 'Questions regarding tariffs, billing cycle, branch offices, or general procedures'),
  ('Complaint', 'Staff conduct, delayed service, service interruption, or general grievances')
ON CONFLICT (name) DO NOTHING;

-- Seed Default Escalation Rules
INSERT INTO support_escalation_rules (priority, first_response_sla_hours, resolution_sla_hours, escalate_to_supervisor_hours, escalate_to_headoffice_hours)
VALUES
  ('Urgent', 1, 8, 8, 16),
  ('High', 2, 16, 16, 32),
  ('Medium', 4, 24, 24, 48),
  ('Low', 8, 48, 48, 96)
ON CONFLICT (priority) DO NOTHING;

-- Seed Support Permissions into RBAC permissions table
INSERT INTO permissions (name, category, description)
VALUES
  ('support:view_all', 'Customer Support', 'View all customer support tickets across all AAWSA branches'),
  ('support:view_branch', 'Customer Support', 'View support tickets assigned to own branch only'),
  ('support:create', 'Customer Support', 'Submit new customer support tickets'),
  ('support:assign', 'Customer Support', 'Assign and reassign tickets to staff members'),
  ('support:resolve', 'Customer Support', 'Mark support tickets as resolved or closed'),
  ('support:manage', 'Customer Support', 'Full management of support module, SLA escalation rules, and categories')
ON CONFLICT (name) DO NOTHING;

-- Indexes for lightning fast queries & dashboard statistics
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON support_tickets(customer_key, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tickets_branch ON support_tickets(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON ticket_feedback(rating);

-- Map Support Permissions to Roles
-- (A) Global Administrators (Admin, System Administrator, Staff admin): Full Support Privileges
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) IN ('admin', 'system administrator', 'staff admin')
  AND p.name LIKE 'support:%'
ON CONFLICT DO NOTHING;

-- (B) Head Office Management: View all branches, create, assign, resolve, manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'head office management'
  AND p.name IN ('support:view_all', 'support:view_branch', 'support:create', 'support:assign', 'support:resolve', 'support:manage')
ON CONFLICT DO NOTHING;

-- (C) Staff Management: Branch-level management, view, create, assign, resolve, manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'staff management'
  AND p.name IN ('support:view_branch', 'support:create', 'support:assign', 'support:resolve', 'support:manage')
ON CONFLICT DO NOTHING;

-- (D) Branch Staff / CSR: Branch ticket view, create, assign, resolve
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'staff'
  AND p.name IN ('support:view_branch', 'support:create', 'support:assign', 'support:resolve')
ON CONFLICT DO NOTHING;

-- (E) Reader Supervisor: Branch ticket view, create, assign, resolve
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'reader supervisor'
  AND p.name IN ('support:view_branch', 'support:create', 'support:assign', 'support:resolve')
ON CONFLICT DO NOTHING;
