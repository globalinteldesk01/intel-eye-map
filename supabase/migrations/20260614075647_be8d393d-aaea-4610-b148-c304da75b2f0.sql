
-- 1) Drop overly permissive INSERT policy on protective_alerts (public, true).
--    Service-role bypasses RLS; legitimate alerts come from the fanout trigger.
DROP POLICY IF EXISTS alerts_insert_system ON public.protective_alerts;

-- 2) Restrict profiles SELECT to authenticated users only (was public/true).
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 3) Add a DELETE policy on crisis_user_settings so users can remove their settings.
DROP POLICY IF EXISTS "Users can delete their own crisis settings" ON public.crisis_user_settings;
CREATE POLICY "Users can delete their own crisis settings"
  ON public.crisis_user_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4) Lock down SECURITY DEFINER admin/maintenance functions from anon (linter warn).
REVOKE EXECUTE ON FUNCTION public.cleanup_old_news_items() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_intel_tokens(integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_intel_tokens(integer) TO authenticated, service_role;

-- Helper role-check functions: keep callable by authenticated only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_client_assignment() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_can_see(text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_client_assignment() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_can_see(text, text) TO authenticated, service_role;
