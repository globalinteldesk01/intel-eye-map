import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CorrelatedItem {
  id: string;
  token: string;
  title: string;
  country: string;
  region: string;
  category: string;
  threat_level: string;
}

export interface Correlation {
  tokens: string[];
  connection_type: 'actor_linked' | 'causal' | 'geographic' | 'temporal' | 'thematic';
  confidence: number;
  explanation: string;
  items: CorrelatedItem[];
}

export interface Pattern {
  pattern_type: 'escalation_sequence' | 'coordinated_campaign' | 'spillover_risk' | 'actor_signature';
  involved_tokens: string[];
  description: string;
  significance: 'high' | 'medium' | 'low';
}

export interface EscalationPrediction {
  token: string;
  current_level: string;
  predicted_level: string;
  probability: number;
  timeframe: string;
  triggers: string[];
  rationale: string;
  item: CorrelatedItem | null;
}

export interface ThreatNetwork {
  primary_actors: string[];
  affected_regions: string[];
  dominant_category: string;
  overall_trajectory: 'escalating' | 'stable' | 'de-escalating';
}

export interface CorrelationResult {
  correlations: Correlation[];
  patterns: Pattern[];
  escalationPredictions: EscalationPrediction[];
  threatNetwork: ThreatNetwork | null;
  analyzedCount: number;
  timeWindow: string;
}

export function useCorrelationEngine() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CorrelationResult | null>(null);
  const { toast } = useToast();

  const analyzeCorrelations = useCallback(async (focusItemId?: string, timeWindowDays: number = 7) => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correlate-threats`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ focusItemId, timeWindowDays }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Correlation analysis failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setResult({
          correlations: data.correlations || [],
          patterns: data.patterns || [],
          escalationPredictions: data.escalationPredictions || [],
          threatNetwork: data.threatNetwork || null,
          analyzedCount: data.analyzedCount || 0,
          timeWindow: data.timeWindow || '7 days',
        });

        toast({
          title: 'Correlation Analysis Complete',
          description: `Analyzed ${data.analyzedCount} items, found ${data.correlations?.length || 0} correlations`,
        });
      } else {
        throw new Error(data.message || 'Analysis returned no results');
      }
    } catch (error) {
      console.error('Correlation engine error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Could not complete correlation analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  const clearResults = useCallback(() => {
    setResult(null);
  }, []);

  return {
    analyzeCorrelations,
    isAnalyzing,
    result,
    clearResults,
  };
}
