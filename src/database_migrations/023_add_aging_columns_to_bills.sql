-- Add aging columns to the bills table
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS "debit_30" NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS "debit_30_60" NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS "debit_60" NUMERIC(12,2);
