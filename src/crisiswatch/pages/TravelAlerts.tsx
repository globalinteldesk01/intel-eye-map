import { useEffect, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, RefreshCw, Plane, AlertTriangle, Sparkles, Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
type DestAnalysis = {
  country: string;
  city: string | null;
  risk: string;
  summary: string;
  recommendations: string[];
  source_tokens: string[];
};
type AIAnalysis = {
  overall_risk: string;
  overall_summary: string;
  destinations: DestAnalysis[];
  global_recommendations: string[];
};

type Alert = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  itinerary_id: string | null;
};

const SEV_COLOR: Record<string, string> = {
  critical: '#ff3860',
  high: '#ff9f43',
  elevated: '#ffd43b',
  info: '#00d4ff',
};

export default function TravelAlerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisAt, setAnalysisAt] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [ollamaToken, setOllamaToken] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('travel_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setAlerts((data ?? []) as Alert[]);
  };

  const loadConfig = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('crisis_user_settings')
      .select('ollama_url, ollama_model, ollama_token, last_travel_analysis, last_travel_analysis_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setOllamaUrl((data as any).ollama_url ?? '');
      setOllamaModel((data as any).ollama_model ?? 'llama3.2');
      setOllamaToken((data as any).ollama_token ?? '');
      setAnalysis(((data as any).last_travel_analysis ?? null) as AIAnalysis | null);
      setAnalysisAt(((data as any).last_travel_analysis_at ?? null) as string | null);
    }
  };

  useEffect(() => {
    load();
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side scan: match itinerary destinations against recent intel.
  // Lightweight; runs against current user's data only (RLS-safe).
  const scan = async () => {
    if (!user) return;
    setScanning(true);
    try {
      const { data: trips } = await supabase
        .from('travel_itineraries')
        .select('id,name,start_date,end_date');
      const { data: dests } = await supabase
        .from('itinerary_destinations')
        .select('*');

      const tripsById = new Map((trips ?? []).map((t: any) => [t.id, t]));
      let inserted = 0;

      for (const d of dests ?? []) {
        const trip = tripsById.get(d.itinerary_id);
        if (!trip) continue;

        const { data: intel } = await supabase
          .from('news_items')
          .select('id,title,summary,token,country,threat_level,published_at')
          .ilike('country', d.country)
          .gte('published_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
          .in('threat_level', ['elevated', 'high', 'critical'])
          .order('published_at', { ascending: false })
          .limit(20);

        const today = new Date();
        const arrival = new Date(d.arrival_date);
        const isInTravel = today >= new Date(trip.start_date) && today <= new Date(trip.end_date);
        const alertType = isInTravel ? 'in-travel' : 'pre-travel';

        for (const item of intel ?? []) {
          // Skip if alert already exists for this user/news pair
          const { data: exists } = await supabase
            .from('travel_alerts')
            .select('id')
            .eq('user_id', user.id)
            .eq('news_item_id', item.id)
            .eq('itinerary_id', trip.id)
            .maybeSingle();
          if (exists) continue;

          const { error } = await supabase.from('travel_alerts').insert({
            user_id: user.id,
            itinerary_id: trip.id,
            destination_id: d.id,
            news_item_id: item.id,
            alert_type: alertType,
            severity: item.threat_level,
            title: `${d.country}: ${item.title}`,
            message: `[${item.token}] ${item.summary?.slice(0, 220) ?? ''}`,
          });
          if (!error) inserted++;
        }
      }
      toast({ title: 'Scan complete', description: `${inserted} new alert${inserted === 1 ? '' : 's'} matched.` });
      load();
    } finally {
      setScanning(false);
    }
  };

  const saveConfig = async () => {
    if (!user) return;
    setSavingCfg(true);
    try {
      const { error } = await supabase
        .from('crisis_user_settings')
        .upsert(
          {
            user_id: user.id,
            ollama_url: ollamaUrl.trim(),
            ollama_model: ollamaModel.trim() || 'llama3.2',
            ollama_token: ollamaToken.trim(),
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      toast({ title: 'Ollama configured', description: 'Settings saved.' });
      setCfgOpen(false);
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setSavingCfg(false);
    }
  };

  const runAIAnalysis = async () => {
    if (!user) return;
    if (!ollamaUrl.trim()) {
      toast({
        title: 'Configure Ollama first',
        description: 'Add your Ollama server URL in settings.',
        variant: 'destructive',
      });
      setCfgOpen(true);
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-travel-ollama', {
        body: {},
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis((data as any).analysis as AIAnalysis);
      setAnalysisAt(new Date().toISOString());
      toast({ title: 'Analysis ready', description: 'Travel risk analysis updated.' });
    } catch (e: any) {
      toast({
        title: 'Analysis failed',
        description: e?.message ?? 'Could not reach Ollama.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const markRead = async (id: string) => {
    await supabase.from('travel_alerts').update({ is_read: true }).eq('id', id);
    load();
  };

  const pre = alerts.filter((a) => a.alert_type === 'pre-travel');
  const inT = alerts.filter((a) => a.alert_type === 'in-travel');

  return (
    <CrisisLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-5 h-5 text-[#00d4ff]" />
              <h1 className="text-xl font-bold text-white">Travel Alerts</h1>
            </div>
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest">
              Pre-travel and in-travel intel matched to your itineraries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-white/70 hover:text-white font-mono text-xs gap-2 border border-white/10">
                  <SettingsIcon className="w-3.5 h-3.5" />
                  Ollama
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#111318] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Ollama AI Settings</DialogTitle>
                  <DialogDescription className="text-white/50 text-xs">
                    Point this app at your Ollama server. The URL must be reachable from the cloud (e.g. ngrok / Cloudflare Tunnel for local Ollama).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-white/60">Server URL</Label>
                    <Input
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="https://your-ollama.example.com"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-white/60">Model</Label>
                    <Input
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3.2"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-white/60">Bearer Token (optional)</Label>
                    <Input
                      type="password"
                      value={ollamaToken}
                      onChange={(e) => setOllamaToken(e.target.value)}
                      placeholder="If your endpoint is auth-protected"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <a
                    href="https://github.com/ollama/ollama/blob/main/docs/api.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[#00d4ff] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Ollama API docs
                  </a>
                </div>
                <DialogFooter>
                  <Button onClick={saveConfig} disabled={savingCfg} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-xs">
                    {savingCfg ? 'Saving…' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              onClick={runAIAnalysis}
              disabled={analyzing}
              variant="ghost"
              className="text-white/80 hover:text-white font-mono text-xs gap-2 border border-[#00d4ff]/40 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20"
            >
              <Sparkles className={cn('w-3.5 h-3.5 text-[#00d4ff]', analyzing && 'animate-pulse')} />
              {analyzing ? 'Analyzing…' : 'Analyze with Ollama'}
            </Button>
            <Button size="sm" onClick={scan} disabled={scanning} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-xs gap-2">
              <RefreshCw className={cn('w-3.5 h-3.5', scanning && 'animate-spin')} />
              {scanning ? 'Scanning…' : 'Scan Itineraries'}
            </Button>
          </div>
        </div>

        {analysis && (
          <AIAnalysisPanel analysis={analysis} generatedAt={analysisAt} />
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Column title="Pre-Travel" icon={<Plane className="w-4 h-4" />} alerts={pre} onRead={markRead} />
          <Column title="In-Travel" icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} alerts={inT} onRead={markRead} />
        </div>
      </div>
    </CrisisLayout>
  );
}

function AIAnalysisPanel({ analysis, generatedAt }: { analysis: AIAnalysis; generatedAt: string | null }) {
  const riskColor = SEV_COLOR[analysis.overall_risk] ?? '#00d4ff';
  return (
    <div className="rounded-lg border mb-6" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Sparkles className="w-4 h-4 text-[#00d4ff]" />
        <span className="text-sm font-semibold text-white">Travel Risk Analysis</span>
        <span
          className="text-[10px] font-mono uppercase px-2 py-0.5 rounded"
          style={{ background: `${riskColor}22`, color: riskColor }}
        >
          {analysis.overall_risk} risk
        </span>
        {generatedAt && (
          <span className="ml-auto text-[10px] text-white/40 font-mono">
            {new Date(generatedAt).toLocaleString()}
          </span>
        )}
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-white/80 leading-relaxed">{analysis.overall_summary}</p>

        {analysis.destinations?.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3">
            {analysis.destinations.map((d, idx) => {
              const c = SEV_COLOR[d.risk] ?? '#00d4ff';
              return (
                <div
                  key={idx}
                  className="rounded border p-3"
                  style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">
                      {d.country}{d.city ? ` · ${d.city}` : ''}
                    </span>
                    <span
                      className="ml-auto text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                      style={{ background: `${c}22`, color: c }}
                    >
                      {d.risk}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed mb-2">{d.summary}</p>
                  {d.recommendations?.length > 0 && (
                    <ul className="text-xs text-white/60 list-disc pl-4 space-y-0.5 mb-2">
                      {d.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  {d.source_tokens?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                      {d.source_tokens.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {analysis.global_recommendations?.length > 0 && (
          <div>
            <div className="text-[10px] font-mono uppercase text-white/40 mb-1">Global recommendations</div>
            <ul className="text-xs text-white/70 list-disc pl-4 space-y-0.5">
              {analysis.global_recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  icon,
  alerts,
  onRead,
}: {
  title: string;
  icon: React.ReactNode;
  alerts: Alert[];
  onRead: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {icon}
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-[10px] font-mono text-white/40 ml-auto">{alerts.length}</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {alerts.length === 0 && (
          <div className="p-6 text-center text-white/40 text-xs">No alerts.</div>
        )}
        {alerts.map((a) => (
          <button
            key={a.id}
            onClick={() => onRead(a.id)}
            className={cn(
              'block w-full text-left p-4 hover:bg-white/[0.02] transition-colors border-l-2',
              !a.is_read ? '' : 'opacity-60'
            )}
            style={{ borderLeftColor: SEV_COLOR[a.severity] ?? '#00d4ff' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: `${SEV_COLOR[a.severity] ?? '#00d4ff'}22`, color: SEV_COLOR[a.severity] ?? '#00d4ff' }}>
                {a.severity}
              </span>
              <span className="text-[10px] text-white/40 font-mono">{new Date(a.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm text-white font-medium leading-snug">{a.title}</div>
            <div className="text-xs text-white/50 mt-1 line-clamp-2">{a.message}</div>
          </button>
        ))}
      </div>
    </div>
  );
}