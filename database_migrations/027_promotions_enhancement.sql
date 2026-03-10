-- Database migration to enhance promotions table with custom display duration and image support

-- Add display_duration (in milliseconds)
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS display_duration integer DEFAULT 5000;

-- Add image_url
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS image_url text;

-- Add comment for clarity
COMMENT ON COLUMN public.promotions.display_duration IS 'Duration in milliseconds for which the promotion is displayed in the carousel';
COMMENT ON COLUMN public.promotions.image_url IS 'Optional URL for a promotional image to display alongside or instead of the icon';
