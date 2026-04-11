import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PipelineStats {
  ingestion: number;
  classified: number;
  geotagged: number;
  verified: number;
  total: number;
  throughput: number;
}

export function usePipelineStats() {
  const [stats, setStats] = useState<PipelineStats>({ ingestion: 0, classified: 0, geotagged: 0, verified: 0, total: 0, throughput: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data, error } = await supabase
      .from('crisis_events')
      .select('pipeline_stage');
    if (!error && data) {
      const counts = { ingestion: 0, classified: 0, geotagged: 0, verified: 0 };
      data.forEach((d: any) => { if (counts[d.pipeline_stage as keyof typeof counts] !== undefined) counts[d.pipeline_stage as keyof typeof counts]++; });
      setStats({ ...counts, total: data.length, throughput: Math.round(data.length / 24 * 60) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading };
}
