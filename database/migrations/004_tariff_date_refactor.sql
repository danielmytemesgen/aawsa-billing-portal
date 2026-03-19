-- Migration script to refactor tariffs table from year-based to date-based.

-- 1. Create a temporary column for effective_date
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS effective_date DATE;

-- 2. Populate effective_date from year (assuming Jan 1st of that year)
UPDATE public.tariffs SET effective_date = TO_DATE(year || '-01-01', 'YYYY-MM-DD') WHERE effective_date IS NULL;

-- 3. Make effective_date NOT NULL
ALTER TABLE public.tariffs ALTER COLUMN effective_date SET NOT NULL;

-- 4. Drop the old unique constraint and the year column
ALTER TABLE public.tariffs DROP CONSTRAINT IF EXISTS tariffs_customer_type_year_key;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS year;

-- 5. Add the new unique constraint
ALTER TABLE public.tariffs ADD CONSTRAINT tariffs_customer_type_effective_date_key UNIQUE (customer_type, effective_date);

-- 6. Add API Keys table for integration
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT FALSE
);
