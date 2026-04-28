import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CrisisEvent, CrisisCategory, CrisisSeverity } from '../types';

// Map news_items rows into CrisisEvent shape so the CrisisWatch map shows
// real, freshly ingested intelligence (no seed/demo data).
function mapCategory(category: string | null, tags: string[] | null): CrisisCategory {
  const c = (category || '').toLowerCase();
  const t = (tags || []).map(x => x.toLowerCase());
  if (c === 'humanitarian' || t.some(x => ['weather', 'storm', 'typhoon', 'flood', 'earthquake', 'cyclone'].includes(x))) return 'Weather';
  if (c === 'security' || c === 'conflict') return 'GovAlert';
  if (c === 'diplomacy') return 'News';
  if (t.some(x => ['traffic', 'transport', 'aviation'].includes(x))) return 'Traffic';
  if (c === 'technology') return 'Social';
  return 'News';
}

function mapSeverity(threat: string | null): CrisisSeverity {
  switch ((threat || '').toLowerCase()) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'elevated': return 'medium';
    default: return 'low';
  }
}

function rowToEvent(r: any): CrisisEvent {
  return {
    id: r.id,
    title: r.title || 'Untitled',
    summary: r.summary || '',
    location: [r.country, r.region].filter(Boolean).join(', ') || r.country || 'Unknown',
    latitude: Number(r.lat) || 0,
    longitude: Number(r.lon) || 0,
    category: mapCategory(r.category, r.tags),
    source_type: r.source || 'osint',
    severity: mapSeverity(r.threat_level),
    status: (r.confidence_level === 'verified' ? 'verified' : 'new'),
    confidence: Math.round((Number(r.confidence_score) || 0) * 100) || 0,
    sources_count: 1,
    affected_area: r.region || r.country || '',
    impacts: [],
    actions: [],
    pipeline_stage: 'verified',
    created_at: r.created_at || r.published_at,
    updated_at: r.created_at || r.published_at,
  };
}

export function useCrisisEvents() {
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('news_items')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(500);
    if (!error && data) setEvents(data.map(rowToEvent));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel('news-items-crisis-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_items' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [rowToEvent(payload.new), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(e => e.id === (payload.new as any).id ? rowToEvent(payload.new) : e));
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(e => e.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

  const updateEvent = useCallback(async (_id: string, _updates: Partial<CrisisEvent>) => {
    return true;
  }, []);

  return { events, loading, refetch: fetchEvents, updateEvent };
}
