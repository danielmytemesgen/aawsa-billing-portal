-- Migration: 027_sync_missing_permissions
-- Description: Adds missing permissions and synchronizes them with server actions.
-- Uses NOT EXISTS throughout to avoid ON CONFLICT issues.

-- 1. Sync sequence
SELECT setval(pg_get_serial_sequence('permissions', 'id'), (SELECT MAX(id) FROM permissions));

-- 2. Insert missing permissions (one by one with NOT EXISTS)
DO $$
DECLARE
    v_perms text[][] := ARRAY[
        ARRAY['meter_readings_delete', 'Data & Reports', 'Delete individual customer meter readings'],
        ARRAY['meter_readings_bulk_delete', 'Data & Reports', 'Delete bulk meter readings'],
        ARRAY['payments_view', 'Billing Workflow', 'View payment history'],
        ARRAY['payments_create', 'Billing Workflow', 'Record new payments'],
        ARRAY['payments_delete', 'Billing Workflow', 'Delete payment records'],
        ARRAY['reports_view', 'Data & Reports', 'View system reports and logs'],
        ARRAY['reports_delete', 'Data & Reports', 'Delete report or security log entries'],
        ARRAY['notifications_delete', 'Notifications', 'Delete system notifications'],
        ARRAY['tariffs_create', 'Tariff Management', 'Create new tariff versions'],
        ARRAY['knowledge_base_view', 'Knowledge Base', 'View knowledge base articles'],
        ARRAY['knowledge_base_manage', 'Knowledge Base', 'Create, update, and delete knowledge base articles'],
        ARRAY['billing:close_cycle', 'Billing Workflow', 'Close billing cycles and generate monthly bills'],
        ARRAY['settings_manage', 'Settings', 'Full management access for settings routes fault codes and recycle bin'],
        ARRAY['bulk_meters_approve', 'Bulk Meter Management', 'Approve or reject bulk meter registrations'],
        ARRAY['bill:manage_all', 'Billing Workflow', 'Full access to all bills across all branches'],
        ARRAY['staff_view_branch', 'Staff Management', 'View staff members in the users branch'],
        ARRAY['permissions_view', 'User Management', 'View roles and permissions'],
        ARRAY['tariffs_view', 'Tariff Management', 'View existing tariffs'],
        ARRAY['dashboard_view_all', 'Dashboard', 'View dashboard with all branches'],
        ARRAY['dashboard_view_branch', 'Dashboard', 'View dashboard for own branch'],
        ARRAY['settings_view', 'Settings', 'View system settings']
    ];
BEGIN
    FOR i IN 1..array_length(v_perms, 1) LOOP
        IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = v_perms[i][1]) THEN
            INSERT INTO permissions (name, category, description)
            VALUES (v_perms[i][1], v_perms[i][2], v_perms[i][3]);
        END IF;
    END LOOP;
END;
$$;

-- 3. Assign permissions to roles
DO $$
DECLARE
    v_role_id smallint;
    v_perm_id smallint;
    v_role_name text;
    v_perm_name text;
    role_perm_pairs text[];
BEGIN
    role_perm_pairs := ARRAY[
        -- Admin gets ALL new permissions
        'Admin|meter_readings_delete', 'Admin|meter_readings_bulk_delete',
        'Admin|payments_view', 'Admin|payments_create', 'Admin|payments_delete',
        'Admin|reports_view', 'Admin|reports_delete',
        'Admin|notifications_delete',
        'Admin|tariffs_create',
        'Admin|knowledge_base_view', 'Admin|knowledge_base_manage',
        'Admin|billing:close_cycle',
        'Admin|settings_manage', 'Admin|bulk_meters_approve', 'Admin|bill:manage_all', 'Admin|staff_view_branch',
        'Admin|permissions_view', 'Admin|tariffs_view', 'Admin|dashboard_view_all', 'Admin|dashboard_view_branch', 'Admin|settings_view',
        -- Staff Management
        'Staff Management|meter_readings_delete', 'Staff Management|meter_readings_bulk_delete',
        'Staff Management|payments_view', 'Staff Management|payments_create', 'Staff Management|payments_delete',
        'Staff Management|reports_view',
        'Staff Management|notifications_delete',
        'Staff Management|knowledge_base_view', 'Staff Management|knowledge_base_manage',
        'Staff Management|billing:close_cycle',
        'Staff Management|bulk_meters_approve', 'Staff Management|staff_view_branch',
        'Staff Management|permissions_view', 'Staff Management|tariffs_view', 'Staff Management|dashboard_view_branch', 'Staff Management|settings_view',
        -- Staff
        'Staff|payments_view', 'Staff|payments_create',
        'Staff|knowledge_base_view',
        'Staff|billing:close_cycle',
        'Staff|dashboard_view_branch', 'Staff|settings_view',
        -- Head Office Management
        'Head Office Management|payments_view',
        'Head Office Management|reports_view',
        'Head Office Management|knowledge_base_view',
        'Head Office Management|bill:manage_all',
        'Head Office Management|dashboard_view_all', 'Head Office Management|settings_view'
    ];

    FOR i IN 1..array_length(role_perm_pairs, 1) LOOP
        v_role_name := split_part(role_perm_pairs[i], '|', 1);
        v_perm_name := split_part(role_perm_pairs[i], '|', 2);

        SELECT id INTO v_role_id FROM roles WHERE role_name = v_role_name;
        SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;

        IF v_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_role_id AND permission_id = v_perm_id) THEN
                INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id);
            END IF;
        END IF;
    END LOOP;
END;
$$;
