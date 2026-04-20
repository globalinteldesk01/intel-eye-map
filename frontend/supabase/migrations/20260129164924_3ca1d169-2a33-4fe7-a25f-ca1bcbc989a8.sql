-- Revoke cleanup function access from authenticated users (was too permissive)
-- This function should only be called by pg_cron via service_role
REVOKE EXECUTE ON FUNCTION public.cleanup_old_news_items() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_news_items() FROM PUBLIC;

-- Ensure only service_role can execute (for automated pg_cron cleanup)
GRANT EXECUTE ON FUNCTION public.cleanup_old_news_items() TO service_role;