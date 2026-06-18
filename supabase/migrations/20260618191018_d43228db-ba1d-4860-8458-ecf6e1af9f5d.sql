-- Enums
DO $$ BEGIN
  CREATE TYPE public.tactical_incident_type AS ENUM (
    'suspicious_activity','intrusion','trespass','theft','vandalism',
    'assault','medical','fire','evacuation','protest','vehicle','cyber','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tactical_incident_status AS ENUM ('open','investigating','contained','resolved','false_alarm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tactical_sensor_kind AS ENUM (
    'camera','motion','perimeter','badge','panic','environmental','vehicle','door','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tactical_incidents
CREATE TABLE IF NOT EXISTS public.tactical_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  incident_type public.tactical_incident_type NOT NULL DEFAULT 'other',
  severity public.crisis_severity NOT NULL DEFAULT 'medium',
  status public.tactical_incident_status NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text,
  location text,
  latitude numeric,
  longitude numeric,
  asset_id uuid REFERENCES public.crisis_assets(id) ON DELETE SET NULL,
  reported_by text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_incidents TO authenticated;
GRANT ALL ON public.tactical_incidents TO service_role;

ALTER TABLE public.tactical_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ti_select_own" ON public.tactical_incidents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ti_insert_own" ON public.tactical_incidents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ti_update_own" ON public.tactical_incidents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ti_delete_own" ON public.tactical_incidents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tactical_incidents_user_occurred
  ON public.tactical_incidents (user_id, occurred_at DESC);

CREATE TRIGGER trg_tactical_incidents_updated_at
  BEFORE UPDATE ON public.tactical_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tactical_sensor_alerts
CREATE TABLE IF NOT EXISTS public.tactical_sensor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_kind public.tactical_sensor_kind NOT NULL DEFAULT 'other',
  device_id text,
  device_name text,
  severity public.crisis_severity NOT NULL DEFAULT 'medium',
  message text NOT NULL,
  location text,
  latitude numeric,
  longitude numeric,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_sensor_alerts TO authenticated;
GRANT ALL ON public.tactical_sensor_alerts TO service_role;

ALTER TABLE public.tactical_sensor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tsa_select_own" ON public.tactical_sensor_alerts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tsa_insert_own" ON public.tactical_sensor_alerts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tsa_update_own" ON public.tactical_sensor_alerts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tsa_delete_own" ON public.tactical_sensor_alerts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tactical_sensor_alerts_user_occurred
  ON public.tactical_sensor_alerts (user_id, occurred_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tactical_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tactical_sensor_alerts;