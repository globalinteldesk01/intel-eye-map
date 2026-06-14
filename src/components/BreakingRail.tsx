import { useEffect, useMemo, useState } from 'react';
import { NewsItem } from '@/types/news';
import { supabase } from '@/integrations/supabase/client';
import { differenceInMinutes } from 'date-fns';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreakingRailProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
}

/**
 * Compact horizontal strip of the last hour's critical/high stories.
 * Auto-cycles one item to the head every 6s for a "live wire" feel.
 */
export function BreakingRail({ newsItems, onSelectItem }: BreakingRailProps) {
  const local = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return newsItems
      .filter(i => (i.threatLevel === 'critical' || i.threatLevel === 'high')
        && new Date(i.publishedAt || i.createdAt || 0).getTime() > cutoff)
      .slice(0, 8);
  }, [newsItems]);

  const [remote, setRemote] = useState<NewsItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc('breaking_news_items', { _limit: 8 });
      if (alive && Array.isArray(data)) {
        setRemote(data.map((r: any) => ({
          id: r.id,
          token: r.token || '',
          title: r.title,
          summary: r.summary,
          url: r.url,
          source: r.source,
          sourceCredibility: r.source_credibility,
          publishedAt: r.published_at,
          createdAt: r.created_at,
          lat: Number(r.lat),
          lon: Number(r.lon),
          country: r.country,
          region: r.region,
          tags: r.tags || [],
          confidenceScore: Number(r.confidence_score),
          confidenceLevel: r.confidence_level,
          threatLevel: r.threat_level,
          actorType: r.actor_type,
          category: r.category,
          aiSummary: r.ai_summary ?? undefined,
          originalLanguage: r.original_language ?? undefined,
        } as NewsItem)));
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const merged = useMemo(() => {
    const map = new Map<string, NewsItem>();
    [...local, ...remote].forEach(i => map.set(i.id, i));
    return Array.from(map.values())
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
      .slice(0, 10);
  }, [local, remote]);

  const [head, setHead] = useState(0);
  useEffect(() => {
    if (merged.length <= 1) return;
    const t = setInterval(() => setHead(h => (h + 1) % merged.length), 6000);
    return () => clearInterval(t);
  }, [merged.length]);

  if (merged.length === 0) return null;

  return (
    <div className="border-b border-border bg-gradient-to-r from-[hsl(0,70%,18%)]/40 via-background to-background">
      <div className="px-5 py-2 flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono uppercase tracking-[0.15em] text-[hsl(0,85%,65%)]">
          <Zap className="w-3 h-3 animate-pulse" />
          Breaking
        </div>
        <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-4">
          {merged.map((item, idx) => {
            const isHead = idx === head;
            const mins = differenceInMinutes(new Date(), new Date(item.publishedAt || item.createdAt || Date.now()));
            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={cn(
                  'shrink-0 max-w-[280px] truncate text-left text-[12px] transition-all',
                  isHead ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle',
                  item.threatLevel === 'critical' ? 'bg-[hsl(0,85%,55%)]' : 'bg-[hsl(25,90%,55%)]'
                )} />
                <span className="font-mono text-[10px] text-muted-foreground/80 mr-1.5">{mins}m</span>
                {item.country && <span className="text-primary/80 mr-1.5">{item.country}</span>}
                {(item.aiSummary || item.title).replace(/<[^>]+>/g, '').slice(0, 90)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}