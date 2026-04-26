
-- Create enums for CrisisWatch
CREATE TYPE public.crisis_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.crisis_status AS ENUM ('new', 'verified', 'active', 'resolved');
CREATE TYPE public.crisis_category AS ENUM ('Social', 'News', 'GovAlert', 'Weather', 'Traffic');
CREATE TYPE public.crisis_pipeline_stage AS ENUM ('ingestion', 'classified', 'geotagged', 'verified');
CREATE TYPE public.crisis_asset_type AS ENUM ('office', 'warehouse', 'employee', 'supplier');

-- Crisis Events table
CREATE TABLE public.crisis_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  latitude NUMERIC NOT NULL DEFAULT 0,
  longitude NUMERIC NOT NULL DEFAULT 0,
  category public.crisis_category NOT NULL DEFAULT 'News',
  source_type TEXT NOT NULL DEFAULT 'RSS',
  severity public.crisis_severity NOT NULL DEFAULT 'low',
  status public.crisis_status NOT NULL DEFAULT 'new',
  confidence INTEGER NOT NULL DEFAULT 50,
  sources_count INTEGER NOT NULL DEFAULT 1,
  affected_area TEXT DEFAULT '',
  impacts TEXT[] NOT NULL DEFAULT '{}',
  actions TEXT[] NOT NULL DEFAULT '{}',
  pipeline_stage public.crisis_pipeline_stage NOT NULL DEFAULT 'ingestion',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view crisis events"
  ON public.crisis_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Analysts can insert crisis events"
  ON public.crisis_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'analyst'));

CREATE POLICY "Analysts can update crisis events"
  ON public.crisis_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'analyst'));

CREATE POLICY "Analysts can delete crisis events"
  ON public.crisis_events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'analyst'));

CREATE TRIGGER update_crisis_events_updated_at
  BEFORE UPDATE ON public.crisis_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crisis Assets table
CREATE TABLE public.crisis_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  latitude NUMERIC NOT NULL DEFAULT 0,
  longitude NUMERIC NOT NULL DEFAULT 0,
  radius_km NUMERIC NOT NULL DEFAULT 5,
  type public.crisis_asset_type NOT NULL DEFAULT 'office',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crisis_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets"
  ON public.crisis_assets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON public.crisis_assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON public.crisis_assets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON public.crisis_assets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Crisis Alert History table
CREATE TABLE public.crisis_alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.crisis_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crisis_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history"
  ON public.crisis_alert_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert alert history"
  ON public.crisis_alert_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Crisis User Settings table
CREATE TABLE public.crisis_user_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  email TEXT DEFAULT '',
  slack_webhook TEXT DEFAULT '',
  sms_number TEXT DEFAULT '',
  regions TEXT[] NOT NULL DEFAULT '{}',
  min_severity public.crisis_severity NOT NULL DEFAULT 'medium',
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_sms BOOLEAN NOT NULL DEFAULT false,
  notify_slack BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crisis_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.crisis_user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.crisis_user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.crisis_user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_crisis_user_settings_updated_at
  BEFORE UPDATE ON public.crisis_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for crisis_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.crisis_events;

-- Index for performance
CREATE INDEX idx_crisis_events_severity ON public.crisis_events(severity);
CREATE INDEX idx_crisis_events_status ON public.crisis_events(status);
CREATE INDEX idx_crisis_events_pipeline_stage ON public.crisis_events(pipeline_stage);
CREATE INDEX idx_crisis_events_category ON public.crisis_events(category);
CREATE INDEX idx_crisis_events_created_at ON public.crisis_events(created_at DESC);
CREATE INDEX idx_crisis_assets_user_id ON public.crisis_assets(user_id);
