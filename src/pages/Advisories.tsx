import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Shield, RefreshCw, Search, ArrowRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Advisory {
  country: string;
  risk_level: 'low' | 'elevated' | 'high' | 'critical';
  risk_score: number;
  narrative: string;
  generated_at: string;
  source_count: number;
}

const riskBg: Record<string, string> = {
  critical: 'bg-[hsl(0,70%,40%)]',
  high: 'bg-[hsl(25,70%,40%)]',
  elevated: 'bg-[hsl(45,70%,35%)]',
  low: 'bg-[hsl(210,60%,35%)]',
};

export default function Advisories() {
  const [list, setList] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('country_advisories')
      .select('country,risk_level,risk_score,narrative,generated_at,source_count')
      .order('risk_score', { ascending: false });
    setList((data as Advisory[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const regenerate = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke('generate-advisories', { body: {} });
      toast({ title: 'Advisories refreshing', description: 'New briefs will appear within a minute.' });
      setTimeout(load, 4000);
    } catch (e) {
      toast({ title: 'Refresh failed', description: String(e), variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = list.filter(a => a.country.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header onToggleSidebar={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Travel Advisories
            </h1>
            <p className="text-xs text-muted-foreground mt-1">AI-generated country briefs from the last 30 days of intel.</p>
          </div>
          <Button size="sm" variant="outline" onClick={regenerate} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country..." className="pl-9 h-9 bg-secondary/60" />
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading advisories...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No advisories yet. Click <span className="font-semibold">Regenerate</span> to build them from current intel.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
              {filtered.map(a => (
                <Link key={a.country} to={`/advisories/${encodeURIComponent(a.country)}`}>
                  <Card className="p-4 hover:bg-secondary/40 transition-all cursor-pointer h-full">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-base">{a.country}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider text-white ${riskBg[a.risk_level]}`}>
                        {a.risk_level} · {a.risk_score}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/75 leading-relaxed line-clamp-4">{a.narrative}</p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase">
                      <span>{a.source_count} sources · {formatDistanceToNow(new Date(a.generated_at))} ago</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}