-- Migration 035: GL Financial & Audit Report Granular Permissions
-- Adds:
--   1. report:gl_audit_view        -> Base view permission for GL Financial & Audit Report
--   2. report:gl_audit_view_all    -> System-wide permission to view all branches & comparison tab
--   3. report:gl_audit_view_branch -> Branch-scoped permission restricted to assigned branch only

-- STEP 1: Insert permissions safely with ON CONFLICT DO NOTHING / UPDATE
INSERT INTO permissions (name, description, category)
VALUES
  ('report:gl_audit_view',        'View GL Financial & Audit Report',                                          'Finance'),
  ('report:gl_audit_view_all',    'View All Branches in GL Financial & Audit Report (System-Wide)',            'Finance'),
  ('report:gl_audit_view_branch', 'View Assigned Branch Only in GL Financial & Audit Report (Branch-Specific)','Finance')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category = EXCLUDED.category;

-- STEP 2: Map to Global / System-Wide Roles
-- Roles: Admin, System Administrator, Staff Admin, Head Office Management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('admin', 'system administrator', 'staff admin', 'head office management')
  AND p.name IN ('report:gl_audit_view', 'report:gl_audit_view_all')
ON CONFLICT DO NOTHING;

-- Clean up any branch-scoped perm mistakenly assigned to global roles
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE LOWER(TRIM(role_name)) IN ('admin', 'system administrator', 'staff admin', 'head office management')
)
AND permission_id IN (
  SELECT id FROM permissions WHERE name IN ('report:gl_audit_view_branch', 'report:branch_gl_finance_yearly', 'report:branch_gl_finance_monthly')
);

-- STEP 3: Map to Branch-Scoped Roles
-- Roles: Staff Management, Staff, Data Encoder, Reader Supervisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('staff management', 'staff', 'data encoder', 'reader supervisor')
  AND p.name IN ('report:gl_audit_view', 'report:gl_audit_view_branch')
ON CONFLICT DO NOTHING;

-- Clean up global view-all perm from branch-only roles
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE LOWER(TRIM(role_name)) IN ('staff management', 'staff', 'data encoder', 'reader supervisor')
)
AND permission_id IN (
  SELECT id FROM permissions WHERE name = 'report:gl_audit_view_all'
);






