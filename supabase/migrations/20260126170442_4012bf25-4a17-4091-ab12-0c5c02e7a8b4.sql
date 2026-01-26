-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- The trigger function already runs as SECURITY DEFINER, so it bypasses RLS
-- No additional INSERT policy needed for the trigger to work