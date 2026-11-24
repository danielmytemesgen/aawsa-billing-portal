-- Migration 017: User Session Monitoring
-- Creates staff_sessions and customer_sessions tables for the security/session monitoring feature.
-- Apply this on any server that is missing these tables (run once -- safe with IF NOT EXISTS).

-- ============================================================
-- staff_sessions: one row per staff login
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id           UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
    staff_email        TEXT NOT NULL,
    role_name          TEXT,
    branch_id          UUID,
    branch_name        TEXT,
    ip_address         TEXT,
    user_agent         TEXT,
    device_name        TEXT,
    location           TEXT,
    login_time         TIMESTAMPTZ NOT NULL DEFAULT now(),
    logout_time        TIMESTAMPTZ,
    duration_seconds   INTEGER,
    last_active_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_end_reason TEXT,
    pages_viewed       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_email  ON staff_sessions (staff_email);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_active ON staff_sessions (logout_time) WHERE logout_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_sessions_login  ON staff_sessions (login_time);

-- ============================================================
-- customer_sessions: one row per customer portal login
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_key_number  TEXT NOT NULL,
    customer_type        TEXT NOT NULL,   -- 'bulk' | 'individual'
    ip_address           TEXT,
    user_agent           TEXT,
    device_name          TEXT,
    location             TEXT,
    logout_time          TIMESTAMPTZ,
    duration_seconds     INTEGER,
    last_active_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_end_reason   TEXT,
    pages_viewed         JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_revoked           BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_key    ON customer_sessions (customer_key_number);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_active ON customer_sessions (logout_time) WHERE logout_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_sessions_login  ON customer_sessions (created_at);
