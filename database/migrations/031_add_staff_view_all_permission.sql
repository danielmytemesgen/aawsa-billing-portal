-- Migration: 031_add_staff_view_all_permission
-- Description: Adds the staff_view_all permission under the Staff Management category.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'staff_view_all') THEN
        INSERT INTO permissions (name, category, description)
        VALUES ('staff_view_all', 'Staff Management', 'Full access to view all staff members across all branches');
    END IF;
END;
$$;

-- Assign to Admin and Head Office Management
DO $$
DECLARE
    v_admin_role_id int;
    v_ho_role_id int;
    v_perm_id int;
BEGIN
    SELECT id INTO v_admin_role_id FROM roles WHERE role_name = 'Admin';
    SELECT id INTO v_ho_role_id FROM roles WHERE role_name IN ('Head Office Management', 'head office management');
    SELECT id INTO v_perm_id FROM permissions WHERE name = 'staff_view_all';

    IF v_admin_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_admin_role_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_perm_id);
        END IF;
    END IF;

    IF v_ho_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_ho_role_id AND permission_id = v_perm_id) THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES (v_ho_role_id, v_perm_id);
        END IF;
    END IF;
END;
$$;
