-- Add the new columns to the tariffs table if they don't already exist.
-- This approach is safer than dropping and recreating the columns.

DO $$
BEGIN
    -- Add vat_rate column if it does not exist
    IF NOT EXISTS (
        SELECT FROM pg_attribute
        WHERE  attrelid = 'public.tariffs'::regclass
        AND    attname = 'vat_rate'
        AND    NOT attisdropped
    ) THEN
        ALTER TABLE public.tariffs ADD COLUMN vat_rate numeric(5, 2) NOT NULL DEFAULT 0.15;
        RAISE NOTICE 'Column vat_rate added to public.tariffs';
    ELSE
        RAISE NOTICE 'Column vat_rate already exists in public.tariffs';
    END IF;

    -- Add domestic_vat_threshold_m3 column if it does not exist
    IF NOT EXISTS (
        SELECT FROM pg_attribute
        WHERE  attrelid = 'public.tariffs'::regclass
        AND    attname = 'domestic_vat_threshold_m3'
        AND    NOT attisdropped
    ) THEN
        ALTER TABLE public.tariffs ADD COLUMN domestic_vat_threshold_m3 numeric(10, 2) NOT NULL DEFAULT 15.00;
        RAISE NOTICE 'Column domestic_vat_threshold_m3 added to public.tariffs';
    ELSE
        RAISE NOTICE 'Column domestic_vat_threshold_m3 already exists in public.tariffs';
    END IF;
END;
$$;

-- Update existing tariff records to set a default value for the new columns
-- This is important to ensure that old records are also correctly handled.
-- We set defaults here just in case the ALTER TABLE command did not apply them
-- to existing rows (behavior can vary across PostgreSQL versions).

UPDATE public.tariffs
SET 
    vat_rate = COALESCE(vat_rate, 0.15),
    domestic_vat_threshold_m3 = COALESCE(domestic_vat_threshold_m3, 15.00)
WHERE 
    vat_rate IS NULL OR domestic_vat_threshold_m3 IS NULL;

-- Add comments to the new columns for clarity
COMMENT ON COLUMN public.tariffs.vat_rate IS 'The Value Added Tax rate to be applied (e.g., 0.15 for 15%).';
COMMENT ON COLUMN public.tariffs.domestic_vat_threshold_m3 IS 'The consumption threshold in cubic meters (m³) above which VAT is applied for Domestic customers.';
