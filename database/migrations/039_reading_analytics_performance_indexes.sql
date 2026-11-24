-- Migration 039: Meter Readings Analytics & Report Performance Indexes
-- Accelerates date-range queries, month filtering, customer joins, and branch lookups

-- 1. Accelerate reading date range filtering and ordering
CREATE INDEX IF NOT EXISTS idx_ic_readings_date_perf
  ON individual_customer_readings ("READING_DATE" DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bm_readings_date_perf
  ON bulk_meter_readings ("READING_DATE" DESC)
  WHERE deleted_at IS NULL;

-- 2. Accelerate customer key joins with branch filtering
CREATE INDEX IF NOT EXISTS idx_ic_branch_custkey
  ON individual_customers (branch_id, "customerKeyNumber")
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bm_branch_custkey
  ON bulk_meters (branch_id, "customerKeyNumber")
  WHERE deleted_at IS NULL;

-- 3. Composite index for customer readings by customer key and date
CREATE INDEX IF NOT EXISTS idx_ic_readings_cust_date_perf
  ON individual_customer_readings ("CUST_KEY", "READING_DATE" DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bm_readings_cust_date_perf
  ON bulk_meter_readings ("CUST_KEY", "READING_DATE" DESC)
  WHERE deleted_at IS NULL;
