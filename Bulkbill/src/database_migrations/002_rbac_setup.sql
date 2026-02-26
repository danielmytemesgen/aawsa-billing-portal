-- Create the roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create the permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create the role_permissions join table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id smallint NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id smallint NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- Add role_id to staff_members table and set up foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'staff_members' AND column_name = 'role_id'
    ) THEN
        ALTER TABLE public.staff_members
        ADD COLUMN role_id smallint;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'staff_members_role_id_fkey'
    ) THEN
        ALTER TABLE public.staff_members
        ADD CONSTRAINT staff_members_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;
    END IF;
END;
$$;


-- Enable RLS for the new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;


-- Policies for 'roles' table
DROP POLICY IF EXISTS "Allow public read access on roles" ON public.roles;
CREATE POLICY "Allow public read access on roles" ON public.roles
FOR SELECT USING (true);

-- Policies for 'permissions' table
DROP POLICY IF EXISTS "Allow public read access on permissions" ON public.permissions;
CREATE POLICY "Allow public read access on permissions" ON public.permissions
FOR SELECT USING (true);

-- Policies for 'role_permissions' table
DROP POLICY IF EXISTS "Allow public read access on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow public read access on role_permissions" ON public.role_permissions
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin full access on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow admin full access on role_permissions" ON public.role_permissions
FOR ALL USING (
    (SELECT (auth.jwt() ->> 'user_role')::text) = 'Admin'
);

-- Policies for 'staff_members' table
DROP POLICY IF EXISTS "Allow individual user to read their own data" ON public.staff_members;
CREATE POLICY "Allow individual user to read their own data" ON public.staff_members
FOR SELECT USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Allow admin users to access all staff data" ON public.staff_members;
CREATE POLICY "Allow admin users to access all staff data" ON public.staff_members
FOR ALL USING (
    (SELECT (auth.jwt() ->> 'user_role')::text) = 'Admin'
);

DROP POLICY IF EXISTS "Allow staff managers to view staff in their own branch" ON public.staff_members;
CREATE POLICY "Allow staff managers to view staff in their own branch" ON public.staff_members
FOR SELECT USING (
    (SELECT (auth.jwt() ->> 'user_role')::text) = 'Staff Management'
    AND
    branch = (SELECT branch FROM public.staff_members WHERE id = auth.uid()::text)
);


-- Function to seed roles
CREATE OR REPLACE FUNCTION seed_roles()
RETURNS void AS $$
BEGIN
    INSERT INTO public.roles (role_name, description) VALUES
    ('Admin', 'Has all permissions and can manage the entire system.'),
    ('Head Office Management', 'Can view all data across all branches but cannot edit.'),
    ('Staff Management', 'Can manage staff, customers, and meters within their assigned branch.'),
    ('Staff', 'Can perform data entry and view data for their assigned branch.')
    ON CONFLICT (role_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to seed permissions
CREATE OR REPLACE FUNCTION seed_permissions()
RETURNS void AS $$
DECLARE
    permissions_data text[] := ARRAY[
        -- Dashboard
        'dashboard_view_all,View aggregated data from all branches,Dashboard',
        'dashboard_view_branch,View data for the user''s assigned branch,Dashboard',
        -- Branches
        'branches_view,View branch information,Branch Management',
        'branches_create,Create new branches,Branch Management',
        'branches_update,Update branch information,Branch Management',
        'branches_delete,Delete branches,Branch Management',
        -- Staff
        'staff_view,View staff member information,Staff Management',
        'staff_create,Create new staff members,Staff Management',
        'staff_update,Update staff member information,Staff Management',
        'staff_delete,Delete staff members,Staff Management',
        -- Roles & Permissions
        'permissions_view,View roles and their assigned permissions,Permissions',
        'permissions_update,Update permissions for a role,Permissions',
        -- Customers
        'customers_view_all,View all individual customers across all branches,Customer Management',
        'customers_view_branch,View individual customers in the user''s branch,Customer Management',
        'customers_create,Create new individual customers,Customer Management',
        'customers_update,Update individual customer information,Customer Management',
        'customers_delete,Delete individual customers,Customer Management',
        -- Bulk Meters
        'bulk_meters_view_all,View all bulk meters across all branches,Bulk Meter Management',
        'bulk_meters_view_branch,View bulk meters in the user''s branch,Bulk Meter Management',
        'bulk_meters_create,Create new bulk meters,Bulk Meter Management',
        'bulk_meters_update,Update bulk meter information,Bulk Meter Management',
        'bulk_meters_delete,Delete bulk meters,Bulk Meter Management',
        -- Data Entry & Reports
        'data_entry_access,Access the manual and CSV data entry pages,Data & Reports',
        'meter_readings_view_all,View meter readings from all branches,Data & Reports',
        'meter_readings_view_branch,View meter readings for the user''s branch,Data & Reports',
        'meter_readings_create,Manually enter or upload meter readings,Data & Reports',
        'reports_generate_all,Generate and view reports with data from all branches,Data & Reports',
        'reports_generate_branch,Generate and view reports for the user''s branch,Data & Reports',
        -- Notifications
        'notifications_view,View system notifications,Notifications',
        'notifications_create,Send notifications to all staff or specific branches,Notifications',
        -- Tariffs
        'tariffs_view,View tariff and fee structures,Tariff Management',
        'tariffs_update,Update tariff rates and fees,Tariff Management',
        -- Settings
        'settings_view,View application settings,Settings',
        'settings_update,Update application settings,Settings'
    ];
    perm_info text;
    perm_name text;
    perm_desc text;
    perm_cat text;
BEGIN
    FOREACH perm_info IN ARRAY permissions_data
    LOOP
        perm_name := split_part(perm_info, ',', 1);
        perm_desc := split_part(perm_info, ',', 2);
        perm_cat := split_part(perm_info, ',', 3);

        INSERT INTO public.permissions (name, description, category)
        VALUES (perm_name, perm_desc, perm_cat)
        ON CONFLICT (name) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to assign permissions to roles
CREATE OR REPLACE FUNCTION assign_permissions_to_roles()
RETURNS void AS $$
DECLARE
    admin_role_id smallint;
    ho_mgmt_role_id smallint;
    staff_mgmt_role_id smallint;
    staff_role_id smallint;
BEGIN
    -- Get role IDs
    SELECT id INTO admin_role_id FROM public.roles WHERE role_name = 'Admin';
    SELECT id INTO ho_mgmt_role_id FROM public.roles WHERE role_name = 'Head Office Management';
    SELECT id INTO staff_mgmt_role_id FROM public.roles WHERE role_name = 'Staff Management';
    SELECT id INTO staff_role_id FROM public.roles WHERE role_name = 'Staff';

    -- Clear existing permissions to prevent duplicates
    TRUNCATE public.role_permissions;

    -- Assign all permissions to Admin
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT admin_role_id, p.id FROM public.permissions p
    ON CONFLICT DO NOTHING;

    -- Assign permissions for Head Office Management
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT ho_mgmt_role_id, p.id FROM public.permissions p
    WHERE p.name IN (
        'dashboard_view_all',
        'branches_view',
        'staff_view',
        'customers_view_all',
        'bulk_meters_view_all',
        'reports_generate_all',
        'notifications_view',
        'notifications_create' -- Added permission to send
    ) ON CONFLICT DO NOTHING;
    
    -- Assign permissions for Staff Management
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT staff_mgmt_role_id, p.id FROM public.permissions p
    WHERE p.name IN (
        'dashboard_view_branch',
        'staff_view', 'staff_create', 'staff_update', 'staff_delete',
        'customers_view_branch', 'customers_create', 'customers_update', 'customers_delete',
        'bulk_meters_view_branch', 'bulk_meters_create', 'bulk_meters_update', 'bulk_meters_delete',
        'data_entry_access', 'meter_readings_view_branch', 'meter_readings_create', 'reports_generate_branch',
        'notifications_view', 'notifications_create'
    ) ON CONFLICT DO NOTHING;

    -- Assign permissions for Staff
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT staff_role_id, p.id FROM public.permissions p
    WHERE p.name IN (
        'dashboard_view_branch',
        'customers_view_branch',
        'bulk_meters_view_branch',
        'data_entry_access',
        'meter_readings_view_branch', 'meter_readings_create',
        'reports_generate_branch',
        'notifications_view'
    ) ON CONFLICT DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- RPC to update role permissions
CREATE OR REPLACE FUNCTION public.update_role_permissions(
    p_role_id smallint,
    p_permission_ids int[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow Admins to execute this function fully
    IF (SELECT (auth.jwt() ->> 'user_role')::text) <> 'Admin' THEN
        RAISE EXCEPTION 'You do not have permission to modify roles.';
    END IF;

    -- Delete existing permissions for the role
    DELETE FROM public.role_permissions WHERE role_id = p_role_id;

    -- Insert new permissions
    IF array_length(p_permission_ids, 1) > 0 THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT p_role_id, permission_id
        FROM unnest(p_permission_ids) AS permission_id;
    END IF;
END;
$$;


-- Execute all seeding functions
SELECT seed_roles();
SELECT seed_permissions();
SELECT assign_permissions_to_roles();
