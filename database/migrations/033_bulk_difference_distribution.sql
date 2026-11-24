-- Migration 033: Bulk Meter Difference Distributions & Individual Customer Apportionment Tables

CREATE TABLE IF NOT EXISTS bulk_difference_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_meter_key VARCHAR(50) NOT NULL,
    bulk_bill_id UUID,
    month_year VARCHAR(7) NOT NULL, -- e.g. '2026-08'
    total_bulk_usage NUMERIC(12, 3) NOT NULL,
    total_submeter_usage NUMERIC(12, 3) NOT NULL,
    difference_usage NUMERIC(12, 3) NOT NULL,
    difference_bill_amount NUMERIC(12, 2) NOT NULL,
    distribution_method VARCHAR(30) DEFAULT 'proportional_usage' 
        CHECK (distribution_method IN ('proportional_usage', 'equal_split')),
    status VARCHAR(20) DEFAULT 'Draft' 
        CHECK (status IN ('Draft', 'Finalized', 'Published', 'Cancelled')),
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bulk_meter_key, month_year),
    FOREIGN KEY (bulk_bill_id, month_year) REFERENCES bills(id, month_year) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bulk_difference_apportionment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID NOT NULL REFERENCES bulk_difference_distributions(id) ON DELETE CASCADE,
    individual_customer_id VARCHAR(50) NOT NULL REFERENCES individual_customers("customerKeyNumber"),
    individual_usage NUMERIC(12, 3) NOT NULL,
    consumption_share_ratio NUMERIC(10, 6) NOT NULL,
    apportioned_amount NUMERIC(12, 2) NOT NULL,
    own_bill_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_due NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(distribution_id, individual_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_dist_items_dist_id ON bulk_difference_apportionment_items(distribution_id);
CREATE INDEX IF NOT EXISTS idx_dist_items_cust ON bulk_difference_apportionment_items(individual_customer_id);
CREATE INDEX IF NOT EXISTS idx_dist_status ON bulk_difference_distributions(status);
