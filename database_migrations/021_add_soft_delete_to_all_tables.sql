-- Migration: Add soft-delete columns to all remaining tables
-- Tables targetted: bills, individual_customer_readings, bulk_meter_readings, payments, reports, notifications, fault_codes
-- knowledge_base_articles already has these columns.

DO $$ 
BEGIN
    -- bills
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='deleted_at') THEN
        ALTER TABLE bills ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE bills ADD COLUMN deleted_by UUID;
    END IF;

    -- individual_customer_readings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='individual_customer_readings' AND column_name='deleted_at') THEN
        ALTER TABLE individual_customer_readings ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE individual_customer_readings ADD COLUMN deleted_by UUID;
    END IF;

    -- bulk_meter_readings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulk_meter_readings' AND column_name='deleted_at') THEN
        ALTER TABLE bulk_meter_readings ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE bulk_meter_readings ADD COLUMN deleted_by UUID;
    END IF;

    -- payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='deleted_at') THEN
        ALTER TABLE payments ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE payments ADD COLUMN deleted_by UUID;
    END IF;

    -- reports
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='deleted_at') THEN
        ALTER TABLE reports ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE reports ADD COLUMN deleted_by UUID;
    END IF;

    -- notifications
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='deleted_at') THEN
        ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE notifications ADD COLUMN deleted_by UUID;
    END IF;

    -- fault_codes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fault_codes' AND column_name='deleted_at') THEN
        ALTER TABLE fault_codes ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE fault_codes ADD COLUMN deleted_by UUID;
    END IF;

END $$;
