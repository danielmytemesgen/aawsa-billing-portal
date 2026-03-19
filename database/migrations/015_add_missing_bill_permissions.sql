-- Migration: 015_add_missing_bill_permissions
-- Description: Adds bill:update and bill:delete permissions.

-- Sync sequence first because it seems out of sync (manual inserts occurred)
SELECT setval(pg_get_serial_sequence('permissions', 'id'), (SELECT MAX(id) FROM permissions));

-- 1. Insert permissions
INSERT INTO permissions (name, category, description)
SELECT 'bill:update', 'Bill Management', 'Update existing bill records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:update');

INSERT INTO permissions (name, category, description)
SELECT 'bill:delete', 'Bill Management', 'Delete bill records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:delete');

-- 2. Assign to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'Admin' AND p.name IN ('bill:update', 'bill:delete')
ON CONFLICT DO NOTHING;

-- 3. Assign to Staff Management role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'Staff Management' AND p.name IN ('bill:update', 'bill:delete')
ON CONFLICT DO NOTHING;

-- 4. Assign to Staff role (optional: only update, not delete?)
-- Usually staff should be able to update their drafts.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'Staff' AND p.name IN ('bill:update')
ON CONFLICT DO NOTHING;
