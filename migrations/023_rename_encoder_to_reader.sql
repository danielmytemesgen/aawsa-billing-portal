-- =================================================================
-- AAWSA BILLING PORTAL: MIGRATION - ENCODER TO READER
-- Description: Renames 'encoder_id' to 'reader_id' in routes table
--              and renames/creates the 'Reader' role.
-- =================================================================

DO $$
BEGIN
    -- 1. Rename column in routes table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'routes' 
        AND column_name = 'encoder_id'
    ) THEN
        ALTER TABLE public.routes RENAME COLUMN encoder_id TO reader_id;
    END IF;

    -- 2. Rename 'Encoder' role to 'Reader' if it exists
    IF EXISTS (SELECT 1 FROM public.roles WHERE role_name = 'Encoder') THEN
        UPDATE public.roles SET role_name = 'Reader' WHERE role_name = 'Encoder';
    ELSE
        -- Create 'Reader' role if no 'Encoder' exists to rename
        INSERT INTO public.roles (role_name, description)
        VALUES ('Reader', 'Staff member responsible for reading and recording water meter values.')
        ON CONFLICT (role_name) DO NOTHING;
    END IF;
END $$;
