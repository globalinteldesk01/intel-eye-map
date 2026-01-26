import { IntelligenceEvent, SEVERITY_COLORS, EVENT_STATE_COLORS, MOMENTUM_CONFIG, CATEGORY_ICONS } from '@/types/timeline';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEventCardProps {
  event: IntelligenceEvent;
  isSelected: boolean;
  onClick: () => void;
  isPremium?: boolean;
}

export function TimelineEventCard({ event, isSelected, onClick, isPremium = false }: TimelineEventCardProps) {
  const severityColor = SEVERITY_COLORS[event.severity];
  const stateColor = EVENT_STATE_COLORS[event.event_state];
  const momentumConfig = MOMENTUM_CONFIG[event.momentum];
  
  const getConfidenceWidth = () => {
    switch (event.confidence_level) {
      case 'high': return 'w-full';
      case 'medium': return 'w-2/3';
      case 'low': return 'w-1/3';
    }
  };

  const getDecisionDeadline = () => {
    if (!event.decision_deadline) return null;
    const deadline = parseISO(event.decision_deadline);
    const now = new Date();
    const hoursLeft = differenceInHours(deadline, now);
    const minutesLeft = differenceInMinutes(deadline, now) % 60;
    
    if (hoursLeft < 0) return { text: 'OVERDUE', urgent: true };
    if (hoursLeft < 6) return { text: `${hoursLeft}h ${minutesLeft}m`, urgent: true };
    if (hoursLeft < 24) return { text: `${hoursLeft}h`, urgent: false };
    return { text: `${Math.floor(hoursLeft / 24)}d`, urgent: false };
  };

  const deadline = getDecisionDeadline();
  const MomentumIcon = event.momentum === 'escalating' ? TrendingUp : 
                       event.momentum === 'de-escalating' ? TrendingDown : Minus;

  // Check if premium feature is locked
  const isLocked = event.is_premium && !isPremium;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative w-full min-w-0 rounded-lg cursor-pointer transition-all duration-200 overflow-hidden group",
        "border hover:shadow-lg hover:shadow-primary/10",
        isSelected
          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30 shadow-intel-glow"
          : "bg-card/80 border-border hover:border-primary/30 hover:bg-card"
      )}
    >
      {/* Severity Stripe */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: severityColor }}
      />
      
      {/* Confidence Indicator (bottom bar) */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
        <div 
          className={cn("h-full transition-all", getConfidenceWidth())}
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        />
      </div>

      <div className="p-3 pl-4">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{CATEGORY_ICONS[event.category]}</span>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 capitalize font-mono"
              style={{ borderColor: stateColor, color: stateColor }}
            >
              {event.event_state.replace('_', ' ')}
            </Badge>
          </div>
          
          {/* Momentum Arrow */}
          <div 
            className="flex items-center gap-1 text-[10px] font-medium"
            style={{ color: momentumConfig.color }}
          >
            <MomentumIcon className="w-3 h-3" />
            <span className="hidden group-hover:inline">{momentumConfig.label}</span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-xs font-semibold leading-tight line-clamp-2 mb-1.5 pr-2">
          {event.title}
        </h4>

        {/* Description */}
        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">
          {event.short_description}
        </p>

        {/* Meta Row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{format(parseISO(event.timestamp), 'HH:mm')} UTC</span>
          </div>
          <span>{event.region} • {event.country}</span>
        </div>

        {/* Bottom Row - Trust Score & Decision Deadline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Trust Score */}
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-mono text-primary">{event.trust_score}%</span>
            </div>
            
            {/* Source Count */}
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">{event.source_count}</span>
            </div>
          </div>

          {/* Decision Deadline */}
          {deadline && (
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono",
              deadline.urgent 
                ? "bg-destructive/20 text-destructive animate-pulse-glow" 
                : "bg-intel-amber/20 text-intel-amber"
            )}>
              <AlertTriangle className="w-3 h-3" />
              <span>{deadline.text}</span>
            </div>
          )}
        </div>

        {/* Impact Tags */}
        {event.impact_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {event.impact_tags.slice(0, 3).map((tag) => (
              <span 
                key={tag}
                className="text-[8px] px-1.5 py-0.5 rounded bg-secondary/50 text-secondary-foreground capitalize"
              >
                {tag.replace('_', ' ')}
              </span>
            ))}
            {event.impact_tags.length > 3 && (
              <span className="text-[8px] text-muted-foreground">+{event.impact_tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Premium Lock Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <Shield className="w-6 h-6 mx-auto mb-1 text-intel-amber" />
              <span className="text-[10px] font-medium text-intel-amber">Premium Intel</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
