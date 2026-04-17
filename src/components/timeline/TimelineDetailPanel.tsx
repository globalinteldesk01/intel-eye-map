import { IntelligenceEvent, SEVERITY_COLORS, EVENT_STATE_COLORS, MOMENTUM_CONFIG, CATEGORY_ICONS } from '@/types/timeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';
import { 
  X, Clock, MapPin, Shield, Eye, AlertTriangle, TrendingUp, TrendingDown, Minus,
  FileText, History, Target, Zap, Radio, ExternalLink, Copy, CheckCircle, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import { exportSingleIntelToPDF } from '@/utils/singleIntelExport';

interface TimelineDetailPanelProps {
  event: IntelligenceEvent;
  onClose: () => void;
  onLocateOnMap?: () => void;
  isPremium?: boolean;
}

export function TimelineDetailPanel({ event, onClose, onLocateOnMap, isPremium = false }: TimelineDetailPanelProps) {
  const [viewMode, setViewMode] = useState<'intel' | 'media'>('intel');
  const severityColor = SEVERITY_COLORS[event.severity];
  const stateColor = EVENT_STATE_COLORS[event.event_state];
  const momentumConfig = MOMENTUM_CONFIG[event.momentum];
  
  const MomentumIcon = event.momentum === 'escalating' ? TrendingUp : 
                       event.momentum === 'de-escalating' ? TrendingDown : Minus;

  const getDecisionDeadline = () => {
    if (!event.decision_deadline) return null;
    const deadline = parseISO(event.decision_deadline);
    const now = new Date();
    const hoursLeft = differenceInHours(deadline, now);
    const minutesLeft = differenceInMinutes(deadline, now) % 60;
    
    if (hoursLeft < 0) return { text: 'OVERDUE', hours: 0, minutes: 0, urgent: true };
    return { 
      text: `${hoursLeft}h ${minutesLeft}m remaining`,
      hours: hoursLeft, 
      minutes: minutesLeft, 
      urgent: hoursLeft < 6 
    };
  };

  const deadline = getDecisionDeadline();

  const copyToken = () => {
    if (event.token) {
      navigator.clipboard.writeText(event.token);
      toast.success('Token copied to clipboard');
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{CATEGORY_ICONS[event.category]}</span>
              {event.token && (
                <button 
                  onClick={copyToken}
                  className="flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
                >
                  <span>{event.token}</span>
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
            <h2 className="font-semibold text-sm leading-tight">{event.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge 
            className="text-[10px] capitalize"
            style={{ backgroundColor: `${severityColor}20`, color: severityColor, borderColor: severityColor }}
          >
            {event.severity}
          </Badge>
          <Badge 
            variant="outline"
            className="text-[10px] capitalize"
            style={{ borderColor: stateColor, color: stateColor }}
          >
            {event.event_state.replace('_', ' ')}
          </Badge>
          <div 
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
            style={{ backgroundColor: `${momentumConfig.color}20`, color: momentumConfig.color }}
          >
            <MomentumIcon className="w-3 h-3" />
            {momentumConfig.label}
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(parseISO(event.timestamp), 'MMM d, yyyy HH:mm')} UTC
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.region} • {event.country}
          </div>
        </div>

        {/* Decision Deadline Timer */}
        {deadline && (
          <div className={cn(
            "mt-3 p-2 rounded-lg border flex items-center justify-between",
            deadline.urgent 
              ? "bg-destructive/10 border-destructive/30" 
              : "bg-intel-amber/10 border-intel-amber/30"
          )}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("w-4 h-4", deadline.urgent ? "text-destructive" : "text-intel-amber")} />
              <span className="text-xs font-medium">Decision Deadline</span>
            </div>
            <span className={cn(
              "font-mono text-sm font-bold",
              deadline.urgent ? "text-destructive animate-pulse" : "text-intel-amber"
            )}>
              {deadline.text}
            </span>
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'intel' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('intel')}
            className="h-7 text-[10px]"
          >
            <Target className="w-3 h-3 mr-1" />
            Intel Assessment
          </Button>
          <Button
            variant={viewMode === 'media' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('media')}
            className="h-7 text-[10px]"
          >
            <FileText className="w-3 h-3 mr-1" />
            Media Narrative
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {viewMode === 'intel' 
                ? (event.intelligence_assessment || event.full_description || event.short_description)
                : (event.media_narrative || event.short_description)
              }
            </p>
          </div>

          {/* Why This Matters */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Why This Matters</span>
            </div>
            <p className="text-xs">{event.why_this_matters}</p>
          </div>

          {/* Recommended Actions */}
          {event.recommended_actions && event.recommended_actions.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recommended Actions
              </h4>
              <div className="space-y-1.5">
                {event.recommended_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-intel-emerald mt-0.5 shrink-0" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cascade Impacts */}
          {event.cascade_impacts && event.cascade_impacts.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Cascade Impact Analysis
              </h4>
              <div className="space-y-2">
                {event.cascade_impacts.map((impact, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "p-2 rounded border-l-2 bg-secondary/30",
                      impact.order === 1 ? "border-l-intel-red" :
                      impact.order === 2 ? "border-l-intel-amber" : "border-l-yellow-500"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium">
                        {impact.order === 1 ? '1st Order' : impact.order === 2 ? '2nd Order' : '3rd Order'} • {impact.category}
                      </span>
                      <span className="text-[10px] font-mono text-primary">
                        {Math.round(impact.probability * 100)}% prob
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{impact.description}</p>
                    <span className="text-[9px] text-muted-foreground">{impact.timeframe}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Threat DNA */}
          {event.threat_dna && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Threat DNA Profile
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-secondary/30">
                  <span className="text-[9px] text-muted-foreground block">Actor Type</span>
                  <span className="text-xs font-medium capitalize">{event.threat_dna.actor_type}</span>
                </div>
                <div className="p-2 rounded bg-secondary/30">
                  <span className="text-[9px] text-muted-foreground block">Capability</span>
                  <span className="text-xs font-medium capitalize">{event.threat_dna.capability}</span>
                </div>
                <div className="p-2 rounded bg-secondary/30">
                  <span className="text-[9px] text-muted-foreground block">Intent</span>
                  <span className="text-xs font-medium capitalize">{event.threat_dna.intent}</span>
                </div>
                <div className="p-2 rounded bg-secondary/30">
                  <span className="text-[9px] text-muted-foreground block">Pattern Match</span>
                  <span className="text-xs font-medium">{event.threat_dna.historical_pattern_similarity}%</span>
                </div>
              </div>
              {event.threat_dna.similar_events && event.threat_dna.similar_events.length > 0 && (
                <div className="mt-2">
                  <span className="text-[9px] text-muted-foreground">Similar Historical Events:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {event.threat_dna.similar_events.map((e, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{e}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pre-Event Signals */}
          {event.pre_event_signals && event.pre_event_signals.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Radio className="w-3 h-3" />
                Pre-Event Signals
              </h4>
              <div className="space-y-1.5">
                {event.pre_event_signals.map((signal) => (
                  <div key={signal.id} className="p-2 rounded bg-secondary/30 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{signal.type}</span>
                      <span className="text-[9px] text-primary font-mono">
                        {Math.round(signal.relevance_score * 100)}% relevance
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{signal.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gaps & Uncertainties */}
          {viewMode === 'intel' && event.gaps_and_uncertainties && event.gaps_and_uncertainties.length > 0 && (
            <div className="p-3 rounded-lg bg-intel-amber/5 border border-intel-amber/20">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-intel-amber mb-2">
                Intelligence Gaps
              </h4>
              <ul className="space-y-1">
                {event.gaps_and_uncertainties.map((gap, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-intel-amber">•</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Update History */}
          {event.update_history.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <History className="w-3 h-3" />
                Update History
              </h4>
              <div className="space-y-2">
                {event.update_history.map((update) => (
                  <div key={update.id} className="flex gap-2 text-xs">
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {format(parseISO(update.timestamp), 'HH:mm')}
                    </span>
                    <div className="flex-1">
                      <p>{update.content}</p>
                      {update.severity_change && (
                        <Badge 
                          className="text-[8px] mt-1"
                          style={{ 
                            backgroundColor: `${SEVERITY_COLORS[update.severity_change]}20`, 
                            color: SEVERITY_COLORS[update.severity_change] 
                          }}
                        >
                          Upgraded to {update.severity_change}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Info */}
          <div className="p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-mono">{event.source_count}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px]",
                    event.source_reliability === 'verified' ? "border-intel-emerald text-intel-emerald" :
                    event.source_reliability === 'credible' ? "border-intel-amber text-intel-amber" :
                    "border-muted-foreground text-muted-foreground"
                  )}
                >
                  {event.source_reliability}
                </Badge>
              </div>
            </div>
            {event.primary_source && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Primary:</span>
                <span className="text-foreground">{event.primary_source}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-3 h-3 text-primary" />
              <span className="text-xs">Trust Score: <span className="font-mono text-primary font-bold">{event.trust_score}%</span></span>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          {onLocateOnMap && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="flex-1 h-8 text-xs"
              onClick={onLocateOnMap}
            >
              <MapPin className="w-3 h-3 mr-1" />
              Locate on Map
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs"
            onClick={async () => {
              toast.loading('Generating PDF report...');
              try {
                await exportSingleIntelToPDF(event);
                toast.dismiss();
                toast.success('Intel report exported successfully');
              } catch (error) {
                toast.dismiss();
                toast.error('Failed to export report');
              }
            }}
          >
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
