-- Migration 027: Meter Change Permissions -- seed & role mapping
-- Run this AFTER 025_meter_change_log.sql and 026_meter_change_enhancements.sql
-- Safe to re-run: all statements use ON CONFLICT DO NOTHING

-- STEP 1: Ensure the three permissions exist
-- (025 already inserts them; this is a safety guard for fresh installs)
INSERT INTO permissions (name, description, category)
VALUES
  ('meter_change_view',   'View meter change audit history and logs',              'Field Operations'),
  ('meter_change_create', 'Perform meter replacements and update meter records',   'Field Operations'),
  ('meter_change_manage', 'Supervisor: void / rollback meter changes + full audit','Field Operations')
ON CONFLICT (name) DO NOTHING;


-- STEP 2: Map permissions to roles
--
-- Role                   | view | create | manage
-- ----------------------------------------------------------------
-- Admin /
--   System Administrator /
--   Staff Admin          |  Y   |   Y    |   Y    (full access)
-- Head Office Management |  Y   |   Y    |   Y    (supervisory)
-- Staff Management       |  Y   |   Y    |   Y    (branch supervisor)
-- Staff                  |  Y   |   Y    |        (field operator, no void)
-- Reader Supervisor      |  Y   |        |        (read-only oversight)

-- (A) Global Admins -- full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) IN ('admin', 'system administrator', 'staff admin')
  AND p.name IN ('meter_change_view', 'meter_change_create', 'meter_change_manage')
ON CONFLICT DO NOTHING;

-- (B) Head Office Management -- view + create + manage (can void/rollback)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'head office management'
  AND p.name IN ('meter_change_view', 'meter_change_create', 'meter_change_manage')
ON CONFLICT DO NOTHING;

-- (C) Staff Management -- view + create + manage (branch supervisor)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'staff management'
  AND p.name IN ('meter_change_view', 'meter_change_create', 'meter_change_manage')
ON CONFLICT DO NOTHING;

-- (D) Staff -- view + create (field operator; cannot void)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'staff'
  AND p.name IN ('meter_change_view', 'meter_change_create')
ON CONFLICT DO NOTHING;

-- (E) Reader Supervisor -- view only (monitoring / oversight)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'reader supervisor'
  AND p.name IN ('meter_change_view')
ON CONFLICT DO NOTHING;
