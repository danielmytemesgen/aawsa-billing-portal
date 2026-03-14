-- Ensure category column exists in fault_codes table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fault_codes' AND column_name='category') THEN
        ALTER TABLE fault_codes ADD COLUMN category VARCHAR(100);
    END IF;
END $$;
