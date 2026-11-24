-- ============================================================
-- Migration: 022b_audit_logs_fix.sql
-- 
-- The audit_logs table already existed on the production DB
-- with a different/older schema. This migration safely adds
-- ALL required columns using DO $$ blocks so it is idempotent
-- (safe to run multiple times — skips columns that exist).
--
-- Run this INSTEAD OF 022_audit_logs.sql if you see:
--   NOTICE: relation "audit_logs" already exists, skipping
--   ERROR:  column "actor_id" does not exist
-- ============================================================

-- ─── Step 1: Inspect what the current table looks like ───────────────────────
DO $$
DECLARE
  col_list TEXT;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO col_list
    FROM information_schema.columns
   WHERE table_name = 'audit_logs';
  RAISE NOTICE '🔍 Current audit_logs columns: %', COALESCE(col_list, '(none found)');
END $$;

-- ─── Step 2: Add missing columns safely ──────────────────────────────────────

DO $$
BEGIN
  -- actor_id (UUID FK to staff_members)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_id UUID REFERENCES staff_members(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added column: actor_id';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): actor_id';
  END IF;

  -- actor_email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'actor_email'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_email TEXT;
    RAISE NOTICE '✅ Added column: actor_email';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): actor_email';
  END IF;

  -- actor_branch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'actor_branch'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_branch TEXT;
    RAISE NOTICE '✅ Added column: actor_branch';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): actor_branch';
  END IF;

  -- action
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'action'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN action TEXT NOT NULL DEFAULT 'UNKNOWN';
    RAISE NOTICE '✅ Added column: action';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): action';
  END IF;

  -- entity_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'unknown';
    RAISE NOTICE '✅ Added column: entity_type';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): entity_type';
  END IF;

  -- entity_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN entity_id TEXT;
    RAISE NOTICE '✅ Added column: entity_id';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): entity_id';
  END IF;

  -- old_value (JSONB snapshot before change)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'old_value'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN old_value JSONB;
    RAISE NOTICE '✅ Added column: old_value';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): old_value';
  END IF;

  -- new_value (JSONB snapshot after change)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'new_value'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN new_value JSONB;
    RAISE NOTICE '✅ Added column: new_value';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): new_value';
  END IF;

  -- ip_address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;
    RAISE NOTICE '✅ Added column: ip_address';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): ip_address';
  END IF;

  -- metadata (JSONB extra context)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN metadata JSONB;
    RAISE NOTICE '✅ Added column: metadata';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): metadata';
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'audit_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE '✅ Added column: created_at';
  ELSE
    RAISE NOTICE '⏭  Skipped (exists): created_at';
  END IF;

END $$;

-- ─── Step 3: Add indexes (safe — all use IF NOT EXISTS) ──────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_logs (created_at DESC);

-- ─── Step 4: password_history table (safe — IF NOT EXISTS) ───────────────────

CREATE TABLE IF NOT EXISTS password_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID        NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_history_staff
  ON password_history (staff_id, created_at DESC);

-- ─── Step 5: Final verification ──────────────────────────────────────────────

DO $$
DECLARE
  col_list TEXT;
  required_cols TEXT[] := ARRAY[
    'actor_id','actor_email','actor_branch','action','entity_type',
    'entity_id','old_value','new_value','ip_address','metadata','created_at'
  ];
  col TEXT;
  missing TEXT := '';
BEGIN
  FOREACH col IN ARRAY required_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = 'audit_logs' AND column_name = col
    ) THEN
      missing := missing || col || ' ';
    END IF;
  END LOOP;

  IF missing = '' THEN
    RAISE NOTICE '✅ Migration 022b complete — all required columns present in audit_logs';
  ELSE
    RAISE EXCEPTION '❌ Migration incomplete — still missing columns: %', missing;
  END IF;

  -- Also confirm password_history exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_history') THEN
    RAISE NOTICE '✅ password_history table confirmed';
  ELSE
    RAISE EXCEPTION '❌ password_history table was not created';
  END IF;
END $$;
