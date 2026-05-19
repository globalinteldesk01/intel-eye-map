CREATE SEQUENCE IF NOT EXISTS public.intel_token_seq;

SELECT setval(
  'public.intel_token_seq',
  GREATEST(
    COALESCE((
      SELECT MAX((regexp_match(token, '^INT-' || to_char(now(), 'YYYY') || '-([0-9]+)$'))[1]::integer)
      FROM public.news_items
      WHERE token ~ ('^INT-' || to_char(now(), 'YYYY') || '-[0-9]+$')
    ), 0),
    COALESCE((SELECT last_value FROM public.intel_token_seq), 0),
    1
  ),
  true
);

CREATE OR REPLACE FUNCTION public.generate_intel_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  year_str text;
  seq_num bigint;
BEGIN
  IF NEW.token IS NOT NULL AND btrim(NEW.token) <> '' THEN
    RETURN NEW;
  END IF;

  year_str := to_char(now(), 'YYYY');
  seq_num := nextval('public.intel_token_seq');
  NEW.token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_news_items_token ON public.news_items;
DROP TRIGGER IF EXISTS generate_news_items_token ON public.news_items;
DROP TRIGGER IF EXISTS trg_generate_intel_token ON public.news_items;

CREATE TRIGGER set_news_items_token
BEFORE INSERT ON public.news_items
FOR EACH ROW
EXECUTE FUNCTION public.generate_intel_token();