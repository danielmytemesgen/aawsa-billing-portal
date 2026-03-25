-- Migration: Add performance indexes for scalability
-- Targeting 1,000,000 customers and large billing sets

-- 1. Individual Customers
CREATE INDEX IF NOT EXISTS idx_individual_customers_bulk_id ON public.individual_customers ("assignedBulkMeterId");
CREATE INDEX IF NOT EXISTS idx_individual_customers_branch_id ON public.individual_customers (branch_id);
CREATE INDEX IF NOT EXISTS idx_individual_customers_status ON public.individual_customers (status);

-- 2. Bulk Meters
CREATE INDEX IF NOT EXISTS idx_bulk_meters_branch_id ON public.bulk_meters (branch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_meters_route_key ON public.bulk_meters ("ROUTE_KEY");
CREATE INDEX IF NOT EXISTS idx_bulk_meters_status ON public.bulk_meters (status);

-- 3. Bills
CREATE INDEX IF NOT EXISTS idx_bills_customer_key ON public.bills ("CUSTOMERKEY");
CREATE INDEX IF NOT EXISTS idx_bills_individual_id ON public.bills (individual_customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_month_year ON public.bills (month_year);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON public.bills (payment_status);

-- 4. Payments
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments (bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments (individual_customer_id);
