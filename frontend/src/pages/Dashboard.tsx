import { useState, useMemo } from 'react';
import { NewsItem } from '@/types/news';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { IntelMap } from '@/components/IntelMap';
import { LiveFeedPanel } from '@/components/LiveFeedPanel';
import { NewsDetail } from '@/components/NewsDetail';
import { ThreatStatsOverlay } from '@/components/ThreatStatsOverlay';
import { ChatPanel } from '@/components/ChatPanel';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Newspaper, BarChart3, History, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type MapTab = 'live' | 'history' | 'safety';

export default function Dashboard() {
  const [activeView, setActiveView] = useState('map');
  const [showFeed, setShowFeed] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [mapTab, setMapTab] = useState<MapTab>('live');
  const [countryFilter, setCountryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { newsItems, loading, deleteNewsItem, refetch } = useNewsItems();
  const { isFetching, lastFetchTime, fetchStatus, refreshNow } = useNewsFetch();

  const handleSelectItem = (item: NewsItem) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  const mapItems = useMemo(() =>
    countryFilter === 'all' ? newsItems : newsItems.filter(i => i.country === countryFilter),
    [newsItems, countryFilter]
  );

  const filteredFeedItems = useMemo(() => {
    if (!searchQuery) return newsItems;
    const q = searchQuery.toLowerCase();
    return newsItems.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.country?.toLowerCase().includes(q) ||
      i.city?.toLowerCase().includes(q) ||
      i.source?.toLowerCase().includes(q)
    );
  }, [newsItems, searchQuery]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0f1a] overflow-hidden">
      {/* Top Header */}
      <Header
        newsItems={newsItems}
        isFetching={isFetching}
        lastFetchTime={lastFetchTime}
        sourcesCount={fetchStatus?.sources_checked}
        onSearch={setSearchQuery}
        onRefresh={async () => { await refreshNow(); await refetch(); }}
      />

      {/* Main: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            if (view === 'live-feed') setShowFeed(true);
          }}
          onToggleChat={() => { setShowChat(!showChat); setActiveView('chat'); }}
        />

        {/* Center: Full-screen map + overlays */}
        <main className="flex-1 relative overflow-hidden">
          {/* Map tabs */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-0.5 bg-[#0f1724]/90 backdrop-blur border border-[#2a3a52] rounded-lg p-0.5">
            {[
              { id: 'live' as MapTab,    label: 'Live Map',      icon: Map },
              { id: 'history' as MapTab, label: 'Threat History', icon: History },
              { id: 'safety' as MapTab,  label: 'Safety Map',     icon: ShieldCheck },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setMapTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all',
                    mapTab === tab.id
                      ? 'bg-[#2563eb] text-white'
                      : 'text-[#64748b] hover:text-white hover:bg-white/5'
                  )}>
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Toggle buttons */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            <button
              onClick={() => setShowFeed(!showFeed)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all',
                showFeed
                  ? 'bg-[#2563eb]/20 border-[#2563eb]/50 text-[#4a90d9]'
                  : 'bg-[#0f1724]/90 border-[#2a3a52] text-[#64748b] hover:text-white'
              )}>
              <Newspaper className="w-3 h-3" />
              Intel Feed
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all',
                showStats
                  ? 'bg-[#2563eb]/20 border-[#2563eb]/50 text-[#4a90d9]'
                  : 'bg-[#0f1724]/90 border-[#2a3a52] text-[#64748b] hover:text-white'
              )}>
              <BarChart3 className="w-3 h-3" />
              Stats
            </button>
          </div>

          {/* MAP */}
          <div className="absolute inset-0">
            <IntelMap
              newsItems={mapItems}
              onSelectItem={handleSelectItem}
              selectedItem={selectedItem}
              showPopups={true}
              darkMode={true}
            />
          </div>

          {/* Threat Stats overlay (bottom-left, AlertMedia style) */}
          {showStats && !loading && (
            <div className="absolute bottom-8 left-3 z-20">
              <ThreatStatsOverlay
                newsItems={newsItems}
                onClose={() => setShowStats(false)}
                selectedCountry={countryFilter !== 'all' ? countryFilter : undefined}
              />
            </div>
          )}
        </main>

        {/* Right panels */}
        {showFeed && !showChat && !showDetail && (
          <LiveFeedPanel
            newsItems={filteredFeedItems}
            onSelectItem={handleSelectItem}
            selectedItem={selectedItem}
            onClose={() => setShowFeed(false)}
          />
        )}

        {showDetail && selectedItem && !showChat && (
          <div className="w-[340px] bg-[#0f1724] border-l border-[#1e2d44] overflow-y-auto">
            <NewsDetail item={selectedItem} onClose={() => { setShowDetail(false); setSelectedItem(null); }} />
          </div>
        )}

        {showChat && (
          <div className="w-[340px] border-l border-[#22c55e]/30">
            <ChatPanel onClose={() => { setShowChat(false); setActiveView('map'); }} />
          </div>
        )}
      </div>
    </div>
  );
}
