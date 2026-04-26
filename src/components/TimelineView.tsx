import { useMemo, useRef, useEffect, useState } from 'react';
import { NewsItem } from '@/types/news';
import { format, parseISO, differenceInHours } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimelineViewProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
}

const categoryColors: Record<string, string> = {
  security: '#14b8a6',
  diplomacy: '#3b82f6',
  economy: '#22c55e',
  conflict: '#ef4444',
  humanitarian: '#f59e0b',
  technology: '#8b5cf6',
};

export function TimelineView({ newsItems, onSelectItem, selectedItem }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Sort items by date
  const sortedItems = useMemo(() => {
    return [...newsItems].sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [newsItems]);

  // Group items by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, NewsItem[]> = {};
    sortedItems.forEach((item) => {
      const date = format(parseISO(item.publishedAt), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  }, [sortedItems]);

  const dates = Object.keys(groupedByDate).sort().reverse();

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="intel-card h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Timeline
        </h2>
        <div className="flex items-center gap-1">
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

      <div className="flex-1 relative overflow-hidden">
        {/* Timeline line */}
        <div className="absolute top-8 left-0 right-0 h-px bg-border" />
        
        <div 
          ref={scrollRef}
          className="h-full overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-6 p-4 min-w-max">
            {dates.map((date) => (
              <div key={date} className="flex flex-col">
                {/* Date marker */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-primary border-2 border-background shadow-lg shadow-primary/30" />
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {format(parseISO(date), 'MMM d, yyyy')}
                  </span>
                </div>

                {/* Events for this date */}
                <div className="flex gap-3">
                  {groupedByDate[date].map((item, index) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className={`w-56 p-3 rounded-lg cursor-pointer transition-all animate-fade-in ${
                        selectedItem?.id === item.id
                          ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                          : 'bg-secondary/30 border border-border hover:bg-secondary/50'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Category & Time */}
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: categoryColors[item.category] }}
                        />
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {format(parseISO(item.publishedAt), 'HH:mm')} UTC
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-medium leading-tight line-clamp-2 mb-2">
                        {item.title}
                      </h4>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{item.country}</span>
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 capitalize"
                          style={{
                            borderColor: `${categoryColors[item.category]}50`,
                            color: categoryColors[item.category],
                          }}
                        >
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
