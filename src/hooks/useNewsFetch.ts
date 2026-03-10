import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (backend cron runs every 1 min)

interface FetchResult {
  success: boolean;
  fetched?: number;
  inserted?: number;
  message?: string;
  error?: string;
}

export function useNewsFetch() {
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [lastFetchResult, setLastFetchResult] = useState<FetchResult | null>(null);
  const [nextFetchTime, setNextFetchTime] = useState<Date | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const fetchNews = useCallback(async (showToast = true): Promise<FetchResult | null> => {
    if (!user) {
      console.log('No user, skipping news fetch');
      return null;
    }

    // Use ref for immediate check to prevent race conditions
    if (isFetchingRef.current) {
      console.log('Already fetching, skipping');
      return null;
    }

    isFetchingRef.current = true;
    setIsFetching(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session for news fetch');
        isFetchingRef.current = false;
        setIsFetching(false);
        return null;
      }

      console.log('Fetching news from API...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-news`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result: FetchResult = await response.json();

      if (response.ok && result.success) {
        setLastFetchTime(new Date());
        setLastFetchResult(result);
        setNextFetchTime(new Date(Date.now() + FETCH_INTERVAL_MS));

        if (showToast && result.inserted && result.inserted > 0) {
          toast({
            title: 'News Updated',
            description: `${result.inserted} new intelligence items fetched.`,
          });
        }

        console.log('News fetch successful:', result);
        return result;
      } else {
        console.error('News fetch failed:', result.error);
        setLastFetchResult(result);

        if (showToast) {
          toast({
            title: 'Fetch Error',
            description: result.error || 'Failed to fetch news',
            variant: 'destructive',
          });
        }
        return result;
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      const errorResult: FetchResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      setLastFetchResult(errorResult);

      if (showToast) {
        toast({
          title: 'Fetch Error',
          description: 'Failed to connect to news API',
          variant: 'destructive',
        });
      }
      return errorResult;
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, [user, toast]);

  // Stop auto-fetch
  const stopAutoFetch = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setNextFetchTime(null);
  }, []);

  // Manual refresh function
  const refreshNow = useCallback(() => {
    console.log('Manual refresh triggered');
    return fetchNews(true);
  }, [fetchNews]);

  // Start auto-fetch interval - only runs once per user session
  useEffect(() => {
    if (!user || hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    // Fetch immediately on start
    fetchNews(false);

    // Then set up interval
    intervalRef.current = setInterval(() => {
      console.log('Auto-fetching news (15 min interval)');
      fetchNews(true);
    }, FETCH_INTERVAL_MS);

    setNextFetchTime(new Date(Date.now() + FETCH_INTERVAL_MS));
    console.log('Auto-fetch started, next fetch at:', new Date(Date.now() + FETCH_INTERVAL_MS).toISOString());

    return () => {
      stopAutoFetch();
      hasInitializedRef.current = false;
    };
  }, [user, fetchNews, stopAutoFetch]);

  return {
    isFetching,
    lastFetchTime,
    lastFetchResult,
    nextFetchTime,
    refreshNow,
    stopAutoFetch,
  };
}
