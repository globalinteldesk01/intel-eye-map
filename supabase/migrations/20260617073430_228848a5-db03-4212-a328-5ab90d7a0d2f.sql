REVOKE ALL ON FUNCTION public.ingest_news_items(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_intel_tokens(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_news_items(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_intel_tokens(integer) TO service_role;