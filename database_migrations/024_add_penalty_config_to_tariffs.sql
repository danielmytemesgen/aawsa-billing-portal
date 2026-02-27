-- Migration: 024_add_penalty_config_to_tariffs
-- Description: Adds penalty configuration fields to the tariffs table.

ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS penalty_month_threshold INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS bank_lending_rate NUMERIC(6,4) DEFAULT 0.1500,
ADD COLUMN IF NOT EXISTS penalty_tiered_rates JSONB DEFAULT '[
    {"month": 3, "rate": 0.00},
    {"month": 4, "rate": 0.10},
    {"month": 5, "rate": 0.15},
    {"month": 6, "rate": 0.20}
]'::jsonb;
