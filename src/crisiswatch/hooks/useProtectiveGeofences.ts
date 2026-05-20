import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProtectiveGeofence {
  id: string;
  user_id: string;
  name: string;
  shape: 'circle' | 'polygon';
  center_lat: number | null;
  center_lon: number | null;
  radius_km: number | null;
  polygon: unknown;
  min_severity: 'critical' | 'high' | 'medium' | 'low';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NewGeofence = Omit<ProtectiveGeofence, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useProtectiveGeofences() {
  const { user } = useAuth();
  const [geofences, setGeofences] = useState<ProtectiveGeofence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('protective_geofences' as never)
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setGeofences(data as unknown as ProtectiveGeofence[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (g: NewGeofence) => {
    if (!user) return null;
    const { data } = await supabase
      .from('protective_geofences' as never)
      .insert({ ...g, user_id: user.id } as never)
      .select()
      .single();
    if (data) setGeofences(prev => [data as unknown as ProtectiveGeofence, ...prev]);
    return data;
  };

  const update = async (id: string, patch: Partial<NewGeofence>) => {
    const { data } = await supabase
      .from('protective_geofences' as never)
      .update(patch as never)
      .eq('id', id)
      .select()
      .single();
    if (data) setGeofences(prev => prev.map(g => g.id === id ? (data as unknown as ProtectiveGeofence) : g));
  };

  const remove = async (id: string) => {
    await supabase.from('protective_geofences' as never).delete().eq('id', id);
    setGeofences(prev => prev.filter(g => g.id !== id));
  };

  return { geofences, loading, create, update, remove, refetch: fetch };
}