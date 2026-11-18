-- ============================================================================
-- Migration 047: Add PDF Attachment & Audit Fields to Knowledge Base Articles
-- Description: Ensures knowledge_base_articles table has pdf_url for document
--              attachments, and deleted_at / deleted_by for recycle bin tracking.
-- ============================================================================

DO $$
BEGIN
    -- 1. Ensure pdf_url column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_base_articles' AND column_name = 'pdf_url'
    ) THEN
        ALTER TABLE knowledge_base_articles ADD COLUMN pdf_url TEXT;
        RAISE NOTICE 'Added pdf_url column to knowledge_base_articles';
    END IF;

    -- 2. Ensure deleted_at column exists (for soft deletion / recycle bin)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_base_articles' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE knowledge_base_articles ADD COLUMN deleted_at TIMESTAMPTZ;
        RAISE NOTICE 'Added deleted_at column to knowledge_base_articles';
    END IF;

    -- 3. Ensure deleted_by column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_base_articles' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE knowledge_base_articles ADD COLUMN deleted_by TEXT;
        RAISE NOTICE 'Added deleted_by column to knowledge_base_articles';
    END IF;
END $$;
