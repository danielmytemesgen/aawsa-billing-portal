-- Migration 029: Performance Optimization Indexes
-- Target: High-frequency query acceleration, zero-sort pagination, and partition filtering

-- 1. Accelerate customer pagination & sorting (eliminates in-memory sort on 48k rows)
CREATE INDEX IF NOT EXISTS idx_individual_customers_perf_sort 
ON individual_customers (created_at DESC) 
WHERE deleted_at IS NULL;

-- 2. Fast lookup for pending customer approvals
CREATE INDEX IF NOT EXISTS idx_individual_customers_pending_approval 
ON individual_customers (created_at DESC) 
WHERE deleted_at IS NULL AND status = 'Pending Approval';

-- 3. Fast lookup for branch-filtered customer pagination
CREATE INDEX IF NOT EXISTS idx_individual_customers_branch_perf
ON individual_customers (branch_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 4. Fast lookup for assigned bulk meter customers
CREATE INDEX IF NOT EXISTS idx_individual_customers_assigned_bulk_active 
ON individual_customers ("assignedBulkMeterId") 
WHERE deleted_at IS NULL;

-- 5. Meter readings cycle & active period index
CREATE INDEX IF NOT EXISTS idx_ind_readings_cycle_date 
ON individual_customer_readings ("READ_PROC_ID", "READING_DATE" DESC) 
WHERE deleted_at IS NULL;

-- 6. Individual customer readings customer key index
CREATE INDEX IF NOT EXISTS idx_ind_readings_cust_key_date
ON individual_customer_readings ("CUST_KEY", "READING_DATE" DESC)
WHERE deleted_at IS NULL;

-- 7. Bills approved & outstanding lookups
CREATE INDEX IF NOT EXISTS idx_bills_approved_outstanding 
ON bills (status, payment_status, due_date) 
WHERE deleted_at IS NULL AND status = 'Approved';
