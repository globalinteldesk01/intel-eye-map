import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CountryWatchlistItem {
  id: string;
  country_name: string;
  is_active: boolean;
  created_at: string;
}

// Comprehensive list of countries commonly appearing in OSINT intel
const ALL_COUNTRIES = [
  'Afghanistan', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Azerbaijan',
  'Bangladesh', 'Belarus', 'Belgium', 'Bosnia', 'Brazil', 'Burkina Faso',
  'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile',
  'China', 'Colombia', 'Congo', 'Crimea', 'Cuba', 'Cyprus',
  'Czech Republic', 'Denmark', 'Ecuador', 'Egypt', 'Eritrea', 'Estonia',
  'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Guatemala', 'Haiti', 'Honduras', 'Hungary', 'India', 'Indonesia', 'Iran',
  'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Latvia', 'Lebanon', 'Libya',
  'Lithuania', 'Malaysia', 'Mali', 'Mexico', 'Moldova', 'Mongolia', 'Morocco',
  'Mozambique', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
  'Niger', 'Nigeria', 'North Korea', 'Norway', 'Oman', 'Pakistan', 'Palestine',
  'Panama', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Singapore', 'Slovakia', 'Slovenia', 'Somalia', 'South Africa', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen',
  'Zimbabwe',
];

export function useCountryWatchlist() {
  const [watchlist, setWatchlist] = useState<CountryWatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchWatchlist = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('country_watchlist')
        .select('*')
        .eq('user_id', user.id)
        .order('country_name');

      if (error) throw error;
      setWatchlist((data as CountryWatchlistItem[]) || []);
    } catch (err) {
      console.error('Error fetching country watchlist:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addCountry = useCallback(async (countryName: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('country_watchlist')
        .insert({ user_id: user.id, country_name: countryName })
        .select()
        .single();

      if (error) throw error;
      setWatchlist(prev => [...prev, data as CountryWatchlistItem].sort((a, b) => a.country_name.localeCompare(b.country_name)));
      toast({ title: 'Country Added', description: `${countryName} added to your watchlist.` });
    } catch (err: any) {
      if (err?.code === '23505') {
        toast({ title: 'Already Added', description: `${countryName} is already in your watchlist.`, variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to add country.', variant: 'destructive' });
      }
    }
  }, [user, toast]);

  const removeCountry = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('country_watchlist')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setWatchlist(prev => prev.filter(item => item.id !== id));
      toast({ title: 'Country Removed', description: 'Country removed from watchlist.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove country.', variant: 'destructive' });
    }
  }, [user, toast]);

  const toggleCountry = useCallback(async (id: string, isActive: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('country_watchlist')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      setWatchlist(prev => prev.map(item => item.id === id ? { ...item, is_active: isActive } : item));
    } catch {
      toast({ title: 'Error', description: 'Failed to update country.', variant: 'destructive' });
    }
  }, [user, toast]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const activeCountries = watchlist.filter(c => c.is_active).map(c => c.country_name);

  return {
    watchlist,
    loading,
    activeCountries,
    addCountry,
    removeCountry,
    toggleCountry,
    allCountries: ALL_COUNTRIES,
    refetch: fetchWatchlist,
  };
}
