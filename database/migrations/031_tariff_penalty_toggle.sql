-- ==============================================================================
-- Migration 031: Add Master Penalty Toggle to Tariffs
-- ==============================================================================
-- Allows toggling late payment penalty calculation ON or OFF globally per tariff.
-- When penalty_enabled = true (default), standard AAWSA tiered penalty calculation runs.
-- When penalty_enabled = false, penalty is strictly 0.00 ETB on all generated bills.
-- ==============================================================================

BEGIN;

-- 1. Add penalty_enabled column to tariffs table
ALTER TABLE tariffs 
ADD COLUMN IF NOT EXISTS penalty_enabled BOOLEAN DEFAULT true;

-- 2. Backfill existing tariffs to have penalty_enabled = true
UPDATE tariffs 
SET penalty_enabled = true 
WHERE penalty_enabled IS NULL;

COMMIT;
