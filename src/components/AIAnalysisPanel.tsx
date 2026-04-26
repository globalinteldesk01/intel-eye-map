import { useState } from 'react';
import { NewsItem } from '@/types/news';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Zap, TrendingUp, Link2, Loader2, X } from 'lucide-react';

interface AIAnalysisPanelProps {
  newsItem: NewsItem;
  onClose: () => void;
}

const analysisOptions = [
  { type: 'summary' as const, label: 'Quick Summary', icon: Zap, description: 'Get a brief intel summary' },
  { type: 'threat-assessment' as const, label: 'Threat Assessment', icon: Brain, description: 'Analyze threat level & impact' },
  { type: 'trend-prediction' as const, label: 'Predict Trends', icon: TrendingUp, description: 'Forecast likely developments' },
  { type: 'related-events' as const, label: 'Related Events', icon: Link2, description: 'Find connected patterns' },
];

export function AIAnalysisPanel({ newsItem, onClose }: AIAnalysisPanelProps) {
  const { analyzeItem, isAnalyzing, analysis, clearAnalysis } = useAIAnalysis();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleAnalyze = (type: 'summary' | 'threat-assessment' | 'trend-prediction' | 'related-events') => {
    setSelectedType(type);
    clearAnalysis();
    analyzeItem(newsItem, type);
  };

  return (
    <Card className="intel-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">AI Analysis</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {analysisOptions.map(({ type, label, icon: Icon, description }) => (
          <Button
            key={type}
            variant={selectedType === type ? 'default' : 'outline'}
            size="sm"
            className="h-auto py-2 px-3 flex-col items-start gap-1"
            onClick={() => handleAnalyze(type)}
            disabled={isAnalyzing}
          >
            <div className="flex items-center gap-2 w-full">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <span className="text-[10px] text-muted-foreground text-left">{description}</span>
          </Button>
        ))}
      </div>

      {(isAnalyzing || analysis) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isAnalyzing && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            <Badge variant="outline" className="text-[10px]">
              {selectedType?.replace('-', ' ')}
            </Badge>
          </div>
          <ScrollArea className="h-48 rounded-md border border-border p-3 bg-secondary/30">
            <div className="text-xs leading-relaxed whitespace-pre-wrap">
              {analysis || 'Analyzing...'}
              {isAnalyzing && <span className="animate-pulse">▊</span>}
            </div>
          </ScrollArea>
        </div>
      )}
    </Card>
  );
}
