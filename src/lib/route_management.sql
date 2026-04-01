/* 
  Route Management Database Schema
  AAWSA Billing Portal - 2026
*/

-- 1. Create the 'routes' table if it doesn't exist
CREATE TABLE IF NOT EXISTS routes (
    route_key VARCHAR(50) PRIMARY KEY,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    reader_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add 'status' column if table exists but column is missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='status') THEN
        ALTER TABLE routes ADD COLUMN status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived'));
    END IF;
END $$;

-- 3. Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_routes_branch_id ON routes(branch_id);
CREATE INDEX IF NOT EXISTS idx_routes_reader_id ON routes(reader_id);

-- 4. Audit Trigger for updated_at
CREATE OR REPLACE FUNCTION update_routes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER trg_update_routes_timestamp
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_routes_timestamp();

COMMENT ON TABLE routes IS 'Stores geographic reading zones and their assignments to branches and staff.';
