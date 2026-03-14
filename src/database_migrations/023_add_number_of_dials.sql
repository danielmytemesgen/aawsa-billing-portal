-- Migration: 023_add_number_of_dials.sql
-- Description: Adds NUMBER_OF_DIALS column to individual_customers and bulk_meters tables.

-- Add column to individual_customers
ALTER TABLE public.individual_customers
ADD COLUMN IF NOT EXISTS "NUMBER_OF_DIALS" INTEGER;

-- Add column to bulk_meters
ALTER TABLE public.bulk_meters
ADD COLUMN IF NOT EXISTS "NUMBER_OF_DIALS" INTEGER;
