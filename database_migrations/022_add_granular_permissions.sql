-- Add granular permissions to replace hard-coded role checks
-- Using a more robust insertion method that doesn't require a unique constraint for idempotency

INSERT INTO public.permissions (name, category, description)
SELECT 'routes_view_assigned', 'Customer Management', 'View routes assigned to the user'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'routes_view_assigned');

INSERT INTO public.permissions (name, category, description)
SELECT 'staff_view_branch', 'Staff Management', 'View staff members in the user''s branch'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'staff_view_branch');

INSERT INTO public.permissions (name, category, description)
SELECT 'bill:view_branch', 'Bill Management', 'View bills in the user''s branch'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bill:view_branch');

INSERT INTO public.permissions (name, category, description)
SELECT 'bill:manage_all', 'Bill Management', 'Bypass branch checks and manage all bills'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bill:manage_all');

INSERT INTO public.permissions (name, category, description)
SELECT 'customers_create_restricted', 'Customer Management', 'Create customers that require approval'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'customers_create_restricted');

INSERT INTO public.permissions (name, category, description)
SELECT 'bulk_meters_create_restricted', 'Bulk Meter Management', 'Create bulk meters that require approval'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bulk_meters_create_restricted');

-- Assign permissions to roles
DO $$
DECLARE
    admin_role_id smallint;
    ho_mgmt_role_id smallint;
    staff_mgmt_role_id smallint;
    staff_role_id smallint;
    reader_role_id smallint;
BEGIN
    -- Get role IDs
    SELECT id INTO admin_role_id FROM public.roles WHERE role_name = 'Admin';
    SELECT id INTO ho_mgmt_role_id FROM public.roles WHERE role_name = 'Head Office Management';
    SELECT id INTO staff_mgmt_role_id FROM public.roles WHERE role_name = 'Staff Management';
    SELECT id INTO staff_role_id FROM public.roles WHERE role_name = 'Staff';
    SELECT id INTO reader_role_id FROM public.roles WHERE role_name = 'Reader';

    -- Reader: Can view assigned routes
    IF reader_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT reader_role_id, id FROM public.permissions 
        WHERE name IN ('routes_view_assigned', 'dashboard_view_branch')
        AND NOT EXISTS (
            SELECT 1 FROM public.role_permissions 
            WHERE role_id = reader_role_id AND permission_id = public.permissions.id
        );
    END IF;

    -- Staff: Restricted creation, branch-level viewing, and bill submission
    IF staff_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT staff_role_id, id FROM public.permissions 
        WHERE name IN (
            'customers_create_restricted', 
            'bulk_meters_create_restricted', 
            'bill:view_branch',
            'meter_readings_view_branch',
            'bill:create',
            'bill:view_drafts',
            'bill:submit'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.role_permissions 
            WHERE role_id = staff_role_id AND permission_id = public.permissions.id
        );
    END IF;

    -- Staff Management: Branch-level management, bill approval/workflow
    IF staff_mgmt_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT staff_mgmt_role_id, id FROM public.permissions 
        WHERE name IN (
            'staff_view_branch', 
            'customers_view_branch', 
            'bulk_meters_view_branch', 
            'bill:view_branch',
            'bill:view_drafts',
            'bill:approve',
            'bill:rework',
            'bill:correct',
            'bill:send'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.role_permissions 
            WHERE role_id = staff_mgmt_role_id AND permission_id = public.permissions.id
        );
    END IF;

    -- Admin & HO Management: Manage all
    IF admin_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT admin_role_id, id FROM public.permissions 
        WHERE name IN ('bill:manage_all', 'staff_view', 'customers_view_all', 'bulk_meters_view_all', 'bill:send', 'bill:approve')
        AND NOT EXISTS (
            SELECT 1 FROM public.role_permissions 
            WHERE role_id = admin_role_id AND permission_id = public.permissions.id
        );
    END IF;

    IF ho_mgmt_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT ho_mgmt_role_id, id FROM public.permissions 
        WHERE name IN ('bill:manage_all', 'staff_view', 'customers_view_all', 'bulk_meters_view_all', 'bill:send', 'bill:approve')
        AND NOT EXISTS (
            SELECT 1 FROM public.role_permissions 
            WHERE role_id = ho_mgmt_role_id AND permission_id = public.permissions.id
        );
    END IF;

END;
$$;
