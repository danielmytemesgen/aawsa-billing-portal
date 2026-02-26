-- =====================================================
-- Add Missing Bill Breakdown Columns
-- =====================================================
-- This migration adds columns to the bills table to store
-- the full breakdown of charges, ensuring they can be 
-- displayed correctly in the customer portal.

DO $$
BEGIN
    -- Add vat_amount column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'vat_amount'
    ) THEN
        ALTER TABLE public.bills ADD COLUMN vat_amount NUMERIC(12,2) DEFAULT 0;
    END IF;

    -- Add additional_fees_charge column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'additional_fees_charge'
    ) THEN
        ALTER TABLE public.bills ADD COLUMN additional_fees_charge NUMERIC(12,2) DEFAULT 0;
    END IF;

    -- Add additional_fees_breakdown column (for historical detail)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'additional_fees_breakdown'
    ) THEN
        ALTER TABLE public.bills ADD COLUMN additional_fees_breakdown JSONB;
    END IF;
END;
$$;
