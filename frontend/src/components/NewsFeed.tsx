import { useMemo, useState } from 'react';
import { NewsItem } from '@/types/news';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Trash2, Shield, Globe, DollarSign, Swords, Heart, Cpu, Clock, MapPin, X,
} from 'lucide-react';
import { subHours, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// All 195 UN-recognised countries + key territories — always shown in filter
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
  // Key territories & regions
  "Gaza","Crimea","Hong Kong","Macau","Kosovo","Western Sahara","Somaliland",
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
  critical: 'border-l-[hsl(0,85%,50%)]',
  high:     'border-l-[hsl(25,90%,50%)]',
  elevated: 'border-l-[hsl(45,90%,50%)]',
  low:      'border-l-[hsl(210,70%,50%)]',
};

const threatIconBg: Record<string, string> = {
  critical: 'bg-[hsl(0,70%,40%)]',
  high:     'bg-[hsl(25,70%,40%)]',
  elevated: 'bg-[hsl(45,70%,35%)]',
  low:      'bg-[hsl(210,60%,35%)]',
};

type TimeFilter = 'all' | '24h' | '48h' | '7d';

export function NewsFeed({
  newsItems, onSelectItem, selectedItem, onDeleteItem,
  countryFilter: externalCountryFilter, onCountryFilterChange,
}: NewsFeedProps) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [typeFilter, setTypeFilter]       = useState<string>('all');
  const [timeFilter, setTimeFilter]       = useState<TimeFilter>('all');
  const countryFilter    = externalCountryFilter ?? 'all';
  const setCountryFilter = onCountryFilterChange  ?? (() => {});

  // Merge world list with any new countries appearing in live intel
  const availableCountries = useMemo(() => {
    const liveCountries = newsItems.map(i => i.country).filter(Boolean) as string[];
    const merged = new Set([...ALL_WORLD_COUNTRIES, ...liveCountries]);
    return Array.from(merged).sort();
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

    return items.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [newsItems, searchQuery, typeFilter, countryFilter, timeFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItem) await onDeleteItem(id);
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
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-secondary/60 border-border text-sm"
            />
          </div>
          <Button size="sm" className="h-9 px-5 bg-[hsl(210,100%,30%)] hover:bg-[hsl(210,100%,35%)] text-white font-semibold uppercase text-xs tracking-wider">
            <Search className="w-3.5 h-3.5 mr-1.5" />Search
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
            <SelectContent className="max-h-72 overflow-y-auto">
              <SelectItem value="all">All Countries</SelectItem>
              {availableCountries.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {countryFilter !== 'all' && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setCountryFilter('all')}>
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          )}

          <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
            {filteredAndSortedNews.length} reports
          </span>
        </div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1">
        <div className="px-5 pb-5 space-y-3">
          {filteredAndSortedNews.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <p>No reports match your filters.</p>
            </div>
          ) : (
            filteredAndSortedNews.map(item => {
              const cfg   = categoryConfig[item.category] || categoryConfig.security;
              const Icon  = cfg.icon;
              const pub   = new Date(item.publishedAt);
              const loc   = item.city && item.city !== item.country ? item.city : item.country;

              return (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    'group relative rounded-lg border-l-4 bg-card/50 p-4 cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:shadow-md',
                    threatBorderColors[item.threatLevel] || threatBorderColors.low,
                    selectedItem?.id === item.id && 'bg-secondary/50 ring-1 ring-primary/30'
                  )}
                >
                  {onDeleteItem && (
                    <Button variant="ghost" size="icon"
                      className="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                      onClick={e => handleDelete(e, item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Category Icon */}
                    <div className={cn(
                      'w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg',
                      threatIconBg[item.threatLevel] || threatIconBg.low
                    )}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-900/60 border border-emerald-700/50 px-1.5 py-0.5 rounded">
                          {loc}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono ml-auto">
                          <Clock className="w-3 h-3" />
                          {format(pub, 'MMM d, HH:mm')} UTC
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
