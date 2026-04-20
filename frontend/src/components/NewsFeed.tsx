import { useMemo, useState } from 'react';
import { NewsItem } from '@/types/news';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Trash2, Shield, Globe, DollarSign, Swords, Heart, Cpu, Clock, MapPin, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subHours, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  conflict: { icon: Swords, label: 'CONFLICT' },
  humanitarian: { icon: Heart, label: 'HUMANITARIAN' },
  technology: { icon: Cpu, label: 'TECHNOLOGY' },
};

const threatBorderColors: Record<string, string> = {
  critical: 'border-l-red-500', high: 'border-l-orange-500',
  elevated: 'border-l-yellow-500', low: 'border-l-blue-500',
};
const threatIconBg: Record<string, string> = {
  critical: 'bg-red-900/80', high: 'bg-orange-900/80',
  elevated: 'bg-yellow-900/60', low: 'bg-blue-900/60',
};
const threatBadge: Record<string, string> = {
  critical: 'bg-red-950 text-red-400 border-red-800',
  high: 'bg-orange-950 text-orange-400 border-orange-800',
  elevated: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  low: 'bg-blue-950 text-blue-400 border-blue-800',
};

type TimeFilter = 'all' | '1h' | '24h' | '48h' | '7d';

const CATEGORIES = [
  { key: 'all', label: 'ALL INTEL', emoji: '' },
  { key: 'conflict', label: 'CONFLICT', emoji: '\u2694' },
  { key: 'security', label: 'SECURITY', emoji: '\ud83d\udee1' },
  { key: 'diplomacy', label: 'DIPLOMACY', emoji: '\ud83c\udf10' },
  { key: 'humanitarian', label: 'HUMANITARIAN', emoji: '\u2764' },
  { key: 'economy', label: 'ECONOMY', emoji: '\ud83d\udcb0' },
  { key: 'technology', label: 'TECH', emoji: '\ud83d\udcbb' },
];

export function NewsFeed({ newsItems, onSelectItem, selectedItem, onDeleteItem, countryFilter: externalFilter, onCountryFilterChange }: NewsFeedProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const countryFilter = externalFilter ?? 'all';
  const setCountryFilter = onCountryFilterChange ?? (() => {});

  const availableCountries = useMemo(() => {
    const s = new Set(newsItems.map(i => i.country).filter(Boolean));
    return Array.from(s).sort();
  }, [newsItems]);

  const filtered = useMemo(() => {
    let items = [...newsItems];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.country?.toLowerCase().includes(q) ||
        i.city?.toLowerCase().includes(q) ||
        i.token?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') items = items.filter(i => i.category === typeFilter);
    if (countryFilter !== 'all') items = items.filter(i => i.country === countryFilter);
    if (timeFilter !== 'all') {
      const now = new Date();
      const cutoff = timeFilter === '1h' ? subHours(now, 1) : timeFilter === '24h' ? subHours(now, 24) : timeFilter === '48h' ? subHours(now, 48) : subDays(now, 7);
      items = items.filter(i => isAfter(new Date(i.publishedAt), cutoff));
    }
    return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [newsItems, searchQuery, typeFilter, countryFilter, timeFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItem) await onDeleteItem(id);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold uppercase tracking-widest text-foreground">Intel Stream</h2>
          <p className="text-[10px] text-muted-foreground">{filtered.length} reports • hyperlocal precision</p>
        </div>
        <div className="flex items-center gap-1">
          {filtered.filter(i => i.threatLevel === 'critical').length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              {filtered.filter(i => i.threatLevel === 'critical').length} CRIT
            </span>
          )}
          {filtered.filter(i => i.threatLevel === 'high').length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-800">
              {filtered.filter(i => i.threatLevel === 'high').length} HIGH
            </span>
          )}
        </div>
      </div>

      {/* Category Filters */}
      <div className="px-4 pb-2 shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setTypeFilter(cat.key)}
              className={cn('shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide border transition-all',
                typeFilter === cat.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground'
              )}>
              {cat.emoji && <span className="mr-1">{cat.emoji}</span>}{cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search intel, city, country..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 bg-secondary/60 border-border text-xs" />
          </div>
          <Button size="sm" className="h-8 px-3 bg-[hsl(210,100%,30%)] hover:bg-[hsl(210,100%,35%)] text-white text-[10px] font-bold uppercase">
            <Search className="w-3 h-3 mr-1" />Search
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-7 bg-secondary/60 border-border text-[11px] flex-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <SelectValue placeholder="All Countries" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {availableCountries.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          {countryFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setCountryFilter('all')}>
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="h-7 bg-secondary/60 border-border text-[11px] w-20">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="48h">48 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No intelligence matches your filters.</p>
            </div>
          ) : (
            filtered.map(item => {
              const cfg = categoryConfig[item.category] || categoryConfig.security;
              const Icon = cfg.icon;
              const pub = new Date(item.publishedAt);
              const isCity = item.precisionLevel === 'city';
              return (
                <article key={item.id} onClick={() => onSelectItem(item)}
                  className={cn(
                    'group relative rounded-lg border-l-4 bg-card/40 p-3 cursor-pointer transition-all hover:bg-secondary/40 hover:shadow-md',
                    threatBorderColors[item.threatLevel] || 'border-l-blue-500',
                    selectedItem?.id === item.id && 'bg-secondary/50 ring-1 ring-primary/30'
                  )}>
                  {onDeleteItem && (
                    <Button variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => handleDelete(e, item.id)}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-lg mt-0.5', threatIconBg[item.threatLevel])}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Category + Threat + Location + Time */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/70">{cfg.label}</span>
                        <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded uppercase border', threatBadge[item.threatLevel])}>
                          {item.threatLevel}
                        </span>
                        <span className="flex items-center gap-0.5 text-[9px] font-medium">
                          <MapPin className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className={cn('font-semibold', isCity ? 'text-emerald-400' : 'text-muted-foreground')}>
                            {item.city && item.city !== item.country ? `${item.city}, ` : ''}{item.country}
                          </span>
                          {isCity && <span className="text-emerald-500 text-[8px] ml-0.5">●</span>}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60 font-mono ml-auto">
                          {formatDistanceToNow(pub, { addSuffix: true })}
                        </span>
                      </div>
                      {/* Row 2: Title */}
                      <p className="text-[12px] font-medium text-foreground/90 leading-snug mb-1 line-clamp-2">{item.title}</p>
                      {/* Row 3: Source + tag */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/50">{item.source}</span>
                        {item.tags?.[0] && <span className="text-[9px] text-muted-foreground/40">#{item.tags[0]}</span>}
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
