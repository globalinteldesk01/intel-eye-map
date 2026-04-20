import { useState } from 'react';
import { FilterState, ConfidenceLevel, ActorType } from '@/types/news';
import { regions, categories, sources, confidenceLevelsList, actorTypesList } from '@/data/mockNews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Filter, 
  X, 
  Globe,
  Tag,
  Radio,
  RotateCcw,
  Users,
  Clock
} from 'lucide-react';

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalResults: number;
  filteredResults: number;
}

const categoryColors: Record<string, string> = {
  security: 'bg-intel-cyan/20 text-intel-cyan border-intel-cyan/30',
  diplomacy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  economy: 'bg-intel-emerald/20 text-intel-emerald border-intel-emerald/30',
  conflict: 'bg-intel-red/20 text-red-400 border-intel-red/30',
  humanitarian: 'bg-intel-amber/20 text-intel-amber border-intel-amber/30',
  technology: 'bg-intel-purple/20 text-purple-400 border-intel-purple/30',
};


export function FilterPanel({ filters, onFiltersChange, totalResults, filteredResults }: FilterPanelProps) {
  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const toggleRegion = (region: string) => {
    const newRegions = filters.regions.includes(region)
      ? filters.regions.filter((r) => r !== region)
      : [...filters.regions, region];
    onFiltersChange({ ...filters, regions: newRegions });
  };

  const toggleSource = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };


  const toggleConfidenceLevel = (level: ConfidenceLevel) => {
    const newLevels = filters.confidenceLevels.includes(level)
      ? filters.confidenceLevels.filter((l) => l !== level)
      : [...filters.confidenceLevels, level];
    onFiltersChange({ ...filters, confidenceLevels: newLevels });
  };

  const toggleActorType = (type: ActorType) => {
    const newTypes = filters.actorTypes.includes(type)
      ? filters.actorTypes.filter((t) => t !== type)
      : [...filters.actorTypes, type];
    onFiltersChange({ ...filters, actorTypes: newTypes });
  };

  const resetFilters = () => {
    onFiltersChange({
      dateRange: { from: null, to: null },
      regions: [],
      countries: [],
      tags: [],
      sources: [],
      searchQuery: '',
      categories: [],
      threatLevels: [],
      confidenceLevels: [],
      actorTypes: [],
      timeRange: '24h',
    });
  };

  const hasActiveFilters = 
    filters.categories.length > 0 || 
    filters.regions.length > 0 || 
    filters.sources.length > 0 || 
    filters.threatLevels.length > 0 ||
    filters.confidenceLevels.length > 0 ||
    filters.actorTypes.length > 0 ||
    filters.searchQuery.length > 0;

  return (
    <div className="intel-card h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Filters</h2>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
        
        {/* Results count */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <Radio className="w-3 h-3 text-intel-cyan animate-pulse" />
          <span className="text-muted-foreground">
            <span className="text-primary font-semibold">{filteredResults}</span>
            {' / '}
            {totalResults} events
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Search */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Search className="w-3 h-3" />
              Keyword Search
            </Label>
            <div className="relative">
              <Input
                placeholder="Search intel..."
                value={filters.searchQuery}
                onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
                className="h-9 bg-secondary/50 border-border text-sm pr-8"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => onFiltersChange({ ...filters, searchQuery: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Tag className="w-3 h-3" />
              Categories
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant="outline"
                  className={`cursor-pointer text-xs capitalize transition-all ${
                    filters.categories.includes(category)
                      ? categoryColors[category]
                      : 'bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/50'
                  }`}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Globe className="w-3 h-3" />
              Regions
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {regions.map((region) => (
                <Badge
                  key={region}
                  variant="outline"
                  className={`cursor-pointer text-xs transition-all ${
                    filters.regions.includes(region)
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/50'
                  }`}
                  onClick={() => toggleRegion(region)}
                >
                  {region}
                </Badge>
              ))}
            </div>
          </div>


          {/* Time Range */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Time Range
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(['1h', '24h', '7d'] as const).map((range) => (
                <Badge
                  key={range}
                  variant="outline"
                  className={`cursor-pointer text-xs transition-all ${
                    filters.timeRange === range
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/50'
                  }`}
                  onClick={() => onFiltersChange({ ...filters, timeRange: range })}
                >
                  {range === '1h' ? 'Last Hour' : range === '24h' ? 'Last 24h' : 'Last 7 Days'}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actor Types */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Users className="w-3 h-3" />
              Actor Type
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {actorTypesList.map((type) => (
                <Badge
                  key={type}
                  variant="outline"
                  className={`cursor-pointer text-xs capitalize transition-all ${
                    filters.actorTypes.includes(type)
                      ? 'bg-intel-purple/20 text-purple-400 border-intel-purple/30'
                      : 'bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/50'
                  }`}
                  onClick={() => toggleActorType(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Radio className="w-3 h-3" />
              Sources
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {sources.slice(0, 8).map((source) => (
                <Badge
                  key={source}
                  variant="outline"
                  className={`cursor-pointer text-xs transition-all ${
                    filters.sources.includes(source)
                      ? 'bg-intel-emerald/20 text-intel-emerald border-intel-emerald/30'
                      : 'bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/50'
                  }`}
                  onClick={() => toggleSource(source)}
                >
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Live indicator */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-intel-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-intel-cyan"></span>
          </span>
          <span className="text-muted-foreground font-mono">LIVE FEED ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
