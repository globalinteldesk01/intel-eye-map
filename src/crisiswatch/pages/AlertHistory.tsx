import { useState, useEffect } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CrisisAlertHistory, SEVERITY_COLORS } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function AlertHistory() {
  const [alerts, setAlerts] = useState<CrisisAlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('crisis_alert_history')
        .select('*, crisis_events(*)')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100);
      setAlerts((data as unknown as CrisisAlertHistory[]) || []);
      setLoading(false);
    };
    fetchAlerts();
  }, [user]);

  const filtered = filterSeverity === 'all' ? alerts : alerts.filter(a => a.crisis_events?.severity === filterSeverity);

  return (
    <CrisisLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Alert History</h1>
            <p className="text-xs text-white/40 font-mono">Track all sent alerts and notification delivery status</p>
          </div>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] hover:bg-transparent">
                <TableHead className="text-white/40 font-mono text-xs">Event</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Severity</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Channels</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Status</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Sent</TableHead>
                <TableHead className="text-white/40 font-mono text-xs w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8 font-mono">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8 font-mono">No alert history yet</TableCell></TableRow>
              ) : filtered.map(alert => (
                <TableRow key={alert.id} className="border-white/[0.07]" style={{ background: '#181c22' }}>
                  <TableCell className="text-white/80 text-sm max-w-[200px] truncate">{alert.crisis_events?.title || '—'}</TableCell>
                  <TableCell>
                    {alert.crisis_events && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded" style={{ background: SEVERITY_COLORS[alert.crisis_events.severity] + '22', color: SEVERITY_COLORS[alert.crisis_events.severity] }}>
                        {alert.crisis_events.severity}
                      </span>
                    )}
                  </TableCell>
                  <TableCell><div className="flex gap-1">{alert.channels.map(c => <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/50">{c}</span>)}</div></TableCell>
                  <TableCell><span className={`text-[10px] font-mono ${alert.status === 'sent' ? 'text-[#2ed573]' : 'text-[#ffa502]'}`}>{alert.status}</span></TableCell>
                  <TableCell className="text-xs text-white/40 font-mono">{format(new Date(alert.sent_at), 'MMM d, HH:mm')}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" className="h-6 text-[10px] text-white/30 hover:text-[#00d4ff]"><RefreshCw className="w-3 h-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </CrisisLayout>
  );
}
