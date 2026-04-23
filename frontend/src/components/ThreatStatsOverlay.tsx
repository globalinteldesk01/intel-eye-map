import { NewsItem } from '@/types/news';
import { X, AlertTriangle, Globe, Shield, Swords, Heart, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreatStatsOverlayProps {
  newsItems: NewsItem[];
  onClose: () => void;
  selectedCountry?: string;
}

export function ThreatStatsOverlay({ newsItems, onClose, selectedCountry }: ThreatStatsOverlayProps) {
  const items = selectedCountry ? newsItems.filter(i => i.country === selectedCountry) : newsItems;

  const critical = items.filter(i => i.threatLevel === 'critical').length;
  const high     = items.filter(i => i.threatLevel === 'high').length;
  const elevated = items.filter(i => i.threatLevel === 'elevated').length;
  const low      = items.filter(i => i.threatLevel === 'low').length;

  const byCategory = {
    conflict:      items.filter(i => i.category === 'conflict').length,
    security:      items.filter(i => i.category === 'security').length,
    humanitarian:  items.filter(i => i.category === 'humanitarian').length,
    diplomacy:     items.filter(i => i.category === 'diplomacy').length,
  };

  const topCountries = Object.entries(
    items.reduce((acc, i) => { acc[i.country] = (acc[i.country] || 0) + 1; return acc; }, {} as Record<string,number>)
  ).sort((a,b) => b[1]-a[1]).slice(0,5);

  return (
    <div className="w-[260px] bg-[#0f1724]/95 backdrop-blur border border-[#2a3a52] rounded-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e2d44]">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-[#4a90d9]" />
          <span className="text-white text-xs font-bold uppercase tracking-wide">
            {selectedCountry ? selectedCountry : 'Global Intel'}
          </span>
        </div>
        <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Threat breakdown */}
      <div className="p-3 space-y-1.5 border-b border-[#1e2d44]">
        <p className="text-[9px] text-[#475569] uppercase tracking-widest font-bold mb-2">Threat Breakdown</p>
        {[
          { label: 'Critical', count: critical, color: 'text-red-400', bg: 'bg-red-500' },
          { label: 'High',     count: high,     color: 'text-orange-400', bg: 'bg-orange-500' },
          { label: 'Elevated', count: elevated, color: 'text-yellow-400', bg: 'bg-yellow-500' },
          { label: 'Low',      count: low,      color: 'text-blue-400',   bg: 'bg-blue-500' },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full shrink-0', row.bg, row.label === 'Critical' && 'animate-pulse')} />
              <span className="text-[#94a3b8] text-xs">{row.label}</span>
            </div>
            <span className={cn('text-xs font-bold', row.color)}>{row.count}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1 border-t border-[#1e2d44]">
          <span className="text-[#64748b] text-xs font-semibold">Total Intel</span>
          <span className="text-white text-xs font-bold">{items.length}</span>
        </div>
      </div>

      {/* Categories */}
      <div className="p-3 border-b border-[#1e2d44]">
        <p className="text-[9px] text-[#475569] uppercase tracking-widest font-bold mb-2">By Category</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'Conflict',    count: byCategory.conflict,     icon: Swords,  color: 'text-red-400' },
            { label: 'Security',    count: byCategory.security,     icon: Shield,  color: 'text-blue-400' },
            { label: 'Humanitarian',count: byCategory.humanitarian, icon: Heart,   color: 'text-yellow-400' },
            { label: 'Diplomacy',   count: byCategory.diplomacy,    icon: Globe,   color: 'text-green-400' },
          ].map(row => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="bg-[#1a2538] rounded p-2 flex items-center gap-1.5">
                <Icon className={cn('w-3 h-3 shrink-0', row.color)} />
                <div>
                  <p className="text-[8px] text-[#64748b] leading-none">{row.label}</p>
                  <p className={cn('text-[11px] font-bold leading-tight', row.color)}>{row.count}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top countries */}
      {!selectedCountry && topCountries.length > 0 && (
        <div className="p-3">
          <p className="text-[9px] text-[#475569] uppercase tracking-widest font-bold mb-2">Top Affected</p>
          {topCountries.map(([country, count]) => (
            <div key={country} className="flex items-center justify-between py-0.5">
              <span className="text-[#94a3b8] text-[11px] truncate">{country}</span>
              <span className="text-[#4a90d9] text-[11px] font-bold ml-2">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
