
-- 1) Purge backlog so inserts are fast again
DELETE FROM public.notifications
WHERE is_read = true
   OR created_at < NOW() - INTERVAL '24 hours';

-- 2) Replace the fanout trigger with a much narrower one:
--    only HIGH/CRITICAL items, and only to analysts who have that
--    country on their active watchlist.
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
BEGIN
  -- Only notify on elevated+ threats to avoid notification floods
  IF NEW.threat_level NOT IN ('critical', 'high') THEN
    RETURN NEW;
  END IF;

  notification_type := CASE NEW.threat_level
    WHEN 'critical' THEN 'alert'
    ELSE 'warning'
  END;

  notification_title := UPPER(NEW.threat_level::text) || ' INTEL: ' || LEFT(NEW.title, 80);
  notification_message := '[' || COALESCE(NEW.token, 'NEW') || '] ' || NEW.category || ' - ' || NEW.region || ': ' || LEFT(NEW.summary, 150);

  -- Only fan out to analysts who have this country on their active watchlist.
  FOR analyst_record IN
    SELECT DISTINCT cw.user_id
    FROM public.country_watchlist cw
    JOIN public.user_roles ur ON ur.user_id = cw.user_id AND ur.role = 'analyst'
    WHERE cw.is_active = true
      AND LOWER(cw.country_name) = LOWER(NEW.country)
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, news_item_id)
    VALUES (analyst_record.user_id, notification_title, notification_message, notification_type, NEW.id)
    ON CONFLICT (user_id, news_item_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;
