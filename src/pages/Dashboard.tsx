import { useState, useMemo } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { List, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [mobileView, setMobileView] = useState<'feed' | 'map'>('feed');
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { from: null, to: null },
    regions: [],
    countries: [],
    tags: [],
    sources: [],
    searchQuery: '',
    categories: [],
    threatLevels: [],
    confidenceLevels: [],
    actorTypes: [],
    timeRange: '24h',
  });
  const { newsItems, loading, createNewsItem, deleteNewsItem, refetch } = useNewsItems();
  
  // Auto-fetch intel from sources every 5 minutes
  useNewsFetch();

  const displayItems = newsItems;

  // Items filtered by country for the map
  const mapItems = useMemo(() => {
    if (countryFilter === 'all') return displayItems;
    return displayItems.filter(item => item.country === countryFilter);
  }, [displayItems, countryFilter]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        newsItems={displayItems}
        onSelectItem={setSelectedItem}
      />

      {/* Mobile view toggle (visible < md) */}
      <div className="md:hidden flex border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
        <button
          onClick={() => setMobileView('feed')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2',
            mobileView === 'feed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="w-4 h-4" />
          Feed
          <span className="text-[10px] opacity-60">({displayItems.length})</span>
        </button>
        <button
          onClick={() => setMobileView('map')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2',
            mobileView === 'map'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <MapIcon className="w-4 h-4" />
          Map
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Reports Feed — full-width on mobile (toggled), 1/2 on md+ */}
        <aside
          className={cn(
            'border-r border-border flex-shrink-0 bg-background',
            'w-full md:w-1/2',
            mobileView === 'feed' ? 'flex' : 'hidden',
            'md:flex'
          )}
        >
          {loading ? (
            <div className="p-5 space-y-4 w-full">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NewsFeed
              newsItems={displayItems}
              onSelectItem={(item) => {
                setSelectedItem(item);
              }}
              selectedItem={selectedItem}
              onDeleteItem={deleteNewsItem}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
            />
          )}
        </aside>

        {/* Map — full-width on mobile (toggled), flex-1 on md+ */}
        <main
          className={cn(
            'overflow-hidden relative',
            'flex-1',
            mobileView === 'map' ? 'flex' : 'hidden',
            'md:flex'
          )}
        >
          <div className="absolute inset-0">
            <IntelMap
              newsItems={mapItems}
              onSelectItem={setSelectedItem}
              selectedItem={selectedItem}
              showPopups={countryFilter !== 'all'}
            />
          </div>
        </main>

        {/* Detail Panel — overlay on mobile, side panel on lg+ */}
        {selectedItem && (
          <aside
            className={cn(
              'border-l border-border bg-background z-40',
              'fixed inset-0 md:relative md:inset-auto',
              'w-full md:w-80 flex-shrink-0',
              'flex'
            )}
          >
            <NewsDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
