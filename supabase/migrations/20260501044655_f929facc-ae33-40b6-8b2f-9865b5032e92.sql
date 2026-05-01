ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS city text;
CREATE INDEX IF NOT EXISTS idx_news_items_city ON public.news_items(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_items_country_city ON public.news_items(country, city) WHERE city IS NOT NULL;