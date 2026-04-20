import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';
const FETCH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (matches backend auto-fetch)

interface FetchResult {
  success: boolean;
  fetched?: number;
  inserted?: number;
  sources_checked?: number;
  message?: string;
  error?: string;
}

interface FetchStatus {
  is_fetching: boolean;
  last_fetch_time: string | null;
  last_fetch_count: number;
  total_items: number;
  sources_checked: number;
}

export function useNewsFetch() {
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [lastFetchResult, setLastFetchResult] = useState<FetchResult | null>(null);
  const [nextFetchTime, setNextFetchTime] = useState<Date | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Fetch current status from backend
  const getStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/news/status`);
      if (response.ok) {
        const status: FetchStatus = await response.json();
        setFetchStatus(status);
        if (status.last_fetch_time) {
          setLastFetchTime(new Date(status.last_fetch_time));
        }
      }
    } catch (err) {
      console.error('Failed to get fetch status:', err);
    }
  }, []);

  const fetchNews = useCallback(async (showToast = true): Promise<FetchResult | null> => {
    if (!user) {
      console.log('No user, skipping news fetch trigger');
      return null;
    }

    if (isFetchingRef.current) {
      console.log('Already fetching, skipping');
      return null;
    }

    isFetchingRef.current = true;
    setIsFetching(true);

    try {
      console.log('Triggering news fetch from backend...');

      const response = await fetch(`${BACKEND_URL}/api/news/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result: FetchResult = await response.json();

      if (response.ok && result.success) {
        setLastFetchTime(new Date());
        setLastFetchResult(result);
        setNextFetchTime(new Date(Date.now() + FETCH_INTERVAL_MS));

        if (showToast && result.inserted && result.inserted > 0) {
          toast({
            title: '📡 Intel Updated',
            description: `${result.inserted} new intelligence items fetched from ${result.sources_checked || 0} sources.`,
          });
        } else if (showToast) {
          toast({
            title: 'Intel Check Complete',
            description: 'No new items at this time.',
          });
        }

        console.log('News fetch triggered successfully:', result);
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
      console.error('Error triggering news fetch:', error);
      const errorResult: FetchResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      setLastFetchResult(errorResult);

      if (showToast) {
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to intel API',
          variant: 'destructive',
        });
      }
      return errorResult;
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, [user, toast]);

  const stopAutoFetch = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setNextFetchTime(null);
  }, []);

  const refreshNow = useCallback(() => {
    console.log('Manual refresh triggered');
    return fetchNews(true);
  }, [fetchNews]);

  // Initialize status polling
  useEffect(() => {
    if (!user || hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Get initial status
    getStatus();

    // Set up interval for periodic status check (not triggering full fetch)
    intervalRef.current = setInterval(() => {
      getStatus();
    }, 30000); // Check status every 30 seconds

    setNextFetchTime(new Date(Date.now() + FETCH_INTERVAL_MS));

    return () => {
      stopAutoFetch();
      hasInitializedRef.current = false;
    };
  }, [user, getStatus, stopAutoFetch]);

  return {
    isFetching,
    lastFetchTime,
    lastFetchResult,
    nextFetchTime,
    fetchStatus,
    refreshNow,
    stopAutoFetch,
  };
}
