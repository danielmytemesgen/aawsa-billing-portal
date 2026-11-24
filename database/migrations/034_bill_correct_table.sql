-- Migration 034: Bill Corrections Tracking Table & Reporting Indexes

CREATE TABLE IF NOT EXISTS bill_correct (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Bill References
    original_bill_id UUID NOT NULL,
    original_bill_number VARCHAR(100) NOT NULL,
    replacement_bill_id UUID,
    replacement_bill_number VARCHAR(100),
    bill_key VARCHAR(100),
    month_year VARCHAR(7) NOT NULL, -- e.g. '2026-03'

    -- Customer & Branch Identification
    customer_key VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    customer_type VARCHAR(30) DEFAULT 'individual', -- 'individual' or 'bulk_meter'
    branch_id UUID,
    branch_name VARCHAR(100),
    meter_number VARCHAR(100),
    contract_number VARCHAR(100),

    -- Correction Authorization & Justification
    reason TEXT NOT NULL,
    reason_category VARCHAR(50) DEFAULT 'meter_reading_error',
    corrected_by UUID,
    corrected_by_name VARCHAR(255),
    corrected_at TIMESTAMPTZ DEFAULT NOW(),

    -- Before State (Original Bill Snapshot)
    original_prev_read NUMERIC(12, 3),
    original_curr_read NUMERIC(12, 3),
    original_consumption NUMERIC(12, 3),
    original_base_charge NUMERIC(12, 2) DEFAULT 0.00,
    original_sewerage_charge NUMERIC(12, 2) DEFAULT 0.00,
    original_penalty_amount NUMERIC(12, 2) DEFAULT 0.00,
    original_bill_amount NUMERIC(14, 2) NOT NULL,

    -- After State (Updated upon Rebilling/Posting)
    new_prev_read NUMERIC(12, 3),
    new_curr_read NUMERIC(12, 3),
    new_consumption NUMERIC(12, 3),
    new_base_charge NUMERIC(12, 2),
    new_sewerage_charge NUMERIC(12, 2),
    new_penalty_amount NUMERIC(12, 2),
    new_bill_amount NUMERIC(14, 2),

    -- Variance / Financial Impact (new - original)
    consumption_difference NUMERIC(12, 3),
    amount_difference NUMERIC(14, 2),

    -- Status Lifecycle
    status VARCHAR(30) DEFAULT 'Draft_Replacement' 
        CHECK (status IN ('Draft_Replacement', 'Posted', 'Reconciled', 'Cancelled')),
    
    -- Additional Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes for Reporting & Lookups
CREATE INDEX IF NOT EXISTS idx_bill_correct_orig_id ON bill_correct(original_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_correct_repl_id ON bill_correct(replacement_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_correct_cust_key ON bill_correct(customer_key);
CREATE INDEX IF NOT EXISTS idx_bill_correct_branch_id ON bill_correct(branch_id);
CREATE INDEX IF NOT EXISTS idx_bill_correct_month_year ON bill_correct(month_year);
CREATE INDEX IF NOT EXISTS idx_bill_correct_corrected_at ON bill_correct(corrected_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_correct_status ON bill_correct(status);
