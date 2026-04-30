import { NewsItem } from '@/types/news';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Download,
  Shield,
  Swords,
  DollarSign,
  Heart,
  Cpu,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportNewsItemToPDF } from '@/utils/newsExport';
import { getBestSourceUrl } from '@/utils/urlUtils';
import { cn } from '@/lib/utils';
import { PublishToClientsButton } from '@/components/client/PublishToClientsButton';

interface NewsDetailProps {
  item: NewsItem;
  onClose: () => void;
}

const categoryConfig: Record<string, { icon: typeof Shield; label: string; color: string }> = {
  security: { icon: Shield, label: 'Security Alert', color: 'hsl(200,80%,50%)' },
  diplomacy: { icon: Globe, label: 'Diplomatic Update', color: 'hsl(220,70%,55%)' },
  economy: { icon: DollarSign, label: 'Economic Report', color: 'hsl(145,60%,45%)' },
  conflict: { icon: Swords, label: 'Conflict Report', color: 'hsl(0,75%,50%)' },
  humanitarian: { icon: Heart, label: 'Humanitarian Update', color: 'hsl(35,85%,55%)' },
  technology: { icon: Cpu, label: 'Technology Intel', color: 'hsl(270,60%,55%)' },
};

const threatLevelConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: 'CRITICAL', bg: 'bg-[hsl(0,75%,50%)]/15', text: 'text-[hsl(0,75%,55%)]', border: 'border-[hsl(0,75%,50%)]' },
  high: { label: 'HIGH', bg: 'bg-[hsl(25,80%,50%)]/15', text: 'text-[hsl(25,80%,55%)]', border: 'border-[hsl(25,80%,50%)]' },
  elevated: { label: 'ELEVATED', bg: 'bg-[hsl(45,80%,50%)]/15', text: 'text-[hsl(45,80%,55%)]', border: 'border-[hsl(45,80%,50%)]' },
  low: { label: 'LOW', bg: 'bg-[hsl(210,60%,50%)]/15', text: 'text-[hsl(210,60%,55%)]', border: 'border-[hsl(210,60%,50%)]' },
};

const countrySidebarColors: Record<string, string> = {
  critical: 'bg-[hsl(0,65%,45%)]',
  high: 'bg-[hsl(25,70%,45%)]',
  elevated: 'bg-[hsl(45,70%,40%)]',
  low: 'bg-[hsl(210,60%,40%)]',
};

// Generate contextual recommendations based on category and threat level
function getRecommendations(item: NewsItem): string[] {
  const base: string[] = [];
  
  switch (item.category) {
    case 'conflict':
      base.push('Monitor developments closely for escalation indicators.');
      base.push('Review travel advisories for the affected region.');
      base.push('Assess impact on local operations and personnel safety.');
      base.push('Coordinate with regional security teams for situational awareness.');
      break;
    case 'security':
      base.push('Review current security posture for affected areas.');
      base.push('Update risk assessments for ongoing operations.');
      base.push('Ensure communication channels are operational.');
      base.push('Brief relevant stakeholders on potential implications.');
      break;
    case 'diplomacy':
      base.push('Monitor diplomatic channels for follow-up statements.');
      base.push('Assess implications for bilateral/multilateral relations.');
      base.push('Review policy alignment and compliance requirements.');
      break;
    case 'economy':
      base.push('Evaluate potential market and supply chain impacts.');
      base.push('Review financial exposure in affected sectors.');
      base.push('Monitor regulatory changes that may follow.');
      break;
    case 'humanitarian':
      base.push('Assess humanitarian corridor status and access.');
      base.push('Monitor aid organization response and coordination.');
      base.push('Review population displacement patterns.');
      base.push('Coordinate with local partners for ground-truth verification.');
      break;
    case 'technology':
      base.push('Review cybersecurity posture for relevant systems.');
      base.push('Assess technology supply chain dependencies.');
      base.push('Monitor for related technical advisories.');
      break;
    default:
      base.push('Continue monitoring the situation for developments.');
  }

  if (item.threatLevel === 'critical' || item.threatLevel === 'high') {
    base.unshift('Exercise heightened vigilance in the affected area.');
  }

  return base;
}

export function NewsDetail({ item, onClose }: NewsDetailProps) {
  const { toast } = useToast();
  const viewableUrl = getBestSourceUrl(item.url, item.title, item.source, item.tags);
  const config = categoryConfig[item.category] || categoryConfig.security;
  const threat = threatLevelConfig[item.threatLevel] || threatLevelConfig.low;
  const sidebarBg = countrySidebarColors[item.threatLevel] || countrySidebarColors.low;
  const CategoryIcon = config.icon;
  const recommendations = getRecommendations(item);

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

  const cleanSummary = item.summary
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  return (
    <div className="h-full w-full flex flex-col animate-slide-in-right bg-card pt-[env(safe-area-inset-top)]">
      {/* Header with close */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-semibold text-sm truncate">Intelligence Report</h2>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 ml-2"
          onClick={onClose}
          aria-label="Close report"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable Report Content */}
      <ScrollArea className="flex-1">
        <div className="relative">
          {/* Country Sidebar Tab */}
          <div className={cn(
            "absolute top-0 right-0 w-8 flex items-center justify-center py-6 rounded-bl-lg z-10",
            sidebarBg
          )}>
            <span className="text-white font-bold text-sm tracking-widest uppercase"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {item.country}
            </span>
          </div>

          <div className="p-4 pr-12 space-y-4">
            {/* Report Title */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-[10px] font-bold uppercase tracking-wider", threat.bg, threat.text, "border", threat.border)}>
                  {threat.label}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {config.label}
                </Badge>
              </div>
              <h1 className="text-base font-bold leading-tight text-foreground">
                {item.subCategory ? `${item.subCategory}: ` : `${config.label}: `}
                {item.title}
              </h1>
            </div>

            {/* Token */}
            {item.token && (
              <div 
                className="flex items-center gap-2 p-2 bg-primary/10 rounded border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
                onClick={copyToken}
              >
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span className="font-mono text-xs font-semibold text-primary">{item.token}</span>
                <Copy className="w-3 h-3 text-muted-foreground ml-auto" />
              </div>
            )}

            {/* Summary / Situation Overview */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-border">
              <p className="text-sm leading-relaxed text-foreground">
                {cleanSummary || item.title}
              </p>
            </div>

            {/* Recommendations */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                Recommendations
              </h3>
              <ul className="space-y-1.5">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-secondary/20 rounded border border-border">
                <span className="text-muted-foreground block mb-0.5">Location</span>
                <span className="font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.country}, {item.region}
                </span>
              </div>
              <div className="p-2 bg-secondary/20 rounded border border-border">
                <span className="text-muted-foreground block mb-0.5">Published</span>
                <span className="font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(item.publishedAt), 'MMM d, HH:mm')} UTC
                </span>
              </div>
              <div className="p-2 bg-secondary/20 rounded border border-border">
                <span className="text-muted-foreground block mb-0.5">Source</span>
                <span className="font-semibold flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {item.source}
                </span>
              </div>
              <div className="p-2 bg-secondary/20 rounded border border-border">
                <span className="text-muted-foreground block mb-0.5">Confidence</span>
                <span className={cn("font-semibold font-mono",
                  item.confidenceScore >= 0.9 ? 'text-[hsl(145,60%,45%)]' :
                  item.confidenceScore >= 0.7 ? 'text-[hsl(35,85%,55%)]' :
                  'text-[hsl(0,75%,55%)]'
                )}>
                  {Math.round(item.confidenceScore * 100)}% — {item.confidenceLevel}
                </span>
              </div>
            </div>

            {/* Coordinates */}
            <div className="p-2 bg-secondary/20 rounded border border-border">
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-muted-foreground">LAT:</span>
                <span className="text-primary font-semibold">{item.lat.toFixed(4)}</span>
                <span className="text-muted-foreground">LON:</span>
                <span className="text-primary font-semibold">{item.lon.toFixed(4)}</span>
              </div>
            </div>

            {/* Tags */}
            {item.tags.filter(t => !t.startsWith('source:')).length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-1">
                  {item.tags
                    .filter(t => !t.startsWith('source:'))
                    .map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px] capitalize">
                        {tag}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Source Attribution */}
            <div className="border-t border-border pt-3 mt-2">
              <p className="text-[10px] text-muted-foreground">
                Source: {item.source} • Credibility: {item.sourceCredibility.toUpperCase()}
              </p>
              <p className="text-xs font-bold text-foreground mt-1 text-right">
                Global Intel Desk
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-3 border-t border-border flex items-center gap-2 bg-card">
        <Button asChild size="sm" className="flex-1 h-8 text-xs">
          <a href={viewableUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            View Source
          </a>
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export PDF
        </Button>
        <PublishToClientsButton newsItemId={item.id} />
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Bookmark className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
