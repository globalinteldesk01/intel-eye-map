import { useMemo, useState } from 'react';
import { NewsItem } from '@/types/news';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Trash2, 
  Shield, 
  Globe, 
  DollarSign, 
  Swords, 
  Heart, 
  Cpu,
  Calendar,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { subHours, subDays, isAfter } from 'date-fns';

interface NewsFeedProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onDeleteItem?: (id: string) => Promise<boolean>;
}

const categoryConfig: Record<string, { icon: typeof Shield; bg: string; label: string }> = {
  security: { icon: Shield, bg: 'bg-[hsl(210,100%,30%)]', label: 'SECURITY' },
  diplomacy: { icon: Globe, bg: 'bg-[hsl(270,60%,40%)]', label: 'DIPLOMACY' },
  economy: { icon: DollarSign, bg: 'bg-[hsl(145,60%,35%)]', label: 'ECONOMY' },
  conflict: { icon: Swords, bg: 'bg-[hsl(0,70%,45%)]', label: 'ARMED CONFLICT' },
  humanitarian: { icon: Heart, bg: 'bg-[hsl(30,80%,45%)]', label: 'HUMANITARIAN' },
  technology: { icon: Cpu, bg: 'bg-[hsl(200,70%,40%)]', label: 'TECHNOLOGY' },
};

type TimeFilter = 'all' | '24h' | '48h' | '7d';

export function NewsFeed({ newsItems, onSelectItem, selectedItem, onDeleteItem }: NewsFeedProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  const filteredAndSortedNews = useMemo(() => {
    let items = [...newsItems];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(item => 
        item.token?.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query)
      );
    }

    // Type/category filter
    if (typeFilter !== 'all') {
      items = items.filter(item => item.category === typeFilter);
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (timeFilter) {
        case '24h': cutoff = subHours(now, 24); break;
        case '48h': cutoff = subHours(now, 48); break;
        case '7d': cutoff = subDays(now, 7); break;
        default: cutoff = new Date(0);
      }
      items = items.filter(item => isAfter(new Date(item.publishedAt), cutoff));
    }
    
    return items.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [newsItems, searchQuery, typeFilter, timeFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItem) {
      await onDeleteItem(id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Title */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Public Reports</h2>
      </div>

      {/* Filter Bar */}
      <div className="px-5 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-secondary/60 border-border text-sm"
            />
          </div>
          <Button size="sm" className="h-9 px-5 bg-[hsl(210,100%,30%)] hover:bg-[hsl(210,100%,35%)] text-white font-semibold uppercase text-xs tracking-wider">
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Search
          </Button>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex items-center gap-2">
          {([
            { value: '24h', label: '24 HOURS' },
            { value: '48h', label: '48 HOURS' },
            { value: '7d', label: 'LAST 7 DAYS' },
          ] as { value: TimeFilter; label: string }[]).map((btn) => (
            <Button
              key={btn.value}
              variant="outline"
              size="sm"
              onClick={() => setTimeFilter(timeFilter === btn.value ? 'all' : btn.value)}
              className={`h-8 px-5 uppercase text-xs font-bold tracking-wider border-border ${
                timeFilter === btn.value
                  ? 'bg-[hsl(210,100%,30%)] text-white border-[hsl(210,100%,30%)] hover:bg-[hsl(210,100%,35%)]'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Event List */}
      <ScrollArea className="flex-1">
        <div className="px-5 pb-5">
          {filteredAndSortedNews.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <p>No reports match your filters.</p>
            </div>
          ) : (
            filteredAndSortedNews.map((item) => {
              const config = categoryConfig[item.category] || categoryConfig.security;
              const CategoryIcon = config.icon;
              const publishedDate = new Date(item.publishedAt);
              
              return (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={`group relative py-5 cursor-pointer border-b border-border/40 transition-colors hover:bg-secondary/30 ${
                    selectedItem?.id === item.id ? 'bg-secondary/40' : ''
                  }`}
                >
                  {/* Delete button */}
                  {onDeleteItem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => handleDelete(e, item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Category Icon Circle */}
                    <div className={`w-12 h-12 rounded-full ${config.bg} flex items-center justify-center shrink-0 shadow-lg`}>
                      <CategoryIcon className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Category + Timestamp */}
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                          {config.label}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(publishedDate, 'MMM d, HH:mm')} UTC
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {item.summary.replace(/<[^>]*>/g, '').replace(/https?:\/\/[^\s]+/g, '').trim() || item.title}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
