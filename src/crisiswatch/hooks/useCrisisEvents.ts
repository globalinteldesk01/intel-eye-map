import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CrisisEvent } from '../types';

export function useCrisisEvents() {
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('crisis_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setEvents(data as unknown as CrisisEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel('crisis-events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crisis_events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [payload.new as unknown as CrisisEvent, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(e => e.id === (payload.new as any).id ? payload.new as unknown as CrisisEvent : e));
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(e => e.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CrisisEvent>) => {
    const { error } = await supabase.from('crisis_events').update(updates as any).eq('id', id);
    return !error;
  }, []);

  return { events, loading, refetch: fetchEvents, updateEvent };
}
