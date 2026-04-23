import { useState, useMemo } from 'react';
import { NewsItem } from '@/types/news';
import { format, formatDistanceToNow, isAfter, subHours } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { X, Search, Shield, Globe, DollarSign, Swords, Heart, Cpu, MapPin, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveFeedPanelProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onClose: () => void;
}

const CAT_ICON: Record<string, React.ElementType> = {
  security: Shield, diplomacy: Globe, economy: DollarSign,
  conflict: Swords, humanitarian: Heart, technology: Cpu,
};
const CAT_LABEL: Record<string, string> = {
  security: 'SECURITY', diplomacy: 'DIPLOMACY', economy: 'ECONOMY',
  conflict: 'ARMED CONFLICT', humanitarian: 'HUMANITARIAN', technology: 'TECHNOLOGY',
};
const THREAT_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', elevated: 'bg-yellow-500', low: 'bg-blue-500',
};
const THREAT_BORDER: Record<string, string> = {
  critical: 'border-l-red-500', high: 'border-l-orange-500', elevated: 'border-l-yellow-500', low: 'border-l-blue-500',
};

export function LiveFeedPanel({ newsItems, onSelectItem, selectedItem, onClose }: LiveFeedPanelProps) {
  const [search, setSearch] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let items = [...newsItems];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.country?.toLowerCase().includes(q) || i.city?.toLowerCase().includes(q));
    }
    if (threatFilter !== 'all') items = items.filter(i => i.threatLevel === threatFilter);
    return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [newsItems, search, threatFilter]);

  return (
    <div className="w-[380px] h-full flex flex-col bg-[#0f1724] border-l border-[#1e2d44]">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[#1e2d44] flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Live Intel Feed</h3>
          <p className="text-[#475569] text-[10px] mt-0.5">{filtered.length} reports</p>
        </div>
        <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-[#1e2d44] space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter intel..." className="pl-8 h-7 bg-[#1a2538] border-[#2a3a52] text-[#e2e8f0] text-xs placeholder-[#475569]" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{scrollbarWidth:'none'}}>
          {['all','critical','high','elevated','low'].map(t => (
            <button key={t} onClick={() => setThreatFilter(t)}
              className={cn('shrink-0 text-[9px] font-bold px-2 py-0.5 rounded uppercase transition-colors',
                threatFilter === t
                  ? t === 'critical' ? 'bg-red-600 text-white' : t === 'high' ? 'bg-orange-600 text-white' : t === 'elevated' ? 'bg-yellow-600 text-black' : t === 'low' ? 'bg-blue-600 text-white' : 'bg-[#2563eb] text-white'
                  : 'bg-[#1a2538] text-[#64748b] hover:text-white border border-[#2a3a52]'
              )}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {filtered.map(item => {
            const Icon = CAT_ICON[item.category] || Shield;
            const loc = item.city && item.city !== item.country ? `${item.city}, ${item.country}` : item.country;
            const pub = new Date(item.publishedAt);
            const isRecent = isAfter(pub, subHours(new Date(), 1));
            return (
              <article key={item.id} onClick={() => onSelectItem(item)}
                className={cn(
                  'border-l-4 rounded bg-[#1a2538]/60 p-3 cursor-pointer transition-all hover:bg-[#1e2d44] group',
                  THREAT_BORDER[item.threatLevel] || THREAT_BORDER.low,
                  selectedItem?.id === item.id && 'bg-[#1e3a5f]/60 ring-1 ring-[#2563eb]/50'
                )}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#0f1724] border border-[#2a3a52] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-[#4a90d9]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', THREAT_DOT[item.threatLevel])} />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{CAT_LABEL[item.category]}</span>
                      <span className="text-[9px] text-emerald-400 bg-emerald-900/40 border border-emerald-800/50 px-1 py-0.5 rounded font-medium">{loc}</span>
                      <span className="ml-auto text-[9px] text-[#475569] font-mono">
                        {isRecent ? <span className="text-green-400">{formatDistanceToNow(pub, {addSuffix:true})}</span> : format(pub,'MMM d, HH:mm')}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#cbd5e1] leading-snug line-clamp-2">{item.title}</p>
                    <p className="text-[10px] text-[#475569] mt-0.5">{item.source}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
