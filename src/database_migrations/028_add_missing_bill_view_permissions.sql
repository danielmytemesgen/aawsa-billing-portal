-- Migration: 028_add_missing_bill_view_permissions
-- Description: Adds missing bill view permissions (bill:view_pending, bill:view_approved)
-- and assigns bill:correct to the correct roles.

-- 1. Sync sequence
SELECT setval(pg_get_serial_sequence('permissions', 'id'), (SELECT MAX(id) FROM permissions));

-- 2. Insert missing permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:view_pending') THEN
        INSERT INTO permissions (name, category, description)
        VALUES ('bill:view_pending', 'Billing Workflow', 'View bills in Pending (awaiting approval) status');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:view_approved') THEN
        INSERT INTO permissions (name, category, description)
        VALUES ('bill:view_approved', 'Billing Workflow', 'View bills in Approved status (ready to post)');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:correct') THEN
        INSERT INTO permissions (name, category, description)
        VALUES ('bill:correct', 'Billing Workflow', 'Revert a Posted bill back to Rework status for corrections');
    END IF;
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
        -- Admin gets all
        'Admin|bill:view_pending',
        'Admin|bill:view_approved',
        'Admin|bill:correct',
        -- Head Office Management
        'Head Office Management|bill:view_pending',
        'Head Office Management|bill:view_approved',
        'Head Office Management|bill:correct',
        -- Staff Management
        'Staff Management|bill:view_pending',
        'Staff Management|bill:view_approved',
        'Staff Management|bill:correct',
        -- Staff (can see pending to know it is submitted, but NOT approved unless they can post)
        'Staff|bill:view_pending',
        'Staff|bill:view_approved'
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
