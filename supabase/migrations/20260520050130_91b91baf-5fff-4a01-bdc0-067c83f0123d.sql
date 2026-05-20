
-- ============ protective_geofences ============
CREATE TABLE public.protective_geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  shape text NOT NULL DEFAULT 'circle' CHECK (shape IN ('circle','polygon')),
  center_lat numeric,
  center_lon numeric,
  radius_km numeric DEFAULT 10,
  polygon jsonb,
  min_severity crisis_severity NOT NULL DEFAULT 'medium',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.protective_geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofences_select_own" ON public.protective_geofences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "geofences_insert_own" ON public.protective_geofences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "geofences_update_own" ON public.protective_geofences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "geofences_delete_own" ON public.protective_geofences FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_geofences_updated BEFORE UPDATE ON public.protective_geofences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ protective_alerts ============
CREATE TABLE public.protective_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('asset','traveler','geofence')),
  source_id uuid,
  source_name text NOT NULL DEFAULT '',
  severity crisis_severity NOT NULL DEFAULT 'medium',
  distance_km numeric,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, source_kind, source_id)
);
ALTER TABLE public.protective_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select_own" ON public.protective_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alerts_update_own" ON public.protective_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "alerts_delete_own" ON public.protective_alerts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "alerts_insert_system" ON public.protective_alerts FOR INSERT WITH CHECK (true);
CREATE INDEX idx_protective_alerts_user_created ON public.protective_alerts(user_id, created_at DESC);

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public._haversine_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  r constant numeric := 6371;
  dlat numeric; dlon numeric; a numeric;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN RETURN NULL; END IF;
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END $$;

CREATE OR REPLACE FUNCTION public._severity_rank(s crisis_severity)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE s WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public._point_in_polygon(plat numeric, plon numeric, poly jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  ring jsonb;
  n int;
  i int;
  j int;
  xi numeric; yi numeric; xj numeric; yj numeric;
  inside boolean := false;
BEGIN
  IF poly IS NULL OR plat IS NULL OR plon IS NULL THEN RETURN false; END IF;
  -- Accept either a GeoJSON Polygon { coordinates: [[[lon,lat],...]] } or a raw ring
  IF jsonb_typeof(poly) = 'object' AND poly ? 'coordinates' THEN
    ring := poly->'coordinates'->0;
  ELSE
    ring := poly;
  END IF;
  IF ring IS NULL OR jsonb_typeof(ring) <> 'array' THEN RETURN false; END IF;
  n := jsonb_array_length(ring);
  IF n < 3 THEN RETURN false; END IF;
  j := n - 1;
  FOR i IN 0..n-1 LOOP
    xi := (ring->i->>0)::numeric; yi := (ring->i->>1)::numeric;
    xj := (ring->j->>0)::numeric; yj := (ring->j->>1)::numeric;
    IF ((yi > plat) <> (yj > plat)) AND (plon < (xj - xi) * (plat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;
  RETURN inside;
END $$;

-- ============ fanout trigger ============
CREATE OR REPLACE FUNCTION public.fanout_protective_alerts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev_rank int;
  r RECORD;
  dist numeric;
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN RETURN NEW; END IF;
  ev_rank := public._severity_rank(NEW.severity);

  -- Assets
  FOR r IN SELECT a.* FROM public.crisis_assets a LOOP
    dist := public._haversine_km(NEW.latitude, NEW.longitude, r.latitude, r.longitude);
    IF dist IS NOT NULL AND dist <= r.radius_km THEN
      INSERT INTO public.protective_alerts (user_id, event_id, source_kind, source_id, source_name, severity, distance_km)
      VALUES (r.user_id, NEW.id, 'asset', r.id, r.name, NEW.severity, dist)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Geofences
  FOR r IN SELECT g.* FROM public.protective_geofences g WHERE g.is_active = true LOOP
    IF ev_rank < public._severity_rank(r.min_severity) THEN CONTINUE; END IF;
    IF r.shape = 'circle' THEN
      dist := public._haversine_km(NEW.latitude, NEW.longitude, r.center_lat, r.center_lon);
      IF dist IS NOT NULL AND dist <= COALESCE(r.radius_km, 10) THEN
        INSERT INTO public.protective_alerts (user_id, event_id, source_kind, source_id, source_name, severity, distance_km)
        VALUES (r.user_id, NEW.id, 'geofence', r.id, r.name, NEW.severity, dist)
        ON CONFLICT DO NOTHING;
      END IF;
    ELSIF r.shape = 'polygon' THEN
      IF public._point_in_polygon(NEW.latitude, NEW.longitude, r.polygon) THEN
        INSERT INTO public.protective_alerts (user_id, event_id, source_kind, source_id, source_name, severity, distance_km)
        VALUES (r.user_id, NEW.id, 'geofence', r.id, r.name, NEW.severity, NULL)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- Travelers (active travel_monitors)
  FOR r IN SELECT tm.* FROM public.travel_monitors tm WHERE tm.status = 'active' LOOP
    IF ev_rank < public._severity_rank(r.severity_threshold::crisis_severity) THEN CONTINUE; END IF;
    -- Match if event location matches monitor's country (best-effort using location text)
    IF NEW.location IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(r.countries) c WHERE NEW.location ILIKE '%' || c || '%'
    ) THEN
      INSERT INTO public.protective_alerts (user_id, event_id, source_kind, source_id, source_name, severity, distance_km)
      VALUES (r.user_id, NEW.id, 'traveler', r.id, r.name, NEW.severity, NULL)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fanout_protective_alerts ON public.crisis_events;
CREATE TRIGGER trg_fanout_protective_alerts
AFTER INSERT OR UPDATE ON public.crisis_events
FOR EACH ROW EXECUTE FUNCTION public.fanout_protective_alerts();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.protective_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.protective_geofences;
