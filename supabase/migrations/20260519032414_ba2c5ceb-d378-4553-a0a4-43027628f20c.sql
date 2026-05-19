
CREATE SEQUENCE IF NOT EXISTS public.intel_token_seq;

-- Seed sequence past existing max for current year
SELECT setval(
  'public.intel_token_seq',
  GREATEST(
    COALESCE((
      SELECT MAX(CAST(split_part(token, '-', 3) AS integer))
      FROM public.news_items
      WHERE token ~ ('^INT-' || to_char(now(), 'YYYY') || '-[0-9]+$')
    ), 0),
    1
  )
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
  year_str := to_char(now(), 'YYYY');
  seq_num := nextval('public.intel_token_seq');
  NEW.token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
  RETURN NEW;
END;
$function$;
