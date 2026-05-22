import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Radio, FileText, Loader2, Activity, AlertTriangle, ExternalLink, Power } from 'lucide-react';
import { formatLocalForViewer } from '@/utils/countryTimezone';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itineraryMapId: string | null;
  itineraryName: string;
  countries: string[];
};

type Monitor = {
  id: string;
  status: string;
  countries: string[];
  severity_threshold: string;
  started_at: string;
};

type TravelAlert = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  news_item_id: string | null;
  created_at: string;
};

const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  elevated: '#eab308',
  low: '#16a34a',
  info: '#94a3b8',
};

export function TravelSecurityPanel({ open, onOpenChange, itineraryMapId, itineraryName, countries }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('phase1');
  const [busy, setBusy] = useState<null | string>(null);

  const [destination, setDestination] = useState<any>(null);
  const [protocols, setProtocols] = useState<any>(null);
  const [debrief, setDebrief] = useState<any>(null);
  const [debriefNotes, setDebriefNotes] = useState('');

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [threshold, setThreshold] = useState('elevated');
  const [alerts, setAlerts] = useState<TravelAlert[]>([]);

  // Load existing assessments + monitor when dialog opens
  const loadState = useCallback(async () => {
    if (!itineraryMapId || !user) return;
    const [{ data: assessments }, { data: monitors }] = await Promise.all([
      supabase
        .from('trip_assessments')
        .select('*')
        .eq('itinerary_map_id', itineraryMapId)
        .order('created_at', { ascending: false }),
      supabase
        .from('travel_monitors')
        .select('*')
        .eq('itinerary_map_id', itineraryMapId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);
    setDestination(assessments?.find((a: any) => a.phase === 'destination')?.content ?? null);
    setProtocols(assessments?.find((a: any) => a.phase === 'protocols')?.content ?? null);
    setDebrief(assessments?.find((a: any) => a.phase === 'debrief')?.content ?? null);
    const m = (monitors?.[0] as Monitor | undefined) ?? null;
    setMonitor(m);
    if (m) setThreshold(m.severity_threshold);
    if (m) await loadAlerts();
  }, [itineraryMapId, user]);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('travel_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAlerts((data ?? []) as TravelAlert[]);
  }, [user]);

  useEffect(() => {
    if (open) loadState();
  }, [open, loadState]);

  // Realtime push for new travel_alerts
  useEffect(() => {
    if (!open || !user) return;
    const ch = supabase
      .channel(`travel-alerts-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'travel_alerts', filter: `user_id=eq.${user.id}` }, (payload) => {
        setAlerts((prev) => [payload.new as TravelAlert, ...prev].slice(0, 50));
        toast({ title: (payload.new as any).title, description: 'New travel alert', variant: 'default' });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, user, toast]);

  const runAssessment = async (phase: 'destination' | 'protocols' | 'debrief') => {
    if (!itineraryMapId) {
      toast({ title: 'Save the itinerary first', variant: 'destructive' });
      return;
    }
    setBusy(phase);
    try {
      const { data, error } = await supabase.functions.invoke('travel-trip-assessment', {
        body: { itinerary_map_id: itineraryMapId, phase, debrief_notes: phase === 'debrief' ? debriefNotes : undefined },
      });
      if (error) throw error;
      const r = data?.results?.[phase];
      if (phase === 'destination') setDestination(r);
      if (phase === 'protocols') setProtocols(r);
      if (phase === 'debrief') setDebrief(r);
      toast({ title: `${phase} assessment generated` });
    } catch (e: any) {
      toast({ title: 'Assessment failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const activateMonitor = async () => {
    if (!user || !itineraryMapId) {
      toast({ title: 'Save the itinerary first', variant: 'destructive' });
      return;
    }
    if (countries.length === 0) {
      toast({ title: 'Pin at least one stop with auto-risk to extract a country', variant: 'destructive' });
      return;
    }
    setBusy('activate');
    const { data, error } = await supabase
      .from('travel_monitors')
      .insert({
        user_id: user.id,
        itinerary_map_id: itineraryMapId,
        name: itineraryName || 'Active Monitor',
        countries,
        severity_threshold: threshold,
        status: 'active',
      })
      .select()
      .single();
    setBusy(null);
    if (error) return toast({ title: 'Failed to activate', description: error.message, variant: 'destructive' });
    setMonitor(data as Monitor);
    toast({ title: 'Live monitoring active', description: `${countries.join(', ')} · ≥${threshold}` });
    await loadAlerts();
  };

  const stopMonitor = async () => {
    if (!monitor) return;
    setBusy('stop');
    await supabase
      .from('travel_monitors')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', monitor.id);
    setMonitor({ ...monitor, status: 'ended' });
    setBusy(null);
    toast({ title: 'Monitoring stopped' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f1115] border-white/10 text-white max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-[#00d4ff]" />
            Travel Security Operations · {itineraryName}
          </DialogTitle>
          <p className="text-[10px] text-white/40 font-mono">
            Four-phase protocol · Destination · Real-Time Alerts · Emergency Protocols · Post-Travel Debrief
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-black/40 border border-white/10 grid grid-cols-4 h-9">
            <TabsTrigger value="phase1" className="text-[11px] data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">
              <FileText className="w-3 h-3 mr-1" />1. Assessment
            </TabsTrigger>
            <TabsTrigger value="phase2" className="text-[11px] data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">
              <Radio className="w-3 h-3 mr-1" />2. Live Alerts
            </TabsTrigger>
            <TabsTrigger value="phase3" className="text-[11px] data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">
              <AlertTriangle className="w-3 h-3 mr-1" />3. Emergency
            </TabsTrigger>
            <TabsTrigger value="phase4" className="text-[11px] data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">
              <Activity className="w-3 h-3 mr-1" />4. Debrief
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3 pr-1">
            {/* PHASE 1 */}
            <TabsContent value="phase1" className="m-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/50 font-mono uppercase">Pre-Trip Destination & Route Assessment</div>
                <Button size="sm" disabled={busy === 'destination'} onClick={() => runAssessment('destination')} className="h-7 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 text-[11px] font-mono">
                  {busy === 'destination' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}Generate
                </Button>
              </div>
              {destination ? <DestinationView data={destination} /> : <Empty>No assessment yet. Generate one from the current itinerary stops.</Empty>}
            </TabsContent>

            {/* PHASE 2 */}
            <TabsContent value="phase2" className="m-0 space-y-3">
              <div className="rounded border border-white/10 p-3 bg-black/30">
                <div className="text-[11px] text-white/50 font-mono uppercase mb-2">Real-Time Threat Monitor</div>
                {monitor && monitor.status === 'active' ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-white">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ACTIVE · countries: <span className="font-mono">{monitor.countries.join(', ')}</span> · threshold ≥ <span className="font-mono uppercase">{monitor.severity_threshold}</span>
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">Started {formatLocalForViewer(monitor.started_at)}</div>
                    </div>
                    <Button size="sm" onClick={stopMonitor} disabled={busy === 'stop'} variant="outline" className="h-7 border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] font-mono">
                      <Power className="w-3 h-3 mr-1" />Stop
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="text-[11px] text-white/60">
                      Countries on this itinerary: <span className="font-mono text-white">{countries.length ? countries.join(', ') : '(none — pin stops with auto-risk first)'}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Select value={threshold} onValueChange={setThreshold}>
                        <SelectTrigger className="h-8 w-32 bg-black/40 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low ≥</SelectItem>
                          <SelectItem value="elevated">Elevated ≥</SelectItem>
                          <SelectItem value="high">High ≥</SelectItem>
                          <SelectItem value="critical">Critical ≥</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={busy === 'activate'} onClick={activateMonitor} className="h-8 bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-mono">
                        {busy === 'activate' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Power className="w-3 h-3 mr-1" />}Activate Monitoring
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-white/50 font-mono uppercase">Inbound Alerts ({alerts.length})</div>
              {alerts.length === 0 ? (
                <Empty>No alerts yet. New intel matching your route will arrive here in real time.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {alerts.map((a) => (
                    <li key={a.id} className="rounded border border-white/10 bg-black/30 p-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-mono uppercase font-bold mt-0.5" style={{ color: SEV_COLOR[a.severity] ?? '#94a3b8' }}>
                          [{a.severity}]
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-white">{a.title}</div>
                          <div className="text-[10px] text-white/50 mt-0.5">{a.message}</div>
                          <div className="text-[10px] text-white/30 font-mono mt-1">{formatLocalForViewer(a.created_at)}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* PHASE 3 */}
            <TabsContent value="phase3" className="m-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/50 font-mono uppercase">Emergency Response Protocols</div>
                <Button size="sm" disabled={busy === 'protocols'} onClick={() => runAssessment('protocols')} className="h-7 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 text-[11px] font-mono">
                  {busy === 'protocols' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}Generate
                </Button>
              </div>
              {protocols ? <ProtocolsView data={protocols} /> : <Empty>No protocols generated yet.</Empty>}
            </TabsContent>

            {/* PHASE 4 */}
            <TabsContent value="phase4" className="m-0 space-y-3">
              <div className="text-[11px] text-white/50 font-mono uppercase">Post-Travel Debrief</div>
              <Textarea
                value={debriefNotes}
                onChange={(e) => setDebriefNotes(e.target.value)}
                placeholder="Traveler notes: what happened, near-misses, deviations from plan, observations…"
                className="bg-black/40 border-white/10 text-white text-xs min-h-[100px]"
              />
              <Button size="sm" disabled={busy === 'debrief'} onClick={() => runAssessment('debrief')} className="h-7 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 text-[11px] font-mono">
                {busy === 'debrief' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}Generate Structured Debrief
              </Button>
              {debrief && <DebriefView data={debrief} />}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-dashed border-white/10 bg-black/20 p-4 text-center text-[11px] text-white/40 font-mono">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#00d4ff] font-mono mb-2">{title}</div>
      {children}
    </div>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return <div className="text-[11px] text-white/30 font-mono">—</div>;
  return (
    <ul className="space-y-1 text-xs text-white/80">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2"><span className="text-[#00d4ff]">›</span><span>{s}</span></li>
      ))}
    </ul>
  );
}

function DestinationView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <Section title={`Executive Summary · Overall: ${data.overall_risk_band ?? 'N/A'}`}>
        <p className="text-xs text-white/80 leading-relaxed">{data.executive_summary ?? '—'}</p>
      </Section>
      <Section title="Stops">
        <div className="space-y-2">
          {(data.stops ?? []).map((s: any, i: number) => (
            <div key={i} className="rounded border border-white/5 bg-black/20 p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-white font-medium">{s.name} <span className="text-white/40 font-mono">· {s.country}</span></div>
                <span className="text-[10px] font-mono uppercase font-bold" style={{ color: SEV_COLOR[(s.risk_band ?? '').toLowerCase()] ?? '#94a3b8' }}>
                  {s.risk_band}
                </span>
              </div>
              {s.key_threats?.length ? <div className="mt-1.5"><div className="text-[9px] uppercase text-white/40 mb-0.5">Key threats</div><Bullets items={s.key_threats} /></div> : null}
              {s.recommended_posture && <div className="mt-1.5 text-[11px] text-white/70"><b className="text-white/50">Posture:</b> {s.recommended_posture}</div>}
              {s.movement_advice && <div className="mt-1 text-[11px] text-white/70"><b className="text-white/50">Movement:</b> {s.movement_advice}</div>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Route Corridor Risks"><Bullets items={data.route_corridor_risks} /></Section>
      <Section title="Pre-Departure Checklist"><Bullets items={data.pre_departure_checklist} /></Section>
    </div>
  );
}

function ProtocolsView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <Section title="Trigger Matrix">
        <div className="space-y-1.5">
          {(data.trigger_matrix ?? []).map((t: any, i: number) => (
            <div key={i} className="rounded border border-white/5 bg-black/20 p-2">
              <div className="text-xs text-white"><b>{t.trigger}</b> <span className="text-[10px] uppercase font-mono ml-1" style={{ color: SEV_COLOR[(t.severity ?? '').toLowerCase()] ?? '#94a3b8' }}>[{t.severity}]</span></div>
              <Bullets items={t.immediate_actions} />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Evacuation">
        <div className="text-xs text-white/80 space-y-1">
          <div><b className="text-white/50">Primary:</b> {data.evacuation?.primary_route ?? '—'}</div>
          <div><b className="text-white/50">Secondary:</b> {data.evacuation?.secondary_route ?? '—'}</div>
          <div><b className="text-white/50">Muster Points:</b></div>
          <Bullets items={data.evacuation?.muster_points} />
        </div>
      </Section>
      <Section title="Medical">
        <div className="text-xs text-white/80 space-y-1">
          <div><b className="text-white/50">Nearest facilities:</b></div>
          <Bullets items={data.medical?.nearest_facilities} />
          <div className="mt-1"><b className="text-white/50">Kit required:</b></div>
          <Bullets items={data.medical?.kit_required} />
        </div>
      </Section>
      <Section title="Communications">
        <div className="text-xs text-white/80 space-y-1">
          <div><b className="text-white/50">Check-in cadence:</b> {data.communications?.check_in_cadence ?? '—'}</div>
          <div><b className="text-white/50">Comms failure:</b> {data.communications?.comms_failure_protocol ?? '—'}</div>
        </div>
      </Section>
      <Section title="Required Local Contacts"><Bullets items={data.local_contacts_required} /></Section>
    </div>
  );
}

function DebriefView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <Section title="Incident Summary"><p className="text-xs text-white/80">{data.incident_summary ?? '—'}</p></Section>
      <Section title="Near Misses"><Bullets items={data.near_misses} /></Section>
      <Section title="What Worked"><Bullets items={data.what_worked} /></Section>
      <Section title="What Failed"><Bullets items={data.what_failed} /></Section>
      <Section title="Lessons Learned"><Bullets items={data.lessons_learned} /></Section>
      <Section title="Posture Updates"><Bullets items={data.posture_updates} /></Section>
    </div>
  );
}