-- =====================================================
-- Phase 3: Database Partitioning for 'bills' table
-- =====================================================

-- 1. Create the Parent Table (Partitioned)
-- NOTE: 'month_year' MUST be part of the Primary Key for partitioning
CREATE TABLE IF NOT EXISTS public.bills_partitioned (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    "BILLKEY" TEXT,
    "CUSTOMERKEY" TEXT,
    "CUSTOMERNAME" TEXT,
    "CUSTOMERTIN" TEXT,
    "CUSTOMERBRANCH" TEXT,
    "REASON" TEXT,
    "CURRREAD" NUMERIC NOT NULL DEFAULT 0.000,
    "PREVREAD" NUMERIC NOT NULL DEFAULT 0.000,
    "CONS" NUMERIC DEFAULT 0.000,
    "TOTALBILLAMOUNT" NUMERIC NOT NULL DEFAULT 0.00,
    "THISMONTHBILLAMT" NUMERIC,
    "OUTSTANDINGAMT" NUMERIC DEFAULT 0.00,
    "PENALTYAMT" NUMERIC,
    "DRACCTNO" TEXT,
    "CRACCTNO" TEXT,
    individual_customer_id TEXT,
    bill_period_start_date DATE NOT NULL,
    bill_period_end_date DATE NOT NULL,
    month_year TEXT NOT NULL,
    difference_usage NUMERIC DEFAULT 0.000,
    base_water_charge NUMERIC NOT NULL DEFAULT 0.00,
    sewerage_charge NUMERIC DEFAULT 0.00,
    maintenance_fee NUMERIC DEFAULT 0.00,
    sanitation_fee NUMERIC DEFAULT 0.00,
    meter_rent NUMERIC DEFAULT 0.00,
    balance_carried_forward NUMERIC DEFAULT 0.00,
    amount_paid NUMERIC DEFAULT 0.00,
    due_date DATE NOT NULL,
    payment_status TEXT DEFAULT 'Unpaid',
    status TEXT DEFAULT 'Draft',
    bill_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    approval_date TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    vat_amount NUMERIC DEFAULT 0,
    additional_fees_charge NUMERIC DEFAULT 0,
    additional_fees_breakdown JSONB,
    snapshot_data JSONB,
    branch_id TEXT,
    debit_30 NUMERIC,
    debit_30_60 NUMERIC,
    debit_60 NUMERIC,
    PRIMARY KEY (id, month_year)
) PARTITION BY LIST (month_year);

-- 2. Create Initial Partitions (Example for current/upcoming months)
CREATE TABLE IF NOT EXISTS bills_2024_01 PARTITION OF bills_partitioned FOR VALUES IN ('2024-01');
CREATE TABLE IF NOT EXISTS bills_2024_02 PARTITION OF bills_partitioned FOR VALUES IN ('2024-02');
CREATE TABLE IF NOT EXISTS bills_2024_03 PARTITION OF bills_partitioned FOR VALUES IN ('2024-03');
CREATE TABLE IF NOT EXISTS bills_2024_04 PARTITION OF bills_partitioned FOR VALUES IN ('2024-04');
CREATE TABLE IF NOT EXISTS bills_2024_05 PARTITION OF bills_partitioned FOR VALUES IN ('2024-05');
CREATE TABLE IF NOT EXISTS bills_2024_06 PARTITION OF bills_partitioned FOR VALUES IN ('2024-06');
CREATE TABLE IF NOT EXISTS bills_default PARTITION OF bills_partitioned DEFAULT;

-- 3. Create Critical Performance Indexes on Parent
CREATE INDEX IF NOT EXISTS idx_bills_part_branch ON bills_partitioned (branch_id);
CREATE INDEX IF NOT EXISTS idx_bills_part_status ON bills_partitioned (status);
CREATE INDEX IF NOT EXISTS idx_bills_part_month ON bills_partitioned (month_year);
CREATE INDEX IF NOT EXISTS idx_bills_part_customer ON bills_partitioned ("CUSTOMERKEY");
CREATE INDEX IF NOT EXISTS idx_bills_part_individual ON bills_partitioned (individual_customer_id);

-- 4. SWAP Procedure (Run this manually when system is low-traffic)
-- BEGIN;
-- INSERT INTO bills_partitioned SELECT * FROM bills;
-- ALTER TABLE bills RENAME TO bills_old;
-- ALTER TABLE bills_partitioned RENAME TO bills;
-- COMMIT;
