-- Allow system/triggers to insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create function to notify analysts of new intel
CREATE OR REPLACE FUNCTION public.notify_new_intel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  notification_message := '[' || NEW.token || '] ' || NEW.category || ' - ' || NEW.region || ': ' || LEFT(NEW.summary, 150);
  
  -- Create notification for all analysts (except the one who created the intel)
  FOR analyst_record IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'analyst' 
    AND ur.user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, news_item_id)
    VALUES (analyst_record.user_id, notification_title, notification_message, notification_type, NEW.id);
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire on new intel
CREATE TRIGGER on_new_intel_notify
AFTER INSERT ON public.news_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_intel();