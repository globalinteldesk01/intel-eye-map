import { useCallback, useEffect, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, ArrowLeft, Loader2, Radio, Activity, Trash2, RefreshCw, Save,
  ShieldAlert, Phone, BookOpen, Plane, MapPin, CalendarDays, User as UserIcon,
} from 'lucide-react';

// =============================================================
// Itinerary Console — Global Alert Feed style (replaces map UI)
// =============================================================

type Severity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

interface RiskScore { category: string; score: number; level: Severity; summary: string; }
interface Assessment {
  overall_level: Severity;
  overall_score: number;
  scores: RiskScore[];
  recommendations: string[];
  emergency_contacts: string[];
  generated_at: string;
}
interface ThreatAlert {
  id: string; severity: Severity; category: string;
  headline: string; detail: string; timestamp: string;
}
interface Itinerary {
  id: string;
  user_id: string;
  traveler_name: string;
  destination_city: string | null;
  destination_country: string | null;
  purpose: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  assessment: Assessment | null;
  alerts: ThreatAlert[];
  debrief: string | null;
  created_at: string;
}

const EMERGENCY_PROTOCOLS = [
  { code: 'P-01', t: 'Medical emergency', d: 'Contact 24/7 crisis line. Analyst will coordinate nearest vetted clinic, trauma center, or air-medical evacuation.' },
  { code: 'P-02', t: 'Security threat / kidnap', d: 'Trigger duress code via app. Operations team initiates extraction protocol with local assets and authorities.' },
  { code: 'P-03', t: 'Civil unrest / political event', d: 'Shelter-in-place at hardened lodging. Analyst tracks event perimeter and advises movement window.' },
  { code: 'P-04', t: 'Natural disaster', d: 'Follow evacuation order. Proceed to designated muster point. Desk provides live route intelligence.' },
  { code: 'P-05', t: 'Detention / border issue', d: 'Do not sign documents. Call legal hotline. Desk coordinates with consular services.' },
];

const sevText = (s?: string) => ({
  LOW: 'text-green-400', MODERATE: 'text-yellow-400',
  HIGH: 'text-orange-400', CRITICAL: 'text-red-400',
}[s as Severity] || 'text-white');

const sevBorder = (s?: string) => ({
  LOW: 'border-green-500/40', MODERATE: 'border-yellow-500/40',
  HIGH: 'border-orange-500/50', CRITICAL: 'border-red-500/60',
}[s as Severity] || 'border-white/10');

const sevBg = (s?: string) => ({
  LOW: 'bg-green-500', MODERATE: 'bg-yellow-500',
  HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500',
}[s as Severity] || 'bg-zinc-500');

const computeStatus = (start: string, end: string): 'planned' | 'active' | 'completed' => {
  const today = new Date().toISOString().slice(0, 10);
  if (today < start) return 'planned';
  if (today > end) return 'completed';
  return 'active';
};

const RiskBadge = ({ level }: { level: string }) => (
  <span className={`font-mono text-[10px] uppercase tracking-[0.2em] border px-2 py-0.5 ${sevBorder(level)} ${sevText(level)}`}>
    {level}
  </span>
);

// ----- Page -----
export default function ItineraryMapBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('travel_itineraries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Failed to load itineraries', description: error.message, variant: 'destructive' });
    setItineraries((data || []) as unknown as Itinerary[]);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total: itineraries.length,
    active: itineraries.filter(i => computeStatus(i.start_date, i.end_date) === 'active').length,
    alerts: itineraries.reduce((n, i) => n + (i.alerts?.length || 0), 0),
    critical: itineraries.reduce((n, i) => n + (i.alerts?.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length || 0), 0),
  };

  const activeItin = itineraries.find(i => i.id === activeId) || null;

  return (
    <CrisisLayout>
      <div className="bg-black min-h-full text-white overflow-y-auto">
        {view === 'list' && (
          <ListView
            stats={stats}
            itineraries={itineraries}
            loading={loading}
            onNew={() => setView('new')}
            onOpen={(id) => { setActiveId(id); setView('detail'); }}
          />
        )}
        {view === 'new' && (
          <NewView
            onBack={() => setView('list')}
            onCreated={async (id) => { await load(); setActiveId(id); setView('detail'); }}
          />
        )}
        {view === 'detail' && activeItin && (
          <DetailView
            itin={activeItin}
            onBack={() => { setActiveId(null); setView('list'); load(); }}
            onChanged={load}
          />
        )}
        {view === 'detail' && !activeItin && (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs uppercase tracking-[0.25em]">
            Mission file not found.
          </div>
        )}
      </div>
    </CrisisLayout>
  );
}

// ============== LIST ==============
function ListView({ stats, itineraries, loading, onNew, onOpen }: {
  stats: { total: number; active: number; alerts: number; critical: number };
  itineraries: Itinerary[];
  loading: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const { user } = useAuth();
  return (
    <>
      <div className="border-b border-white/10 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 bg-green-400 rounded-full" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">OPS CENTER · ONLINE</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">// OPERATOR CONSOLE</div>
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome back, {user?.email?.split('@')[0] || 'Operator'}
            </h1>
            <p className="text-sm text-zinc-400 mt-2">Active itinerary surveillance and intelligence feed.</p>
          </div>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-black font-mono text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Itinerary
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total itineraries" value={stats.total} />
          <StatCard label="Active" value={stats.active} accent="text-green-400" />
          <StatCard label="Alerts tracked" value={stats.alerts} accent="text-orange-400" />
          <StatCard label="Critical flags" value={stats.critical} accent="text-red-400" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">// MONITORED ITINERARIES</div>
            <h2 className="text-2xl font-bold mt-1">All missions</h2>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <Radio className="h-3 w-3" /> Live view
          </div>
        </div>

        {loading ? (
          <div className="border border-white/10 p-16 flex items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs uppercase tracking-[0.25em]">LOADING FEED</span>
          </div>
        ) : itineraries.length === 0 ? (
          <div className="border border-white/10 p-16 text-center">
            <Plane className="h-8 w-8 mx-auto text-zinc-600 mb-3" strokeWidth={1.5} />
            <h3 className="text-xl font-bold">No mission files yet</h3>
            <p className="mt-3 text-zinc-400 text-sm">Open a new itinerary to activate AI-driven risk assessment and live threat monitoring.</p>
            <button onClick={onNew} className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-white text-black font-mono text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 transition-colors">
              <Plus className="h-4 w-4" /> Open new itinerary
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {itineraries.map((it) => {
              const status = computeStatus(it.start_date, it.end_date);
              return (
                <button
                  key={it.id}
                  onClick={() => onOpen(it.id)}
                  className="text-left border border-white/10 bg-[#0a0a0a] hover:bg-[#101010] hover:border-white/20 p-6 transition-colors group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                        MISSION · {it.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xl font-bold mt-1 group-hover:text-white">
                        {it.destination_city || '—'}, {it.destination_country || '—'}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-zinc-300">
                        <span className="flex items-center gap-1.5"><UserIcon className="h-3 w-3" /> {it.traveler_name}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {it.purpose}</span>
                        <span className="flex items-center gap-1.5 font-mono"><CalendarDays className="h-3 w-3" /> {it.start_date} → {it.end_date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {it.assessment && <RiskBadge level={it.assessment.overall_level} />}
                      <span className={`font-mono text-[10px] uppercase tracking-[0.25em] border px-2 py-0.5 ${
                        status === 'active' ? 'border-green-500/50 text-green-400' :
                        status === 'planned' ? 'border-white/20 text-zinc-300' :
                        'border-white/10 text-zinc-500'
                      }`}>{status}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{it.alerts?.length || 0} alerts</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const StatCard = ({ label, value, accent = 'text-white' }: { label: string; value: number | string; accent?: string }) => (
  <div className="border border-white/10 bg-[#0a0a0a] p-6">
    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
    <div className={`mt-3 font-mono text-4xl font-medium tracking-tight ${accent}`}>{value}</div>
  </div>
);

// ============== NEW ==============
function NewView({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    traveler_name: '',
    destination_country: '',
    destination_city: '',
    purpose: 'Business',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const change = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('travel_itineraries')
        .insert({
          user_id: user.id,
          name: `${form.destination_city}, ${form.destination_country}`,
          ...form,
        })
        .select()
        .single();
      if (error) throw error;
      toast({ title: 'Itinerary created', description: 'Running AI risk assessment…' });
      // Fire and forget assessment
      try {
        await supabase.functions.invoke('itinerary-assess', { body: { itinerary_id: data.id, mode: 'all' } });
      } catch (err) {
        console.error('assess failed', err);
      }
      onCreated(data.id);
    } catch (err: any) {
      toast({ title: 'Failed to create', description: err.message ?? String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-8 py-12">
      <button onClick={onBack} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to console
      </button>
      <div className="mt-6 mb-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500 mb-3">// NEW ITINERARY</div>
        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter leading-[1]">Open a new mission file.</h1>
        <p className="text-sm text-zinc-400 mt-3 max-w-xl">
          Submit itinerary details to activate real-time threat monitoring and AI-driven risk assessment.
        </p>
      </div>

      <form onSubmit={submit} className="border border-white/10 bg-[#0a0a0a] p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Traveler Name" required value={form.traveler_name} onChange={change('traveler_name')} />
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 block mb-2">Purpose *</label>
            <select
              value={form.purpose}
              onChange={change('purpose')}
              className="w-full bg-black border border-white/15 text-white px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
            >
              <option>Business</option>
              <option>Diplomatic</option>
              <option>Humanitarian / NGO</option>
              <option>Media / Journalism</option>
              <option>Government</option>
              <option>Tourism</option>
              <option>Executive Protection</option>
            </select>
          </div>
          <Field label="Destination City" required value={form.destination_city} onChange={change('destination_city')} />
          <Field label="Destination Country" required value={form.destination_country} onChange={change('destination_country')} />
          <Field label="Start Date" type="date" required value={form.start_date} onChange={change('start_date')} />
          <Field label="End Date" type="date" required value={form.end_date} onChange={change('end_date')} />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 block mb-2">Mission Notes</label>
          <textarea
            value={form.notes}
            onChange={change('notes')}
            rows={4}
            placeholder="Context, specific concerns, high-risk venues, VIP profile..."
            className="w-full bg-black border border-white/15 text-white px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors resize-none"
          />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            AI ASSESSMENT WILL RUN AUTOMATICALLY
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-mono text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Provisioning…</>) : (<>Activate monitoring <Plane className="h-4 w-4" /></>)}
          </button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, type = 'text', required, value, onChange }: {
  label: string; type?: string; required?: boolean;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div>
    <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 block mb-2">
      {label} {required && '*'}
    </label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={onChange}
      className="w-full bg-black border border-white/15 text-white px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
    />
  </div>
);

// ============== DETAIL ==============
function DetailView({ itin, onBack, onChanged }: { itin: Itinerary; onBack: () => void; onChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [assessing, setAssessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [debrief, setDebrief] = useState(itin.debrief || '');
  const [savingDebrief, setSavingDebrief] = useState(false);

  useEffect(() => { setDebrief(itin.debrief || ''); }, [itin.id, itin.debrief]);

  const status = computeStatus(itin.start_date, itin.end_date);

  const onAssess = async () => {
    setAssessing(true);
    try {
      const { error } = await supabase.functions.invoke('itinerary-assess', { body: { itinerary_id: itin.id, mode: 'all' } });
      if (error) throw error;
      await onChanged();
      toast({ title: 'Risk assessment complete' });
    } catch (e: any) {
      toast({ title: 'Assessment failed', description: e.message ?? String(e), variant: 'destructive' });
    } finally { setAssessing(false); }
  };

  const onRefreshAlerts = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('itinerary-assess', { body: { itinerary_id: itin.id, mode: 'alerts' } });
      if (error) throw error;
      await onChanged();
      toast({ title: 'Threat feed refreshed' });
    } catch (e: any) {
      toast({ title: 'Refresh failed', description: e.message ?? String(e), variant: 'destructive' });
    } finally { setRefreshing(false); }
  };

  const onSaveDebrief = async () => {
    setSavingDebrief(true);
    try {
      const { error } = await supabase.from('travel_itineraries').update({ debrief }).eq('id', itin.id);
      if (error) throw error;
      await onChanged();
      toast({ title: 'Debrief saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSavingDebrief(false); }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this itinerary? This cannot be undone.')) return;
    const { error } = await supabase.from('travel_itineraries').delete().eq('id', itin.id);
    if (error) { toast({ title: 'Delete failed', variant: 'destructive' }); return; }
    toast({ title: 'Itinerary deleted' });
    onBack();
  };

  return (
    <>
      <div className="border-b border-white/10 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <button onClick={onBack} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 hover:text-white transition-colors mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> Console
          </button>
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">
                MISSION · {itin.id.slice(0, 8).toUpperCase()}
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tighter leading-[1]">
                {itin.destination_city || '—'}, {itin.destination_country || '—'}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-2 text-zinc-300"><UserIcon className="h-3.5 w-3.5" /> {itin.traveler_name}</span>
                <span className="flex items-center gap-2 text-zinc-300"><MapPin className="h-3.5 w-3.5" /> {itin.purpose}</span>
                <span className="flex items-center gap-2 text-zinc-300 font-mono"><CalendarDays className="h-3.5 w-3.5" /> {itin.start_date} → {itin.end_date}</span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.25em] border px-2 py-0.5 ${
                  status === 'active' ? 'border-green-500/50 text-green-400' :
                  status === 'planned' ? 'border-white/20 text-zinc-300' :
                  'border-white/10 text-zinc-500'
                }`}>{status}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={onAssess} disabled={assessing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-mono text-xs uppercase tracking-[0.2em] hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                {itin.assessment ? 'Re-assess' : 'Run assessment'}
              </button>
              <button onClick={onDelete}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-500/40 text-red-400 font-mono text-xs uppercase tracking-[0.2em] hover:bg-red-500/10 transition-colors">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 grid grid-cols-12 gap-4">
        <section className="col-span-12 lg:col-span-8">
          <div className="border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">// RISK PICTURE</div>
                <div className="text-lg font-bold">Assessment</div>
              </div>
              {itin.assessment && <RiskBadge level={itin.assessment.overall_level} />}
            </div>

            {assessing ? (
              <div className="p-16 flex items-center justify-center gap-3 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-mono text-xs uppercase tracking-[0.25em]">ANALYSTS COMPILING BRIEFING…</span>
              </div>
            ) : !itin.assessment ? (
              <div className="p-12 text-center">
                <ShieldAlert className="h-8 w-8 mx-auto text-zinc-600 mb-3" strokeWidth={1.5} />
                <div className="font-bold">No assessment yet.</div>
                <div className="text-sm text-zinc-400 mt-1">Run an intelligence assessment to generate a full risk picture.</div>
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-white/10 grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">OVERALL LEVEL</div>
                    <div className="mt-1 text-2xl font-black">{itin.assessment.overall_level}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">COMPOSITE SCORE</div>
                    <div className="mt-1 font-mono text-2xl font-medium">{itin.assessment.overall_score}<span className="text-zinc-500 text-base">/100</span></div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">GENERATED</div>
                    <div className="mt-1 font-mono text-xs text-zinc-300">{new Date(itin.assessment.generated_at).toUTCString()}</div>
                  </div>
                </div>

                <div className="divide-y divide-white/10">
                  {itin.assessment.scores?.map((s, i) => (
                    <div key={i} className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold">{s.category}</div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-zinc-300">{s.score}<span className="text-zinc-500 text-xs">/100</span></span>
                          <RiskBadge level={s.level} />
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 overflow-hidden">
                        <div className={`h-full ${sevBg(s.level)}`} style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }} />
                      </div>
                      <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{s.summary}</p>
                    </div>
                  ))}
                </div>

                <div className="p-5 border-t border-white/10 bg-[#080808]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">// RECOMMENDATIONS</div>
                  <ul className="space-y-3">
                    {itin.assessment.recommendations?.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                        <span className="mt-1.5 h-1 w-4 bg-white flex-shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {itin.assessment.emergency_contacts?.map((c, i) => (
                    <div key={i} className="border border-white/10 p-3 flex items-start gap-3">
                      <Phone className="h-4 w-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="text-xs text-zinc-300">{c}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="mt-4 border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">// POST-TRAVEL DEBRIEF</div>
                <div className="text-lg font-bold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Incident log & notes</div>
              </div>
              <button onClick={onSaveDebrief} disabled={savingDebrief}
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-black disabled:opacity-50 transition-colors">
                <Save className="h-3.5 w-3.5" /> {savingDebrief ? 'Saving…' : 'Save'}
              </button>
            </div>
            <textarea
              value={debrief}
              onChange={(e) => setDebrief(e.target.value)}
              rows={6}
              placeholder="Record incidents, near-misses, local asset feedback, protocol refinements…"
              className="w-full bg-black text-white px-5 py-4 text-sm focus:outline-none resize-none"
            />
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">// THREAT FEED</div>
                <div className="text-lg font-bold flex items-center gap-2"><Radio className="h-4 w-4 text-red-400" /> Live alerts</div>
              </div>
              <button onClick={onRefreshAlerts} disabled={refreshing}
                className="p-2 border border-white/15 hover:bg-white hover:text-black disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
              {(itin.alerts || []).length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No alerts yet. Run an assessment to generate feed.</div>
              ) : itin.alerts.map((a) => (
                <div key={a.id} className={`p-4 border-l-2 ${sevBorder(a.severity)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.25em] ${sevText(a.severity)}`}>[{a.severity}] {a.category}</span>
                    <span className="font-mono text-[9px] text-zinc-500">{new Date(a.timestamp).toUTCString().slice(17, 22)}</span>
                  </div>
                  <div className="text-sm font-semibold leading-tight">{a.headline}</div>
                  <div className="mt-1 text-xs text-zinc-400 leading-relaxed">{a.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-[#0a0a0a]">
            <div className="p-5 border-b border-white/10">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">// EMERGENCY PROTOCOLS</div>
              <div className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Response playbooks</div>
            </div>
            <div className="divide-y divide-white/10">
              {EMERGENCY_PROTOCOLS.map((p) => (
                <div key={p.code} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-sm">{p.t}</div>
                    <span className="font-mono text-[10px] text-zinc-500">{p.code}</span>
                  </div>
                  <div className="text-xs text-zinc-400 leading-relaxed">{p.d}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10 bg-black flex items-center gap-3">
              <Phone className="h-4 w-4 text-red-400" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">24/7 CRISIS LINE</div>
                <div className="font-bold text-sm">+1 (800) 555-0198</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
