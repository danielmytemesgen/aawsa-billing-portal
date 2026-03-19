-- Add bill:correct permission
INSERT INTO public.permissions (name, description, category) VALUES
('bill:correct', 'Allow reverting a posted bill to rework status for corrections', 'Bill Management')
ON CONFLICT (name) DO NOTHING;

-- Grant to Managers and Admins
DO $$
DECLARE
    mgr_role_id smallint;
    adm_role_id smallint;
BEGIN
    SELECT id INTO mgr_role_id FROM public.roles WHERE role_name IN ('Manager', 'Managerial');
    SELECT id INTO adm_role_id FROM public.roles WHERE role_name IN ('Admin', 'Administrator');
    
    IF mgr_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT mgr_role_id, id FROM public.permissions WHERE name = 'bill:correct'
        ON CONFLICT DO NOTHING;
    END IF;

    IF adm_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT adm_role_id, id FROM public.permissions WHERE name = 'bill:correct'
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;
