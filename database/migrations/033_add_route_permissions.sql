-- Migration: 033_add_route_permissions
-- Description: Adds granular route permissions and assigns them to default roles.

DO $$
DECLARE
    v_perms text[][] := ARRAY[
        ARRAY['routes_view', 'Route Management', 'View geographic routes'],
        ARRAY['routes_view_all', 'Route Management', 'View geographic routes across all branches'],
        ARRAY['routes_create', 'Route Management', 'Create new geographic routes'],
        ARRAY['routes_update', 'Route Management', 'Update existing geographic routes'],
        ARRAY['routes_delete', 'Route Management', 'Delete geographic routes']
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

DO $$
DECLARE
    v_role_id smallint;
    v_perm_id smallint;
    v_role_name text;
    v_perm_name text;
    role_perm_pairs text[];
BEGIN
    role_perm_pairs := ARRAY[
        -- Admin gets EVERYTHING
        'Admin|routes_view', 'Admin|routes_view_all', 'Admin|routes_create', 'Admin|routes_update', 'Admin|routes_delete',
        -- Head Office Management gets view all
        'Head Office Management|routes_view', 'Head Office Management|routes_view_all',
        -- Staff Management can manage routes (branch specific unless they have staff_view_all)
        'Staff Management|routes_view', 'Staff Management|routes_create', 'Staff Management|routes_update', 'Staff Management|routes_delete'
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
