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
  Clock,
  MapPin,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subHours, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewsFeedProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onDeleteItem?: (id: string) => Promise<boolean>;
  countryFilter?: string;
  onCountryFilterChange?: (country: string) => void;
}

const categoryConfig: Record<string, { icon: typeof Shield; label: string }> = {
  security: { icon: Shield, label: 'SECURITY' },
  diplomacy: { icon: Globe, label: 'DIPLOMACY' },
  economy: { icon: DollarSign, label: 'ECONOMY' },
  conflict: { icon: Swords, label: 'ARMED CONFLICT' },
  humanitarian: { icon: Heart, label: 'HUMANITARIAN' },
  technology: { icon: Cpu, label: 'TECHNOLOGY' },
};

const threatBorderColors: Record<string, string> = {
  critical: 'border-l-[hsl(0,85%,50%)]',
  high: 'border-l-[hsl(25,90%,50%)]',
  elevated: 'border-l-[hsl(45,90%,50%)]',
  low: 'border-l-[hsl(210,70%,50%)]',
};

const threatIconBg: Record<string, string> = {
  critical: 'bg-[hsl(0,70%,40%)]',
  high: 'bg-[hsl(25,70%,40%)]',
  elevated: 'bg-[hsl(45,70%,35%)]',
  low: 'bg-[hsl(210,60%,35%)]',
};

type TimeFilter = 'all' | '24h' | '48h' | '7d';

export function NewsFeed({ newsItems, onSelectItem, selectedItem, onDeleteItem, countryFilter: externalCountryFilter, onCountryFilterChange }: NewsFeedProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const countryFilter = externalCountryFilter ?? 'all';
  const setCountryFilter = onCountryFilterChange ?? (() => {});

  // Extract unique countries from news items
  const availableCountries = useMemo(() => {
    const countries = new Set(newsItems.map(item => item.country).filter(Boolean));
    return Array.from(countries).sort();
  }, [newsItems]);
  
  const filteredAndSortedNews = useMemo(() => {
    let items = [...newsItems];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(item => 
        item.token?.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.country?.toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      items = items.filter(item => item.category === typeFilter);
    }

    if (countryFilter !== 'all') {
      items = items.filter(item => item.country === countryFilter);
    }

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
  }, [newsItems, searchQuery, typeFilter, countryFilter, timeFilter]);

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
      <div className="px-5 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by keyword or country..."
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

        {/* Country Filter */}
        <div className="flex items-center gap-2">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-8 bg-secondary/60 border-border text-xs flex-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Countries" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {availableCountries.map(country => (
                <SelectItem key={country} value={country}>{country}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {countryFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setCountryFilter('all')}
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}

          <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
            {filteredAndSortedNews.length} reports
          </span>
        </div>
      </div>
      
      {/* Event List */}
      <ScrollArea className="flex-1">
        <div className="px-5 pb-5 space-y-3">
          {filteredAndSortedNews.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <p>No reports match your filters.</p>
            </div>
          ) : (
            filteredAndSortedNews.map((item) => {
              const config = categoryConfig[item.category] || categoryConfig.security;
              const CategoryIcon = config.icon;
              const publishedDate = new Date(item.publishedAt);
              const borderColor = threatBorderColors[item.threatLevel] || threatBorderColors.low;
              const iconBg = threatIconBg[item.threatLevel] || threatIconBg.low;
              
              return (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    "group relative rounded-lg border-l-4 bg-card/50 p-4 cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:shadow-md",
                    borderColor,
                    selectedItem?.id === item.id && 'bg-secondary/50 ring-1 ring-primary/30'
                  )}
                >
                  {/* Delete button */}
                  {onDeleteItem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => handleDelete(e, item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Category Icon Circle */}
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg",
                      iconBg
                    )}>
                      <CategoryIcon className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Category + Country + Timestamp */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                          {config.label}
                        </span>
                        <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                          {item.country}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono ml-auto">
                          <Clock className="w-3 h-3" />
                          {format(publishedDate, 'MMM d, HH:mm')} UTC
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
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
