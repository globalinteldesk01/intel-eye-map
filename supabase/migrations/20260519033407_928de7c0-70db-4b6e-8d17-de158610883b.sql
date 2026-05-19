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
    seq_num := nextval('public.intel_token_seq');
    next_token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.news_items ni WHERE ni.token = next_token
    );
  END LOOP;

  NEW.token := next_token;
  RETURN NEW;
END;
$function$;