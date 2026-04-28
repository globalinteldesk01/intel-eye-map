import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { NewsItem, ThreatLevel, ConfidenceLevel, ActorType, SourceCredibility } from '@/types/news';

// Database row type
interface NewsItemRow {
  id: string;
  token: string | null;
  title: string;
  summary: string;
  url: string;
  source: string;
  source_credibility: string;
  published_at: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  tags: string[];
  confidence_score: number;
  confidence_level: string;
  threat_level: string;
  actor_type: string;
  sub_category: string | null;
  category: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Transform database row to NewsItem
const transformRow = (row: NewsItemRow): NewsItem => ({
  id: row.id,
  token: row.token || '',
  title: row.title,
  summary: row.summary,
  url: row.url,
  source: row.source,
  sourceCredibility: row.source_credibility as SourceCredibility,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  lat: Number(row.lat),
  lon: Number(row.lon),
  country: row.country,
  region: row.region,
  tags: row.tags,
  confidenceScore: Number(row.confidence_score),
  confidenceLevel: row.confidence_level as ConfidenceLevel,
  threatLevel: row.threat_level as ThreatLevel,
  actorType: row.actor_type as ActorType,
  subCategory: row.sub_category || undefined,
  category: row.category as NewsItem['category'],
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
  const { user } = useAuth();
  const { toast } = useToast();
  const isInitialLoadRef = useRef(true);

  // Fetch all news items
  const fetchNewsItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('news_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (data as NewsItemRow[]).map(transformRow);
      setNewsItems(items);
      setError(null);
    } catch (err) {
      setError(err as Error);
      toast({
        title: 'Error fetching news',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Create a news item
  const createNewsItem = async (input: CreateNewsItemInput) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to create news items.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('news_items')
        .insert({
          title: input.title,
          summary: input.summary,
          url: input.url,
          source: input.source,
          source_credibility: input.sourceCredibility,
          published_at: input.publishedAt || new Date().toISOString(),
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
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newItem = transformRow(data as NewsItemRow);
      setNewsItems((prev) => [newItem, ...prev]);
      
      toast({
        title: 'Intel Created',
        description: 'News item added successfully.',
      });

      return newItem;
    } catch (err) {
      toast({
        title: 'Error creating news',
        description: (err as Error).message,
        variant: 'destructive',
      });
      return null;
    }
  };

  // Update a news item
  const updateNewsItem = async (input: UpdateNewsItemInput) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to update news items.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.summary !== undefined) updateData.summary = input.summary;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.source !== undefined) updateData.source = input.source;
      if (input.sourceCredibility !== undefined) updateData.source_credibility = input.sourceCredibility;
      if (input.publishedAt !== undefined) updateData.published_at = input.publishedAt;
      if (input.lat !== undefined) updateData.lat = input.lat;
      if (input.lon !== undefined) updateData.lon = input.lon;
      if (input.country !== undefined) updateData.country = input.country;
      if (input.region !== undefined) updateData.region = input.region;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.confidenceScore !== undefined) updateData.confidence_score = input.confidenceScore;
      if (input.confidenceLevel !== undefined) updateData.confidence_level = input.confidenceLevel;
      if (input.threatLevel !== undefined) updateData.threat_level = input.threatLevel;
      if (input.actorType !== undefined) updateData.actor_type = input.actorType;
      if (input.subCategory !== undefined) updateData.sub_category = input.subCategory;
      if (input.category !== undefined) updateData.category = input.category;

      const { data, error } = await supabase
        .from('news_items')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      const updatedItem = transformRow(data as NewsItemRow);
      setNewsItems((prev) =>
        prev.map((item) => (item.id === input.id ? updatedItem : item))
      );

      toast({
        title: 'Intel Updated',
        description: 'News item updated successfully.',
      });

      return updatedItem;
    } catch (err) {
      toast({
        title: 'Error updating news',
        description: (err as Error).message,
        variant: 'destructive',
      });
      return null;
    }
  };

  // Delete a news item
  const deleteNewsItem = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to delete news items.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('news_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNewsItems((prev) => prev.filter((item) => item.id !== id));

      toast({
        title: 'Intel Deleted',
        description: 'News item removed successfully.',
      });

      return true;
    } catch (err) {
      toast({
        title: 'Error deleting news',
        description: (err as Error).message,
        variant: 'destructive',
      });
      return false;
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    fetchNewsItems().then(() => {
      // Mark initial load as complete after first fetch
      setTimeout(() => { isInitialLoadRef.current = false; }, 1000);
    });

    const channel = supabase
      .channel('news-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'news_items',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = transformRow(payload.new as NewsItemRow);
            setNewsItems((prev) => {
              // Avoid duplicates
              if (prev.some((item) => item.id === newItem.id)) return prev;
              // Insert in correct position by publish date (newest first).
              const updated = [newItem, ...prev];
              return updated.sort((a, b) => {
                const aTime = new Date(a.createdAt || a.publishedAt).getTime();
                const bTime = new Date(b.createdAt || b.publishedAt).getTime();
                return bTime - aTime;
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = transformRow(payload.new as NewsItemRow);
            setNewsItems((prev) =>
              prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setNewsItems((prev) => prev.filter((item) => item.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
