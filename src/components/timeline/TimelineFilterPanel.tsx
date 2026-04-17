import { TimelineFilters, ThreatCategory, SeverityLevel, EventState, ImpactTag, MomentumScore, ClientSector } from '@/types/timeline';
import { REGIONS, TIME_WINDOWS } from '@/data/mockTimelineEvents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, X, RefreshCw, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineFilterPanelProps {
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  onReset: () => void;
  eventCount: number;
}

const CATEGORIES: { value: ThreatCategory; label: string; icon: string }[] = [
  { value: 'geopolitical', label: 'Geopolitical', icon: '🌐' },
  { value: 'cyber', label: 'Cyber', icon: '💻' },
  { value: 'military', label: 'Military', icon: '⚔️' },
  { value: 'natural_disaster', label: 'Natural Disaster', icon: '🌪️' },
  { value: 'economic', label: 'Economic', icon: '📈' },
];

const SEVERITIES: { value: SeverityLevel; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'bg-intel-red' },
  { value: 'high', label: 'High', color: 'bg-intel-amber' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-intel-emerald' },
];

const EVENT_STATES: { value: EventState; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'developing', label: 'Developing' },
  { value: 'escalating', label: 'Escalating' },
  { value: 'stabilized', label: 'Stabilized' },
  { value: 'resolved', label: 'Resolved' },
];

const IMPACT_TAGS: { value: ImpactTag; label: string }[] = [
  { value: 'travel', label: 'Travel' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'corporate_ops', label: 'Corporate Ops' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'supply_chain', label: 'Supply Chain' },
  { value: 'markets', label: 'Markets' },
];

const CLIENT_SECTORS: { value: ClientSector; label: string }[] = [
  { value: 'aviation', label: 'Aviation' },
  { value: 'it', label: 'IT/Tech' },
  { value: 'energy', label: 'Energy' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
];

export function TimelineFilterPanel({ filters, onFiltersChange, onReset, eventCount }: TimelineFilterPanelProps) {
  const toggleArrayFilter = <T extends string>(key: keyof TimelineFilters, value: T) => {
    const current = filters[key] as T[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const activeFilterCount = 
    filters.regions.length + 
    filters.categories.length + 
    filters.severities.length + 
    filters.event_states.length + 
    filters.impact_tags.length +
    (filters.client_sector ? 1 : 0) +
    (filters.time_window !== 'all' ? 1 : 0);

  return (
    <div className="intel-card border-r border-border h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Filters</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onReset}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-8 h-8 text-xs bg-secondary/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Time Window */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Time Window
            </label>
            <Select
              value={filters.time_window}
              onValueChange={(value: TimelineFilters['time_window']) => 
                onFiltersChange({ ...filters, time_window: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_WINDOWS.map((tw) => (
                  <SelectItem key={tw.value} value={tw.value} className="text-xs">
                    {tw.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Sector */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Client Sector
            </label>
            <Select
              value={filters.client_sector || 'all'}
              onValueChange={(value) => 
                onFiltersChange({ ...filters, client_sector: value === 'all' ? undefined : value as ClientSector })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Sectors</SelectItem>
                {CLIENT_SECTORS.map((sector) => (
                  <SelectItem key={sector.value} value={sector.value} className="text-xs">
                    {sector.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Severity Level
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev.value}
                  onClick={() => toggleArrayFilter('severities', sev.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all",
                    filters.severities.includes(sev.value)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground border border-transparent hover:bg-secondary/50"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", sev.color)} />
                  {sev.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Threat Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => toggleArrayFilter('categories', cat.value)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                    filters.categories.includes(cat.value)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground border border-transparent hover:bg-secondary/50"
                  )}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event State */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Event State
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_STATES.map((state) => (
                <button
                  key={state.value}
                  onClick={() => toggleArrayFilter('event_states', state.value)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-all capitalize",
                    filters.event_states.includes(state.value)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground border border-transparent hover:bg-secondary/50"
                  )}
                >
                  {state.label}
                </button>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Region
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((region) => (
                <button
                  key={region}
                  onClick={() => toggleArrayFilter('regions', region)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-all",
                    filters.regions.includes(region)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground border border-transparent hover:bg-secondary/50"
                  )}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          {/* Impact Tags */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Impact Areas
            </label>
            <div className="flex flex-wrap gap-1.5">
              {IMPACT_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  onClick={() => toggleArrayFilter('impact_tags', tag.value)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-all",
                    filters.impact_tags.includes(tag.value)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground border border-transparent hover:bg-secondary/50"
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card/50">
        <div className="text-center text-xs text-muted-foreground">
          <span className="font-mono text-primary">{eventCount}</span> events match
        </div>
      </div>
    </div>
  );
}
