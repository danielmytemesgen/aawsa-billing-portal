-- Migration: Add use_rule_of_three to tariffs table
-- This toggle controls whether consumption < 3 m3 is automatically treated as 3 m3.

ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS use_rule_of_three boolean DEFAULT true;

-- Update existing records to default to true (backward compatible with existing "hardcoded" behavior)
UPDATE public.tariffs SET use_rule_of_three = true WHERE use_rule_of_three IS NULL;
