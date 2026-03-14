
-- Migration to reorder columns in the bills table.
-- Sequence: id, BILLKEY, CUSTOMERKEY, CUSTOMERNAME, CUSTOMERTIN, CUSTOMERBRANCH, REASON, CURRREAD, PREVREAD, CONS, TOTALBILLAMOUNT, THISMONTHBILLAMT, OUTSTANDINGAMT, PENALTYAMT, DRACCTNO, CRACCTNO, and the rest.

BEGIN;

-- 1. Rename existing table
ALTER TABLE bills RENAME TO bills_old;

-- 2. Create new table with exact desired order
CREATE TABLE bills (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    "BILLKEY" text,
    "CUSTOMERKEY" text,
    "CUSTOMERNAME" text,
    "CUSTOMERTIN" text,
    "CUSTOMERBRANCH" text,
    "REASON" text,
    "CURRREAD" numeric NOT NULL DEFAULT 0.000,
    "PREVREAD" numeric NOT NULL DEFAULT 0.000,
    "CONS" numeric DEFAULT 0.000,
    "TOTALBILLAMOUNT" numeric NOT NULL DEFAULT 0.00,
    "THISMONTHBILLAMT" numeric,
    "OUTSTANDINGAMT" numeric DEFAULT 0.00,
    "PENALTYAMT" numeric,
    "DRACCTNO" text,
    "CRACCTNO" text,
    
    -- Remaining columns
    individual_customer_id text,
    bill_period_start_date date NOT NULL,
    bill_period_end_date date NOT NULL,
    month_year text NOT NULL,
    difference_usage numeric DEFAULT 0.000,
    base_water_charge numeric NOT NULL DEFAULT 0.00,
    sewerage_charge numeric DEFAULT 0.00,
    maintenance_fee numeric DEFAULT 0.00,
    sanitation_fee numeric DEFAULT 0.00,
    meter_rent numeric DEFAULT 0.00,
    balance_carried_forward numeric DEFAULT 0.00,
    amount_paid numeric DEFAULT 0.00,
    due_date date NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'Unpaid'::payment_status,
    bill_number text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    status character varying NOT NULL DEFAULT 'Draft'::character varying,
    approval_date timestamp without time zone,
    approved_by character varying,
    vat_amount numeric DEFAULT 0,
    additional_fees_charge numeric DEFAULT 0,
    additional_fees_breakdown jsonb,

    CONSTRAINT bills_pkey PRIMARY KEY (id),
    CONSTRAINT chk_bills_customer_or_bulk CHECK ((((individual_customer_id IS NOT NULL) AND ("CUSTOMERKEY" IS NULL)) OR ((individual_customer_id IS NULL) AND ("CUSTOMERKEY" IS NOT NULL)))),
    CONSTRAINT fk_bills_individual FOREIGN KEY (individual_customer_id) REFERENCES individual_customers(customerKeyNumber) ON DELETE SET NULL,
    CONSTRAINT fk_bills_bulk FOREIGN KEY ("CUSTOMERKEY") REFERENCES bulk_meters(customerKeyNumber) ON DELETE SET NULL
);

-- 3. Copy data from old table to new table
INSERT INTO bills (
    id, "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON", "CURRREAD", "PREVREAD", "CONS", "TOTALBILLAMOUNT", "THISMONTHBILLAMT", "OUTSTANDINGAMT", "PENALTYAMT", "DRACCTNO", "CRACCTNO",
    individual_customer_id, bill_period_start_date, bill_period_end_date, month_year, difference_usage, base_water_charge, sewerage_charge, maintenance_fee, sanitation_fee, meter_rent, balance_carried_forward, amount_paid, due_date, payment_status, bill_number, notes, created_at, updated_at, status, approval_date, approved_by, vat_amount, additional_fees_charge, additional_fees_breakdown
)
SELECT 
    id, "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON", "CURRREAD", "PREVREAD", "CONS", "TOTALBILLAMOUNT", "THISMONTHBILLAMT", "OUTSTANDINGAMT", "PENALTYAMT", "DRACCTNO", "CRACCTNO",
    individual_customer_id, bill_period_start_date, bill_period_end_date, month_year, difference_usage, base_water_charge, sewerage_charge, maintenance_fee, sanitation_fee, meter_rent, balance_carried_forward, amount_paid, due_date, payment_status, bill_number, notes, created_at, updated_at, status, approval_date, approved_by, vat_amount, additional_fees_charge, additional_fees_breakdown
FROM bills_old;

-- 4. Re-create indexes
CREATE INDEX idx_bills_individual ON bills (individual_customer_id);
CREATE INDEX idx_bills_bulk ON bills ("CUSTOMERKEY");
CREATE INDEX idx_bills_due_date ON bills (due_date);
CREATE INDEX idx_bills_billkey ON bills ("BILLKEY");
CREATE INDEX idx_bills_payment_status ON bills (payment_status);

-- 5. Drop old table
DROP TABLE bills_old;

COMMIT;
