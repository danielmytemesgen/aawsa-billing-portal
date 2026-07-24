=============================================================================
SQL CODE COMPILATION: Update Payment with CSV Upload Feature
=============================================================================

This document contains all SQL code related to the "Update Payment with CSV Upload"
feature for the AAWSA Billing Portal.

=============================================================================
1. PRIMARY MIGRATION - Payment Reconciliation Setup
   File: database/migrations/050_payment_infrastructure_csv.sql
=============================================================================

-- Step 1: Ensure all reconciliation and payment columns exist on public.bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'Not reconciled';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_channel TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS bank_ref TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS route_key TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS walk_order INTEGER;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS meter_key TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS "OUTSTANDINGAMT" NUMERIC DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Step 2: Safely convert payment_status to TEXT (avoids Enum type coercion crashes)
ALTER TABLE public.bills ALTER COLUMN payment_status TYPE TEXT USING payment_status::TEXT;

-- Convert paymentStatus on individual_customers and bulk_meters if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'individual_customers' AND column_name = 'paymentStatus') THEN
        ALTER TABLE public.individual_customers ALTER COLUMN "paymentStatus" TYPE TEXT USING "paymentStatus"::TEXT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bulk_meters' AND column_name = 'payment_status') THEN
        ALTER TABLE public.bulk_meters ALTER COLUMN payment_status TYPE TEXT USING payment_status::TEXT;
    END IF;
END $$;

-- Step 3: Ensure Payments Audit Trail Table Exists
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
    bill_month_year TEXT,
    individual_customer_id TEXT,
    amount_paid NUMERIC NOT NULL DEFAULT 0.00,
    payment_method TEXT,
    transaction_reference TEXT,
    processed_by_staff_id UUID,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create Performance Indexes for Fast Lookups and Reports
CREATE INDEX IF NOT EXISTS idx_bills_billkey ON public.bills ("BILLKEY");
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON public.bills (bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_customerkey ON public.bills ("CUSTOMERKEY");
CREATE INDEX IF NOT EXISTS idx_bills_ind_customer ON public.bills (individual_customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON public.bills (payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_reconciliation_status ON public.bills (reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments (bill_id);

-- Step 5: Reset outstanding balance to 0 for already paid bills
UPDATE public.bills
SET "OUTSTANDINGAMT" = 0.00
WHERE LOWER(TRIM(COALESCE(payment_status, ''))) = 'paid';

=============================================================================
2. SOFT DELETE SUPPORT FOR PAYMENTS
   File: database/migrations/021_add_soft_delete_to_all_tables.sql
=============================================================================

-- Add soft-delete columns to payments table for audit trail
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='deleted_at') THEN
        ALTER TABLE payments ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE payments ADD COLUMN deleted_by UUID;
    END IF;
END $$;

=============================================================================
3. CORE BILL STRUCTURE FOR PAYMENT TRACKING
   File: database/migrations/020_reorder_bills_columns.sql (Relevant Section)
=============================================================================

-- Bills table includes these payment-related columns:
-- - id UUID NOT NULL DEFAULT gen_random_uuid()
-- - amount_paid NUMERIC DEFAULT 0.00
-- - payment_status TEXT NOT NULL DEFAULT 'Unpaid'
-- - status CHARACTER VARYING NOT NULL DEFAULT 'Draft'
-- - updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()

-- Foreign key constraints:
-- CONSTRAINT fk_bills_individual FOREIGN KEY (individual_customer_id) REFERENCES individual_customers
-- CONSTRAINT fk_bills_bulk FOREIGN KEY ("CUSTOMERKEY") REFERENCES bulk_meters

=============================================================================
4. CUSTOMER PAYMENT STATUS SYNC
   Files: individual_customers and bulk_meters tables
=============================================================================

-- Individual Customers Table (Related Column)
-- - "paymentStatus" TEXT (originally ENUM, converted to TEXT)

-- Bulk Meters Table (Related Column)
-- - payment_status TEXT (originally ENUM, converted to TEXT)

=============================================================================
5. EXPECTED TABLE STRUCTURE AFTER MIGRATION
=============================================================================

-- bills table columns (Payment-related):
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'bills' 
ORDER BY ordinal_position;

-- Expected columns:
-- id                          | uuid
-- payment_status              | text (converted from enum)
-- amount_paid                 | numeric
-- reconciliation_status       | text
-- payment_channel             | text
-- bank_ref                    | text
-- last_payment_date           | timestamp with time zone
-- phone                       | text
-- route_key                   | text
-- walk_order                  | integer
-- meter_key                   | text
-- "OUTSTANDINGAMT"            | numeric
-- deleted_at                  | timestamp with time zone
-- deleted_by                  | uuid
-- updated_at                  | timestamp with time zone

-- payments table columns:
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payments' 
ORDER BY ordinal_position;

-- Expected columns:
-- id                          | uuid
-- bill_id                     | uuid (foreign key to bills)
-- bill_month_year             | text
-- individual_customer_id      | text
-- amount_paid                 | numeric
-- payment_method              | text
-- transaction_reference       | text
-- processed_by_staff_id       | uuid
-- payment_date                | timestamp with time zone
-- notes                       | text
-- created_at                  | timestamp with time zone
-- deleted_at                  | timestamp with time zone (soft delete)
-- deleted_by                  | uuid (soft delete)

=============================================================================
6. INDEXES CREATED FOR PERFORMANCE
=============================================================================

-- Bill lookup indexes (for CSV matching):
CREATE INDEX idx_bills_billkey ON public.bills ("BILLKEY");
CREATE INDEX idx_bills_bill_number ON public.bills (bill_number);
CREATE INDEX idx_bills_customerkey ON public.bills ("CUSTOMERKEY");
CREATE INDEX idx_bills_ind_customer ON public.bills (individual_customer_id);

-- Payment status indexes (for filtering):
CREATE INDEX idx_bills_payment_status ON public.bills (payment_status);
CREATE INDEX idx_bills_reconciliation_status ON public.bills (reconciliation_status);

-- Payments table indexes:
CREATE INDEX idx_payments_bill_id ON public.payments (bill_id);

=============================================================================
7. VERIFICATION QUERIES
=============================================================================

-- Verify columns exist on bills:
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'bills' 
AND column_name IN ('reconciliation_status', 'payment_channel', 'bank_ref', 'last_payment_date', 'phone', 'route_key', 'walk_order', 'meter_key', 'amount_paid', 'OUTSTANDINGAMT');

-- Verify payments table exists:
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments');

-- Verify indexes:
SELECT indexname FROM pg_indexes WHERE tablename = 'bills' AND indexname LIKE 'idx_bills%';
SELECT indexname FROM pg_indexes WHERE tablename = 'payments' AND indexname LIKE 'idx_payments%';

-- Check data type of payment_status:
SELECT data_type FROM information_schema.columns 
WHERE table_name = 'bills' AND column_name = 'payment_status';

=============================================================================
8. DEPLOYMENT CHECKLIST
=============================================================================

✅ Run migration: 050_payment_infrastructure_csv.sql
✅ Verify columns were added successfully
✅ Verify payment_status is now TEXT (not enum)
✅ Verify payments table exists with correct structure
✅ Verify all indexes are created
✅ Test CSV upload with sample payment data
✅ Verify payment records inserted into payments table
✅ Verify bill records updated with payment details
✅ Verify individual_customers and bulk_meters synced

=============================================================================
9. SUPPORT FOR APPLICATION CODE
=============================================================================

These SQL migrations support the following application files:

JavaScript/TypeScript Code:
- src/lib/db-queries.ts (dbBatchUpdatePaymentsFromCsv function)
- src/lib/actions.ts (updatePaymentsFromCsvAction)
- src/components/billing/PaymentCsvUploadDialog.tsx
- src/app/(dashboard)/admin/reports/paid-bills/page.tsx
- src/app/(dashboard)/staff/reports/paid-bills/ClientPage.tsx

The migration creates the necessary database structures for:
1. ✅ Parsing CSV payment records
2. ✅ Matching bills by BILLKEY, CUSTOMERKEY, or METERKEY
3. ✅ Updating payment status and reconciliation details
4. ✅ Recording payment audit trail
5. ✅ Synchronizing customer payment status

=============================================================================
END OF SQL COMPILATION
=============================================================================
