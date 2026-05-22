import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { dateTimeValue } from '@/utils/time';

export interface ProtectiveAlert {
  id: string;
  user_id: string;
  event_id: string;
  source_kind: 'asset' | 'traveler' | 'geofence';
  source_id: string | null;
  source_name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  distance_km: number | null;
  is_read: boolean;
  created_at: string;
}

const sortDesc = (a: ProtectiveAlert, b: ProtectiveAlert) =>
  dateTimeValue(b.created_at) - dateTimeValue(a.created_at);

export function useProtectiveAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ProtectiveAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('protective_alerts' as never)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setAlerts((data as unknown as ProtectiveAlert[]).sort(sortDesc));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('protective-alerts-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'protective_alerts', filter: `user_id=eq.${user.id}` }, (payload) => {
        const row = payload.new as unknown as ProtectiveAlert;
        setAlerts(prev => [row, ...prev].sort(sortDesc));
        toast.error(`${row.severity.toUpperCase()} · ${row.source_name}`, {
          description: `New event matched your ${row.source_kind}`,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    await supabase.from('protective_alerts' as never).update({ is_read: true } as never).eq('id', id);
  };

  const dismiss = async (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    await supabase.from('protective_alerts' as never).delete().eq('id', id);
  };

  return { alerts, loading, markRead, dismiss, refetch: fetchAlerts };
}