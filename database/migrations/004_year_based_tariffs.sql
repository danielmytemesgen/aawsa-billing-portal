-- This script adds a 'year' column to the tariffs table, creating a composite primary key
-- on (customer_type, year) to allow for different tariff rates each year.
-- It also back-populates existing data to the year 2024.

-- Step 1: Add the 'year' column with a default value for existing rows.
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2024;

-- Step 2: Remove the default value constraint now that old rows are populated.
ALTER TABLE public.tariffs ALTER COLUMN year DROP DEFAULT;

-- Step 3: Drop the old primary key if it exists.
-- We use DO-$$ block to handle cases where the constraint might not exist.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tariffs_pkey' AND conrelid = 'public.tariffs'::regclass
    ) THEN
        ALTER TABLE public.tariffs DROP CONSTRAINT tariffs_pkey;
    END IF;
END
$$;

-- Step 4: Create the new composite primary key.
-- This ensures that each combination of customer_type and year is unique.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tariffs_pkey' AND conrelid = 'public.tariffs'::regclass
    ) THEN
        ALTER TABLE public.tariffs ADD PRIMARY KEY (customer_type, year);
    END IF;
END
$$;

-- Inform the user that the migration is complete.
SELECT 'Migration to year-based tariffs complete. The primary key is now (customer_type, year).';
