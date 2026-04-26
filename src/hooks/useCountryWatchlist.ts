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

// All countries in the world
const ALL_COUNTRIES = [
  // ── ASEAN Countries (Priority) ──
  'Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar',
  'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam',
  // ── Africa ──
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
  'Congo', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt',
  'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia',
  'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho',
  'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania',
  'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
  'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone',
  'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo',
  'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
  // ── Americas ──
  'Antigua and Barbuda', 'Argentina', 'Bahamas', 'Barbados', 'Belize',
  'Bolivia', 'Brazil', 'Canada', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
  'Dominica', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Grenada',
  'Guatemala', 'Guyana', 'Haiti', 'Honduras', 'Jamaica', 'Mexico',
  'Nicaragua', 'Panama', 'Paraguay', 'Peru', 'Saint Kitts and Nevis',
  'Saint Lucia', 'Saint Vincent and the Grenadines', 'Suriname',
  'Trinidad and Tobago', 'United States', 'Uruguay', 'Venezuela',
  // ── Europe ──
  'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
  'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland',
  'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia',
  'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia',
  'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine',
  'United Kingdom', 'Vatican City',
  // ── Asia ──
  'Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan',
  'China', 'Georgia', 'India', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan',
  'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Lebanon', 'Maldives', 'Mongolia',
  'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Qatar',
  'Saudi Arabia', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan',
  'Turkey', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Yemen',
  // ── Oceania ──
  'Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru',
  'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa', 'Solomon Islands',
  'Tonga', 'Tuvalu', 'Vanuatu',
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
