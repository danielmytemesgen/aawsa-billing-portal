-- 1. Create table
CREATE TABLE public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Insert Default Billing Cycle Information
INSERT INTO public.system_settings (key, value) VALUES
    ('billing_cycle_mode', 'once_per_month'),
    ('billing_cycle_start_day', '16'),
    ('billing_due_date_offset', '15')
ON CONFLICT (key) DO NOTHING;
