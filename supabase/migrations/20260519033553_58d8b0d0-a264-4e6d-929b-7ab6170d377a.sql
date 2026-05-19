ALTER TABLE public.news_items
ALTER COLUMN token TYPE text USING token::text;

SELECT setval(
  'public.intel_token_seq',
  GREATEST(
    COALESCE((
      SELECT MAX((regexp_match(token, '^INT-' || to_char(now(), 'YYYY') || '-([0-9]+)$'))[1]::integer)
      FROM public.news_items
      WHERE token ~ ('^INT-' || to_char(now(), 'YYYY') || '-[0-9]+$')
    ), 0),
    COALESCE((SELECT last_value FROM public.intel_token_seq), 0),
    10000
  ),
  true
);