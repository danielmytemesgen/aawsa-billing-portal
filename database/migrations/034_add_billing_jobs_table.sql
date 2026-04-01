-- Migration 034: Create billing_jobs table (if not exists) and add missing columns
-- This safely creates the billing_jobs table and adds any missing columns
-- to handle environments where the table was created from an older schema.

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.billing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('bulk_meters', 'individual_customers')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    last_processed_id TEXT,
    month_year TEXT NOT NULL,
    carry_balance BOOLEAN NOT NULL DEFAULT false,
    period_start_date TEXT,
    period_end_date TEXT,
    due_date_offset_days INTEGER,
    branch_id UUID REFERENCES public.branches(id),
    worker_id TEXT,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Safely add missing columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'billing_jobs'
          AND column_name = 'worker_id'
    ) THEN
        ALTER TABLE public.billing_jobs ADD COLUMN worker_id TEXT;
        RAISE NOTICE 'Added worker_id column to billing_jobs';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'billing_jobs'
          AND column_name = 'error_log'
    ) THEN
        ALTER TABLE public.billing_jobs ADD COLUMN error_log TEXT;
        RAISE NOTICE 'Added error_log column to billing_jobs';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'billing_jobs'
          AND column_name = 'carry_balance'
    ) THEN
        ALTER TABLE public.billing_jobs ADD COLUMN carry_balance BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added carry_balance column to billing_jobs';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'billing_jobs'
          AND column_name = 'period_start_date'
    ) THEN
        ALTER TABLE public.billing_jobs ADD COLUMN period_start_date TEXT;
        ALTER TABLE public.billing_jobs ADD COLUMN period_end_date TEXT;
        ALTER TABLE public.billing_jobs ADD COLUMN due_date_offset_days INTEGER;
        RAISE NOTICE 'Added custom period columns to billing_jobs';
    END IF;
END;
$$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_billing_jobs_status ON public.billing_jobs (status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_billing_jobs_month ON public.billing_jobs (month_year);
CREATE INDEX IF NOT EXISTS idx_billing_jobs_type ON public.billing_jobs (type);

-- Ensure the updated_at trigger exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'update_billing_jobs_modtime'
          AND event_object_table = 'billing_jobs'
    ) THEN
        CREATE TRIGGER update_billing_jobs_modtime
            BEFORE UPDATE ON public.billing_jobs
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;
