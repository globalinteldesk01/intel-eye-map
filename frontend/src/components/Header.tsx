import { useState } from 'react';
import { Bell, Search, User, RefreshCw, Radio } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NewsItem } from '@/types/news';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface HeaderProps {
  newsItems?: NewsItem[];
  isFetching?: boolean;
  lastFetchTime?: Date | null;
  sourcesCount?: number;
  onSearch?: (q: string) => void;
  onRefresh?: () => void;
}

export function Header({
  newsItems = [], isFetching = false, lastFetchTime, sourcesCount = 0,
  onSearch, onRefresh,
}: HeaderProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');

  const criticalCount = newsItems.filter(i => i.threatLevel === 'critical').length;
  const highCount = newsItems.filter(i => i.threatLevel === 'high').length;
  const initials = user?.email?.substring(0, 2).toUpperCase() || 'AN';

  return (
    <header className="h-12 bg-[#0d1321] border-b border-[#1e2d44] flex items-center px-4 gap-4 shrink-0 z-50">
      {/* Left: live status */}
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-green-400 font-bold tracking-widest uppercase text-[10px]">Live</span>
        </div>
        <div className="flex items-center gap-1 text-[#4a90d9]">
          <Radio className="w-3 h-3" />
          <span className="text-[10px]">{sourcesCount || 85}+ sources</span>
        </div>
        {isFetching && (
          <div className="flex items-center gap-1 text-yellow-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span className="text-[10px]">Fetching intel...</span>
          </div>
        )}
        {!isFetching && lastFetchTime && (
          <span className="text-[#475569] text-[10px]">
            {formatDistanceToNow(lastFetchTime, { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Center: search */}
      <div className="flex-1 max-w-lg mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            placeholder="Search intel, countries, threats... (Ctrl+K)"
            className="w-full bg-[#1a2538] border border-[#2a3a52] text-[#e2e8f0] placeholder-[#475569] text-[12px] pl-9 pr-4 py-1.5 rounded-md focus:outline-none focus:border-[#2563eb] transition-colors"
          />
        </div>
      </div>

      {/* Right: alerts + user */}
      <div className="flex items-center gap-3">
        {criticalCount > 0 && (
          <div className="flex items-center gap-1 bg-red-950/60 border border-red-800 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            {criticalCount} CRITICAL
          </div>
        )}
        {highCount > 0 && (
          <div className="flex items-center gap-1 bg-orange-950/60 border border-orange-800 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded">
            {highCount} HIGH
          </div>
        )}
        <button onClick={onRefresh} disabled={isFetching} className="text-[#475569] hover:text-white transition-colors disabled:opacity-40" title="Refresh">
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
        </button>
        <button className="relative text-[#64748b] hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
          {criticalCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
              {Math.min(criticalCount, 9)}
            </span>
          )}
        </button>
        <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[10px] font-bold cursor-pointer">
          {initials}
        </div>
      </div>
    </header>
  );
}
