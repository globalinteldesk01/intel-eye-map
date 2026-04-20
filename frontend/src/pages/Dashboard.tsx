import { useState, useMemo, useEffect, useRef } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Radio, AlertCircle, Zap, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string>('all');
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
  const { isFetching, lastFetchTime, fetchStatus, refreshNow } = useNewsFetch();

  // Track new items since last seen for live indicator
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const prevCountRef = useRef(0);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  // Track newly arrived items
  useEffect(() => {
    if (newsItems.length > prevCountRef.current && prevCountRef.current > 0) {
      const diff = newsItems.length - prevCountRef.current;
      setNewItemsCount(prev => prev + diff);
    }
    prevCountRef.current = newsItems.length;
  }, [newsItems.length]);

  const handleRefresh = async () => {
    setNewItemsCount(0);
    setLastSeen(new Date());
    await refreshNow();
    await refetch();
  };

  const displayItems = newsItems;

  // Items filtered by country for the map
  const mapItems = useMemo(() => {
    if (countryFilter === 'all') return displayItems;
    return displayItems.filter(item => item.country === countryFilter);
  }, [displayItems, countryFilter]);

  // Count critical/high items
  const criticalCount = useMemo(() => 
    displayItems.filter(item => item.threatLevel === 'critical').length, 
    [displayItems]
  );
  const highCount = useMemo(() => 
    displayItems.filter(item => item.threatLevel === 'high').length, 
    [displayItems]
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        newsItems={displayItems}
        onSelectItem={setSelectedItem}
        onCreateNews={createNewsItem}
      />

      {/* Live Status Bar - Samdesk-style */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[hsl(215,30%,12%)] border-b border-border/40 text-xs">
        <div className="flex items-center gap-4">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-green-400 font-bold tracking-widest uppercase text-[10px]">Live</span>
          </div>

          {/* Source count */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Radio className="w-3 h-3 text-blue-400" />
            <span className="text-blue-300">{fetchStatus?.sources_checked || 12} sources</span>
          </div>

          {/* Total reports */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-foreground/60">{displayItems.length} reports</span>
          </div>

          {/* Threat summary */}
          {criticalCount > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold">
              <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
              {criticalCount} CRITICAL
            </Badge>
          )}
          {highCount > 0 && (
            <Badge className="h-4 px-1.5 text-[9px] font-bold bg-orange-600 hover:bg-orange-600">
              {highCount} HIGH
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* New items notification */}
          {newItemsCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-400 animate-pulse">
              <Zap className="w-3 h-3" />
              <span className="font-semibold">{newItemsCount} new</span>
            </div>
          )}

          {/* Last updated */}
          {lastFetchTime && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatDistanceToNow(lastFetchTime, { addSuffix: true })}</span>
            </div>
          )}

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Fetching...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Reports Feed */}
        <aside className={`w-1/2 border-r border-border flex-shrink-0 transition-all duration-300 ${
          showSidebar ? 'translate-x-0' : '-translate-x-full absolute lg:relative lg:translate-x-0'
        }`}>
          {loading ? (
            <div className="p-5 space-y-4">
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
              onSelectItem={setSelectedItem}
              selectedItem={selectedItem}
              onDeleteItem={deleteNewsItem}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
            />
          )}
        </aside>

        {/* Right Panel - Map */}
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0">
            <IntelMap
              newsItems={mapItems}
              onSelectItem={setSelectedItem}
              selectedItem={selectedItem}
              showPopups={countryFilter !== 'all'}
            />
          </div>
        </main>

        {/* Detail Panel */}
        {selectedItem && (
          <aside className="w-80 border-l border-border flex-shrink-0 bg-background">
            <NewsDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
