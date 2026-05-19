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
      seq_num := nextval('public.intel_token_seq');
      next_token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.news_items ni WHERE ni.token = next_token
      );
    END LOOP;

    tokens := array_append(tokens, next_token);
  END LOOP;

  RETURN tokens;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_intel_tokens(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_intel_tokens(integer) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_intel_tokens(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_intel_tokens(integer) TO service_role;