-- Drop existing conflicting functions if they exist to ensure a clean slate.
DROP FUNCTION IF EXISTS public.insert_notification(text, text, text, text);
DROP FUNCTION IF EXISTS public.insert_notification(text, text, text, uuid);

-- Create the single, correct function for inserting notifications.
-- This function accepts the target branch ID as TEXT to match the table's schema,
-- preventing type mismatch errors.
-- It is defined with SECURITY DEFINER to bypass potential row-level security
-- policy restrictions that would otherwise prevent the function from inserting rows.
CREATE OR REPLACE FUNCTION public.insert_notification(
    p_title text,
    p_message text,
    p_sender_name text,
    p_target_branch_id text DEFAULT NULL
)
RETURNS SETOF public.notifications -- Defines the structure of the returned row(s) to match the 'notifications' table.
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert the new notification into the table and return the inserted row.
    -- The target_branch_id is returned as-is (text) to match the table column type.
    RETURN QUERY
    INSERT INTO public.notifications (title, message, sender_name, target_branch_id)
    VALUES (p_title, p_message, p_sender_name, p_target_branch_id)
    RETURNING id, created_at, title, message, sender_name, target_branch_id;
END;
$$;
