-- Migration: Create customer_sessions table
CREATE TABLE IF NOT EXISTS public.customer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_key_number TEXT NOT NULL,
    customer_type TEXT NOT NULL, -- 'individual' or 'bulk'
    ip_address TEXT,
    device_name TEXT,
    location TEXT,
    is_revoked BOOLEAN DEFAULT false,
    last_active_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Add customer_key_number to security_logs for better tracking if not already present
-- The existing table has: id, created_at, event, branch_name, staff_email, ip_address
-- We'll use the 'details' JSON field to store customer_key_number for now to avoid breaking existing queries,
-- but adding a column would be cleaner. Let's add a column.

ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS customer_key_number TEXT;
