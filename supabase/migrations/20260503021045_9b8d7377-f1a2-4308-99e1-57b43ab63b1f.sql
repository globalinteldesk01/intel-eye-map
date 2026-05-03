
CREATE TABLE public.itinerary_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  city text,
  center_lat double precision,
  center_lon double precision,
  zoom integer DEFAULT 5,
  features jsonb NOT NULL DEFAULT '{"type":"FeatureCollection","features":[]}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own itinerary maps" ON public.itinerary_maps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own itinerary maps" ON public.itinerary_maps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own itinerary maps" ON public.itinerary_maps
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own itinerary maps" ON public.itinerary_maps
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_itinerary_maps_updated_at
  BEFORE UPDATE ON public.itinerary_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_itinerary_maps_user ON public.itinerary_maps(user_id, updated_at DESC);
