-- Migration: Add billing_jobs table for asynchronous batch processing
-- Supports Phase 2 scalability (700,000+ bills)

CREATE TABLE IF NOT EXISTS public.billing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('bulk_meters', 'individual_customers')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    last_processed_id TEXT,
    month_year TEXT NOT NULL,
    carry_balance BOOLEAN NOT NULL DEFAULT false,
    branch_id UUID REFERENCES public.branches(id),
    worker_id TEXT,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index for finding active jobs quickly
CREATE INDEX IF NOT EXISTS idx_billing_jobs_status ON public.billing_jobs (status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_billing_jobs_month ON public.billing_jobs (month_year);

-- Trigger to update updated_at
CREATE TRIGGER update_billing_jobs_modtime 
    BEFORE UPDATE ON public.billing_jobs 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
