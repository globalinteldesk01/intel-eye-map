
-- ============== travel_monitors ==============
CREATE TABLE public.travel_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  itinerary_map_id uuid NOT NULL REFERENCES public.itinerary_maps(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Active Monitor',
  countries text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  severity_threshold text NOT NULL DEFAULT 'elevated',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_travel_monitors_user ON public.travel_monitors(user_id, status);
CREATE INDEX idx_travel_monitors_active_countries ON public.travel_monitors USING GIN(countries) WHERE status = 'active';
ALTER TABLE public.travel_monitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitors_select_own" ON public.travel_monitors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "monitors_insert_own" ON public.travel_monitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "monitors_update_own" ON public.travel_monitors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "monitors_delete_own" ON public.travel_monitors FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_travel_monitors_updated BEFORE UPDATE ON public.travel_monitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== trip_assessments ==============
CREATE TABLE public.trip_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  itinerary_map_id uuid NOT NULL REFERENCES public.itinerary_maps(id) ON DELETE CASCADE,
  phase text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_assessments_map ON public.trip_assessments(itinerary_map_id, created_at DESC);
ALTER TABLE public.trip_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessments_select_own" ON public.trip_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "assessments_insert_own" ON public.trip_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "assessments_update_own" ON public.trip_assessments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "assessments_delete_own" ON public.trip_assessments FOR DELETE USING (auth.uid() = user_id);

-- ============== fan-out trigger on news_items ==============
CREATE OR REPLACE FUNCTION public.fanout_travel_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  sev_order int;
  th_order int;
BEGIN
  IF NEW.country IS NULL THEN RETURN NEW; END IF;
  sev_order := CASE NEW.threat_level
    WHEN 'critical' THEN 4
    WHEN 'high' THEN 3
    WHEN 'elevated' THEN 2
    ELSE 1 END;

  FOR m IN
    SELECT * FROM public.travel_monitors
    WHERE status = 'active' AND NEW.country = ANY(countries)
  LOOP
    th_order := CASE m.severity_threshold
      WHEN 'critical' THEN 4
      WHEN 'high' THEN 3
      WHEN 'elevated' THEN 2
      ELSE 1 END;
    IF sev_order >= th_order THEN
      INSERT INTO public.travel_alerts (
        user_id, news_item_id, alert_type, severity, title, message
      ) VALUES (
        m.user_id,
        NEW.id,
        'in-trip',
        NEW.threat_level::text,
        UPPER(NEW.threat_level::text) || ' · ' || NEW.country || ' — ' || LEFT(NEW.title, 120),
        '[' || COALESCE(NEW.token, 'NEW') || '] ' || COALESCE(LEFT(NEW.summary, 240), '')
      );
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fanout_travel_alerts ON public.news_items;
CREATE TRIGGER trg_fanout_travel_alerts
  AFTER INSERT ON public.news_items
  FOR EACH ROW EXECUTE FUNCTION public.fanout_travel_alerts();

-- ============== realtime ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.travel_alerts;
ALTER TABLE public.travel_alerts REPLICA IDENTITY FULL;
