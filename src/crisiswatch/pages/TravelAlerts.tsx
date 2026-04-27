import { useEffect, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, RefreshCw, Plane, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

  const load = async () => {
    const { data } = await supabase
      .from('travel_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setAlerts((data ?? []) as Alert[]);
  };

  useEffect(() => {
    load();
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
          <Button size="sm" onClick={scan} disabled={scanning} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-xs gap-2">
            <RefreshCw className={cn('w-3.5 h-3.5', scanning && 'animate-spin')} />
            {scanning ? 'Scanning…' : 'Scan Itineraries'}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Column title="Pre-Travel" icon={<Plane className="w-4 h-4" />} alerts={pre} onRead={markRead} />
          <Column title="In-Travel" icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} alerts={inT} onRead={markRead} />
        </div>
      </div>
    </CrisisLayout>
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