-- ============================================================
-- Migration: 022_audit_logs.sql
-- Creates the audit_logs table for tracking all significant
-- staff actions (payments, bills, corrections, user management).
--
-- Run this on the production database BEFORE deploying the
-- corresponding application code.
-- ============================================================

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  actor_id        UUID        REFERENCES staff_members(id) ON DELETE SET NULL,
  actor_email     TEXT,
  actor_branch    TEXT,

  -- What was done
  action          TEXT        NOT NULL,   -- e.g. PAYMENT_UPDATED, BILL_REVERSED
  entity_type     TEXT        NOT NULL,   -- e.g. 'bill', 'payment', 'staff'
  entity_id       TEXT,                   -- Primary key of the affected record

  -- Before / after snapshots (JSONB for flexible schema)
  old_value       JSONB,
  new_value       JSONB,

  -- Request context
  ip_address      TEXT,
  metadata        JSONB,      -- Extra context (e.g. batch size, reason)

  -- Timestamp (immutable — no updated_at on audit records)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

-- Fast lookup by actor (admin reviewing a staff member's history)
CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON audit_logs (actor_id, created_at DESC);

-- Fast lookup by entity (e.g. all changes to a specific bill)
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

-- Fast lookup by action type (e.g. all BILL_REVERSED events)
CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_logs (action, created_at DESC);

-- Date range queries for reporting
CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_logs (created_at DESC);

-- ─── Retention Policy Comment ────────────────────────────────────────────────
-- Recommended: retain audit logs for at least 3 years per financial regulations.
-- To purge old records:
--   DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '3 years';
-- Consider archiving to a separate table before deleting.

-- ─── Password History Table ──────────────────────────────────────────────────
-- Stores hashed previous passwords to prevent password reuse (last 3 enforced).

CREATE TABLE IF NOT EXISTS password_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID        NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_history_staff
  ON password_history (staff_id, created_at DESC);

-- Confirm migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 022: audit_logs and password_history tables created successfully.';
END $$;
