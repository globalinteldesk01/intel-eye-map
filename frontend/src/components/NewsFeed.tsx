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
      {/* Title with threat count indicators */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Intel Stream</h2>
        <div className="flex items-center gap-1.5">
          {filteredAndSortedNews.filter(i => i.threatLevel === 'critical').length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              {filteredAndSortedNews.filter(i => i.threatLevel === 'critical').length} CRIT
            </span>
          )}
          {filteredAndSortedNews.filter(i => i.threatLevel === 'high').length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-800">
              {filteredAndSortedNews.filter(i => i.threatLevel === 'high').length} HIGH
            </span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-5 pb-3 space-y-2">
        {/* Category quick filters */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'conflict', 'security', 'diplomacy', 'humanitarian', 'economy', 'technology'].map(cat => (
            <button
              key={cat}
              onClick={() => setTypeFilter(cat)}
              className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide transition-colors ${
                typeFilter === cat 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All Intel' : cat === 'conflict' ? '⚔ Conflict' : cat === 'security' ? '🛡 Security' : cat === 'diplomacy' ? '🌐 Diplomacy' : cat === 'humanitarian' ? '❤ Humanitarian' : cat === 'economy' ? '💰 Economy' : '💻 Tech'}
            </button>
          ))}
        </div>

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

                  <div className="flex items-start gap-3">
                    {/* Category Icon Circle */}
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg mt-0.5",
                      iconBg
                    )}>
                      <CategoryIcon className="w-4.5 h-4.5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: Category label + Threat badge + Country + Time */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/80">
                          {config.label}
                        </span>
                        {/* Threat level badge */}
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
                          item.threatLevel === 'critical' ? 'bg-red-900/80 text-red-300 border border-red-700' :
                          item.threatLevel === 'high' ? 'bg-orange-900/80 text-orange-300 border border-orange-700' :
                          item.threatLevel === 'elevated' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700' :
                          'bg-blue-900/60 text-blue-300 border border-blue-700'
                        )}>
                          {item.threatLevel}
                        </span>
                        <span className="text-[10px] font-medium text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                          {item.country}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 font-mono ml-auto">
                          <Clock className="w-2.5 h-2.5" />
                          {format(publishedDate, 'HH:mm')}
                        </span>
                      </div>

                      {/* Title */}
                      <p className="text-[12.5px] font-medium text-foreground/90 leading-snug mb-1 line-clamp-2">
                        {item.title}
                      </p>

                      {/* Source */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/60">
                          {item.source}
                        </span>
                        {item.tags && item.tags.length > 0 && (
                          <span className="text-[10px] text-muted-foreground/50">
                            #{item.tags[0]}
                          </span>
                        )}
                      </div>
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
