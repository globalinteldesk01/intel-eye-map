
-- Enrichment fields on news_items
ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS original_title text,
  ADD COLUMN IF NOT EXISTS original_language text,
  ADD COLUMN IF NOT EXISTS severity_score integer,
  ADD COLUMN IF NOT EXISTS threat_type text,
  ADD COLUMN IF NOT EXISTS actors text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS targets text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS casualties jsonb,
  ADD COLUMN IF NOT EXISTS incident_id uuid,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_news_items_enriched_at ON public.news_items(enriched_at);
CREATE INDEX IF NOT EXISTS idx_news_items_incident_id ON public.news_items(incident_id);
CREATE INDEX IF NOT EXISTS idx_news_items_country_published ON public.news_items(country, published_at DESC);

-- Incidents table
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text DEFAULT '',
  threat_type text,
  country text,
  city text,
  region text,
  lat numeric,
  lon numeric,
  severity_max integer DEFAULT 0,
  item_count integer DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view incidents" ON public.incidents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Analysts insert incidents" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'analyst'::app_role));
CREATE POLICY "Analysts update incidents" ON public.incidents
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'analyst'::app_role));
CREATE POLICY "Analysts delete incidents" ON public.incidents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'analyst'::app_role));

CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Country advisories table
CREATE TABLE IF NOT EXISTS public.country_advisories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text UNIQUE NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  risk_score integer NOT NULL DEFAULT 0,
  key_threats jsonb NOT NULL DEFAULT '[]'::jsonb,
  regions_to_avoid jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  narrative text NOT NULL DEFAULT '',
  source_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.country_advisories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view advisories" ON public.country_advisories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Analysts insert advisories" ON public.country_advisories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'analyst'::app_role));
CREATE POLICY "Analysts update advisories" ON public.country_advisories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'analyst'::app_role));
CREATE POLICY "Analysts delete advisories" ON public.country_advisories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'analyst'::app_role));

CREATE TRIGGER country_advisories_updated_at BEFORE UPDATE ON public.country_advisories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
