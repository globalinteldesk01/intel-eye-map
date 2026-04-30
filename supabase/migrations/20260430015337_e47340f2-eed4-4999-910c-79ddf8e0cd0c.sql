
-- 1. client_assignments table
CREATE TABLE public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL UNIQUE,
  analyst_user_id uuid NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  services text[] NOT NULL DEFAULT '{intel_feed,alerts,briefings,travel,bespoke}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_client_assignments_updated_at
BEFORE UPDATE ON public.client_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Publishing fields on news_items
ALTER TABLE public.news_items
  ADD COLUMN is_published_to_clients boolean NOT NULL DEFAULT false,
  ADD COLUMN published_to_clients_at timestamptz,
  ADD COLUMN published_by uuid;

CREATE INDEX idx_news_items_published_clients
  ON public.news_items (is_published_to_clients, published_to_clients_at DESC)
  WHERE is_published_to_clients = true;

-- 3. briefing_requests table
CREATE TABLE public.briefing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  title text NOT NULL,
  scope text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  deadline date,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  analyst_user_id uuid,
  response_notes text,
  response_report_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.briefing_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_briefing_requests_updated_at
BEFORE UPDATE ON public.briefing_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Helper: get current client assignment row (security definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_client_assignment()
RETURNS TABLE(countries text[], regions text[], services text[], is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT countries, regions, services, is_active
  FROM public.client_assignments
  WHERE client_user_id = auth.uid()
  LIMIT 1;
$$;

-- 5. Helper: can current client see a given country/region?
CREATE OR REPLACE FUNCTION public.client_can_see(_country text, _region text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_assignments ca
    WHERE ca.client_user_id = auth.uid()
      AND ca.is_active = true
      AND (
        _country = ANY(ca.countries)
        OR _region = ANY(ca.regions)
      )
  );
$$;

-- 6. RLS: client_assignments
CREATE POLICY "Clients view own assignment"
ON public.client_assignments FOR SELECT TO authenticated
USING (auth.uid() = client_user_id);

CREATE POLICY "Analysts view all assignments"
ON public.client_assignments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'analyst'::app_role));

CREATE POLICY "Analysts insert assignments"
ON public.client_assignments FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'analyst'::app_role) AND auth.uid() = analyst_user_id);

CREATE POLICY "Analysts update assignments"
ON public.client_assignments FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'analyst'::app_role));

CREATE POLICY "Analysts delete assignments"
ON public.client_assignments FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'analyst'::app_role));

-- 7. RLS: news_items — replace open SELECT with role-aware policy
DROP POLICY IF EXISTS "Authenticated users can view all news items" ON public.news_items;

CREATE POLICY "Analysts view all news items"
ON public.news_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'analyst'::app_role));

CREATE POLICY "Clients view published assigned news items"
ON public.news_items FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND is_published_to_clients = true
  AND public.client_can_see(country, region)
);

-- 8. RLS: briefing_requests
CREATE POLICY "Clients view own briefing requests"
ON public.briefing_requests FOR SELECT TO authenticated
USING (auth.uid() = client_user_id);

CREATE POLICY "Clients create own briefing requests"
ON public.briefing_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = client_user_id AND has_role(auth.uid(), 'client'::app_role));

CREATE POLICY "Analysts view all briefing requests"
ON public.briefing_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'analyst'::app_role));

CREATE POLICY "Analysts update briefing requests"
ON public.briefing_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'analyst'::app_role));
