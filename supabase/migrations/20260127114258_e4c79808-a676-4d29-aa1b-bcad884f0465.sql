-- Drop and recreate the notify_new_intel function to only notify the SAME user who created the intel
-- This makes notifications a personal "inbox" of intel you've added, not cross-user alerts

CREATE OR REPLACE FUNCTION public.notify_new_intel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
  
  -- Create notification ONLY for the user who created the intel item
  INSERT INTO public.notifications (user_id, title, message, type, news_item_id)
  VALUES (NEW.user_id, notification_title, notification_message, notification_type, NEW.id);
  
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_new_intel_notify ON public.news_items;
CREATE TRIGGER on_new_intel_notify
  AFTER INSERT ON public.news_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_intel();