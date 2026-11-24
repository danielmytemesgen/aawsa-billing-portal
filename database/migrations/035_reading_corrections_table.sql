-- Migration 035: Meter Reading Corrections Audit Table & Performance Indexes

CREATE TABLE IF NOT EXISTS reading_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reading Reference & Identification
    reading_id VARCHAR(100) NOT NULL,
    meter_type VARCHAR(20) NOT NULL CHECK (meter_type IN ('individual', 'bulk')),
    customer_key VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255),
    meter_number VARCHAR(100),
    branch_id UUID,
    branch_name VARCHAR(100),
    route_key VARCHAR(100),
    month_year VARCHAR(7) NOT NULL, -- e.g. '2026-10'
    reading_date TIMESTAMPTZ NOT NULL,

    -- Before State (Old Values)
    old_previous_reading NUMERIC(12, 3) NOT NULL,
    old_current_reading NUMERIC(12, 3) NOT NULL,
    old_consumption NUMERIC(12, 3) NOT NULL,
    old_fault_code VARCHAR(50),

    -- After State (Corrected Values)
    new_previous_reading NUMERIC(12, 3) NOT NULL,
    new_current_reading NUMERIC(12, 3) NOT NULL,
    new_consumption NUMERIC(12, 3) NOT NULL,
    new_fault_code VARCHAR(50),

    -- Variance & Impact Analysis
    consumption_difference NUMERIC(12, 3) NOT NULL,
    reading_difference NUMERIC(12, 3) NOT NULL,

    -- Authorization & Justification
    reason TEXT NOT NULL,
    reason_category VARCHAR(50) DEFAULT 'meter_dial_misread',
    corrected_by UUID,
    corrected_by_name VARCHAR(255) NOT NULL,
    corrected_at TIMESTAMPTZ DEFAULT NOW(),

    -- Additional Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reading_corr_cust_key ON reading_corrections(customer_key);
CREATE INDEX IF NOT EXISTS idx_reading_corr_branch_id ON reading_corrections(branch_id);
CREATE INDEX IF NOT EXISTS idx_reading_corr_month_year ON reading_corrections(month_year);
CREATE INDEX IF NOT EXISTS idx_reading_corr_date ON reading_corrections(corrected_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_corr_meter_type ON reading_corrections(meter_type);

