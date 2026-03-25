-- Migration: Add aging columns to bills table for scalable reporting
-- Supports Phase 4 scalability (avoiding in-memory aging calculation)

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS debit_30 NUMERIC DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS debit_30_60 NUMERIC DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS debit_60 NUMERIC DEFAULT 0;

-- Index for even faster reporting
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON public.bills (payment_status) WHERE payment_status = 'Unpaid';
