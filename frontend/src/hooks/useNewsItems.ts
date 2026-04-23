import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NewsItem, ThreatLevel, ConfidenceLevel, ActorType, SourceCredibility } from '@/types/news';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';

const transform = (raw: Record<string, unknown>): NewsItem => ({
  id: raw.id as string,
  token: (raw.token as string) || '',
  title: raw.title as string,
  summary: raw.summary as string,
  url: (raw.url as string) || '',
  source: raw.source as string,
  sourceCredibility: (raw.source_credibility as SourceCredibility) || 'medium',
  publishedAt: raw.published_at as string,
  lat: Number(raw.lat) || 0,
  lon: Number(raw.lon) || 0,
  country: (raw.country as string) || 'Global',
  region: (raw.region as string) || 'Global',
  city: (raw.city as string) || undefined,
  tags: (raw.tags as string[]) || [],
  confidenceScore: Number(raw.confidence_score) || 0.6,
  confidenceLevel: (raw.confidence_level as ConfidenceLevel) || 'developing',
  threatLevel: (raw.threat_level as ThreatLevel) || 'low',
  actorType: (raw.actor_type as ActorType) || 'state',
  subCategory: raw.sub_category as string | undefined,
  category: (raw.category as NewsItem['category']) || 'security',
  actionableInsights: (raw.actionable_insights as string[]) || [],
  keyActors: (raw.key_actors as string[]) || [],
  severitySummary: (raw.severity_summary as string) || '',
  precisionLevel: (raw.precision_level as NewsItem['precisionLevel']) || 'country',
});

export function useNewsItems() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(true);

  const fetchItems = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/news?limit=300`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setNewsItems((data as Record<string, unknown>[]).map(transform));
      setError(null);
    } catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, []);

  const deleteNewsItem = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/news/${id}`, { method: 'DELETE' });
      setNewsItems(prev => prev.filter(i => i.id !== id));
      return true;
    } catch { return false; }
  };

  const setupSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    try {
      const sse = new EventSource(`${BACKEND_URL}/api/news/stream`);
      sseRef.current = sse;
      sse.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'new_item' && data.item) {
            const item = transform(data.item as Record<string, unknown>);
            setNewsItems(prev => {
              if (prev.some(i => i.id === item.id)) return prev;
              return [item, ...prev].sort((a,b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
            });
          } else if (data.type === 'deleted_item') {
            setNewsItems(prev => prev.filter(i => i.id !== data.id));
          }
        } catch {}
      };
      sse.onerror = () => { sse.close(); sseRef.current = null; setTimeout(setupSSE, 5000); };
    } catch {}
  }, []);

  useEffect(() => {
    fetchItems();
    setupSSE();
    pollRef.current = setInterval(fetchItems, 30000);
    return () => {
      sseRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { newsItems, loading, error, deleteNewsItem, refetch: fetchItems };
}
