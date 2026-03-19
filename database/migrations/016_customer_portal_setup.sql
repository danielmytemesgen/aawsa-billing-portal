-- =====================================================
-- Customer Portal Setup Migration
-- =====================================================
-- This migration adds support for customer portal access
-- Customers can log in using their Customer Key Number and password
-- to view their billing history and account information
-- =====================================================

-- Step 1: Add Customer role
INSERT INTO public.roles (role_name, description) VALUES
('Customer', 'External customer with access to view their own billing history and account information')
ON CONFLICT (role_name) DO NOTHING;

-- Step 2: Add customer portal permissions
INSERT INTO public.permissions (name, description, category) VALUES
('customer_portal:view_own_bills', 'View own billing history and current bills', 'Customer Portal'),
('customer_portal:view_own_account', 'View own account details and meter information', 'Customer Portal'),
('customer_portal:update_own_password', 'Change own portal password', 'Customer Portal')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Assign permissions to Customer role
DO $$
DECLARE
    customer_role_id smallint;
BEGIN
    SELECT id INTO customer_role_id FROM public.roles WHERE role_name = 'Customer';
    
    IF customer_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT customer_role_id, p.id FROM public.permissions p
        WHERE p.name IN (
            'customer_portal:view_own_bills',
            'customer_portal:view_own_account',
            'customer_portal:update_own_password'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

-- Step 4: Add authentication fields to individual_customers table
DO $$
BEGIN
    -- Add password_hash column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'individual_customers' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.individual_customers
        ADD COLUMN password_hash TEXT;
    END IF;

    -- Add email column (optional, for future notifications)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'individual_customers' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.individual_customers
        ADD COLUMN email TEXT;
    END IF;

    -- Add phone_number column (optional, for future SMS/OTP)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'individual_customers' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.individual_customers
        ADD COLUMN phone_number TEXT;
    END IF;

    -- Add last_login_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'individual_customers' AND column_name = 'last_login_at'
    ) THEN
        ALTER TABLE public.individual_customers
        ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add is_portal_enabled column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'individual_customers' AND column_name = 'is_portal_enabled'
    ) THEN
        ALTER TABLE public.individual_customers
        ADD COLUMN is_portal_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END;
$$;

-- Step 5: Create RLS policies for customer portal access
-- Policy: Customers can view their own record
DROP POLICY IF EXISTS "Customers can view own record" ON public.individual_customers;
CREATE POLICY "Customers can view own record" ON public.individual_customers
FOR SELECT
USING (
    customerKeyNumber = current_setting('app.current_customer_key', true)
);

-- Policy: Customers can update their own password
DROP POLICY IF EXISTS "Customers can update own password" ON public.individual_customers;
CREATE POLICY "Customers can update own password" ON public.individual_customers
FOR UPDATE
USING (
    customerKeyNumber = current_setting('app.current_customer_key', true)
)
WITH CHECK (
    customerKeyNumber = current_setting('app.current_customer_key', true)
);

-- Step 6: Create RLS policies for bills table (customers can view their own bills)
-- First, ensure bills table has RLS enabled
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own bills
DROP POLICY IF EXISTS "Customers can view own bills" ON public.bills;
CREATE POLICY "Customers can view own bills" ON public.bills
FOR SELECT
USING (
    individual_customer_id = current_setting('app.current_customer_key', true)
);

-- Step 7: Create helper function to authenticate customers
CREATE OR REPLACE FUNCTION public.authenticate_customer(
    p_customer_key_number TEXT,
    p_password TEXT
)
RETURNS TABLE (
    customer_key_number TEXT,
    name TEXT,
    email TEXT,
    phone_number TEXT,
    is_portal_enabled BOOLEAN,
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_password_hash TEXT;
    v_is_enabled BOOLEAN;
    v_customer_name TEXT;
    v_customer_email TEXT;
    v_customer_phone TEXT;
BEGIN
    -- Get customer details
    SELECT 
        password_hash, 
        is_portal_enabled,
        individual_customers.name,
        individual_customers.email,
        individual_customers.phone_number
    INTO 
        v_password_hash, 
        v_is_enabled,
        v_customer_name,
        v_customer_email,
        v_customer_phone
    FROM public.individual_customers
    WHERE customerKeyNumber = p_customer_key_number;

    -- Check if customer exists
    IF v_password_hash IS NULL THEN
        RETURN QUERY SELECT 
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, FALSE, FALSE, 
            'Customer not found or portal access not set up'::TEXT;
        RETURN;
    END IF;

    -- Check if portal is enabled
    IF NOT v_is_enabled THEN
        RETURN QUERY SELECT 
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, FALSE, FALSE, 
            'Portal access is not enabled for this account'::TEXT;
        RETURN;
    END IF;

    -- Verify password (using crypt for bcrypt hashing)
    IF v_password_hash = crypt(p_password, v_password_hash) THEN
        -- Update last login time
        UPDATE public.individual_customers
        SET last_login_at = NOW()
        WHERE customerKeyNumber = p_customer_key_number;

        -- Return success
        RETURN QUERY SELECT 
            p_customer_key_number, 
            v_customer_name, 
            v_customer_email, 
            v_customer_phone,
            v_is_enabled, 
            TRUE, 
            'Authentication successful'::TEXT;
    ELSE
        -- Return failure
        RETURN QUERY SELECT 
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, FALSE, FALSE, 
            'Invalid password'::TEXT;
    END IF;
END;
$$;

-- Step 8: Create helper function to set customer password
CREATE OR REPLACE FUNCTION public.set_customer_password(
    p_customer_key_number TEXT,
    p_new_password TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update password hash using bcrypt
    UPDATE public.individual_customers
    SET 
        password_hash = crypt(p_new_password, gen_salt('bf')),
        is_portal_enabled = TRUE
    WHERE customerKeyNumber = p_customer_key_number;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Password set successfully and portal access enabled'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'Customer not found'::TEXT;
    END IF;
END;
$$;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN public.individual_customers.password_hash IS 'Bcrypt hashed password for customer portal login';
COMMENT ON COLUMN public.individual_customers.email IS 'Customer email address for notifications (optional)';
COMMENT ON COLUMN public.individual_customers.phone_number IS 'Customer phone number for SMS/OTP (optional)';
COMMENT ON COLUMN public.individual_customers.last_login_at IS 'Timestamp of last successful portal login';
COMMENT ON COLUMN public.individual_customers.is_portal_enabled IS 'Whether customer portal access is enabled for this account';

COMMENT ON FUNCTION public.authenticate_customer IS 'Authenticates a customer using their customer key number and password';
COMMENT ON FUNCTION public.set_customer_password IS 'Sets or updates a customer password and enables portal access';

-- Step 10: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.authenticate_customer TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_password TO authenticated;
