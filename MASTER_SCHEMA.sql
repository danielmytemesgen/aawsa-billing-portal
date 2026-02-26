-- =================================================================
-- AAWSA BILLING PORTAL: CONSOLIDATED POSTGRESQL SCHEMA
-- =================================================================
-- This file contains the complete database structure, including
-- RBAC, customers, meters, billing, and system configurations.
-- =================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- -----------------------------------------------------------------
-- 1. BASE TABLES & RBAC
-- -----------------------------------------------------------------

-- Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Role-Permissions Join Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id smallint NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id smallint NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- Staff Members
CREATE TABLE IF NOT EXISTS public.staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password text,
    phone text,
    branch text,
    role text NOT NULL,
    role_id smallint REFERENCES public.roles(id) ON DELETE SET NULL,
    status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
    hire_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------
-- 2. BRANCHES & CUSTOMERS
-- -----------------------------------------------------------------

-- Branches
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    location text NOT NULL,
    "contactPerson" text,
    "contactPhone" text,
    status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Routes Table
CREATE TABLE IF NOT EXISTS public.routes (
    route_key TEXT PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    reader_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bulk Meters
CREATE TABLE IF NOT EXISTS public.bulk_meters (
    "customerKeyNumber" TEXT PRIMARY KEY,
    "INST_KEY" TEXT,
    name TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL UNIQUE,
    "meterSize" NUMERIC NOT NULL,
    "METER_KEY" TEXT NOT NULL UNIQUE,
    "previousReading" NUMERIC NOT NULL,
    "currentReading" NUMERIC NOT NULL,
    month TEXT NOT NULL,
    "specificArea" TEXT,
    "subCity" TEXT,
    woreda TEXT,

    branch_id UUID REFERENCES public.branches(id),
    "NUMBER_OF_DIALS" INTEGER,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Pending Approval', 'Rejected')),
    "paymentStatus" TEXT DEFAULT 'Unpaid' CHECK ("paymentStatus" IN ('Paid', 'Unpaid')),
    charge_group TEXT CHECK (charge_group IN ('Domestic', 'Non-domestic')),
    "ROUTE_KEY" TEXT REFERENCES public.routes(route_key) ON DELETE SET NULL,
    sewerage_connection TEXT CHECK (sewerage_connection IN ('Yes', 'No')),
    "approved_by" UUID REFERENCES public.staff_members(id),
    "approved_at" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- Individual Customers
CREATE TABLE IF NOT EXISTS public.individual_customers (
    "customerKeyNumber" TEXT PRIMARY KEY,
    "INST_KEY" TEXT,
    name TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL UNIQUE,
    "customerType" TEXT CHECK ("customerType" IN ('Domestic', 'Non-domestic')),
    "bookNumber" TEXT,
    ordinal INTEGER,
    "meterSize" NUMERIC,
    "METER_KEY" TEXT NOT NULL UNIQUE,
    "previousReading" NUMERIC,
    "currentReading" NUMERIC,
    month TEXT,
    "assignedBulkMeterId" TEXT REFERENCES public.bulk_meters("customerKeyNumber"),

    branch_id UUID REFERENCES public.branches(id),
    "NUMBER_OF_DIALS" INTEGER,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Pending Approval', 'Rejected')),
    "paymentStatus" TEXT DEFAULT 'Unpaid' CHECK ("paymentStatus" IN ('Paid', 'Unpaid', 'Pending')),
    "approved_by" UUID REFERENCES public.staff_members(id),
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------
-- 3. READINGS & BILLING
-- -----------------------------------------------------------------

-- Individual Meter Readings
CREATE TABLE IF NOT EXISTS public.individual_customer_readings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "READ_PROC_ID" TEXT GENERATED ALWAYS AS ('BK' || id::text) STORED,
    
    "ROUND_KEY" TEXT,
    "WALK_ORDER" INTEGER,
    "INST_KEY" TEXT,
    "INST_TYPE_CODE" TEXT,
    "CUST_KEY" TEXT,
    "CUST_NAME" TEXT,
    "DISPLAY_ADDRESS" TEXT,
    "BRANCH_NAME" TEXT,
    "METER_KEY" TEXT,
    "PREVIOUS_READING" NUMERIC(12,3),
    "LAST_READING_DATE" TIMESTAMP WITH TIME ZONE,
    "NUMBER_OF_DIALS" INTEGER,
    "METER_DIAMETER" NUMERIC,
    "SHADOW_PCNT" NUMERIC,
    "MIN_USAGE_QTY" NUMERIC,
    "MIN_USAGE_AMOUNT" NUMERIC,
    "CHARGE_GROUP" TEXT,
    "USAGE_CODE" TEXT,
    "SELL_CODE" TEXT,
    "FREQUENCY" TEXT,
    "SERVICE_CODE" TEXT,
    "SHADOW_USAGE" NUMERIC,
    "ESTIMATED_READING" NUMERIC,
    "ESTIMATED_READING_LOW" NUMERIC,
    "ESTIMATED_READING_HIGH" NUMERIC,
    "ESTIMATED_READING_IND" TEXT,
    "METER_READING" NUMERIC(12,3) NOT NULL,
    "READING_DATE" TIMESTAMP WITH TIME ZONE DEFAULT now(),
    "METER_READER_CODE" TEXT,
    "FAULT_CODE" TEXT,
    "SERVICE_BILLED_UP_TO_DATE" DATE,
    "METER_MULTIPLY_FACTOR" NUMERIC,
    "LATITUDE" NUMERIC,
    "LONGITUDE" NUMERIC,
    "ALTITUDE" NUMERIC,
    "PHONE_NUMBER" TEXT,
    "isSuccess" BOOLEAN,
    "error" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_readings_cust_key ON public.individual_customer_readings("CUST_KEY");
CREATE INDEX IF NOT EXISTS idx_readings_meter_key ON public.individual_customer_readings("METER_KEY");
CREATE INDEX IF NOT EXISTS idx_readings_date ON public.individual_customer_readings("READING_DATE");

-- Bulk Meter Readings
CREATE TABLE IF NOT EXISTS public.bulk_meter_readings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "READ_PROC_ID" TEXT GENERATED ALWAYS AS ('BM' || id::text) STORED,
    "ROUND_KEY" TEXT,
    "WALK_ORDER" INTEGER,
    "INST_KEY" TEXT,
    "INST_TYPE_CODE" TEXT,
    "CUST_KEY" TEXT,
    "CUST_NAME" TEXT,
    "DISPLAY_ADDRESS" TEXT,
    "BRANCH_NAME" TEXT,
    "METER_KEY" TEXT,
    "PREVIOUS_READING" NUMERIC(12,3),
    "LAST_READING_DATE" TIMESTAMP WITH TIME ZONE,
    "NUMBER_OF_DIALS" INTEGER,
    "METER_DIAMETER" NUMERIC,
    "SHADOW_PCNT" NUMERIC,
    "MIN_USAGE_QTY" NUMERIC,
    "MIN_USAGE_AMOUNT" NUMERIC,
    "CHARGE_GROUP" TEXT,
    "USAGE_CODE" TEXT,
    "SELL_CODE" TEXT,
    "FREQUENCY" TEXT,
    "SERVICE_CODE" TEXT,
    "SHADOW_USAGE" NUMERIC,
    "ESTIMATED_READING" NUMERIC,
    "ESTIMATED_READING_LOW" NUMERIC,
    "ESTIMATED_READING_HIGH" NUMERIC,
    "ESTIMATED_READING_IND" TEXT,
    "METER_READING" NUMERIC(12,3) NOT NULL,
    "READING_DATE" TIMESTAMP WITH TIME ZONE DEFAULT now(),
    "METER_READER_CODE" TEXT,
    "FAULT_CODE" TEXT,
    "SERVICE_BILLED_UP_TO_DATE" DATE,
    "METER_MULTIPLY_FACTOR" NUMERIC,
    "LATITUDE" NUMERIC,
    "LONGITUDE" NUMERIC,
    "ALTITUDE" NUMERIC,
    "PHONE_NUMBER" TEXT,
    "isSuccess" BOOLEAN,
    "error" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_bulk_readings_cust_key ON public.bulk_meter_readings("CUST_KEY");
CREATE INDEX IF NOT EXISTS idx_bulk_readings_meter_key ON public.bulk_meter_readings("METER_KEY");
CREATE INDEX IF NOT EXISTS idx_bulk_readings_date ON public.bulk_meter_readings("READING_DATE");

-- Bills
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "BILLKEY" TEXT,
    "CUSTOMERKEY" TEXT,
    "CUSTOMERNAME" TEXT,
    "CUSTOMERTIN" TEXT,
    "CUSTOMERBRANCH" TEXT,
    "REASON" TEXT,
    "CURRREAD" NUMERIC NOT NULL DEFAULT 0.000,
    "PREVREAD" NUMERIC NOT NULL DEFAULT 0.000,
    "CONS" NUMERIC DEFAULT 0.000,
    "TOTALBILLAMOUNT" NUMERIC NOT NULL DEFAULT 0.00,
    "THISMONTHBILLAMT" NUMERIC,
    "OUTSTANDINGAMT" NUMERIC DEFAULT 0.00,
    "PENALTYAMT" NUMERIC,
    "DRACCTNO" TEXT,
    "CRACCTNO" TEXT,
    
    individual_customer_id TEXT REFERENCES public.individual_customers("customerKeyNumber"),
    bill_period_start_date DATE NOT NULL,
    bill_period_end_date DATE NOT NULL,
    month_year TEXT NOT NULL,
    difference_usage NUMERIC DEFAULT 0.000,
    base_water_charge NUMERIC NOT NULL DEFAULT 0.00,
    sewerage_charge NUMERIC DEFAULT 0.00,
    maintenance_fee NUMERIC DEFAULT 0.00,
    sanitation_fee NUMERIC DEFAULT 0.00,
    meter_rent NUMERIC DEFAULT 0.00,
    balance_carried_forward NUMERIC DEFAULT 0.00,
    amount_paid NUMERIC DEFAULT 0.00,
    due_date DATE NOT NULL,
    payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid')),
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Rework', 'Posted')),
    bill_number TEXT,
    notes TEXT,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_date timestamp with time zone,
    approved_by TEXT,
    vat_amount NUMERIC DEFAULT 0,
    additional_fees_charge NUMERIC DEFAULT 0,
    additional_fees_breakdown JSONB,

    CONSTRAINT chk_bills_customer_or_bulk CHECK ((((individual_customer_id IS NOT NULL) AND ("CUSTOMERKEY" IS NULL)) OR ((individual_customer_id IS NULL) AND ("CUSTOMERKEY" IS NOT NULL))))
);

CREATE INDEX IF NOT EXISTS idx_bills_individual ON public.bills (individual_customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_bulk ON public.bills ("CUSTOMERKEY");
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills (due_date);
CREATE INDEX IF NOT EXISTS idx_bills_billkey ON public.bills ("BILLKEY");

-- Bill Workflow Logs
CREATE TABLE IF NOT EXISTS public.bill_workflow_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.staff_members(id),
    reason TEXT,
    created_at timestamp with time zone DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID REFERENCES public.bills(id),
    individual_customer_id TEXT REFERENCES public.individual_customers("customerKeyNumber"),
    amount_paid NUMERIC(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Online Payment', 'Other')),
    transaction_reference TEXT,
    processed_by_staff_id UUID REFERENCES public.staff_members(id),
    payment_date timestamp with time zone DEFAULT now(),
    notes TEXT
);

-- -----------------------------------------------------------------
-- 4. SYSTEM TABLES
-- -----------------------------------------------------------------

-- Tariffs
CREATE TABLE IF NOT EXISTS public.tariffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_type TEXT NOT NULL,
    year INTEGER NOT NULL,
    tiers JSONB NOT NULL,
    maintenance_percentage NUMERIC DEFAULT 0.01,
    sanitation_percentage NUMERIC,
    sewerage_rate_per_m3 NUMERIC,
    vat_rate NUMERIC DEFAULT 0.15,
    UNIQUE(customer_type, year)
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    category text,
    keywords text[],
    pdf_url text,
    created_at timestamp with time zone DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    sender_name text NOT NULL,
    target_branch_id UUID REFERENCES public.branches(id),

    created_at timestamp with time zone DEFAULT now()
);

-- Fault Codes
CREATE TABLE IF NOT EXISTS public.fault_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------
-- 5. FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------

-- Identity/RBAC Helper to update role permissions
CREATE OR REPLACE FUNCTION public.update_role_permissions(
    p_role_id smallint,
    p_permission_ids int[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.role_permissions WHERE role_id = p_role_id;
    IF array_length(p_permission_ids, 1) > 0 THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT p_role_id, permission_id
        FROM unnest(p_permission_ids) AS perm_id;
    END IF;
END;
$$;

-- Trigger to auto-update 'updatedAt' columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_staff_members_modtime BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bulk_meters_modtime BEFORE UPDATE ON public.bulk_meters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_individual_customers_modtime BEFORE UPDATE ON public.individual_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bills_modtime BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for fault_codes
CREATE TRIGGER update_fault_codes_modtime
    BEFORE UPDATE ON public.fault_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =================================================================
-- END OF SCHEMA
-- =================================================================
