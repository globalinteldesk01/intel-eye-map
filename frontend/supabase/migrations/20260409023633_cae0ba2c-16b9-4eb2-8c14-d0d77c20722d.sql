
-- Create country watchlist table
CREATE TABLE public.country_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  country_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, country_name)
);

-- Enable RLS
ALTER TABLE public.country_watchlist ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own country watchlist"
ON public.country_watchlist FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own country watchlist"
ON public.country_watchlist FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own country watchlist"
ON public.country_watchlist FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own country watchlist"
ON public.country_watchlist FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update the notification trigger to respect country watchlists
CREATE OR REPLACE FUNCTION public.notify_new_intel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  analyst_record RECORD;
  notification_type text;
  notification_title text;
  notification_message text;
  has_watchlist boolean;
  country_match boolean;
BEGIN
  CASE NEW.threat_level
    WHEN 'critical' THEN notification_type := 'alert';
    WHEN 'high' THEN notification_type := 'warning';
    WHEN 'elevated' THEN notification_type := 'warning';
    ELSE notification_type := 'info';
  END CASE;
  
  notification_title := UPPER(NEW.threat_level::text) || ' INTEL: ' || LEFT(NEW.title, 80);
  notification_message := '[' || COALESCE(NEW.token, 'NEW') || '] ' || NEW.category || ' - ' || NEW.region || ': ' || LEFT(NEW.summary, 150);
  
  FOR analyst_record IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'analyst'
  LOOP
    -- Check if user has any active country watchlist entries
    SELECT EXISTS(
      SELECT 1 FROM public.country_watchlist 
      WHERE user_id = analyst_record.user_id AND is_active = true
    ) INTO has_watchlist;
    
    -- If user has a watchlist, check if the country matches
    IF has_watchlist THEN
      SELECT EXISTS(
        SELECT 1 FROM public.country_watchlist 
        WHERE user_id = analyst_record.user_id 
          AND is_active = true 
          AND LOWER(country_name) = LOWER(NEW.country)
      ) INTO country_match;
      
      IF NOT country_match THEN
        CONTINUE; -- Skip this user, country not in their watchlist
      END IF;
    END IF;
    
    INSERT INTO public.notifications (user_id, title, message, type, news_item_id)
    VALUES (analyst_record.user_id, notification_title, notification_message, notification_type, NEW.id)
    ON CONFLICT (user_id, news_item_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$function$;
