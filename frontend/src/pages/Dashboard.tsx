import { useState, useMemo } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { ChatPanel } from '@/components/ChatPanel';
import { TravelRiskBanner } from '@/components/TravelRiskBanner';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [filters] = useState<FilterState>({
    dateRange: { from: null, to: null }, regions: [], countries: [], tags: [],
    sources: [], searchQuery: '', categories: [], threatLevels: [],
    confidenceLevels: [], actorTypes: [], timeRange: '24h',
  });

  const { newsItems, loading, deleteNewsItem } = useNewsItems();
  useNewsFetch();

  const displayItems = newsItems;
  const mapItems = useMemo(() =>
    countryFilter === 'all' ? displayItems : displayItems.filter(i => i.country === countryFilter),
    [displayItems, countryFilter]
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        newsItems={displayItems}
        onSelectItem={setSelectedItem}
        onToggleChat={() => setShowChat(!showChat)}
        chatOpen={showChat}
      />

      {/* Travel Security Risk Banner */}
      <TravelRiskBanner newsItems={displayItems} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <aside className={`w-[420px] min-w-[300px] border-r border-border flex-shrink-0 transition-all duration-300 ${
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

        {/* Map */}
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
        {selectedItem && !showChat && (
          <aside className="w-80 border-l border-border flex-shrink-0 bg-background">
            <NewsDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          </aside>
        )}

        {/* Chat Panel */}
        {showChat && (
          <aside className="w-[340px] border-l border-[#22c55e]/30 flex-shrink-0">
            <ChatPanel onClose={() => setShowChat(false)} />
          </aside>
        )}
      </div>
    </div>
  );
}
