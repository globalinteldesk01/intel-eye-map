CREATE OR REPLACE FUNCTION public.generate_intel_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  year_str text;
  seq_num bigint;
  next_token text;
BEGIN
  IF NEW.token IS NOT NULL AND btrim(NEW.token) <> '' THEN
    RETURN NEW;
  END IF;

  year_str := to_char(now(), 'YYYY');

  LOOP
    seq_num := nextval('public.intel_token_seq') % 100000000;
    next_token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.news_items ni WHERE ni.token = next_token
    );
  END LOOP;

  NEW.token := next_token;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_intel_tokens(_count integer)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tokens text[] := ARRAY[]::text[];
  year_str text := to_char(now(), 'YYYY');
  seq_num bigint;
  next_token text;
  i integer;
BEGIN
  IF _count IS NULL OR _count <= 0 THEN
    RETURN tokens;
  END IF;

  IF _count > 500 THEN
    RAISE EXCEPTION 'Cannot reserve more than 500 intel tokens at once';
  END IF;

  FOR i IN 1.._count LOOP
    LOOP
      seq_num := nextval('public.intel_token_seq') % 100000000;
      next_token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.news_items ni WHERE ni.token = next_token
      ) AND NOT next_token = ANY(tokens);
    END LOOP;

    tokens := array_append(tokens, next_token);
  END LOOP;

  RETURN tokens;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ingest_news_items(_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RETURN 0;
  END IF;

  WITH payload AS (
    SELECT *
    FROM jsonb_to_recordset(_items) AS x(
      actor_type public.actor_type,
      category public.news_category,
      city text,
      confidence_level public.confidence_level,
      confidence_score numeric,
      country text,
      lat numeric,
      lon numeric,
      published_at timestamptz,
      region text,
      source text,
      source_credibility public.source_credibility,
      summary text,
      tags text[],
      threat_level public.threat_level,
      title text,
      url text,
      user_id uuid,
      ai_summary text,
      original_title text,
      original_language text,
      severity_score integer,
      threat_type text,
      actors text[],
      targets text[],
      casualties jsonb
    )
  ), inserted AS (
    INSERT INTO public.news_items (
      actor_type, category, city, confidence_level, confidence_score, country, lat, lon,
      published_at, region, source, source_credibility, summary, tags, threat_level,
      title, url, user_id, ai_summary, original_title, original_language,
      severity_score, threat_type, actors, targets, casualties
    )
    SELECT
      COALESCE(p.actor_type, 'organization'::public.actor_type),
      COALESCE(p.category, 'security'::public.news_category),
      p.city,
      COALESCE(p.confidence_level, 'developing'::public.confidence_level),
      ROUND(GREATEST(0.01, LEAST(0.99, COALESCE(p.confidence_score, 0.5)))::numeric, 2),
      COALESCE(NULLIF(p.country, ''), 'Global'),
      ROUND(GREATEST(-89.9999, LEAST(89.9999, COALESCE(p.lat, 0)))::numeric, 4),
      ROUND(GREATEST(-179.9999, LEAST(179.9999, COALESCE(p.lon, 0)))::numeric, 4),
      COALESCE(p.published_at, now()),
      COALESCE(NULLIF(p.region, ''), 'Global'),
      COALESCE(NULLIF(p.source, ''), 'Open Source'),
      COALESCE(p.source_credibility, 'medium'::public.source_credibility),
      COALESCE(NULLIF(p.summary, ''), p.title, 'Open source intelligence item'),
      COALESCE(p.tags, '{}'::text[]),
      COALESCE(p.threat_level, 'low'::public.threat_level),
      COALESCE(NULLIF(p.title, ''), 'Untitled intelligence item'),
      p.url,
      p.user_id,
      p.ai_summary,
      p.original_title,
      p.original_language,
      p.severity_score,
      p.threat_type,
      COALESCE(p.actors, '{}'::text[]),
      COALESCE(p.targets, '{}'::text[]),
      p.casualties
    FROM payload p
    WHERE p.url IS NOT NULL AND btrim(p.url) <> '' AND p.user_id IS NOT NULL
    ON CONFLICT (url) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ingest_news_items(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_intel_tokens(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_intel_token() TO service_role;