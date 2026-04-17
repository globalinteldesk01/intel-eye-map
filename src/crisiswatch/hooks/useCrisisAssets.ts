import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CrisisAsset } from '../types';

export function useCrisisAssets() {
  const [assets, setAssets] = useState<CrisisAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('crisis_assets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setAssets(data as unknown as CrisisAsset[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const addAsset = useCallback(async (asset: Omit<CrisisAsset, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('crisis_assets')
      .insert({ ...asset, user_id: user.id } as any)
      .select()
      .single();
    if (!error && data) {
      setAssets(prev => [data as unknown as CrisisAsset, ...prev]);
      return data;
    }
    return null;
  }, [user]);

  const deleteAsset = useCallback(async (id: string) => {
    const { error } = await supabase.from('crisis_assets').delete().eq('id', id);
    if (!error) setAssets(prev => prev.filter(a => a.id !== id));
    return !error;
  }, []);

  return { assets, loading, addAsset, deleteAsset, refetch: fetchAssets };
}
