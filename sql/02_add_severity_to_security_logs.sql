-- Add severity and details columns to security_logs table

ALTER TABLE security_logs
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Info',
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- Optional: Add a check constraint for severity if you want to enforce values at DB level
-- ALTER TABLE security_logs ADD CONSTRAINT security_logs_severity_check CHECK (severity IN ('Info', 'Warning', 'Critical'));
