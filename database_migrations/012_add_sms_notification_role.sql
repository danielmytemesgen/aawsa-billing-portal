-- 1. Create the new permission for sending SMS notifications
INSERT INTO public.permissions (name, description, category)
VALUES ('sms_notifications_send', 'Can send SMS notifications to customers', 'Notifications')
ON CONFLICT (name) DO NOTHING;

-- 2. Create the new role for sending SMS
INSERT INTO public.roles (role_name, description)
VALUES ('SMS Notifier', 'Can send SMS notifications to customers')
ON CONFLICT (role_name) DO NOTHING;

-- 3. Assign the new permission to the new role, and also to Admin and Staff Management
DO $$
DECLARE
    sms_notifier_role_id smallint;
    admin_role_id smallint;
    staff_mgmt_role_id smallint;
    sms_permission_id smallint;
BEGIN
    -- Get role IDs
    SELECT id INTO sms_notifier_role_id FROM public.roles WHERE role_name = 'SMS Notifier';
    SELECT id INTO admin_role_id FROM public.roles WHERE role_name = 'Admin';
    SELECT id INTO staff_mgmt_role_id FROM public.roles WHERE role_name = 'Staff Management';

    -- Get permission ID
    SELECT id INTO sms_permission_id FROM public.permissions WHERE name = 'sms_notifications_send';

    -- Assign permission to SMS Notifier role
    IF sms_notifier_role_id IS NOT NULL AND sms_permission_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (sms_notifier_role_id, sms_permission_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Assign permission to Admin role
    IF admin_role_id IS NOT NULL AND sms_permission_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (admin_role_id, sms_permission_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Assign permission to Staff Management role
    IF staff_mgmt_role_id IS NOT NULL AND sms_permission_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (staff_mgmt_role_id, sms_permission_id)
        ON CONFLICT DO NOTHING;
    END IF;

END;
$$ LANGUAGE plpgsql;
