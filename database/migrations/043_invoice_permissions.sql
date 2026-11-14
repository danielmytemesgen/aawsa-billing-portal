-- Migration 043: Granular Invoice Generator RBAC Permissions
-- Defines 6 invoice permissions that gate the Invoice Generator page and its UI elements:
--   invoice:view                – Access the Invoice Generator page at all
--   invoice:print               – Print single invoice or batch print multiple
--   invoice:export_csv          – Export invoice list to CSV
--   invoice:export_excel        – Export invoice list to Excel (.xlsx)
--   invoice:batch               – Access the Batch Invoices tab (org-wide bulk view)
--   invoice:customer_statement  – Access the Customer Statements tab (per-customer lookup)

-- ============================================================================
-- STEP 1: Upsert all 6 invoice permissions
-- ============================================================================
INSERT INTO permissions (name, description, category)
VALUES
  ('invoice:view',               'Access the Invoice Generator page',                                    'Invoices'),
  ('invoice:print',              'Print individual or batch invoices',                                   'Invoices'),
  ('invoice:export_csv',         'Export invoice data to CSV format',                                    'Invoices'),
  ('invoice:export_excel',       'Export invoice data to Excel format',                                  'Invoices'),
  ('invoice:batch',              'Access the Batch Invoices tab to view and select invoices in bulk',    'Invoices'),
  ('invoice:customer_statement', 'Access the Customer Statements tab for per-customer invoice lookup',   'Invoices')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category;

-- ============================================================================
-- STEP 2: Full access → Admin & System-level roles
-- (admin, system administrator, staff admin, head office management)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'admin', 'system administrator', 'staff admin', 'head office management'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:export_csv',
    'invoice:export_excel',
    'invoice:batch',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Manager / Approver roles
-- (branch manager, manager, supervisor, approver)
-- View + print + both tabs; no raw data export
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'branch manager', 'manager', 'supervisor', 'approver'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:batch',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Billing Officers & Clerks (data encoders / staff)
-- Can view invoices and print; no raw export; batch tab only
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'billing officer', 'data encoder', 'staff', 'clerk'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:batch'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Cashiers & Tellers
-- Can view + print individual invoices; customer statement tab only
-- (they hand invoices to walk-in customers, not batch-printing)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'cashier', 'teller', 'payment collector'
)
  AND p.name IN (
    'invoice:view',
    'invoice:print',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 6: Auditors & Inspectors
-- View-only: can see both tabs but cannot print or export
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN (
  'auditor', 'inspector', 'gl auditor'
)
  AND p.name IN (
    'invoice:view',
    'invoice:batch',
    'invoice:customer_statement'
  )
ON CONFLICT DO NOTHING;

