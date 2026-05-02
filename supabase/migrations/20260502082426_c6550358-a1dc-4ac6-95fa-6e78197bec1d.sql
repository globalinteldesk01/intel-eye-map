-- Helper: is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- user_roles
DROP POLICY IF EXISTS "Super admins view all roles" ON public.user_roles;
CREATE POLICY "Super admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins insert roles" ON public.user_roles;
CREATE POLICY "Super admins insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update roles" ON public.user_roles;
CREATE POLICY "Super admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete roles" ON public.user_roles;
CREATE POLICY "Super admins delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- profiles
DROP POLICY IF EXISTS "Super admins update any profile" ON public.profiles;
CREATE POLICY "Super admins update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- client_assignments
DROP POLICY IF EXISTS "Super admins view assignments" ON public.client_assignments;
CREATE POLICY "Super admins view assignments"
  ON public.client_assignments FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins insert assignments" ON public.client_assignments;
CREATE POLICY "Super admins insert assignments"
  ON public.client_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update assignments" ON public.client_assignments;
CREATE POLICY "Super admins update assignments"
  ON public.client_assignments FOR UPDATE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete assignments" ON public.client_assignments;
CREATE POLICY "Super admins delete assignments"
  ON public.client_assignments FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- news_items
DROP POLICY IF EXISTS "Super admins view all news" ON public.news_items;
CREATE POLICY "Super admins view all news"
  ON public.news_items FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update news" ON public.news_items;
CREATE POLICY "Super admins update news"
  ON public.news_items FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- briefing_requests
DROP POLICY IF EXISTS "Super admins view briefing requests" ON public.briefing_requests;
CREATE POLICY "Super admins view briefing requests"
  ON public.briefing_requests FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update briefing requests" ON public.briefing_requests;
CREATE POLICY "Super admins update briefing requests"
  ON public.briefing_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin());