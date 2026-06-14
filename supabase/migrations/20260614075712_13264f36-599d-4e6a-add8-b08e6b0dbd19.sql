
-- Revoke EXECUTE on internal trigger / helper SECURITY DEFINER functions
-- from anon and authenticated. Triggers run as table owner and do not need
-- explicit EXECUTE grants. service_role is unaffected (bypasses).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_intel() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fanout_travel_alerts() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fanout_protective_alerts() FROM anon, authenticated, PUBLIC;
