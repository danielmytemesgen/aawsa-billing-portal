-- Migration to add tiered sewerage fees and remove the old column.

-- 1. Add the new 'sewerage_tiers' column to the tariffs table if it doesn't exist.
-- This column will store the array of tiers as JSONB.
ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS sewerage_tiers JSONB;

-- 2. Populate 'sewerage_tiers' for "Domestic" customers.
-- This creates a default two-tier structure using the existing 'sewerage_rate_per_m3' value.
UPDATE public.tariffs
SET 
  sewerage_tiers = jsonb_build_array(
    jsonb_build_object('rate', sewerage_rate_per_m3, 'limit', 5),
    jsonb_build_object('rate', sewerage_rate_per_m3, 'limit', 'Infinity')
  )
WHERE 
  customer_type = 'Domestic' 
  AND (sewerage_tiers IS NULL OR sewerage_tiers::text = 'null' OR sewerage_tiers::text = '[]');

-- 3. Populate 'sewerage_tiers' for "Non-domestic" customers.
-- This creates a single-tier structure that applies to all consumption levels.
UPDATE public.tariffs
SET
  sewerage_tiers = jsonb_build_array(
    jsonb_build_object('rate', sewerage_rate_per_m3, 'limit', 'Infinity')
  )
WHERE
  customer_type = 'Non-domestic'
  AND (sewerage_tiers IS NULL OR sewerage_tiers::text = 'null' OR sewerage_tiers::text = '[]');


-- 4. Drop the old 'sewerage_rate_per_m3' column as it's now redundant.
-- All sewerage rate logic will now use the 'sewerage_tiers' column.
ALTER TABLE public.tariffs
DROP COLUMN IF EXISTS sewerage_rate_per_m3;
