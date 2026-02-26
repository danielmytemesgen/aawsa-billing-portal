-- Migration to add soft delete functionality
-- Add deleted_at and deleted_by to major tables

-- Branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Staff Members
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Bulk Meters
ALTER TABLE public.bulk_meters ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bulk_meters ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Individual Customers
ALTER TABLE public.individual_customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.individual_customers ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Routes
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Tariffs
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Knowledge Base Articles
ALTER TABLE public.knowledge_base_articles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.knowledge_base_articles ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff_members(id);

-- Create Recycle Bin tracking table
CREATE TABLE IF NOT EXISTS public.recycle_bin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- e.g., 'branch', 'staff', 'customer', 'bulk_meter', 'route'
    entity_id TEXT NOT NULL,   -- The ID/Key of the deleted record
    entity_name TEXT,          -- A human-readable name for the record
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    deleted_by UUID REFERENCES public.staff_members(id),
    original_data JSONB,       -- Optional: store the full record data for recovery if schema changes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_recycle_bin_entity ON public.recycle_bin(entity_type, entity_id);
