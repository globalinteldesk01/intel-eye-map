-- Immutable helper wrapping the full-text vector build so we can use it in a generated column.
CREATE OR REPLACE FUNCTION public.news_items_tsv(
  _title text, _ai_summary text, _summary text,
  _country text, _region text, _city text, _tags text[]
)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('simple'::regconfig, coalesce(_title, '')), 'A')
       || setweight(to_tsvector('simple'::regconfig, coalesce(_ai_summary, '')), 'A')
       || setweight(to_tsvector('simple'::regconfig, coalesce(_summary, '')), 'B')
       || setweight(to_tsvector('simple'::regconfig, coalesce(_country, '')), 'C')
       || setweight(to_tsvector('simple'::regconfig, coalesce(_region, '')), 'C')
       || setweight(to_tsvector('simple'::regconfig, coalesce(_city, '')), 'C')
       || setweight(to_tsvector('simple'::regconfig, array_to_string(coalesce(_tags, '{}'::text[]), ' ')), 'D');
$$;

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    public.news_items_tsv(title, ai_summary, summary, country, region, city, tags)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_news_items_search_vector
  ON public.news_items USING gin (search_vector);

-- Ranked search RPC scoped to the last 30 days.
CREATE OR REPLACE FUNCTION public.search_news_items(_query text, _limit int DEFAULT 100)
RETURNS SETOF public.news_items
LANGUAGE sql
STABLE
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.search_news_items(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_news_items(text, int) TO authenticated, service_role;

-- Breaking Now RPC — last 60 minutes, high/critical only.
CREATE OR REPLACE FUNCTION public.breaking_news_items(_limit int DEFAULT 8)
RETURNS SETOF public.news_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.*
  FROM public.news_items n
  WHERE n.threat_level IN ('critical', 'high')
    AND coalesce(n.published_at, n.created_at) > now() - interval '60 minutes'
  ORDER BY coalesce(n.published_at, n.created_at) DESC
  LIMIT greatest(1, least(coalesce(_limit, 8), 25));
$$;

REVOKE EXECUTE ON FUNCTION public.breaking_news_items(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.breaking_news_items(int) TO authenticated, service_role;