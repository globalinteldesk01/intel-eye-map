import { useState, useMemo, useEffect, useRef } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { from: null, to: null },
    regions: [], countries: [], tags: [], sources: [],
    searchQuery: '', categories: [], threatLevels: [],
    confidenceLevels: [], actorTypes: [], timeRange: '24h',
  });

  const { newsItems, loading, createNewsItem, deleteNewsItem } = useNewsItems();
  const { fetchStatus, lastFetchTime } = useNewsFetch();

  const displayItems = newsItems;
  const mapItems = useMemo(() => {
    if (countryFilter === 'all') return displayItems;
    return displayItems.filter(item => item.country === countryFilter);
  }, [displayItems, countryFilter]);

  // Stats
  const criticalCount = useMemo(() => displayItems.filter(i => i.threatLevel === 'critical').length, [displayItems]);
  const highCount = useMemo(() => displayItems.filter(i => i.threatLevel === 'high').length, [displayItems]);
  const sourceCount = fetchStatus?.sources_checked || 0;
  const newItemsCount = fetchStatus?.last_fetch_count || 0;

  // Latest 20 items for the live ticker
  const tickerItems = useMemo(() => displayItems.slice(0, 20), [displayItems]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        newsItems={displayItems}
        onSelectItem={setSelectedItem}
      />

      {/* Live Status Bar */}
      <div className="flex-shrink-0 bg-[hsl(222,47%,7%)] border-b border-border px-4 py-1.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 text-xs font-bold tracking-widest font-mono">LIVE</span>
        </div>
        <div className="h-3 w-px bg-border/60" />
        <span className="text-muted-foreground text-xs font-mono">
          <span className="text-foreground font-semibold">{sourceCount || 45}</span> sources
        </span>
        <span className="text-muted-foreground text-xs font-mono">
          <span className="text-foreground font-semibold">{displayItems.length}</span> reports
        </span>
        {criticalCount > 0 && (
          <span className="bg-red-950/60 text-red-400 border border-red-900/50 text-xs font-bold px-2 py-0.5 rounded font-mono">
            {criticalCount} CRIT
          </span>
        )}
        {highCount > 0 && (
          <span className="bg-orange-950/60 text-orange-400 border border-orange-900/50 text-xs font-bold px-2 py-0.5 rounded font-mono">
            {highCount} HIGH
          </span>
        )}
        {newItemsCount > 0 && (
          <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-900/50 text-xs font-bold px-2 py-0.5 rounded font-mono animate-pulse">
            +{newItemsCount} NEW
          </span>
        )}
        <div className="ml-auto text-muted-foreground text-xs font-mono">
          {lastFetchTime ? `Updated ${formatDistanceToNow(lastFetchTime, { addSuffix: true })}` : 'Initializing...'}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <aside className={`w-[420px] border-r border-border flex-shrink-0 transition-all duration-300 ${
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

        {/* Map Panel */}
        <main className="flex-1 overflow-hidden relative" style={{ paddingBottom: '32px' }}>
          <div className="absolute inset-0" style={{ bottom: '0px' }}>
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

      {/* Live Ticker (Samdesk-style) */}
      {tickerItems.length > 0 && (
        <div className="flex-shrink-0 h-8 bg-black border-t border-green-900/40 flex items-center overflow-hidden z-50">
          <div className="flex-shrink-0 bg-red-600 h-full flex items-center px-3 gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
            </span>
            <span className="text-white text-[11px] font-black tracking-widest font-mono">LIVE</span>
          </div>
          <div className="flex-1 overflow-hidden relative h-full">
            <div className="ticker-scroll flex items-center h-full">
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span
                  key={`${item.id}-${i}`}
                  className="inline-flex items-center gap-2 cursor-pointer hover:text-green-300 transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: item.threatLevel === 'critical' ? '#ef4444' :
                        item.threatLevel === 'high' ? '#f97316' :
                        item.threatLevel === 'elevated' ? '#eab308' : '#22c55e'
                    }}
                  />
                  <span className="text-green-400 text-[11px] font-mono whitespace-nowrap">
                    {item.source.toUpperCase()}
                  </span>
                  <span className="text-white/70 text-[11px] whitespace-nowrap">
                    {item.title.length > 80 ? item.title.slice(0, 80) + '…' : item.title}
                  </span>
                  <span className="text-white/20 mx-3 text-[11px]">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
