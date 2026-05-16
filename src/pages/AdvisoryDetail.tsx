import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, AlertTriangle, MapPin, ShieldCheck, RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface KeyThreat { type: string; description: string; severity: string; }
interface Advisory {
  country: string;
  risk_level: string;
  risk_score: number;
  key_threats: KeyThreat[];
  regions_to_avoid: string[];
  recommendations: string[];
  narrative: string;
  source_count: number;
  generated_at: string;
}

const riskBg: Record<string, string> = {
  critical: 'bg-[hsl(0,70%,40%)]',
  high: 'bg-[hsl(25,70%,40%)]',
  elevated: 'bg-[hsl(45,70%,35%)]',
  low: 'bg-[hsl(210,60%,35%)]',
};

export default function AdvisoryDetail() {
  const { country } = useParams<{ country: string }>();
  const [adv, setAdv] = useState<Advisory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!country) return;
    setLoading(true);
    const { data } = await supabase
      .from('country_advisories')
      .select('*')
      .eq('country', decodeURIComponent(country))
      .maybeSingle();
    setAdv(data ? (data as unknown as Advisory) : null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [country]);

  const regenerate = async () => {
    if (!country) return;
    setRefreshing(true);
    try {
      await supabase.functions.invoke('generate-advisories', { body: { country: decodeURIComponent(country) } });
      toast({ title: 'Regenerating brief...', description: 'Updated advisory will appear shortly.' });
      setTimeout(load, 4000);
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header onToggleSidebar={() => {}} />
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
            <div className="flex items-center justify-between">
              <Link to="/advisories">
                <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" /> All Advisories</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={regenerate} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : !adv ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-3">No advisory has been generated for <span className="text-foreground font-semibold">{decodeURIComponent(country || '')}</span> yet.</p>
                <Button onClick={regenerate} disabled={refreshing}>Generate Now</Button>
              </Card>
            ) : (
              <>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h1 className="text-2xl font-bold">{adv.country}</h1>
                      <p className="text-xs text-muted-foreground mt-1 font-mono uppercase">
                        Generated {formatDistanceToNow(new Date(adv.generated_at))} ago · {adv.source_count} sources
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded text-white text-center ${riskBg[adv.risk_level]}`}>
                      <div className="text-[10px] font-mono uppercase tracking-wider opacity-90">Risk Level</div>
                      <div className="text-lg font-bold leading-tight">{adv.risk_level.toUpperCase()}</div>
                      <div className="text-[11px] font-mono">Score {adv.risk_score}/100</div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/85">{adv.narrative}</p>
                </Card>

                <Card className="p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary" /> Key Threats
                  </h2>
                  {adv.key_threats?.length ? (
                    <div className="space-y-2">
                      {adv.key_threats.map((t, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded bg-secondary/40 border border-border">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase text-white shrink-0 ${riskBg[t.severity] || riskBg.low}`}>{t.severity}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wider text-foreground">{t.type}</div>
                            <div className="text-sm text-foreground/80 mt-0.5">{t.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">None identified.</p>}
                </Card>

                <Card className="p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Regions to Avoid
                  </h2>
                  {adv.regions_to_avoid?.length ? (
                    <ul className="space-y-1.5">
                      {adv.regions_to_avoid.map((r, i) => (
                        <li key={i} className="text-sm text-foreground/85 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{r}</li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-muted-foreground">No specific regions flagged.</p>}
                </Card>

                <Card className="p-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Recommendations
                  </h2>
                  {adv.recommendations?.length ? (
                    <ol className="space-y-2">
                      {adv.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-foreground/85 flex gap-3">
                          <span className="text-primary font-mono shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-xs text-muted-foreground">No specific recommendations.</p>}
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}