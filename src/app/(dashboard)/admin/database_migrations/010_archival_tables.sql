-- Migration: Create Archival Tables for long-term scalability
-- Supports Phase 5 (Data Archival)

-- 1. Bills History
CREATE TABLE IF NOT EXISTS public.bills_history (
    id UUID PRIMARY KEY,
    "BILLKEY" TEXT,
    "CUSTOMERKEY" TEXT,
    "CUSTOMERNAME" TEXT,
    "CUSTOMERTIN" TEXT,
    "CUSTOMERBRANCH" TEXT,
    "REASON" TEXT,
    "CURRREAD" NUMERIC,
    "PREVREAD" NUMERIC,
    "CONS" NUMERIC,
    "TOTALBILLAMOUNT" NUMERIC,
    "THISMONTHBILLAMT" NUMERIC,
    "OUTSTANDINGAMT" NUMERIC,
    "PENALTYAMT" NUMERIC,
    "DRACCTNO" TEXT,
    "CRACCTNO" TEXT,
    individual_customer_id TEXT,
    bill_period_start_date DATE,
    bill_period_end_date DATE,
    month_year TEXT,
    difference_usage NUMERIC,
    base_water_charge NUMERIC,
    sewerage_charge NUMERIC,
    maintenance_fee NUMERIC,
    sanitation_fee NUMERIC,
    meter_rent NUMERIC,
    balance_carried_forward NUMERIC,
    amount_paid NUMERIC,
    due_date DATE,
    payment_status TEXT,
    status TEXT,
    bill_number TEXT,
    notes TEXT,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    approval_date timestamp with time zone,
    approved_by TEXT,
    vat_amount NUMERIC,
    additional_fees_charge NUMERIC,
    additional_fees_breakdown JSONB,
    snapshot_data JSONB,
    debit_30 NUMERIC,
    debit_30_60 NUMERIC,
    debit_60 NUMERIC,
    archived_at timestamp with time zone DEFAULT now()
);

-- 2. Payments History
CREATE TABLE IF NOT EXISTS public.payments_history (
    id UUID PRIMARY KEY,
    bill_id UUID,
    individual_customer_id TEXT,
    amount_paid NUMERIC(12,2),
    payment_method TEXT,
    transaction_reference TEXT,
    processed_by_staff_id UUID,
    payment_date timestamp with time zone,
    notes TEXT,
    archived_at timestamp with time zone DEFAULT now()
);

-- Indexes for History tables
CREATE INDEX IF NOT EXISTS idx_bills_history_customer ON public.bills_history ("CUSTOMERKEY");
CREATE INDEX IF NOT EXISTS idx_bills_history_month ON public.bills_history (month_year);
CREATE INDEX IF NOT EXISTS idx_payments_history_bill ON public.payments_history (bill_id);
