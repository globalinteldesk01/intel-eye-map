import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { IntelligenceTimeline } from '@/components/timeline/IntelligenceTimeline';
import { useNewsItems } from '@/hooks/useNewsItems';
import { IntelligenceEvent } from '@/types/timeline';
import { newsItemsToTimelineEvents } from '@/utils/newsToTimelineAdapter';
import { mockTimelineEvents } from '@/data/mockTimelineEvents';
import { Skeleton } from '@/components/ui/skeleton';

export default function Timeline() {
  const [selectedEvent, setSelectedEvent] = useState<IntelligenceEvent | null>(null);
  const { newsItems, loading } = useNewsItems();

  // Transform database news items to timeline events
  const timelineEvents = useMemo(() => {
    if (newsItems.length > 0) {
      return newsItemsToTimelineEvents(newsItems);
    }
    // Fall back to mock data if no database items
    return mockTimelineEvents;
  }, [newsItems]);

  return (
    <div className="h-screen flex flex-col bg-background grid-pattern">
      <Header
        onToggleSidebar={() => {}}
        newsItems={newsItems}
      />

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full">
            <div className="w-64 shrink-0 border-r border-border p-4 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="flex-1 p-4">
              <div className="flex gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-72 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <IntelligenceTimeline
            events={timelineEvents}
            onEventSelect={setSelectedEvent}
            isPremium={true}
          />
        )}
      </div>
    </div>
  );
}
