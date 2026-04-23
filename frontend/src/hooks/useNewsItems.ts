import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NewsItem, ThreatLevel, ConfidenceLevel, ActorType, SourceCredibility } from '@/types/news';

const BACKEND_URL = (
  import.meta.env.REACT_APP_BACKEND_URL ||
  'https://instant-news-board.preview.emergentagent.com'
).replace(/\/$/, '');

const transform = (raw: Record<string, unknown>): NewsItem | null => {
  try {
    const id = raw.id as string;
    const title = raw.title as string;
    if (!id || !title) return null;
    return {
      id,
      token: (raw.token as string) || '',
      title,
      summary: (raw.summary as string) || title,
      url: (raw.url as string) || '',
      source: (raw.source as string) || 'Unknown',
      sourceCredibility: (raw.source_credibility as SourceCredibility) || 'medium',
      publishedAt: (raw.published_at as string) || new Date().toISOString(),
      lat: Number(raw.lat) || 0,
      lon: Number(raw.lon) || 0,
      country: (raw.country as string) || 'Global',
      region: (raw.region as string) || 'Global',
      city: (raw.city as string) || undefined,
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
      confidenceScore: Number(raw.confidence_score) || 0.6,
      confidenceLevel: (raw.confidence_level as ConfidenceLevel) || 'developing',
      threatLevel: (['critical','high','elevated','low'].includes(raw.threat_level as string)
        ? raw.threat_level : 'low') as ThreatLevel,
      actorType: (['state','non-state','organization'].includes(raw.actor_type as string)
        ? raw.actor_type : 'state') as ActorType,
      subCategory: raw.sub_category as string | undefined,
      category: (
        ['security','diplomacy','economy','conflict','humanitarian','technology']
          .includes(raw.category as string)
          ? raw.category : 'security'
      ) as NewsItem['category'],
      actionableInsights: Array.isArray(raw.actionable_insights) ? (raw.actionable_insights as string[]) : [],
      keyActors: Array.isArray(raw.key_actors) ? (raw.key_actors as string[]) : [],
      severitySummary: (raw.severity_summary as string) || '',
      precisionLevel: (raw.precision_level as NewsItem['precisionLevel']) || 'country',
    };
  } catch {
    return null;
  }
};

export function useNewsItems() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  const fetchItems = useCallback(async () => {
    try {
      const url = `${BACKEND_URL}/api/news?limit=300`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: Record<string, unknown>[] = await resp.json();

      if (!Array.isArray(data)) throw new Error('Invalid response format');

      const items = data
        .map(transform)
        .filter((item): item is NewsItem => item !== null)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      setNewsItems(items);
      setError(null);
      return items;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = (err as Error).message;
        setError(msg);
        console.error('[useNewsItems] fetch error:', msg);
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteNewsItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/news/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setNewsItems(prev => prev.filter(i => i.id !== id));
      return true;
    } catch (err) {
      console.error('[useNewsItems] delete error:', err);
      return false;
    }
  }, []);

  // Setup SSE for real-time updates
  const setupSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    try {
      const sse = new EventSource(`${BACKEND_URL}/api/news/stream`);
      sseRef.current = sse;

      sse.onopen = () => {
        console.log('[SSE] Connected to intel stream');
      };

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_item' && data.item) {
            const item = transform(data.item as Record<string, unknown>);
            if (item) {
              setNewsItems(prev => {
                if (prev.some(i => i.id === item.id)) return prev;
                return [item, ...prev].sort(
                  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
                );
              });
            }
          } else if (data.type === 'deleted_item' && data.id) {
            setNewsItems(prev => prev.filter(i => i.id !== data.id));
          }
        } catch {
          // ignore parse errors (heartbeats etc.)
        }
      };

      sse.onerror = () => {
        console.log('[SSE] Connection lost, will retry in 10s');
        sse.close();
        sseRef.current = null;
        setTimeout(setupSSE, 10000);
      };
    } catch (err) {
      console.error('[SSE] Setup failed:', err);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Load items immediately
    fetchItems();

    // Connect SSE stream
    setupSSE();

    // Poll every 45 seconds as backup (covers SSE gaps)
    pollRef.current = setInterval(() => {
      fetchItems();
    }, 45000);

    return () => {
      if (sseRef.current) sseRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      initializedRef.current = false;
    };
  }, [fetchItems, setupSSE]);

  return {
    newsItems,
    loading,
    error,
    deleteNewsItem,
    refetch: fetchItems,
  };
}
