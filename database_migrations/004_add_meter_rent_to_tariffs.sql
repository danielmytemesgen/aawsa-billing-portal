-- Add the new column for meter rent prices to the tariffs table.
-- It's a JSONB column to store a map of meter sizes to prices.
ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS meter_rent_prices JSONB;

-- Update existing tariff rows to include a default set of meter rent prices.
-- This ensures that all existing tariffs have a value for the new column.
-- It's safe to run this multiple times; it will only update rows where the column is currently NULL.
UPDATE public.tariffs
SET meter_rent_prices = '{
  "0.5": 15, "0.75": 20, "1": 33, "1.25": 36, "1.5": 57, "2": 98,
  "2.5": 112, "3": 148, "4": 177, "5": 228, "6": 259
}'::jsonb
WHERE meter_rent_prices IS NULL;
