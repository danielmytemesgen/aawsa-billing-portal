-- Migration: PDF Generation Jobs for long-term scalability
-- Supports Phase 7 (Batch PDF Generation)

CREATE TABLE IF NOT EXISTS public.pdf_generation_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id TEXT,
    month_year TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_bills INTEGER DEFAULT 0,
    generated_bills INTEGER DEFAULT 0,
    file_paths TEXT[], -- Array of paths to merged PDF files
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    error_message TEXT,
    unique_key TEXT UNIQUE -- e.g. "branch_id_month_year" to avoid duplicate jobs
);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status ON public.pdf_generation_jobs (status);
