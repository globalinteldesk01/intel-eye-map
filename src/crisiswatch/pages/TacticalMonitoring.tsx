import { useMemo, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import {
  useTacticalIncidents, useTacticalSensorAlerts,
  type Severity, type IncidentType, type IncidentStatus, type SensorKind,
} from '../hooks/useTacticalData';
import {
  ShieldAlert, Radio, AlertTriangle, MapPin, Camera, DoorOpen, Activity,
  Siren, IdCard, Car, Flame, CheckCircle2, X, Plus, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const SEV_COLOR: Record<Severity, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
};
const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const INCIDENT_TYPES: IncidentType[] = [
  'suspicious_activity','intrusion','trespass','theft','vandalism','assault',
  'medical','fire','evacuation','protest','vehicle','cyber','other',
];
const STATUSES: IncidentStatus[] = ['open','investigating','contained','resolved','false_alarm'];
const SENSOR_KINDS: SensorKind[] = ['camera','motion','perimeter','badge','panic','environmental','vehicle','door','other'];

const SENSOR_ICON: Record<SensorKind, typeof Camera> = {
  camera: Camera, motion: Activity, perimeter: ShieldAlert, badge: IdCard,
  panic: Siren, environmental: Flame, vehicle: Car, door: DoorOpen, other: Radio,
};

function fmtTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function SeverityPill({ s }: { s: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold"
      style={{ background: `${SEV_COLOR[s]}22`, color: SEV_COLOR[s], border: `1px solid ${SEV_COLOR[s]}55` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEV_COLOR[s], boxShadow: `0 0 6px ${SEV_COLOR[s]}` }} />
      {s}
    </span>
  );
}

function IncidentForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { create } = useTacticalIncidents();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', incident_type: 'suspicious_activity' as IncidentType,
    severity: 'medium' as Severity, location: '', reported_by: '',
    occurred_at: new Date().toISOString().slice(0, 16),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await create({
        ...form,
        title: form.title.trim().slice(0, 200),
        description: form.description.trim().slice(0, 4000) || null,
        location: form.location.trim().slice(0, 300) || null,
        reported_by: form.reported_by.trim().slice(0, 200) || null,
        occurred_at: new Date(form.occurred_at).toISOString(),
      });
      setForm({ ...form, title: '', description: '', location: '' });
      setOpen(false);
      onSubmitted();
      toast({ title: 'Incident logged' });
    } catch (err: any) { toast({ title: 'Failed', description: err.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider"
        style={{ background: '#00d4ff22', color: '#00d4ff', border: '1px solid #00d4ff55' }}>
        <Plus className="w-3.5 h-3.5" /> New Incident
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="p-4 rounded space-y-3" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-[#00d4ff]">Log Tactical Incident</span>
        <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button>
      </div>
      <input required maxLength={200} placeholder="Title — what happened?" value={form.title}
        onChange={e => setForm({ ...form, title: e.target.value })}
        className="w-full px-2 py-1.5 rounded text-sm bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00d4ff]/50" />
      <div className="grid grid-cols-2 gap-2">
        <select value={form.incident_type} onChange={e => setForm({ ...form, incident_type: e.target.value as IncidentType })}
          className="px-2 py-1.5 rounded text-xs bg-black/30 border border-white/10 text-white">
          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as Severity })}
          className="px-2 py-1.5 rounded text-xs bg-black/30 border border-white/10 text-white">
          {(['low','medium','high','critical'] as Severity[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input maxLength={300} placeholder="Location" value={form.location}
          onChange={e => setForm({ ...form, location: e.target.value })}
          className="px-2 py-1.5 rounded text-xs bg-black/30 border border-white/10 text-white placeholder:text-white/30" />
        <input maxLength={200} placeholder="Reported by" value={form.reported_by}
          onChange={e => setForm({ ...form, reported_by: e.target.value })}
          className="px-2 py-1.5 rounded text-xs bg-black/30 border border-white/10 text-white placeholder:text-white/30" />
        <input type="datetime-local" value={form.occurred_at}
          onChange={e => setForm({ ...form, occurred_at: e.target.value })}
          className="col-span-2 px-2 py-1.5 rounded text-xs bg-black/30 border border-white/10 text-white" />
      </div>
      <textarea maxLength={4000} placeholder="Description, actions taken, suspect description…" rows={3} value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
        className="w-full px-2 py-1.5 rounded text-xs bg-black/30 border border-white/10 text-white placeholder:text-white/30 resize-none" />
      <button disabled={busy} type="submit"
        className="w-full py-2 rounded text-xs font-mono uppercase tracking-wider disabled:opacity-50"
        style={{ background: '#00d4ff', color: '#001018' }}>
        {busy ? 'Submitting…' : 'Log Incident'}
      </button>
    </form>
  );
}

export default function TacticalMonitoring() {
  const { items: incidents, update, remove } = useTacticalIncidents();
  const { items: alerts, acknowledge, remove: removeAlert } = useTacticalSensorAlerts();
  const [minSev, setMinSev] = useState<Severity>('low');
  const [hideAck, setHideAck] = useState(true);

  const filteredIncidents = useMemo(
    () => incidents.filter(i => SEV_RANK[i.severity] >= SEV_RANK[minSev]),
    [incidents, minSev]
  );
  const filteredAlerts = useMemo(
    () => alerts.filter(a => SEV_RANK[a.severity] >= SEV_RANK[minSev] && (!hideAck || !a.acknowledged)),
    [alerts, minSev, hideAck]
  );

  const stats = useMemo(() => ({
    openIncidents: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
    criticalOpen: incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'false_alarm').length,
    unackAlerts: alerts.filter(a => !a.acknowledged).length,
    last24hAlerts: alerts.filter(a => Date.now() - new Date(a.occurred_at).getTime() < 86400000).length,
  }), [incidents, alerts]);

  return (
    <CrisisLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#00d4ff]" />
              Tactical Monitoring
            </h1>
            <p className="text-xs text-white/40 font-mono mt-1">
              Ground-truth operational intelligence — incident reports and live sensor feed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Filter className="w-3 h-3 text-white/40" />
              <select value={minSev} onChange={e => setMinSev(e.target.value as Severity)}
                className="bg-transparent text-white/80 text-xs focus:outline-none">
                <option value="low">All severities</option>
                <option value="medium">Medium+</option>
                <option value="high">High+</option>
                <option value="critical">Critical only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Open Incidents', value: stats.openIncidents, color: '#00d4ff', icon: ShieldAlert },
            { label: 'Critical Active', value: stats.criticalOpen, color: '#ef4444', icon: AlertTriangle },
            { label: 'Unack Alerts', value: stats.unackAlerts, color: '#f97316', icon: Siren },
            { label: 'Sensor Events / 24h', value: stats.last24hAlerts, color: '#22c55e', icon: Radio },
          ].map(s => (
            <div key={s.label} className="p-3 rounded" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">{s.label}</span>
                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              </div>
              <div className="text-2xl font-mono font-semibold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Incidents column */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white/70 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#00d4ff]" /> Field Incidents
                <span className="text-white/30">({filteredIncidents.length})</span>
              </h2>
              <IncidentForm onSubmitted={() => {}} />
            </div>
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
              {filteredIncidents.length === 0 && (
                <div className="p-6 text-center text-xs text-white/30 font-mono rounded" style={{ background: '#111318', border: '1px dashed rgba(255,255,255,0.08)' }}>
                  No incidents logged. Use “New Incident” to record one.
                </div>
              )}
              {filteredIncidents.map(i => (
                <div key={i.id} className="p-3 rounded" style={{ background: '#111318', border: `1px solid ${SEV_COLOR[i.severity]}33`, borderLeftWidth: 3, borderLeftColor: SEV_COLOR[i.severity] }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityPill s={i.severity} />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">{i.incident_type.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-white/70" style={{ background: 'rgba(255,255,255,0.06)' }}>{i.status}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/30 whitespace-nowrap">{fmtTime(i.occurred_at)}</span>
                  </div>
                  <div className="text-sm text-white font-medium leading-snug">{i.title}</div>
                  {i.description && <p className="text-xs text-white/60 mt-1 leading-relaxed whitespace-pre-wrap">{i.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40 font-mono">
                    {i.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{i.location}</span>}
                    {i.reported_by && <span>· {i.reported_by}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                    <select value={i.status} onChange={e => update(i.id, { status: e.target.value as IncidentStatus })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 border border-white/10 text-white/70 font-mono">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => { if (confirm('Delete incident?')) remove(i.id); }}
                      className="ml-auto text-[10px] text-white/30 hover:text-red-400 font-mono">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sensor alerts column */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white/70 flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#f97316]" /> Sensor &amp; Camera Alerts
                <span className="text-white/30">({filteredAlerts.length})</span>
              </h2>
              <button onClick={() => setHideAck(v => !v)}
                className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded text-white/60 hover:text-white"
                style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}>
                {hideAck ? 'Hiding ack’d' : 'Showing all'}
              </button>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
              {filteredAlerts.length === 0 && (
                <div className="p-6 text-center text-xs text-white/30 font-mono rounded" style={{ background: '#111318', border: '1px dashed rgba(255,255,255,0.08)' }}>
                  No active sensor alerts. POST to{' '}
                  <code className="text-[#00d4ff]">/functions/v1/tactical-sensor-webhook</code> to ingest.
                </div>
              )}
              {filteredAlerts.map(a => {
                const Icon = SENSOR_ICON[a.source_kind] || Radio;
                return (
                  <div key={a.id} className={cn('p-3 rounded', a.acknowledged && 'opacity-60')}
                    style={{ background: '#111318', border: `1px solid ${SEV_COLOR[a.severity]}33`, borderLeftWidth: 3, borderLeftColor: SEV_COLOR[a.severity] }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityPill s={a.severity} />
                        <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-white/60">
                          <Icon className="w-3 h-3" />{a.source_kind}
                        </span>
                        {a.device_name && <span className="text-[10px] font-mono text-white/40">· {a.device_name}</span>}
                      </div>
                      <span className="text-[10px] font-mono text-white/30 whitespace-nowrap">{fmtTime(a.occurred_at)}</span>
                    </div>
                    <div className="text-sm text-white leading-snug">{a.message}</div>
                    {a.location && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-white/40 font-mono">
                        <MapPin className="w-3 h-3" />{a.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                      {!a.acknowledged ? (
                        <button onClick={() => acknowledge(a.id)}
                          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e55' }}>
                          <CheckCircle2 className="w-3 h-3" /> Acknowledge
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-green-400/70">
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged
                        </span>
                      )}
                      <button onClick={() => { if (confirm('Delete alert?')) removeAlert(a.id); }}
                        className="ml-auto text-[10px] text-white/30 hover:text-red-400 font-mono">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <details className="rounded p-3 text-xs text-white/50" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}>
          <summary className="cursor-pointer text-white/70 font-mono uppercase tracking-wider text-[11px]">
            Sensor Webhook Integration
          </summary>
          <p className="mt-2">
            Configure CCTV / IoT systems to POST JSON to the public webhook below. Authenticate with either an
            <code className="px-1 text-[#00d4ff]">x-webhook-secret</code> header (set <code className="text-[#00d4ff]">TACTICAL_WEBHOOK_SECRET</code> in project secrets)
            or a signed-in analyst’s bearer token.
          </p>
          <pre className="mt-2 p-2 rounded bg-black/40 text-[11px] overflow-x-auto text-white/70">{`POST /functions/v1/tactical-sensor-webhook
Content-Type: application/json
x-webhook-secret: <shared-secret>

{
  "user_id": "<analyst uuid>",
  "source_kind": "camera",
  "device_id": "cam-lobby-04",
  "device_name": "Lobby Cam 04",
  "severity": "high",
  "message": "Motion detected after hours near reception.",
  "location": "HQ – Lobby",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "occurred_at": "2026-06-18T19:02:00Z",
  "raw": { "vendor": "Verkada", "event_id": "abc123" }
}`}</pre>
        </details>
      </div>
    </CrisisLayout>
  );
}