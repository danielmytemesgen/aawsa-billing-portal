-- Migration: 023_add_missing_bill_action_permissions
-- Description: Inserts bill:send and bill:correct permissions which were
--              referenced in role assignments but never inserted into the
--              permissions table, causing Action Center buttons to be hidden.

-- 1. Insert missing permissions
INSERT INTO public.permissions (name, category, description)
SELECT 'bill:send', 'Bill Management', 'Post and finalize approved bills'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bill:send');

INSERT INTO public.permissions (name, category, description)
SELECT 'bill:correct', 'Bill Management', 'Correct a previously posted bill'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bill:correct');

INSERT INTO public.permissions (name, category, description)
SELECT 'bill:view_pending', 'Bill Management', 'View bills awaiting approval'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bill:view_pending');

INSERT INTO public.permissions (name, category, description)
SELECT 'bill:view_approved', 'Bill Management', 'View bills ready to post'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'bill:view_approved');

-- 1b. Unify all bill-related permission categories into 'Bill Management'
UPDATE public.permissions
SET category = 'Bill Management'
WHERE (name LIKE 'bill:%' OR name LIKE 'billing:%')
  AND category IS DISTINCT FROM 'Bill Management';

-- 2. Assign to appropriate roles (idempotent)
DO $$
DECLARE
    admin_role_id smallint;
    ho_mgmt_role_id smallint;
    staff_mgmt_role_id smallint;
    send_perm_id int;
    correct_perm_id int;
    view_pending_perm_id int;
    view_approved_perm_id int;
BEGIN
    SELECT id INTO admin_role_id      FROM public.roles WHERE role_name = 'Admin';
    SELECT id INTO ho_mgmt_role_id    FROM public.roles WHERE role_name = 'Head Office Management';
    SELECT id INTO staff_mgmt_role_id FROM public.roles WHERE role_name = 'Staff Management';
    SELECT id INTO send_perm_id       FROM public.permissions WHERE name = 'bill:send';
    SELECT id INTO correct_perm_id    FROM public.permissions WHERE name = 'bill:correct';
    SELECT id INTO view_pending_perm_id  FROM public.permissions WHERE name = 'bill:view_pending';
    SELECT id INTO view_approved_perm_id FROM public.permissions WHERE name = 'bill:view_approved';

    -- Admin gets bill:send + bill:correct + bill:view_pending + bill:view_approved
    IF admin_role_id IS NOT NULL AND send_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT admin_role_id, send_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = admin_role_id AND permission_id = send_perm_id);
    END IF;

    IF admin_role_id IS NOT NULL AND correct_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT admin_role_id, correct_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = admin_role_id AND permission_id = correct_perm_id);
    END IF;

    IF admin_role_id IS NOT NULL AND view_pending_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT admin_role_id, view_pending_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = admin_role_id AND permission_id = view_pending_perm_id);
    END IF;

    IF admin_role_id IS NOT NULL AND view_approved_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT admin_role_id, view_approved_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = admin_role_id AND permission_id = view_approved_perm_id);
    END IF;

    -- Head Office Management gets bill:send + bill:correct + bill:view_pending + bill:view_approved
    IF ho_mgmt_role_id IS NOT NULL AND send_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT ho_mgmt_role_id, send_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = ho_mgmt_role_id AND permission_id = send_perm_id);
    END IF;

    IF ho_mgmt_role_id IS NOT NULL AND correct_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT ho_mgmt_role_id, correct_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = ho_mgmt_role_id AND permission_id = correct_perm_id);
    END IF;

    IF ho_mgmt_role_id IS NOT NULL AND view_pending_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT ho_mgmt_role_id, view_pending_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = ho_mgmt_role_id AND permission_id = view_pending_perm_id);
    END IF;

    IF ho_mgmt_role_id IS NOT NULL AND view_approved_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT ho_mgmt_role_id, view_approved_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = ho_mgmt_role_id AND permission_id = view_approved_perm_id);
    END IF;

    -- Staff Management gets bill:send + bill:correct + bill:view_pending + bill:view_approved
    IF staff_mgmt_role_id IS NOT NULL AND send_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT staff_mgmt_role_id, send_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = staff_mgmt_role_id AND permission_id = send_perm_id);
    END IF;

    IF staff_mgmt_role_id IS NOT NULL AND correct_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT staff_mgmt_role_id, correct_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = staff_mgmt_role_id AND permission_id = correct_perm_id);
    END IF;

    IF staff_mgmt_role_id IS NOT NULL AND view_pending_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT staff_mgmt_role_id, view_pending_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = staff_mgmt_role_id AND permission_id = view_pending_perm_id);
    END IF;

    IF staff_mgmt_role_id IS NOT NULL AND view_approved_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT staff_mgmt_role_id, view_approved_perm_id
        WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = staff_mgmt_role_id AND permission_id = view_approved_perm_id);
    END IF;

END;
$$;

