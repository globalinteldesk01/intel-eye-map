import { useMemo, useState } from 'react';
import { NewsItem, TravelImpact } from '@/types/news';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Trash2, Shield, Globe, DollarSign, Swords, Heart, Cpu,
  Clock, MapPin, X, Plane, AlertTriangle, Activity, Zap
} from 'lucide-react';
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
  security:     { icon: Shield,      label: 'SECURITY' },
  diplomacy:    { icon: Globe,       label: 'DIPLOMACY' },
  economy:      { icon: DollarSign,  label: 'ECONOMY' },
  conflict:     { icon: Swords,      label: 'ARMED CONFLICT' },
  humanitarian: { icon: Heart,       label: 'HUMANITARIAN' },
  technology:   { icon: Cpu,         label: 'TECHNOLOGY' },
};

const threatBorderColors: Record<string, string> = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-500',
  elevated: 'border-l-yellow-500',
  low:      'border-l-blue-500',
};

const threatIconBg: Record<string, string> = {
  critical: 'bg-[hsl(0,70%,35%)]',
  high:     'bg-[hsl(25,70%,35%)]',
  elevated: 'bg-[hsl(45,65%,30%)]',
  low:      'bg-[hsl(210,60%,30%)]',
};

const travelImpactConfig: Record<TravelImpact, { label: string; bg: string; text: string; show: boolean }> = {
  critical: { label: '⚡ TRAVEL ALERT', bg: 'bg-red-950 border-red-800',    text: 'text-red-400',    show: true  },
  high:     { label: '⚠ HIGH RISK',     bg: 'bg-orange-950 border-orange-800', text: 'text-orange-400', show: true  },
  medium:   { label: '◈ CAUTION',       bg: 'bg-yellow-950 border-yellow-800', text: 'text-yellow-400', show: true  },
  low:      { label: '',                bg: '',                               text: '',                show: false },
  none:     { label: '',                bg: '',                               text: '',                show: false },
};

type TimeFilter = 'all' | '1h' | '24h' | '48h' | '7d';

export function NewsFeed({
  newsItems, onSelectItem, selectedItem, onDeleteItem,
  countryFilter: externalFilter, onCountryFilterChange
}: NewsFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [travelFilter, setTravelFilter] = useState<string>('all');
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
        i.city?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') items = items.filter(i => i.category === typeFilter);
    if (countryFilter !== 'all') items = items.filter(i => i.country === countryFilter);
    if (travelFilter !== 'all') items = items.filter(i => i.travelImpact === travelFilter);
    if (timeFilter !== 'all') {
      const now = new Date();
      const cutoff =
        timeFilter === '1h'  ? subHours(now, 1) :
        timeFilter === '24h' ? subHours(now, 24) :
        timeFilter === '48h' ? subHours(now, 48) : subDays(now, 7);
      items = items.filter(i => isAfter(new Date(i.publishedAt), cutoff));
    }

    return items.sort((a, b) => {
      // Sort: travel alerts first, then by time
      const ta = a.travelImpact || 'none';
      const tb = b.travelImpact || 'none';
      const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
      if (rank[tb] !== rank[ta]) return rank[tb] - rank[ta];
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [newsItems, searchQuery, typeFilter, countryFilter, travelFilter, timeFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItem) await onDeleteItem(id);
  };

  const travelAlertCount = filtered.filter(i => i.travelImpact === 'critical' || i.travelImpact === 'high').length;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
            <Plane className="w-4 h-4 text-blue-400" />
            Public Reports
          </h2>
        </div>
        {travelAlertCount > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-900/50 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {travelAlertCount} TRAVEL ALERT{travelAlertCount > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pb-2 shrink-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search intel, city, country..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-8 bg-secondary/60 border-border text-xs"
            />
          </div>
          <Button size="sm" className="h-8 px-3 bg-[hsl(210,100%,30%)] hover:bg-[hsl(210,100%,35%)] text-white text-[10px] font-bold uppercase">
            <Search className="w-3 h-3 mr-1" />Search
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Country */}
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-7 bg-secondary/60 border-border text-[10px] flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Countries" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {availableCountries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Travel Impact Filter */}
          <Select value={travelFilter} onValueChange={setTravelFilter}>
            <SelectTrigger className="h-7 bg-secondary/60 border-border text-[10px] w-28 shrink-0">
              <div className="flex items-center gap-1">
                <Plane className="w-3 h-3 text-blue-400 shrink-0" />
                <SelectValue placeholder="Risk" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="critical">⚡ Critical</SelectItem>
              <SelectItem value="high">⚠ High</SelectItem>
              <SelectItem value="medium">◈ Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Time Filter */}
          <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="h-7 bg-secondary/60 border-border text-[10px] w-20 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="48h">48 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {countryFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setCountryFilter('all')}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground pl-1">{filtered.length} reports</div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No intel matches your filters.</p>
            </div>
          ) : (
            filtered.map(item => {
              const cfg = categoryConfig[item.category] || categoryConfig.security;
              const Icon = cfg.icon;
              const pub = new Date(item.publishedAt);
              const impact = item.travelImpact || 'none';
              const impactCfg = travelImpactConfig[impact];
              const locationLabel = item.city && item.city !== item.country
                ? `${item.city}, ${item.country}`
                : item.country;

              return (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    'group relative rounded-lg border-l-4 bg-card/50 p-3.5 cursor-pointer transition-all hover:bg-secondary/40 hover:shadow-md',
                    threatBorderColors[item.threatLevel] || 'border-l-blue-500',
                    selectedItem?.id === item.id && 'bg-secondary/50 ring-1 ring-primary/30',
                    item.evacuationRelevance && 'ring-1 ring-red-800/50'
                  )}
                >
                  {onDeleteItem && (
                    <Button variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                      onClick={e => { e.stopPropagation(); onDeleteItem(item.id); }}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg', threatIconBg[item.threatLevel])}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Row 1: Category + Travel Badge + Time */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/80">{cfg.label}</span>

                        {/* Travel Impact Badge */}
                        {impactCfg.show && (
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide', impactCfg.bg, impactCfg.text)}>
                            {impactCfg.label}
                          </span>
                        )}

                        {/* Evacuation badge */}
                        {item.evacuationRelevance && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-red-950 text-red-300 border-red-700 uppercase animate-pulse">
                            EVACUATION
                          </span>
                        )}

                        <span className="text-[9px] text-muted-foreground/60 font-mono ml-auto">
                          {formatDistanceToNow(pub, { addSuffix: true })}
                        </span>
                      </div>

                      {/* Row 2: Location */}
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-semibold text-primary/90">{locationLabel}</span>
                      </div>

                      {/* Row 3: Title */}
                      <p className="text-[12.5px] font-medium text-foreground/90 leading-snug mb-1.5 line-clamp-2">
                        {item.title}
                      </p>

                      {/* Row 4: Traveler Advice (if critical/high) */}
                      {item.travelerAdvice && (impact === 'critical' || impact === 'high') && (
                        <div className={cn(
                          'text-[10px] px-2 py-1 rounded border-l-2 mb-1.5 leading-relaxed',
                          impact === 'critical'
                            ? 'bg-red-950/40 border-red-600 text-red-300'
                            : 'bg-orange-950/40 border-orange-600 text-orange-300'
                        )}>
                          {item.travelerAdvice}
                        </div>
                      )}

                      {/* Row 5: Source */}
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
