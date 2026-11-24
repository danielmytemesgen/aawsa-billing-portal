-- ==============================================================================
-- Migration 030: Fix Faulty Paid & Reconciled Bills Anomaly
-- ==============================================================================
-- Problem:
--   Certain bills were marked with reconciliation_status = 'Reconciled' and 
--   had external bank references (e.g. 'BBPT-...') assigned, but their actual 
--   payment_status was 'Unpaid' or amount_paid was 0.00 (no payment made).
--   Legacy queries using `OR reconciliation_status = 'reconciled'` caused these 
--   unpaid bills to leak into Paid Bills tables and Paid Bills reports.
--
-- Solution in this migration:
--   1. Audit & view the faulty records.
--   2. Revert faulty bills back to payment_status = 'Unpaid', 
--      reconciliation_status = 'Not reconciled', amount_paid = 0.00, bank_ref = NULL,
--      and append an audit trail to `notes`.
--   3. Create high-performance indexes for fast Paid Bills querying and reconciliation checks.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Fast Composite Indexes for Paid Bills & Reconciliation Lookups
-- ------------------------------------------------------------------------------
-- Fast lookups for strictly paid bills paginated by date and branch
CREATE INDEX IF NOT EXISTS idx_bills_paid_strict_perf
ON bills (branch_id, month_year, created_at DESC)
WHERE deleted_at IS NULL AND LOWER(payment_status::text) = 'paid';

-- Fast lookups for reconciliation status audits
CREATE INDEX IF NOT EXISTS idx_bills_reconciliation_anomaly_audit
ON bills (reconciliation_status, payment_status, amount_paid)
WHERE deleted_at IS NULL;

-- Fast lookup on bank reference for payment tracking
CREATE INDEX IF NOT EXISTS idx_bills_bank_ref_active
ON bills (bank_ref)
WHERE deleted_at IS NULL AND bank_ref IS NOT NULL;


-- ------------------------------------------------------------------------------
-- STEP 2: Revert False Reconciled & False Paid Records
-- ------------------------------------------------------------------------------
-- Revert records where:
--   a) reconciliation_status is 'Reconciled' BUT payment_status is 'Unpaid' or amount_paid is 0
--   b) payment_status is 'Paid' BUT amount_paid is 0
UPDATE bills
SET 
    reconciliation_status = 'Not reconciled',
    payment_status = 'Unpaid',
    amount_paid = 0.00,
    bank_ref = NULL,
    notes = CASE 
        WHEN notes IS NOT NULL AND TRIM(notes) != '' 
            THEN notes || E'\n[Migration 030: Reverted false Reconciled/Paid status - amount was 0 or bill unpaid]'
        ELSE '[Migration 030: Reverted false Reconciled/Paid status - amount was 0 or bill unpaid]'
    END,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (
    -- Fault Case A: Marked Reconciled without payment
    (
        LOWER(COALESCE(reconciliation_status, '')) = 'reconciled' 
        AND (LOWER(COALESCE(payment_status::text, '')) = 'unpaid' OR COALESCE(amount_paid, 0) = 0)
    )
    OR
    -- Fault Case B: Marked Paid with zero amount paid
    (
        LOWER(COALESCE(payment_status::text, '')) = 'paid' 
        AND COALESCE(amount_paid, 0) = 0
    )
  );

-- ------------------------------------------------------------------------------
-- STEP 3: Verification & Sanity Check
-- ------------------------------------------------------------------------------
-- If any anomalies still exist, this query will show them (should return 0 rows):
-- SELECT id, "BILLKEY", "CUSTOMERKEY", payment_status, reconciliation_status, amount_paid, bank_ref
-- FROM bills
-- WHERE deleted_at IS NULL
--   AND (
--     (LOWER(COALESCE(reconciliation_status, '')) = 'reconciled' AND (LOWER(COALESCE(payment_status::text, '')) = 'unpaid' OR COALESCE(amount_paid, 0) = 0))
--     OR (LOWER(COALESCE(payment_status::text, '')) = 'paid' AND COALESCE(amount_paid, 0) = 0)
--   );

COMMIT;
