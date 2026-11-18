-- ============================================================================
-- Migration 046: Login Screen Hero Copy & Styling Customization
-- Description: Ensures system_settings primary key and seeds default hero title,
--              highlighted accent, subtitle description, and design styling JSON.
-- ============================================================================

-- 1. Ensure system_settings has primary key on "key"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_pkey'
    ) THEN
        ALTER TABLE system_settings ADD PRIMARY KEY (key);
    END IF;
END $$;

-- 2. Insert or update default login hero texts and styling
INSERT INTO system_settings (key, value, updated_at)
VALUES 
    -- Headline leading title
    ('login_hero_title', 'Modernizing', NOW()),
    
    -- Highlighted accent text (with glow / underline / badge / gradient)
    ('login_hero_highlight', 'Utility Services', NOW()),
    
    -- Subtitle introductory description
    ('login_hero_description', 'Access your account, track consumption, and manage payments effortlessly in one unified portal.', NOW()),
    
    -- Design styling: font family, font weight, colors, accent style, card theme, ambient glow
    ('login_hero_styles', '{"fontFamily":"sans","fontWeight":"extrabold","headlineColor":"#ffffff","highlightColor":"#60a5fa","accentStyle":"underline","descColor":"rgba(255, 255, 255, 0.7)","cardBg":"glass","customCardBg":"","ambientGlow":"blue"}', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, 
    updated_at = NOW();
