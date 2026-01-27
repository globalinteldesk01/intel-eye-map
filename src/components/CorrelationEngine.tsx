import { useState } from 'react';
import { useCorrelationEngine, Correlation, Pattern, EscalationPrediction } from '@/hooks/useCorrelationEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  Network, 
  TrendingUp, 
  AlertTriangle, 
  Loader2, 
  X, 
  Link2,
  Target,
  Zap,
  Globe,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight
} from 'lucide-react';

interface CorrelationEngineProps {
  onClose: () => void;
  focusItemId?: string;
}

const CONNECTION_TYPE_CONFIG = {
  actor_linked: { label: 'Actor Linked', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  causal: { label: 'Causal', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  geographic: { label: 'Geographic', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  temporal: { label: 'Temporal', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  thematic: { label: 'Thematic', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const PATTERN_TYPE_CONFIG = {
  escalation_sequence: { label: 'Escalation Sequence', icon: TrendingUp, color: 'text-red-400' },
  coordinated_campaign: { label: 'Coordinated Campaign', icon: Network, color: 'text-purple-400' },
  spillover_risk: { label: 'Spillover Risk', icon: Globe, color: 'text-orange-400' },
  actor_signature: { label: 'Actor Signature', icon: Target, color: 'text-blue-400' },
};

const TRAJECTORY_CONFIG = {
  escalating: { icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-500/20' },
  stable: { icon: ArrowRight, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'de-escalating': { icon: ArrowDownRight, color: 'text-green-400', bg: 'bg-green-500/20' },
};

export function CorrelationEngine({ onClose, focusItemId }: CorrelationEngineProps) {
  const { analyzeCorrelations, isAnalyzing, result, clearResults } = useCorrelationEngine();
  const [timeWindow, setTimeWindow] = useState<string>('7');

  const handleAnalyze = () => {
    analyzeCorrelations(focusItemId, parseInt(timeWindow));
  };

  const CorrelationCard = ({ correlation }: { correlation: Correlation }) => {
    const config = CONNECTION_TYPE_CONFIG[correlation.connection_type] || CONNECTION_TYPE_CONFIG.thematic;
    
    return (
      <Card className="bg-secondary/30 border-border/50">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={config.color}>
              <Link2 className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {Math.round(correlation.confidence * 100)}% confidence
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground">{correlation.explanation}</p>
          
          <div className="space-y-1">
            {correlation.items.map((item, idx) => (
              <div key={idx} className="text-xs bg-background/50 rounded px-2 py-1 flex items-center gap-2">
                <span className="text-primary font-mono">{item.token}</span>
                <span className="truncate text-muted-foreground">{item.title}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const PatternCard = ({ pattern }: { pattern: Pattern }) => {
    const config = PATTERN_TYPE_CONFIG[pattern.pattern_type] || PATTERN_TYPE_CONFIG.actor_signature;
    const Icon = config.icon;
    
    return (
      <Card className="bg-secondary/30 border-border/50">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${config.color}`} />
              <span className="text-sm font-medium">{config.label}</span>
            </div>
            <Badge 
              variant="outline" 
              className={
                pattern.significance === 'high' ? 'border-red-500/50 text-red-400' :
                pattern.significance === 'medium' ? 'border-yellow-500/50 text-yellow-400' :
                'border-green-500/50 text-green-400'
              }
            >
              {pattern.significance}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground">{pattern.description}</p>
          
          <div className="flex flex-wrap gap-1">
            {pattern.involved_tokens.map((token, idx) => (
              <Badge key={idx} variant="secondary" className="text-[10px] font-mono">
                {token}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const PredictionCard = ({ prediction }: { prediction: EscalationPrediction }) => {
    const isEscalating = prediction.predicted_level !== prediction.current_level;
    
    return (
      <Card className={`border-border/50 ${isEscalating ? 'bg-red-500/10' : 'bg-secondary/30'}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-primary">{prediction.token}</span>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px]">
                {prediction.current_level}
              </Badge>
              {isEscalating && (
                <>
                  <ArrowUpRight className="w-3 h-3 text-red-400" />
                  <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">
                    {prediction.predicted_level}
                  </Badge>
                </>
              )}
            </div>
          </div>
          
          {prediction.item && (
            <p className="text-xs font-medium truncate">{prediction.item.title}</p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{Math.round(prediction.probability * 100)}% probability</span>
            <span>•</span>
            <span>{prediction.timeframe}</span>
          </div>
          
          <p className="text-xs text-muted-foreground">{prediction.rationale}</p>
          
          {prediction.triggers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prediction.triggers.slice(0, 3).map((trigger, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] border-orange-500/30 text-orange-400">
                  {trigger}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="intel-card h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Threat Correlation Engine</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 pt-2">
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="3">Last 3 days</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            size="sm" 
            onClick={handleAnalyze} 
            disabled={isAnalyzing}
            className="gap-1"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Analyze
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {result ? (
          <Tabs defaultValue="correlations" className="h-full flex flex-col">
            <TabsList className="mx-4 mb-2">
              <TabsTrigger value="correlations" className="text-xs gap-1">
                <Link2 className="w-3 h-3" />
                Correlations ({result.correlations.length})
              </TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs gap-1">
                <Network className="w-3 h-3" />
                Patterns ({result.patterns.length})
              </TabsTrigger>
              <TabsTrigger value="predictions" className="text-xs gap-1">
                <TrendingUp className="w-3 h-3" />
                Predictions ({result.escalationPredictions.length})
              </TabsTrigger>
            </TabsList>
            
            {/* Threat Network Summary */}
            {result.threatNetwork && (
              <div className="mx-4 mb-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Threat Network Overview</span>
                  {result.threatNetwork.overall_trajectory && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${TRAJECTORY_CONFIG[result.threatNetwork.overall_trajectory]?.bg} ${TRAJECTORY_CONFIG[result.threatNetwork.overall_trajectory]?.color}`}
                    >
                      {(() => {
                        const Icon = TRAJECTORY_CONFIG[result.threatNetwork.overall_trajectory]?.icon || ArrowRight;
                        return <Icon className="w-3 h-3 mr-1" />;
                      })()}
                      {result.threatNetwork.overall_trajectory}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="text-foreground/70">Actors:</span>{' '}
                    {result.threatNetwork.primary_actors.slice(0, 3).join(', ')}
                  </div>
                  <div>
                    <span className="text-foreground/70">Regions:</span>{' '}
                    {result.threatNetwork.affected_regions.slice(0, 3).join(', ')}
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 px-4 pb-4">
              <TabsContent value="correlations" className="mt-0 space-y-3">
                {result.correlations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No significant correlations detected
                  </p>
                ) : (
                  result.correlations.map((correlation, idx) => (
                    <CorrelationCard key={idx} correlation={correlation} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="patterns" className="mt-0 space-y-3">
                {result.patterns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No significant patterns detected
                  </p>
                ) : (
                  result.patterns.map((pattern, idx) => (
                    <PatternCard key={idx} pattern={pattern} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="predictions" className="mt-0 space-y-3">
                {result.escalationPredictions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No escalation predictions at this time
                  </p>
                ) : (
                  result.escalationPredictions.map((prediction, idx) => (
                    <PredictionCard key={idx} prediction={prediction} />
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Brain className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {isAnalyzing ? 'Analyzing threat correlations...' : 'Ready to analyze'}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {isAnalyzing 
                ? 'Scanning patterns, actors, and escalation signals'
                : 'Click Analyze to discover connections between intel items'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
