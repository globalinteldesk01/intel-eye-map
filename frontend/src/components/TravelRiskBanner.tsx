import { useMemo } from 'react';
import { NewsItem, TravelImpact } from '@/types/news';
import { AlertTriangle, Shield, Activity, Plane, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TravelRiskBannerProps {
  newsItems: NewsItem[];
}

const REGIONS = [
  'Middle East', 'Eastern Europe', 'South Asia', 'East Asia',
  'Southeast Asia', 'West Africa', 'East Africa', 'Horn of Africa',
  'Sub-Saharan Africa', 'Latin America', 'North America', 'Western Europe',
  'Central Asia', 'Sahel', 'Caribbean', 'Pacific',
];

const impactRank: Record<TravelImpact, number> = {
  critical: 4, high: 3, medium: 2, low: 1, none: 0,
};

const impactStyle: Record<TravelImpact, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-red-950/80',    text: 'text-red-400',    border: 'border-red-800',    dot: 'bg-red-500' },
  high:     { bg: 'bg-orange-950/80', text: 'text-orange-400', border: 'border-orange-800', dot: 'bg-orange-500' },
  medium:   { bg: 'bg-yellow-950/60', text: 'text-yellow-400', border: 'border-yellow-800', dot: 'bg-yellow-500' },
  low:      { bg: 'bg-blue-950/60',   text: 'text-blue-400',   border: 'border-blue-800',   dot: 'bg-blue-500' },
  none:     { bg: 'bg-green-950/60',  text: 'text-green-400',  border: 'border-green-800',  dot: 'bg-green-500' },
};

const impactLabel: Record<TravelImpact, string> = {
  critical: 'CRITICAL', high: 'HIGH RISK', medium: 'CAUTION', low: 'LOW RISK', none: 'CLEAR',
};

export function TravelRiskBanner({ newsItems }: TravelRiskBannerProps) {
  // Compute risk per region from last 48h of news
  const regionRisks = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const riskMap: Record<string, TravelImpact> = {};

    newsItems.forEach(item => {
      const age = new Date(item.publishedAt).getTime();
      if (age < cutoff) return;
      const region = item.region || 'Global';
      const impact = item.travelImpact || 'none';
      const current = riskMap[region] || 'none';
      if (impactRank[impact] > impactRank[current]) {
        riskMap[region] = impact;
      }
    });

    // Sort by risk level (highest first), take top 8
    return Object.entries(riskMap)
      .filter(([_, v]) => v !== 'none')
      .sort(([, a], [, b]) => impactRank[b] - impactRank[a])
      .slice(0, 8);
  }, [newsItems]);

  // Global stats
  const stats = useMemo(() => {
    const critical = newsItems.filter(i => i.travelImpact === 'critical').length;
    const high = newsItems.filter(i => i.travelImpact === 'high').length;
    const evacuation = newsItems.filter(i => i.evacuationRelevance).length;
    return { critical, high, evacuation };
  }, [newsItems]);

  if (regionRisks.length === 0) return null;

  return (
    <div className="bg-[hsl(215,35%,8%)] border-b border-border/30 px-4 py-2">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Plane className="w-3 h-3 text-blue-400" />
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Travel Security Brief</span>
        </div>
        <div className="h-px flex-1 bg-border/30" />
        {stats.critical > 0 && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            {stats.critical} CRITICAL ZONE{stats.critical > 1 ? 'S' : ''}
          </div>
        )}
        {stats.evacuation > 0 && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-orange-400">
            <Zap className="w-3 h-3" />
            {stats.evacuation} EVACUATION ALERT{stats.evacuation > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* Region risk tiles */}
      <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {regionRisks.map(([region, impact]) => {
          const style = impactStyle[impact];
          return (
            <div
              key={region}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold',
                style.bg, style.text, style.border
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', style.dot,
                impact === 'critical' && 'animate-pulse'
              )} />
              <span className="uppercase tracking-wide">{region}</span>
              <span className="opacity-70">·</span>
              <span>{impactLabel[impact]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
