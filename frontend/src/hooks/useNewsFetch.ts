import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';

interface FetchResult { success: boolean; fetched?: number; inserted?: number; sources_checked?: number; message?: string; error?: string; }
interface FetchStatus { is_fetching: boolean; last_fetch_time: string | null; last_fetch_count: number; total_items: number; sources_checked: number; }

export function useNewsFetch() {
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [lastFetchResult, setLastFetchResult] = useState<FetchResult | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const isFetchingRef = useRef(false);
  const hasInitRef = useRef(false);

  const getStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/news/status`);
      if (r.ok) {
        const s: FetchStatus = await r.json();
        setFetchStatus(s);
        if (s.last_fetch_time) setLastFetchTime(new Date(s.last_fetch_time));
      }
    } catch {}
  }, []);

  const refreshNow = useCallback(async (): Promise<FetchResult | null> => {
    if (!user || isFetchingRef.current) return null;
    isFetchingRef.current = true;
    setIsFetching(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/news/fetch`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const result: FetchResult = await r.json();
      if (r.ok && result.success) {
        setLastFetchTime(new Date());
        setLastFetchResult(result);
        if (result.inserted && result.inserted > 0)
          toast({ title: '📡 Intel Updated', description: `${result.inserted} new items from ${result.sources_checked || 0} sources.` });
      }
      return result;
    } catch (err) {
      const e = { success: false, error: (err as Error).message };
      setLastFetchResult(e);
      return e;
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user || hasInitRef.current) return;
    hasInitRef.current = true;
    getStatus();
    const interval = setInterval(getStatus, 30000);
    return () => { clearInterval(interval); hasInitRef.current = false; };
  }, [user, getStatus]);

  return { isFetching, lastFetchTime, lastFetchResult, fetchStatus, refreshNow, stopAutoFetch: () => {} };
}
