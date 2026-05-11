
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS destination_country text,
  ADD COLUMN IF NOT EXISTS destination_city text,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'Business',
  ADD COLUMN IF NOT EXISTS assessment jsonb,
  ADD COLUMN IF NOT EXISTS alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS debrief text;

-- Make traveler_name not null with a sane default for any legacy rows
UPDATE public.travel_itineraries SET traveler_name = COALESCE(traveler_name, 'Unspecified') WHERE traveler_name IS NULL;

ALTER TABLE public.travel_itineraries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='travel_itineraries' AND policyname='itineraries_select_own') THEN
    CREATE POLICY "itineraries_select_own" ON public.travel_itineraries FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='travel_itineraries' AND policyname='itineraries_insert_own') THEN
    CREATE POLICY "itineraries_insert_own" ON public.travel_itineraries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='travel_itineraries' AND policyname='itineraries_update_own') THEN
    CREATE POLICY "itineraries_update_own" ON public.travel_itineraries FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='travel_itineraries' AND policyname='itineraries_delete_own') THEN
    CREATE POLICY "itineraries_delete_own" ON public.travel_itineraries FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
