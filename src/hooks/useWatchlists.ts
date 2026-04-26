import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FilterState } from '@/types/news';

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filters: FilterState;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWatchlistInput {
  name: string;
  description?: string;
  filters: FilterState;
  is_shared?: boolean;
}

export function useWatchlists() {
  const { user } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlists = useCallback(async () => {
    if (!user) {
      setWatchlists([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watchlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = (data || []).map(w => ({
        ...w,
        filters: w.filters as unknown as FilterState
      }));
      
      setWatchlists(typedData);
    } catch (err) {
      console.error('Error fetching watchlists:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createWatchlist = async (input: CreateWatchlistInput) => {
    if (!user) throw new Error('Must be logged in');

    const { data, error } = await supabase
      .from('watchlists')
      .insert([{
        user_id: user.id,
        name: input.name,
        description: input.description || null,
        filters: JSON.parse(JSON.stringify(input.filters)),
        is_shared: input.is_shared || false,
      }])
      .select()
      .single();

    if (error) throw error;

    const newWatchlist = {
      ...data,
      filters: data.filters as unknown as FilterState
    };
    
    setWatchlists(prev => [newWatchlist, ...prev]);
    return newWatchlist;
  };

  const updateWatchlist = async (id: string, input: Partial<CreateWatchlistInput>) => {
    if (!user) throw new Error('Must be logged in');

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.filters !== undefined) updateData.filters = input.filters as unknown as Record<string, unknown>;
    if (input.is_shared !== undefined) updateData.is_shared = input.is_shared;

    const { data, error } = await supabase
      .from('watchlists')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    const updatedWatchlist = {
      ...data,
      filters: data.filters as unknown as FilterState
    };
    
    setWatchlists(prev => prev.map(w => w.id === id ? updatedWatchlist : w));
    return updatedWatchlist;
  };

  const deleteWatchlist = async (id: string) => {
    if (!user) throw new Error('Must be logged in');

    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    setWatchlists(prev => prev.filter(w => w.id !== id));
  };

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  return {
    watchlists,
    loading,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    refetch: fetchWatchlists,
  };
}
