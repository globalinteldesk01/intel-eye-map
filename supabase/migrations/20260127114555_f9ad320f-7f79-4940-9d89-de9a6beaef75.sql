-- Add unique constraint to prevent duplicate notifications for same user + news_item
ALTER TABLE public.notifications 
ADD CONSTRAINT unique_user_news_notification 
UNIQUE (user_id, news_item_id);

-- Recreate the notify_new_intel function to notify ALL analysts (except creator)
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
  -- Determine notification type based on threat level
  CASE NEW.threat_level
    WHEN 'critical' THEN notification_type := 'alert';
    WHEN 'high' THEN notification_type := 'warning';
    WHEN 'elevated' THEN notification_type := 'warning';
    ELSE notification_type := 'info';
  END CASE;
  
  -- Build notification title with threat level prefix
  notification_title := UPPER(NEW.threat_level::text) || ' INTEL: ' || LEFT(NEW.title, 80);
  
  -- Build notification message
  notification_message := '[' || COALESCE(NEW.token, 'NEW') || '] ' || NEW.category || ' - ' || NEW.region || ': ' || LEFT(NEW.summary, 150);
  
  -- Create notification for ALL analysts (including the creator for their own records)
  FOR analyst_record IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'analyst'
  LOOP
    -- Use ON CONFLICT to prevent duplicates
    INSERT INTO public.notifications (user_id, title, message, type, news_item_id)
    VALUES (analyst_record.user_id, notification_title, notification_message, notification_type, NEW.id)
    ON CONFLICT (user_id, news_item_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$function$;