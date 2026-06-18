import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentType =
  | 'suspicious_activity' | 'intrusion' | 'trespass' | 'theft' | 'vandalism'
  | 'assault' | 'medical' | 'fire' | 'evacuation' | 'protest' | 'vehicle' | 'cyber' | 'other';
export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'false_alarm';
export type SensorKind =
  | 'camera' | 'motion' | 'perimeter' | 'badge' | 'panic' | 'environmental' | 'vehicle' | 'door' | 'other';

export interface TacticalIncident {
  id: string;
  user_id: string;
  occurred_at: string;
  incident_type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  asset_id: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TacticalSensorAlert {
  id: string;
  user_id: string;
  source_kind: SensorKind;
  device_id: string | null;
  device_name: string | null;
  severity: Severity;
  message: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  occurred_at: string;
  created_at: string;
}

const TABLE_I = 'tactical_incidents';
const TABLE_S = 'tactical_sensor_alerts';

export function useTacticalIncidents() {
  const { user } = useAuth();
  const [items, setItems] = useState<TacticalIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from(TABLE_I).select('*').order('occurred_at', { ascending: false }).limit(200);
    setItems((data || []) as TacticalIncident[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
    if (!user) return;
    const ch = supabase.channel('tactical-incidents-rt')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE_I, filter: `user_id=eq.${user.id}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch]);

  const create = useCallback(async (payload: Partial<TacticalIncident> & { title: string }) => {
    if (!user) throw new Error('Not signed in');
    const { error } = await (supabase as any).from(TABLE_I).insert({ ...payload, user_id: user.id });
    if (error) throw error;
  }, [user]);

  const update = useCallback(async (id: string, patch: Partial<TacticalIncident>) => {
    const { error } = await (supabase as any).from(TABLE_I).update(patch).eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from(TABLE_I).delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { items, loading, refetch, create, update, remove };
}

export function useTacticalSensorAlerts() {
  const { user } = useAuth();
  const [items, setItems] = useState<TacticalSensorAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from(TABLE_S).select('*').order('occurred_at', { ascending: false }).limit(200);
    setItems((data || []) as TacticalSensorAlert[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
    if (!user) return;
    const ch = supabase.channel('tactical-sensor-rt')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE_S, filter: `user_id=eq.${user.id}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch]);

  const acknowledge = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from(TABLE_S)
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from(TABLE_S).delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { items, loading, refetch, acknowledge, remove };
}