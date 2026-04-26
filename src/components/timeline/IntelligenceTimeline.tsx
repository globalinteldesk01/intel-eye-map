import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { IntelligenceEvent, TimelineFilters, SEVERITY_COLORS, CLIENT_SECTOR_PRIORITIES } from '@/types/timeline';
import { TimelineEventCard } from './TimelineEventCard';
import { TimelineFilterPanel } from './TimelineFilterPanel';
import { TimelineDetailPanel } from './TimelineDetailPanel';
import { format, parseISO, isAfter, subHours, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronLeft, ChevronRight, Layers, Map, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntelligenceTimelineProps {
  events: IntelligenceEvent[];
  onEventSelect?: (event: IntelligenceEvent | null) => void;
  onLocateOnMap?: (event: IntelligenceEvent) => void;
  isPremium?: boolean;
}

const DEFAULT_FILTERS: TimelineFilters = {
  regions: [],
  categories: [],
  severities: [],
  event_states: [],
  impact_tags: [],
  time_window: 'all',
  search: '',
};

export function IntelligenceTimeline({ 
  events, 
  onEventSelect,
  onLocateOnMap,
  isPremium = false 
}: IntelligenceTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<IntelligenceEvent | null>(null);
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  // Default: filters open on desktop, closed on mobile (avoids overlay covering content on first load)
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Time window filter
    if (filters.time_window !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (filters.time_window) {
        case '6h': cutoff = subHours(now, 6); break;
        case '12h': cutoff = subHours(now, 12); break;
        case '24h': cutoff = subHours(now, 24); break;
        case '7d': cutoff = subDays(now, 7); break;
        case '30d': cutoff = subDays(now, 30); break;
        default: cutoff = new Date(0);
      }
      result = result.filter(e => isAfter(parseISO(e.timestamp), cutoff));
    }

    // Client sector prioritization
    if (filters.client_sector) {
      const priorityCategories = CLIENT_SECTOR_PRIORITIES[filters.client_sector];
      result.sort((a, b) => {
        const aIndex = priorityCategories.indexOf(a.category);
        const bIndex = priorityCategories.indexOf(b.category);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    // Array filters
    if (filters.regions.length > 0) {
      result = result.filter(e => filters.regions.includes(e.region));
    }
    if (filters.categories.length > 0) {
      result = result.filter(e => filters.categories.includes(e.category));
    }
    if (filters.severities.length > 0) {
      result = result.filter(e => filters.severities.includes(e.severity));
    }
    if (filters.event_states.length > 0) {
      result = result.filter(e => filters.event_states.includes(e.event_state));
    }
    if (filters.impact_tags.length > 0) {
      result = result.filter(e => 
        e.impact_tags.some(tag => filters.impact_tags.includes(tag))
      );
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(searchLower) ||
        e.short_description.toLowerCase().includes(searchLower) ||
        e.token?.toLowerCase().includes(searchLower) ||
        e.country.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [events, filters]);

  // Sort and group by date
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [filteredEvents]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, IntelligenceEvent[]> = {};
    sortedEvents.forEach((event) => {
      const date = format(parseISO(event.timestamp), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    });
    return groups;
  }, [sortedEvents]);

  const dates = Object.keys(groupedByDate).sort().reverse();

  // Critical events count
  const criticalCount = filteredEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length;
  const escalatingCount = filteredEvents.filter(e => e.momentum === 'escalating').length;

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, filteredEvents]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleEventSelect = (event: IntelligenceEvent) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  const handleCloseDetail = () => {
    setSelectedEvent(null);
    onEventSelect?.(null);
  };

  const handleLocateOnMap = () => {
    if (selectedEvent && onLocateOnMap) {
      onLocateOnMap(selectedEvent);
    }
  };

  return (
    <div className="h-full flex relative">
      {/* Filter Panel — overlay on mobile, side panel on md+ */}
      {showFilters && (
        <>
          {/* Mobile backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={() => setShowFilters(false)}
          />
          <div className="w-72 md:w-64 shrink-0 animate-slide-in-right fixed md:relative inset-y-0 left-0 z-50 md:z-auto bg-background border-r border-border md:border-r-0">
            <TimelineFilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
              eventCount={filteredEvents.length}
            />
          </div>
        </>
      )}

      {/* Main Timeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="intel-card border-b border-border">
          <div className="p-3 md:p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap min-w-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <h2 className="font-semibold text-sm whitespace-nowrap">Intelligence Timeline</h2>
              </div>
              
              {/* Status Indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                {criticalCount > 0 && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] bg-intel-red/10 border-intel-red/30 text-intel-red"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {criticalCount} Critical/High
                  </Badge>
                )}
                {escalatingCount > 0 && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] bg-intel-amber/10 border-intel-amber/30 text-intel-amber"
                  >
                    {escalatingCount} Escalating
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn("h-7", showFilters && "bg-secondary")}
              >
                <Layers className="w-3 h-3 mr-1" />
                Filters
              </Button>
              <div className="hidden md:flex items-center gap-1 border-l border-border pl-2 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => scroll('left')}
                  disabled={!canScrollLeft}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => scroll('right')}
                  disabled={!canScrollRight}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 relative overflow-hidden intel-card">
          {filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events match your filters</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-2"
                >
                  Reset filters
                </Button>
              </div>
            </div>
          ) : (
            <div 
              ref={scrollRef}
              className="h-full overflow-y-auto p-4"
            >
              <div className="space-y-6">
                {dates.map((date, dateIndex) => (
                  <div 
                    key={date} 
                    className="animate-fade-in"
                    style={{ animationDelay: `${dateIndex * 50}ms` }}
                  >
                    {/* Date marker */}
                    <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-primary border-2 border-background shadow-lg shadow-primary/40" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {format(parseISO(date), 'EEEE')}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {format(parseISO(date), 'MMM d, yyyy')}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {groupedByDate[date].length} events
                        </Badge>
                      </div>
                    </div>

                    {/* Events grid for this date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                      {groupedByDate[date].map((event, index) => (
                        <div 
                          key={event.id}
                          className="animate-fade-in"
                          style={{ animationDelay: `${(dateIndex * 50) + (index * 25)}ms` }}
                        >
                          <TimelineEventCard
                            event={event}
                            isSelected={selectedEvent?.id === event.id}
                            onClick={() => handleEventSelect(event)}
                            isPremium={isPremium}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel — full-screen overlay on mobile, side panel on md+ */}
      {selectedEvent && (
        <div className="w-full md:w-96 shrink-0 animate-slide-in-right fixed md:relative inset-0 md:inset-auto z-50 md:z-auto bg-background">
          <TimelineDetailPanel
            event={selectedEvent}
            onClose={handleCloseDetail}
            onLocateOnMap={onLocateOnMap ? handleLocateOnMap : undefined}
            isPremium={isPremium}
          />
        </div>
      )}
    </div>
  );
}
