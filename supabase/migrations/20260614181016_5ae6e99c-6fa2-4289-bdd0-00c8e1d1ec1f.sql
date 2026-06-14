ALTER FUNCTION public.news_items_tsv(text, text, text, text, text, text, text[]) SET search_path = public;

CREATE OR REPLACE FUNCTION public.search_news_items(_query text, _limit int DEFAULT 100)
RETURNS SETOF public.news_items
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT n.*
  FROM public.news_items n,
       plainto_tsquery('simple'::regconfig, coalesce(_query, '')) q
  WHERE _query IS NOT NULL
    AND btrim(_query) <> ''
    AND n.search_vector @@ q
    AND n.published_at > now() - interval '30 days'
  ORDER BY ts_rank(n.search_vector, q) DESC,
           n.published_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 100), 500));
$$;

CREATE OR REPLACE FUNCTION public.breaking_news_items(_limit int DEFAULT 8)
RETURNS SETOF public.news_items
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT n.*
  FROM public.news_items n
  WHERE n.threat_level IN ('critical', 'high')
    AND coalesce(n.published_at, n.created_at) > now() - interval '60 minutes'
  ORDER BY coalesce(n.published_at, n.created_at) DESC
  LIMIT greatest(1, least(coalesce(_limit, 8), 25));
$$;

REVOKE EXECUTE ON FUNCTION public.search_news_items(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_news_items(text, int) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.breaking_news_items(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.breaking_news_items(int) TO authenticated, service_role;