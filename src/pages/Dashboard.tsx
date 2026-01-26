import { useState } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { mockNewsData } from '@/data/mockNews';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { useNewsItems } from '@/hooks/useNewsItems';
import { useNewsFetch } from '@/hooks/useNewsFetch';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
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
  const { newsItems, loading, createNewsItem, deleteNewsItem } = useNewsItems();
  const { isFetching, lastFetchTime, nextFetchTime, refreshNow } = useNewsFetch();

  // Use only database items (no mock data fallback)
  const displayItems = newsItems;

  // Analyst dashboard - full detailed view with map and news feed
  return (
    <div className="h-screen flex flex-col bg-background grid-pattern scanline">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        showSidebar={showSidebar}
        onCreateNews={createNewsItem}
        newsItems={displayItems}
        isFetching={isFetching}
        lastFetchTime={lastFetchTime}
        nextFetchTime={nextFetchTime}
        onRefreshNews={refreshNow}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - News Feed */}
        <aside className={`w-96 border-r border-border flex-shrink-0 transition-all duration-300 ${
          showSidebar ? 'translate-x-0' : '-translate-x-full absolute lg:relative lg:translate-x-0'
        }`}>
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <NewsFeed
              newsItems={displayItems}
              onSelectItem={setSelectedItem}
              selectedItem={selectedItem}
              onDeleteItem={deleteNewsItem}
            />
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0">
            <IntelMap
              newsItems={displayItems}
              onSelectItem={setSelectedItem}
              selectedItem={selectedItem}
            />
          </div>
        </main>

        {/* Right Sidebar - News Detail */}
        {selectedItem && (
          <aside className="w-80 border-l border-border flex-shrink-0 bg-background">
            <NewsDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
