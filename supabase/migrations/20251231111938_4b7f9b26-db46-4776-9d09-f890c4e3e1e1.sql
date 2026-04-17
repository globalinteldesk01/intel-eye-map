-- Add RLS policies for notifications INSERT and DELETE
-- Using service-role approach: regular users cannot INSERT notifications (system-generated only)
-- But users can DELETE their own notifications for cleanup

-- Create DELETE policy for users to remove their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Note: No INSERT policy is added intentionally - notifications should be 
-- created by backend/edge functions using service_role key, not by users directly.
-- This prevents notification spam and fake notification attacks.