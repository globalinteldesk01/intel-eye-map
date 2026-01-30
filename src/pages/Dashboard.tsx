import { useState } from 'react';
import { NewsItem, FilterState } from '@/types/news';
import { Header } from '@/components/Header';
import { NewsFeed } from '@/components/NewsFeed';
import { IntelMap } from '@/components/IntelMap';
import { NewsDetail } from '@/components/NewsDetail';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { WatchlistManager } from '@/components/WatchlistManager';
import { AlertRulesManager } from '@/components/AlertRulesManager';
import { useNewsItems } from '@/hooks/useNewsItems';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Map, BarChart3, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type DashboardView = 'map' | 'executive';

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showManagementPanel, setShowManagementPanel] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('map');
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

  // Use only database items (no mock data fallback)
  const displayItems = newsItems;

  // Apply filters handler for watchlist
  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Analyst dashboard - full detailed view with map/executive toggle and news feed
  return (
    <div className="h-screen flex flex-col bg-background grid-pattern scanline">
      <Header
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        showSidebar={showSidebar}
        newsItems={displayItems}
        onSelectItem={setSelectedItem}
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
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* View Toggle Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
            <Tabs value={dashboardView} onValueChange={(v) => setDashboardView(v as DashboardView)}>
              <TabsList className="h-8">
                <TabsTrigger value="map" className="text-xs gap-1.5 px-3">
                  <Map className="w-3.5 h-3.5" />
                  Intel Map
                </TabsTrigger>
                <TabsTrigger value="executive" className="text-xs gap-1.5 px-3">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Executive View
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs gap-1.5"
              onClick={() => setShowManagementPanel(!showManagementPanel)}
            >
              {showManagementPanel ? (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  Hide Tools
                </>
              ) : (
                <>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Show Tools
                </>
              )}
            </Button>
          </div>

          {/* Main View Content */}
          <div className="flex-1 overflow-hidden relative flex">
            <div className="flex-1 relative">
              {dashboardView === 'map' ? (
                <div className="absolute inset-0">
                  <IntelMap
                    newsItems={displayItems}
                    onSelectItem={setSelectedItem}
                    selectedItem={selectedItem}
                  />
                </div>
              ) : (
                <ExecutiveDashboard newsItems={displayItems} loading={loading} />
              )}
            </div>

            {/* Management Tools Panel */}
            {showManagementPanel && (
              <aside className="w-72 border-l border-border bg-card/50 flex-shrink-0">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    <WatchlistManager 
                      currentFilters={filters} 
                      onApplyFilters={handleApplyFilters} 
                    />
                    <AlertRulesManager />
                  </div>
                </ScrollArea>
              </aside>
            )}
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
