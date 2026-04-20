import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { NewsItem, ThreatLevel, ConfidenceLevel, ActorType, SourceCredibility } from '@/types/news';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds polling

// Transform backend response to NewsItem
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
  tags: (raw.tags as string[]) || [],
  confidenceScore: Number(raw.confidence_score) || 0.6,
  confidenceLevel: (raw.confidence_level as ConfidenceLevel) || 'probable',
  threatLevel: (raw.threat_level as ThreatLevel) || 'low',
  actorType: (raw.actor_type as ActorType) || 'state',
  subCategory: raw.sub_category as string | undefined,
  category: (raw.category as NewsItem['category']) || 'security',
});

export interface CreateNewsItemInput {
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceCredibility: SourceCredibility;
  publishedAt?: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  tags: string[];
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  threatLevel: ThreatLevel;
  actorType: ActorType;
  subCategory?: string;
  category: NewsItem['category'];
}

export interface UpdateNewsItemInput extends Partial<CreateNewsItemInput> {
  id: string;
}

export function useNewsItems() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const sseRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fetch all news items from backend
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
      console.error('Failed to fetch news items:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a news item
  const createNewsItem = async (input: CreateNewsItemInput): Promise<NewsItem | null> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          summary: input.summary,
          url: input.url,
          source: input.source,
          source_credibility: input.sourceCredibility,
          published_at: input.publishedAt,
          lat: input.lat,
          lon: input.lon,
          country: input.country,
          region: input.region,
          tags: input.tags,
          confidence_score: input.confidenceScore,
          confidence_level: input.confidenceLevel,
          threat_level: input.threatLevel,
          actor_type: input.actorType,
          sub_category: input.subCategory,
          category: input.category,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const newItem = transformItem(data as Record<string, unknown>);

      setNewsItems((prev) => {
        if (prev.some((item) => item.id === newItem.id)) return prev;
        return [newItem, ...prev].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
      });

      toast({ title: 'Intel Created', description: 'News item added successfully.' });
      return newItem;
    } catch (err) {
      toast({
        title: 'Error creating intel',
        description: (err as Error).message,
        variant: 'destructive',
      });
      return null;
    }
  };

  // Update a news item (local state only - backend update can be added later)
  const updateNewsItem = async (input: UpdateNewsItemInput): Promise<NewsItem | null> => {
    setNewsItems((prev) =>
      prev.map((item) => {
        if (item.id !== input.id) return item;
        return {
          ...item,
          ...(input.title !== undefined && { title: input.title }),
          ...(input.summary !== undefined && { summary: input.summary }),
          ...(input.url !== undefined && { url: input.url }),
          ...(input.source !== undefined && { source: input.source }),
          ...(input.sourceCredibility !== undefined && { sourceCredibility: input.sourceCredibility }),
          ...(input.publishedAt !== undefined && { publishedAt: input.publishedAt }),
          ...(input.lat !== undefined && { lat: input.lat }),
          ...(input.lon !== undefined && { lon: input.lon }),
          ...(input.country !== undefined && { country: input.country }),
          ...(input.region !== undefined && { region: input.region }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.confidenceScore !== undefined && { confidenceScore: input.confidenceScore }),
          ...(input.confidenceLevel !== undefined && { confidenceLevel: input.confidenceLevel }),
          ...(input.threatLevel !== undefined && { threatLevel: input.threatLevel }),
          ...(input.actorType !== undefined && { actorType: input.actorType }),
          ...(input.subCategory !== undefined && { subCategory: input.subCategory }),
          ...(input.category !== undefined && { category: input.category }),
        };
      })
    );
    toast({ title: 'Intel Updated', description: 'News item updated.' });
    const updated = newsItems.find((i) => i.id === input.id);
    return updated || null;
  };

  // Delete a news item
  const deleteNewsItem = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/news/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNewsItems((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Intel Deleted', description: 'News item removed.' });
      return true;
    } catch (err) {
      toast({
        title: 'Error deleting intel',
        description: (err as Error).message,
        variant: 'destructive',
      });
      return false;
    }
  };

  // Setup SSE for real-time updates
  const setupSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    try {
      const sse = new EventSource(`${BACKEND_URL}/api/news/stream`);
      sseRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'new_item' && data.item) {
            const newItem = transformItem(data.item as Record<string, unknown>);
            setNewsItems((prev) => {
              if (prev.some((item) => item.id === newItem.id)) return prev;
              const updated = [newItem, ...prev];
              // Show toast for new intel (after initial load)
              if (!isInitialLoadRef.current) {
                // Toast notification is handled separately to avoid stale closure
              }
              return updated.sort(
                (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
              );
            });

            if (!isInitialLoadRef.current) {
              toast({
                title: `🔔 New Intel: ${newItem.threatLevel.toUpperCase()}`,
                description: newItem.title.substring(0, 80),
              });
            }
          } else if (data.type === 'deleted_item' && data.id) {
            setNewsItems((prev) => prev.filter((item) => item.id !== data.id));
          }
        } catch (e) {
          // Ignore heartbeat and parse errors
        }
      };

      sse.onerror = () => {
        console.log('SSE connection lost, will reconnect...');
        sse.close();
        sseRef.current = null;
        // Reconnect after 5 seconds
        setTimeout(setupSSE, 5000);
      };

      sse.onopen = () => {
        console.log('SSE connected for real-time intel updates');
      };
    } catch (err) {
      console.error('Failed to setup SSE:', err);
    }
  }, [toast]);

  // Initial load and setup
  useEffect(() => {
    fetchNewsItems().then(() => {
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 2000);
    });

    // Setup SSE for real-time updates
    setupSSE();

    // Also poll every 30 seconds as backup
    pollIntervalRef.current = setInterval(() => {
      fetchNewsItems();
    }, POLL_INTERVAL_MS);

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    newsItems,
    loading,
    error,
    createNewsItem,
    updateNewsItem,
    deleteNewsItem,
    refetch: fetchNewsItems,
  };
}
