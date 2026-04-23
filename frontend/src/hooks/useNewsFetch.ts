import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';

interface FetchStatus { is_fetching: boolean; last_fetch_time: string | null; last_fetch_count: number; total_items: number; sources_checked: number; }

export function useNewsFetch() {
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);
  const { user } = useAuth();
  const ref = useRef(false);

  const getStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/news/status`);
      if (r.ok) { const s: FetchStatus = await r.json(); setFetchStatus(s); setIsFetching(s.is_fetching); if (s.last_fetch_time) setLastFetchTime(new Date(s.last_fetch_time)); }
    } catch {}
  }, []);

  const refreshNow = useCallback(async () => {
    if (!user) return;
    setIsFetching(true);
    try { await fetch(`${BACKEND_URL}/api/news/fetch`, { method: 'POST' }); await getStatus(); }
    catch {} finally { setIsFetching(false); }
  }, [user, getStatus]);

  useEffect(() => {
    if (!user || ref.current) return;
    ref.current = true;
    getStatus();
    const t = setInterval(getStatus, 30000);
    return () => { clearInterval(t); ref.current = false; };
  }, [user, getStatus]);

  return { isFetching, lastFetchTime, fetchStatus, refreshNow };
}
