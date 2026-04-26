import { useMemo, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { SEVERITY_COLORS, CATEGORY_BG, CrisisEvent } from '../types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function AnalystQueue() {
  const { events, updateEvent } = useCrisisEvents();
  const { toast } = useToast();

  const pendingEvents = useMemo(() => events.filter(e => e.status === 'new'), [events]);
  const verifiedToday = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events.filter(e => e.status !== 'new' && new Date(e.updated_at) >= today).length;
  }, [events]);

  const [editSeverity, setEditSeverity] = useState<Record<string, string>>({});

  const handleApprove = async (event: CrisisEvent) => {
    const sev = editSeverity[event.id] || event.severity;
    const ok = await updateEvent(event.id, { status: 'verified', severity: sev as any, pipeline_stage: 'verified' });
    toast({ title: ok ? 'Approved' : 'Error', description: ok ? `${event.title} verified` : 'Failed to approve', variant: ok ? 'default' : 'destructive' });
  };

  const handleReject = async (event: CrisisEvent) => {
    const ok = await updateEvent(event.id, { status: 'resolved' });
    toast({ title: ok ? 'Rejected' : 'Error', variant: ok ? 'default' : 'destructive' });
  };

  return (
    <CrisisLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Analyst Queue</h1>
            <p className="text-xs text-white/40 font-mono">Human-in-the-loop verification — Layer 2 Analyst stage</p>
          </div>
        </div>

        {/* Throughput stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending', value: pendingEvents.length, icon: Clock, color: '#ffa502' },
            { label: 'Verified Today', value: verifiedToday, icon: CheckCircle, color: '#2ed573' },
            { label: 'Rejection Rate', value: '12%', icon: BarChart3, color: '#00d4ff' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border p-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-white/40 uppercase">{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <span className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Queue list */}
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2">
            {pendingEvents.length === 0 ? (
              <div className="text-center py-16 text-white/30 font-mono text-sm">Queue is empty — all events are verified</div>
            ) : pendingEvents.map(event => (
              <div key={event.id} className="rounded-lg border p-4" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: SEVERITY_COLORS[event.severity] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${CATEGORY_BG[event.category]}`}>{event.category}</span>
                      <span className="text-[10px] font-mono text-white/30">{event.source_type}</span>
                      <span className="text-[10px] font-mono text-white/30 ml-auto">{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</span>
                    </div>
                    <h3 className="text-sm font-medium text-white/90 mb-1">{event.title}</h3>
                    <p className="text-xs text-white/50 mb-2 line-clamp-2">{event.summary}</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-mono text-white/30">AI Confidence</span>
                          <span className="text-[10px] font-mono text-[#00d4ff]">{event.confidence}%</span>
                        </div>
                        <Progress value={event.confidence} className="h-1" />
                      </div>
                      <Select value={editSeverity[event.id] || event.severity} onValueChange={v => setEditSeverity(p => ({ ...p, [event.id]: v }))}>
                        <SelectTrigger className="w-28 h-7 text-xs bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 h-7 text-xs bg-[#2ed573] text-black hover:bg-[#2ed573]/80" onClick={() => handleApprove(event)}>
                        <CheckCircle className="w-3 h-3" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/10" onClick={() => handleReject(event)}>
                        <XCircle className="w-3 h-3" />Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </CrisisLayout>
  );
}
