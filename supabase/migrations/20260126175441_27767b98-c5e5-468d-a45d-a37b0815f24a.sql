-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to delete old news items (older than 3 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_news_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete news items older than 3 days
  WITH deleted AS (
    DELETE FROM public.news_items
    WHERE published_at < NOW() - INTERVAL '3 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Also delete orphaned notifications for deleted news items
  DELETE FROM public.notifications
  WHERE news_item_id IS NOT NULL
    AND news_item_id NOT IN (SELECT id FROM public.news_items);
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_old_news_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_news_items() TO service_role;