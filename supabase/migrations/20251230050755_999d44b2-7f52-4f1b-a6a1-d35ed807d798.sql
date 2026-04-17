-- Add token column to news_items table
ALTER TABLE public.news_items ADD COLUMN token text UNIQUE;

-- Create function to generate unique token
CREATE OR REPLACE FUNCTION public.generate_intel_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_str text;
  seq_num integer;
  new_token text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN token ~ ('^INT-' || year_str || '-[0-9]+$') 
      THEN CAST(split_part(token, '-', 3) AS integer)
      ELSE 0 
    END
  ), 0) + 1 INTO seq_num
  FROM public.news_items;
  
  -- Generate token like INT-2024-0001
  new_token := 'INT-' || year_str || '-' || lpad(seq_num::text, 4, '0');
  
  NEW.token := new_token;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate token on insert
CREATE TRIGGER generate_news_item_token
  BEFORE INSERT ON public.news_items
  FOR EACH ROW
  WHEN (NEW.token IS NULL)
  EXECUTE FUNCTION public.generate_intel_token();

-- Generate tokens for existing items
UPDATE public.news_items
SET token = 'INT-' || to_char(created_at, 'YYYY') || '-' || lpad(row_number::text, 4, '0')
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_number
  FROM public.news_items
  WHERE token IS NULL
) AS numbered
WHERE news_items.id = numbered.id;