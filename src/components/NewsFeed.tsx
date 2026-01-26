import { useMemo, useState } from 'react';
import { NewsItem } from '@/types/news';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Clock, 
  Trash2, 
  Search, 
  Hash, 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NewsFeedProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  onDeleteItem?: (id: string) => Promise<boolean>;
}

const categoryColors: Record<string, string> = {
  security: 'bg-intel-cyan/20 text-intel-cyan border-intel-cyan/30',
  diplomacy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  economy: 'bg-intel-emerald/20 text-intel-emerald border-intel-emerald/30',
  conflict: 'bg-intel-red/20 text-red-400 border-intel-red/30',
  humanitarian: 'bg-intel-amber/20 text-intel-amber border-intel-amber/30',
  technology: 'bg-intel-purple/20 text-purple-400 border-intel-purple/30',
};

const threatLevelConfig: Record<string, { color: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: ShieldAlert, label: 'CRITICAL' },
  high: { color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', icon: AlertTriangle, label: 'HIGH' },
  elevated: { color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', icon: TrendingUp, label: 'ELEVATED' },
  low: { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30', icon: ShieldCheck, label: 'LOW' },
};

const confidenceLevelConfig: Record<string, { color: string; label: string }> = {
  verified: { color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40', label: 'VERIFIED' },
  developing: { color: 'text-amber-400 bg-amber-500/15 border-amber-500/40', label: 'DEVELOPING' },
  breaking: { color: 'text-red-400 bg-red-500/15 border-red-500/40', label: 'BREAKING' },
};

const sourceCredibilityConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'text-emerald-400', label: 'High Credibility' },
  medium: { color: 'text-amber-400', label: 'Medium Credibility' },
  low: { color: 'text-red-400', label: 'Low Credibility' },
};

export function NewsFeed({ newsItems, onSelectItem, selectedItem, onDeleteItem }: NewsFeedProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter and sort news items
  const filteredAndSortedNews = useMemo(() => {
    let items = [...newsItems];
    
    // Filter by search query (token, title, or summary)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(item => 
        item.token?.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query)
      );
    }
    
    // Sort chronologically (newest first)
    return items.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [newsItems, searchQuery]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItem) {
      await onDeleteItem(id);
    }
  };

  return (
    <div className="intel-card h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by token (INT-2024-...) or keyword"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/50"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
          {filteredAndSortedNews.length} of {newsItems.length} intel reports
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredAndSortedNews.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <p>No intel reports yet.</p>
              <p className="text-xs mt-1">Click "Add Intel" to create one.</p>
            </div>
          ) : (
            filteredAndSortedNews.map((item) => {
              const threatConfig = threatLevelConfig[item.threatLevel] || threatLevelConfig.low;
              const ThreatIcon = threatConfig.icon;
              const confidenceConfig = confidenceLevelConfig[item.confidenceLevel] || confidenceLevelConfig.developing;
              const credibilityConfig = sourceCredibilityConfig[item.sourceCredibility] || sourceCredibilityConfig.medium;
              
              return (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={`rounded-xl cursor-pointer transition-all group relative overflow-hidden ${
                    selectedItem?.id === item.id
                      ? 'bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 border-2 border-primary/40 shadow-lg shadow-primary/10'
                      : 'bg-gradient-to-br from-secondary/60 via-secondary/40 to-secondary/20 border border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
                  }`}
                >
                  {/* Threat Level Accent Bar */}
                  <div className={`h-1 w-full ${
                    item.threatLevel === 'critical' ? 'bg-gradient-to-r from-red-600 via-red-500 to-red-400' :
                    item.threatLevel === 'high' ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400' :
                    item.threatLevel === 'elevated' ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400' :
                    'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400'
                  }`} />

                  <div className="p-3">
                    {/* Delete button - only show for items user can delete */}
                    {onDeleteItem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive z-10"
                        onClick={(e) => handleDelete(e, item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}

                    {/* Top Row: Category + Confidence Level + Time */}
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider font-semibold px-3 py-0.5 ${categoryColors[item.category]}`}
                      >
                        {item.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider font-semibold px-3 py-0.5 ${confidenceConfig.color}`}
                      >
                        {confidenceConfig.label}
                      </Badge>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>

                    {/* Summary/Brief */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {item.summary}
                    </p>

                    {/* Bottom Row: Location + Source + Threat Level */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary/70" />
                          {item.country}
                        </span>
                        <span className={`flex items-center gap-1 ${credibilityConfig.color}`}>
                          {item.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 ${threatConfig.color}`}
                        >
                          <ThreatIcon className="w-2.5 h-2.5 mr-0.5" />
                          {threatConfig.label}
                        </Badge>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
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
