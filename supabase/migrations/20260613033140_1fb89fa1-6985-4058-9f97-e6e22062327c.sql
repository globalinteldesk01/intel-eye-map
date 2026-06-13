
-- Remove duplicates by url, keeping the oldest row per url
DELETE FROM public.news_items a
USING public.news_items b
WHERE a.url = b.url
  AND a.created_at > b.created_at;

-- Hard DB-level uniqueness on url
CREATE UNIQUE INDEX IF NOT EXISTS news_items_url_unique
  ON public.news_items (url);
