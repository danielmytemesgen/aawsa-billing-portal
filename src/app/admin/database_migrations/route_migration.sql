-- Migration to add Route Key and Encoder Assignment

-- 1. Create the routes table
CREATE TABLE IF NOT EXISTS public.routes (
    route_key TEXT PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    encoder_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Add ROUTE_KEY to bulk_meters
-- We check if it exists first to avoid errors during re-runs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bulk_meters' AND column_name='ROUTE_KEY') THEN
        ALTER TABLE public.bulk_meters ADD COLUMN "ROUTE_KEY" TEXT REFERENCES public.routes(route_key) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Add trigger for updated_at on routes
CREATE TRIGGER update_routes_modtime 
    BEFORE UPDATE ON public.routes 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();
