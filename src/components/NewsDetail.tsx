import { NewsItem } from '@/types/news';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  MapPin, 
  Clock, 
  Globe, 
  Tag, 
  X,
  Share2,
  Bookmark,
  AlertCircle,
  Hash,
  Copy,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportNewsItemToPDF } from '@/utils/newsExport';

interface NewsDetailProps {
  item: NewsItem;
  onClose: () => void;
}

const categoryColors: Record<string, string> = {
  security: 'bg-intel-cyan/20 text-intel-cyan border-intel-cyan/30',
  diplomacy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  economy: 'bg-intel-emerald/20 text-intel-emerald border-intel-emerald/30',
  conflict: 'bg-intel-red/20 text-red-400 border-intel-red/30',
  humanitarian: 'bg-intel-amber/20 text-intel-amber border-intel-amber/30',
  technology: 'bg-intel-purple/20 text-purple-400 border-intel-purple/30',
};

const getConfidenceColor = (score: number) => {
  if (score >= 0.9) return 'text-intel-emerald';
  if (score >= 0.7) return 'text-intel-amber';
  return 'text-intel-red';
};

const getConfidenceLabel = (score: number) => {
  if (score >= 0.9) return 'High';
  if (score >= 0.7) return 'Medium';
  return 'Low';
};

export function NewsDetail({ item, onClose }: NewsDetailProps) {
  const { toast } = useToast();

  const copyToken = () => {
    if (item.token) {
      navigator.clipboard.writeText(item.token);
      toast({
        title: 'Token Copied',
        description: `${item.token} copied to clipboard`,
      });
    }
  };

  const handleExport = async () => {
    toast({
      title: 'Generating Report',
      description: 'Creating intelligence report PDF...',
    });
    
    try {
      await exportNewsItemToPDF(item);
      toast({
        title: 'Report Generated',
        description: 'Intelligence report downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not generate the report',
        variant: 'destructive',
      });
    }
  };
  return (
    <div className="intel-card h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Intel Detail</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Token Badge */}
        {item.token && (
          <div 
            className="flex items-center gap-2 p-2.5 bg-primary/10 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
            onClick={copyToken}
          >
            <Hash className="w-4 h-4 text-primary" />
            <span className="font-mono font-semibold text-primary">{item.token}</span>
            <Copy className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
            <span className="text-[10px] text-muted-foreground">Click to copy</span>
          </div>
        )}

        {/* Category & Confidence */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`uppercase tracking-wider ${categoryColors[item.category]}`}
          >
            {item.category}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <span className={`text-sm font-mono font-semibold ${getConfidenceColor(item.confidenceScore)}`}>
              {Math.round(item.confidenceScore * 100)}%
            </span>
            <Badge variant="outline" className={getConfidenceColor(item.confidenceScore)}>
              {getConfidenceLabel(item.confidenceScore)}
            </Badge>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-lg font-semibold leading-tight">{item.title}</h1>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(item.publishedAt), 'MMM d, yyyy HH:mm')} UTC
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {item.country}, {item.region}
          </span>
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            {item.source}
          </span>
        </div>

        {/* Coordinates */}
        <div className="p-3 bg-secondary/30 rounded-lg border border-border">
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-muted-foreground">LAT:</span>
            <span className="text-primary">{item.lat.toFixed(4)}</span>
            <span className="text-muted-foreground">LON:</span>
            <span className="text-primary">{item.lon.toFixed(4)}</span>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Summary
          </h3>
          <p className="text-sm leading-relaxed">{item.summary}</p>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground font-mono">
          <span>Published: </span>
          <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border flex items-center gap-2">
        <Button asChild size="sm" className="flex-1">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Source
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Share2 className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Bookmark className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
