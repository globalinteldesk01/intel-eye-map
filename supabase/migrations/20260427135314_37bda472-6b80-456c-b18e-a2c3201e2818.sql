
-- Travel Itineraries
CREATE TABLE public.travel_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  traveler_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own itineraries" ON public.travel_itineraries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own itineraries" ON public.travel_itineraries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own itineraries" ON public.travel_itineraries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own itineraries" ON public.travel_itineraries
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_itineraries_updated
  BEFORE UPDATE ON public.travel_itineraries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itinerary destinations
CREATE TABLE public.itinerary_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES public.travel_itineraries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own destinations" ON public.itinerary_destinations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own destinations" ON public.itinerary_destinations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own destinations" ON public.itinerary_destinations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own destinations" ON public.itinerary_destinations
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_itinerary_dest_itin ON public.itinerary_destinations(itinerary_id);
CREATE INDEX idx_itinerary_dest_country ON public.itinerary_destinations(country);

-- Travel alerts
CREATE TABLE public.travel_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  itinerary_id UUID REFERENCES public.travel_itineraries(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES public.itinerary_destinations(id) ON DELETE CASCADE,
  news_item_id UUID REFERENCES public.news_items(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'pre-travel',
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own travel alerts" ON public.travel_alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own travel alerts" ON public.travel_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own travel alerts" ON public.travel_alerts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own travel alerts" ON public.travel_alerts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_travel_alerts_user ON public.travel_alerts(user_id, created_at DESC);

-- Sam AI chats
CREATE TABLE public.sam_ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sam_ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sam chats" ON public.sam_ai_chats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sam chats" ON public.sam_ai_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sam chats" ON public.sam_ai_chats
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_sam_chats_conv ON public.sam_ai_chats(user_id, conversation_id, created_at);
