CREATE TABLE IF NOT EXISTS fault_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger for updated_at
CREATE TRIGGER update_fault_codes_modtime
    BEFORE UPDATE ON fault_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
