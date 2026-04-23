import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { NewsItem } from '@/types/news';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Trash2, Shield, Globe, DollarSign, Swords, Heart, Cpu,
  Clock, MapPin, X, RefreshCw, ArrowUp,
} from 'lucide-react';
import { subHours, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNewsFetch } from '@/hooks/useNewsFetch';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';

// All 195 UN-recognised countries + key territories
const ALL_WORLD_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina",
  "Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados",
  "Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia","Botswana","Brazil",
  "Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada",
  "Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros",
  "Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti",
  "Dominican Republic","DR Congo","Ecuador","Egypt","El Salvador","Equatorial Guinea",
  "Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia",
  "Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau",
  "Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq",
  "Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati",
  "Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya",
  "Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives",
  "Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia",
  "Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia",
  "Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea",
  "North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama",
  "Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar",
  "Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia",
  "Saint Vincent and the Grenadines","Samoa","San Marino","São Tomé and Príncipe",
  "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan",
  "Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan",
  "Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago",
  "Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Venezuela",
  "Vietnam","West Bank","Yemen","Zambia","Zimbabwe",
  "Gaza","Crimea","Hong Kong","Macau","Western Sahara","Somaliland",
  "Nagorno-Karabakh","Kurdistan","Catalonia","Scotland","Northern Ireland",
].sort();

interface NewsFeedProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onDeleteItem?: (id: string) => Promise<boolean>;
  countryFilter?: string;
  onCountryFilterChange?: (country: string) => void;
}

const categoryConfig: Record<string, { icon: typeof Shield; label: string }> = {
  security:     { icon: Shield,     label: 'SECURITY' },
  diplomacy:    { icon: Globe,      label: 'DIPLOMACY' },
  economy:      { icon: DollarSign, label: 'ECONOMY' },
  conflict:     { icon: Swords,     label: 'ARMED CONFLICT' },
  humanitarian: { icon: Heart,      label: 'HUMANITARIAN' },
  technology:   { icon: Cpu,        label: 'TECHNOLOGY' },
};

const threatBorderColors: Record<string, string> = {
  critical: 'border-l-[hsl(210,100%,40%)]',
  high:     'border-l-[hsl(210,100%,40%)]',
  elevated: 'border-l-[hsl(210,100%,40%)]',
  low:      'border-l-[hsl(210,100%,40%)]',
};
const threatIconBg: Record<string, string> = {
  critical: 'bg-[hsl(220,40%,18%)]',
  high:     'bg-[hsl(220,40%,18%)]',
  elevated: 'bg-[hsl(220,40%,18%)]',
  low:      'bg-[hsl(220,40%,18%)]',
};

type TimeFilter = 'all' | '24h' | '48h' | '7d';

export function NewsFeed({
  newsItems, onSelectItem, selectedItem, onDeleteItem,
  countryFilter: externalCountryFilter, onCountryFilterChange,
}: NewsFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter]   = useState<string>('all');
  const [timeFilter, setTimeFilter]   = useState<TimeFilter>('all');
  const countryFilter    = externalCountryFilter ?? 'all';
  const setCountryFilter = onCountryFilterChange  ?? (() => {});

  // Live fetch status
  const { isFetching, lastFetchTime, fetchStatus, refreshNow } = useNewsFetch();

  // Track new items (arrived after component mount)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const prevCountRef = useRef(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  // When new items arrive, mark them and show banner
  useEffect(() => {
    if (prevCountRef.current === 0) {
      prevCountRef.current = newsItems.length;
      return;
    }
    if (newsItems.length > prevCountRef.current) {
      const diff = newsItems.length - prevCountRef.current;
      const newIds = newsItems.slice(0, diff).map(i => i.id);
      setNewItemIds(prev => new Set([...prev, ...newIds]));
      if (!isAtTopRef.current) {
        setPendingNewCount(prev => prev + diff);
      }
      // Clear "new" highlight after 30 seconds
      setTimeout(() => {
        setNewItemIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 30000);
    }
    prevCountRef.current = newsItems.length;
  }, [newsItems.length]);

  const scrollToTop = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = 0;
    }
    setPendingNewCount(0);
    isAtTopRef.current = true;
  }, []);

  const availableCountries = useMemo(() => {
    const live = newsItems.map(i => i.country).filter(Boolean) as string[];
    return Array.from(new Set([...ALL_WORLD_COUNTRIES, ...live])).sort();
  }, [newsItems]);

  const filteredAndSortedNews = useMemo(() => {
    let items = [...newsItems];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(i =>
        i.token?.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.country?.toLowerCase().includes(q) ||
        i.city?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all')    items = items.filter(i => i.category === typeFilter);
    if (countryFilter !== 'all') items = items.filter(i => i.country === countryFilter);
    if (timeFilter !== 'all') {
      const now = new Date();
      const cutoff =
        timeFilter === '24h' ? subHours(now, 24) :
        timeFilter === '48h' ? subHours(now, 48) : subDays(now, 7);
      items = items.filter(i => isAfter(new Date(i.publishedAt), cutoff));
    }
    // Newest always first
    return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [newsItems, searchQuery, typeFilter, countryFilter, timeFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItem) await onDeleteItem(id);
  };

  const isNewItem = (id: string) => newItemIds.has(id);
  const isRecent = (publishedAt: string) =>
    isAfter(new Date(publishedAt), subHours(new Date(), 1));

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Title */}
      <div className="px-4 pt-4 pb-2 md:px-5 md:pt-5">
        <h2 className="text-base md:text-lg font-bold uppercase tracking-wider text-foreground">
          Public Reports
        </h2>
      </div>

      {/* Filter Bar */}
      <div className="px-4 pb-3 space-y-2 md:px-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by keyword or country..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-secondary/60 border-border text-sm"
            />
          </div>
          <Button size="sm" className="h-9 px-4 bg-[hsl(210,100%,30%)] hover:bg-[hsl(210,100%,35%)] text-white font-semibold uppercase text-xs tracking-wider shrink-0">
            <Search className="w-3.5 h-3.5 mr-1.5" />Search
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-8 bg-secondary/60 border-border text-xs flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Countries" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72 overflow-y-auto">
              <SelectItem value="all">All Countries</SelectItem>
              {availableCountries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {countryFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => setCountryFilter('all')}>
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap shrink-0">
            {filteredAndSortedNews.length} reports
          </span>
        </div>
      </div>

      {/* ── NEW ITEMS BANNER ────────────────────────────────────────────── */}
      {pendingNewCount > 0 && (
        <button
          onClick={scrollToTop}
          className="mx-4 md:mx-5 mb-2 flex items-center justify-center gap-2 py-1.5 rounded-md bg-primary/20 border border-primary/40 text-primary text-xs font-bold animate-pulse hover:bg-primary/30 transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          {pendingNewCount} new intel item{pendingNewCount > 1 ? 's' : ''} — tap to view
        </button>
      )}

      {/* Feed */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="px-4 pb-20 space-y-3 md:px-5 md:pb-5">
          {filteredAndSortedNews.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">No reports match your filters.</p>
              {isFetching && (
                <p className="text-muted-foreground/60 text-xs mt-2 flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Fetching intel from {fetchStatus?.sources_checked ?? 120}+ sources...
                </p>
              )}
            </div>
          ) : (
            filteredAndSortedNews.map(item => {
              const cfg  = categoryConfig[item.category] || categoryConfig.security;
              const Icon = cfg.icon;
              const pub  = new Date(item.publishedAt);
              const loc  = item.city && item.city !== item.country ? item.city : item.country;
              const isNew    = isNewItem(item.id);
              const isRecent_ = isRecent(item.publishedAt);

              return (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    'group relative rounded-lg border-l-4 bg-card/50 p-3.5 md:p-4 cursor-pointer transition-all duration-200 hover:bg-secondary/40 active:bg-secondary/60 hover:shadow-md touch-manipulation',
                    threatBorderColors[item.threatLevel] || threatBorderColors.low,
                    selectedItem?.id === item.id && 'bg-secondary/50 ring-1 ring-primary/30',
                    isNew && 'ring-1 ring-green-500/40 bg-green-950/10'
                  )}
                >
                  {/* NEW badge */}
                  {isNew && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-900 text-green-300 border border-green-700 uppercase tracking-wider">
                      NEW
                    </span>
                  )}

                  {onDeleteItem && !isNew && (
                    <Button variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                      onClick={e => handleDelete(e, item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-md border border-white/10',
                      threatIconBg[item.threatLevel] || threatIconBg.low
                    )}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[13px] font-bold uppercase tracking-wider text-white">
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-900/60 border border-emerald-700/50 px-1.5 py-0.5 rounded">
                          {loc}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono ml-auto">
                          <Clock className="w-3 h-3" />
                          {isRecent_
                            ? <span className="text-green-400">{formatDistanceToNow(pub, { addSuffix: true })}</span>
                            : format(pub, 'MMM d, HH:mm')} UTC
                        </span>
                      </div>
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
