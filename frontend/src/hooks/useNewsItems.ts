import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NewsItem, ThreatLevel, ConfidenceLevel, ActorType, SourceCredibility } from '@/types/news';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';
const POLL_INTERVAL_MS = 30 * 1000;

const transformItem = (raw: Record<string, unknown>): NewsItem => ({
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
  travelImpact: (raw.travel_impact as NewsItem['travelImpact']) || 'low',
  threatType: (raw.threat_type as NewsItem['threatType']) || 'political',
  travelerAdvice: (raw.traveler_advice as string) || '',
  affectedZones: (raw.affected_zones as string[]) || [],
  evacuationRelevance: Boolean(raw.evacuation_relevance),
  actionableInsights: (raw.actionable_insights as string[]) || [],
  keyActors: (raw.key_actors as string[]) || [],
  severitySummary: (raw.severity_summary as string) || '',
  precisionLevel: (raw.precision_level as NewsItem['precisionLevel']) || 'country',
});

export interface CreateNewsItemInput {
  title: string; summary: string; url: string; source: string;
  sourceCredibility: SourceCredibility; publishedAt?: string;
  lat: number; lon: number; country: string; region: string; city?: string;
  tags: string[]; confidenceScore: number; confidenceLevel: ConfidenceLevel;
  threatLevel: ThreatLevel; actorType: ActorType; subCategory?: string;
  category: NewsItem['category'];
}

export interface UpdateNewsItemInput extends Partial<CreateNewsItemInput> { id: string; }

export function useNewsItems() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialRef = useRef(true);

  const fetchNewsItems = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/news?limit=300`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = (data as Record<string, unknown>[]).map(transformItem);
      setNewsItems(items);
      setError(null);
      return items;
    } catch (err) {
      setError(err as Error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createNewsItem = async (input: CreateNewsItemInput): Promise<NewsItem | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title, summary: input.summary, url: input.url,
          source: input.source, source_credibility: input.sourceCredibility,
          published_at: input.publishedAt, lat: input.lat, lon: input.lon,
          country: input.country, region: input.region, city: input.city || '',
          tags: input.tags, confidence_score: input.confidenceScore,
          confidence_level: input.confidenceLevel, threat_level: input.threatLevel,
          actor_type: input.actorType, sub_category: input.subCategory, category: input.category,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const newItem = transformItem(data as Record<string, unknown>);
      setNewsItems(prev => {
        if (prev.some(i => i.id === newItem.id)) return prev;
        return [newItem, ...prev].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      });
      toast({ title: 'Intel Created', description: 'News item added successfully.' });
      return newItem;
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      return null;
    }
  };

  const updateNewsItem = async (input: UpdateNewsItemInput): Promise<NewsItem | null> => {
    setNewsItems(prev => prev.map(item => item.id !== input.id ? item : { ...item, ...input }));
    return newsItems.find(i => i.id === input.id) || null;
  };

  const deleteNewsItem = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/news/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNewsItems(prev => prev.filter(item => item.id !== id));
      toast({ title: 'Intel Deleted' });
      return true;
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const setupSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    try {
      const sse = new EventSource(`${BACKEND_URL}/api/news/stream`);
      sseRef.current = sse;
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_item' && data.item) {
            const newItem = transformItem(data.item as Record<string, unknown>);
            setNewsItems(prev => {
              if (prev.some(i => i.id === newItem.id)) return prev;
              return [newItem, ...prev].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
            });
          } else if (data.type === 'deleted_item' && data.id) {
            setNewsItems(prev => prev.filter(i => i.id !== data.id));
          }
        } catch {}
      };
      sse.onerror = () => { sse.close(); sseRef.current = null; setTimeout(setupSSE, 5000); };
    } catch {}
  }, [toast]);

  useEffect(() => {
    fetchNewsItems().then(() => setTimeout(() => { initialRef.current = false; }, 2000));
    setupSSE();
    pollRef.current = setInterval(fetchNewsItems, POLL_INTERVAL_MS);
    return () => {
      sseRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { newsItems, loading, error, createNewsItem, updateNewsItem, deleteNewsItem, refetch: fetchNewsItems };
}
