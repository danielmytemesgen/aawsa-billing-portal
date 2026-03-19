
-- This function securely inserts a new notification.
-- The SECURITY DEFINER clause is crucial; it allows this function to bypass RLS policies
-- on the notifications table for the INSERT operation, ensuring the notification is always saved.
-- Read access is still governed by RLS policies based on the user viewing the notifications.

CREATE OR REPLACE FUNCTION public.insert_notification(
    p_title text,
    p_message text,
    p_sender_name text,
    p_target_branch_id text -- The branch ID can be null for "All Staff"
)
RETURNS notifications -- This specifies the return type to match the table row
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inserted_notification notifications%ROWTYPE;
BEGIN
    -- This function's primary purpose is to abstract the insert.
    -- The RLS policy for INSERT on the 'notifications' table checks if the calling
    -- user has the 'notifications_create' permission.
    INSERT INTO public.notifications (title, message, sender_name, target_branch_id)
    VALUES (p_title, p_message, p_sender_name, p_target_branch_id)
    RETURNING * INTO inserted_notification;
    
    RETURN inserted_notification;
END;
$$;

-- Grant permission to any user to call this function.
-- Actual permission to insert is still checked by the RLS policy on the table.
GRANT EXECUTE ON FUNCTION public.insert_notification(text, text, text, text) TO public;
