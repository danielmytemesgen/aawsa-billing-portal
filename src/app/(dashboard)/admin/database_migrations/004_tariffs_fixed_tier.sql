-- Migration: Add fixed_tier_index to tariffs table
-- This allows configuring which tier is used for rental customer types (0-based index)
-- Default behavior (NULL) = use tier index 3 (4th tier) for backward compatibility

ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS fixed_tier_index integer DEFAULT NULL;

COMMENT ON COLUMN public.tariffs.fixed_tier_index IS 
  'Which water tier to use as fixed rate for rental types (0-based). NULL defaults to index 3 (4th tier).';
