-- Migration: 028_reading_analytics_permission
-- Description: Adds meter_readings_analytics_view permission and assigns it to core roles.

DO $$
DECLARE
    v_perm_id smallint;
    v_role_id smallint;
    v_roles text[] := ARRAY['Admin', 'Head Office Management', 'Staff Management', 'Staff'];
    v_role_name text;
BEGIN
    -- 1. Add the permission
    IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'meter_readings_analytics_view') THEN
        INSERT INTO public.permissions (name, category, description)
        VALUES ('meter_readings_analytics_view', 'Data & Reports', 'View meter reading analytics and reports')
        RETURNING id INTO v_perm_id;
    ELSE
        SELECT id INTO v_perm_id FROM public.permissions WHERE name = 'meter_readings_analytics_view';
    END IF;

    -- 2. Assign to roles
    FOREACH v_role_name IN ARRAY v_roles
    LOOP
        SELECT id INTO v_role_id FROM public.roles WHERE role_name = v_role_name;
        
        IF v_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = v_role_id AND permission_id = v_perm_id) THEN
                INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id);
            END IF;
        END IF;
    END LOOP;
END;
$$;
