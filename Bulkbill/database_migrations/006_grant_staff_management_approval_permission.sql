-- This script grants the 'customers_approve' permission to the 'Staff Management' role.
-- It is designed to be safe to run multiple times and corrects previous errors.

DO $$
DECLARE
  v_staff_management_role_id INT;
  v_customers_approve_permission_id INT;
BEGIN
  -- Step 1: Ensure the 'customers_approve' permission exists in the permissions table.
  -- If it doesn't, this will add it. If it does, it will do nothing.
  INSERT INTO public.permissions (name, description, category)
  VALUES ('customers_approve', 'Can approve or reject new customer registrations.', 'Customers')
  ON CONFLICT (name) DO NOTHING;

  -- Step 2: Get the ID for the 'Staff Management' role.
  SELECT id INTO v_staff_management_role_id FROM public.roles WHERE role_name = 'Staff Management';

  -- Step 3: Get the ID for the 'customers_approve' permission.
  SELECT id INTO v_customers_approve_permission_id FROM public.permissions WHERE name = 'customers_approve';

  -- Step 4: If both the role and permission exist, insert the link into the role_permissions table.
  -- The ON CONFLICT clause prevents errors if the link already exists.
  IF v_staff_management_role_id IS NOT NULL AND v_customers_approve_permission_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_staff_management_role_id, v_customers_approve_permission_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

END$$;
