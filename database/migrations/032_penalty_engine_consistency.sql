-- Migration 032: Penalty Engine Consistency
-- ============================================================
-- 1. Adds a DB-level trigger that prevents any bill from being
--    inserted or updated with a non-zero PENALTYAMT when the
--    penalty engine is globally OFF (latest tariff has
--    penalty_enabled = false).
--
-- 2. Adds a performance index on tariffs.effective_date so the
--    trigger lookup (and all ORDER BY effective_date queries)
--    hit an index instead of doing a full table scan.
--
-- Run this migration once per environment.
-- ============================================================

-- Index to speed up ORDER BY effective_date DESC (used by the trigger,
-- penalty guard queries, and tariff lookups).
CREATE INDEX IF NOT EXISTS idx_tariffs_effective_date
    ON tariffs (effective_date DESC);

-- Trigger function
-- Checks the most recent tariff penalty_enabled flag before
-- allowing any INSERT or UPDATE that sets PENALTYAMT != 0.
-- The check is skipped if no tariff rows exist yet (safe default).
CREATE OR REPLACE FUNCTION enforce_penalty_engine_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    engine_on BOOLEAN := true;
BEGIN
    -- Fetch the penalty_enabled flag from the latest tariff.
    -- COALESCE to true so a missing/null value keeps the engine ON.
    SELECT COALESCE(penalty_enabled, true)
    INTO   engine_on
    FROM   tariffs
    ORDER  BY effective_date DESC
    LIMIT  1;

    -- If engine is OFF and the bill is trying to carry a non-zero penalty,
    -- raise an explicit error so the application can surface it.
    IF engine_on = false AND COALESCE(NEW."PENALTYAMT"::numeric, 0) <> 0 THEN
        RAISE EXCEPTION
            'Penalty engine is OFF: PENALTYAMT must be 0.00, got %. Turn the penalty engine ON in Tariff Settings before applying penalties.',
            NEW."PENALTYAMT";
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger
-- Fires AFTER INSERT or UPDATE OF "PENALTYAMT" on bills.
-- Compatible with both partitioned and non-partitioned tables.
-- Any RAISE EXCEPTION immediately aborts and rolls back the operation.
DROP TRIGGER IF EXISTS trg_penalty_engine_guard ON bills;
CREATE TRIGGER trg_penalty_engine_guard
    AFTER INSERT OR UPDATE OF "PENALTYAMT"
    ON bills
    FOR EACH ROW
    EXECUTE FUNCTION enforce_penalty_engine_guard();
