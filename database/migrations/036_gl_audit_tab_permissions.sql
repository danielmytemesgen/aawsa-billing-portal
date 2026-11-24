-- Migration 036: GL Financial & Audit Report — Per-Tab Granular Permissions
-- Adds dedicated permissions for each of the 4 tabs in the GL Audit page:
--   1. report:gl_audit_view          -> GL Code Summary tab (base view — already exists in 035)
--   2. report:gl_audit_view_all      -> All Branch Monthly GL tab (already exists in 035)
--   3. report:gl_audit_view_matrix   -> Component Breakdown Matrix tab (NEW)
--   4. report:gl_audit_view_anomaly  -> Audit & Anomaly Inspector tab (NEW)

-- STEP 1: Upsert new tab permissions
INSERT INTO permissions (name, description, category)
VALUES
  ('report:gl_audit_view_matrix',  'View Component Breakdown Matrix in GL Financial & Audit Report',  'Finance'),
  ('report:gl_audit_view_anomaly', 'View Audit & Anomaly Inspector in GL Financial & Audit Report',   'Finance')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category;

-- STEP 2: Grant view, matrix + anomaly tabs to Global roles (Admin, Head Office Management, Staff admin, System Administrator)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('admin', 'system administrator', 'staff admin', 'head office management')
  AND p.name IN ('report:gl_audit_view', 'report:gl_audit_view_all', 'report:gl_audit_view_matrix', 'report:gl_audit_view_anomaly')
ON CONFLICT DO NOTHING;

-- STEP 3: Grant matrix tab only to Branch-Scoped roles (Staff Management, Staff, Data Encoder, Reader Supervisor)
--          Branch roles do NOT get the anomaly tab (system-wide privilege required)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('staff management', 'staff', 'data encoder', 'reader supervisor')
  AND p.name IN ('report:gl_audit_view_matrix')
ON CONFLICT DO NOTHING;

-- STEP 4: Enforce — remove anomaly permission from branch-only roles
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE LOWER(TRIM(role_name)) IN ('staff management', 'staff', 'data encoder', 'reader supervisor')
)
AND permission_id IN (
  SELECT id FROM permissions WHERE name = 'report:gl_audit_view_anomaly'
);

