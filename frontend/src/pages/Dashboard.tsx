import { useState, useMemo } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { ChatPanel } from '@/components/ChatPanel';
import { MobileNav } from '@/components/MobileNav';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';

type MobileTab = 'feed' | 'map' | 'chat';

export default function Dashboard() {
  const isMobile = useIsMobile();

  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar]   = useState(true);
  const [showChat, setShowChat]         = useState(false);
  const [mobileTab, setMobileTab]       = useState<MobileTab>('feed');
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

  const handleSelectItem = (item: NewsItem) => {
    setSelectedItem(item);
    if (isMobile) setMobileTab('feed'); // show detail in feed tab
  };

  const handleMobileTab = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'chat') setShowChat(true);
    else setShowChat(false);
    if (tab !== 'feed') setSelectedItem(null);
  };

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <Header
          onToggleSidebar={() => {}}
          newsItems={displayItems}
          onSelectItem={handleSelectItem}
          onToggleChat={() => handleMobileTab('chat')}
          chatOpen={mobileTab === 'chat'}
        />

        {/* Mobile content area */}
        <div className="flex-1 overflow-hidden relative">
          {/* Intel Feed Tab */}
          {mobileTab === 'feed' && (
            <div className="absolute inset-0 overflow-y-auto">
              {selectedItem ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 bg-secondary/40 border-b border-border">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Intel Detail</span>
                    <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <NewsDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
                  </div>
                </div>
              ) : loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <NewsFeed
                  newsItems={displayItems}
                  onSelectItem={handleSelectItem}
                  selectedItem={selectedItem}
                  onDeleteItem={deleteNewsItem}
                  countryFilter={countryFilter}
                  onCountryFilterChange={setCountryFilter}
                />
              )}
            </div>
          )}

          {/* Map Tab */}
          {mobileTab === 'map' && (
            <div className="absolute inset-0">
              <IntelMap
                newsItems={mapItems}
                onSelectItem={(item) => { setSelectedItem(item); setMobileTab('feed'); }}
                selectedItem={selectedItem}
                showPopups={true}
              />
            </div>
          )}

          {/* Chat Tab */}
          {mobileTab === 'chat' && (
            <div className="absolute inset-0">
              <ChatPanel onClose={() => handleMobileTab('feed')} />
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          activeTab={mobileTab}
          onTabChange={handleMobileTab}
        />
        {/* Spacer for bottom nav */}
        <div className="h-16 shrink-0" />
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        newsItems={displayItems}
        onSelectItem={setSelectedItem}
        onToggleChat={() => setShowChat(!showChat)}
        chatOpen={showChat}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left — Feed */}
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

        {/* Center — Map */}
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

        {/* Right — Detail */}
        {selectedItem && !showChat && (
          <aside className="w-80 border-l border-border flex-shrink-0 bg-background overflow-y-auto">
            <NewsDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          </aside>
        )}

        {/* Right — Chat */}
        {showChat && (
          <aside className="w-[340px] border-l border-[#22c55e]/30 flex-shrink-0">
            <ChatPanel onClose={() => setShowChat(false)} />
          </aside>
        )}
      </div>
    </div>
  );
}
