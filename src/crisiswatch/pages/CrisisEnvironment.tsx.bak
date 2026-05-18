import { useState, useMemo, useEffect } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { EventCard } from '../components/EventCard';
import { EventDetail } from '../components/EventDetail';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { CrisisEvent, SEVERITY_COLORS } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CloudRain, Waves, Wind, Flame, Mountain, AlertTriangle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENV_KEYWORDS = [
  'weather','storm','typhoon','hurricane','cyclone','flood','flooding','earthquake',
  'quake','tsunami','volcano','volcanic','eruption','wildfire','bushfire','fire',
  'drought','heatwave','blizzard','tornado','landslide','mudslide','avalanche',
  'climate','environment','pollution','rainfall','snowstorm','seismic','aftershock'
];

type EnvType = 'all' | 'seismic' | 'storm' | 'flood' | 'fire' | 'other';

function classify(e: CrisisEvent): EnvType {
  const s = `${e.title} ${e.summary}`.toLowerCase();
  if (/earthquake|quake|seismic|tsunami|volcan|aftershock|eruption/.test(s)) return 'seismic';
  if (/storm|typhoon|hurricane|cyclone|tornado|blizzard|snowstorm|wind/.test(s)) return 'storm';
  if (/flood|rainfall|monsoon|landslide|mudslide/.test(s)) return 'flood';
  if (/wildfire|bushfire|\bfire\b|drought|heatwave/.test(s)) return 'fire';
  return 'other';
}

interface UsgsQuake {
  id: string;
  title: string;
  summary: string;
  location: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mag: number;
  time: string;
  url: string;
}

function quakeToEvent(q: UsgsQuake): CrisisEvent {
  return {
    id: `usgs-${q.id}`,
    title: q.title,
    summary: q.summary,
    location: q.location,
    latitude: q.latitude,
    longitude: q.longitude,
    category: 'Weather',
    source_type: 'USGS',
    severity: q.severity,
    status: 'verified',
    confidence: 100,
    sources_count: 1,
    affected_area: q.location,
    impacts: [`Magnitude ${q.mag.toFixed(1)}`],
    actions: [],
    pipeline_stage: 'verified',
    created_at: q.time,
    updated_at: q.time,
  };
}

function useUsgsQuakes() {
  const [quakes, setQuakes] = useState<CrisisEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson');
        const j = await r.json();
        const items: CrisisEvent[] = (j.features || []).map((f: any) => {
          const p = f.properties || {};
          const c = f.geometry?.coordinates || [0, 0];
          const mag = Number(p.mag) || 0;
          const sev: UsgsQuake['severity'] = mag >= 7 ? 'critical' : mag >= 6 ? 'high' : mag >= 5 ? 'medium' : 'low';
          return quakeToEvent({
            id: f.id,
            title: p.title || `M${mag} earthquake`,
            summary: `${p.place || 'Unknown location'} — depth ${(f.geometry?.coordinates?.[2] || 0).toFixed(1)} km`,
            location: p.place || 'Unknown',
            latitude: c[1], longitude: c[0],
            severity: sev, mag,
            time: new Date(p.time || Date.now()).toISOString(),
            url: p.url || '',
          });
        });
        if (!cancelled) setQuakes(items);
      } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return quakes;
}

export default function CrisisEnvironment() {
  const { events, loading } = useCrisisEvents();
  const quakes = useUsgsQuakes();
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [filter, setFilter] = useState<EnvType>('all');

  const envEvents = useMemo(() => {
    const filtered = events.filter(e => {
      const s = `${e.title} ${e.summary}`.toLowerCase();
      return ENV_KEYWORDS.some(k => s.includes(k));
    });
    const combined = [...quakes, ...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (filter === 'all') return combined;
    return combined.filter(e => classify(e) === filter);
  }, [events, quakes, filter]);

  const stats = useMemo(() => ({
    total: envEvents.length,
    seismic: envEvents.filter(e => classify(e) === 'seismic').length,
    storm: envEvents.filter(e => classify(e) === 'storm').length,
    flood: envEvents.filter(e => classify(e) === 'flood').length,
    fire: envEvents.filter(e => classify(e) === 'fire').length,
    critical: envEvents.filter(e => e.severity === 'critical').length,
  }), [envEvents]);

  const filters: { id: EnvType; label: string; icon: any; color: string }[] = [
    { id: 'all',     label: 'All',         icon: Activity,  color: '#00d4ff' },
    { id: 'seismic', label: 'Seismic',     icon: Mountain,  color: '#a855f7' },
    { id: 'storm',   label: 'Storm/Wind',  icon: Wind,      color: '#3b82f6' },
    { id: 'flood',   label: 'Flood/Rain',  icon: Waves,     color: '#14b8a6' },
    { id: 'fire',    label: 'Fire/Heat',   icon: Flame,     color: '#ff4757' },
    { id: 'other',   label: 'Other',       icon: CloudRain, color: '#94a3b8' },
  ];

  return (
    <CrisisLayout>
      <div className="flex flex-col h-full">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <CloudRain className="w-5 h-5 text-[#00d4ff]" />
            <h1 className="text-lg font-semibold text-white">Environment & Natural Hazards</h1>
          </div>
          <p className="text-xs font-mono text-white/40 uppercase tracking-wider">
            Weather · Earthquakes · Floods · Wildfires · Climate events
          </p>
        </div>

        <div className="grid grid-cols-6 gap-3 px-4 pb-3">
          {[
            { label: 'Total', value: stats.total, icon: Activity, color: '#00d4ff' },
            { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: '#ff4757' },
            { label: 'Seismic', value: stats.seismic, icon: Mountain, color: '#a855f7' },
            { label: 'Storms', value: stats.storm, icon: Wind, color: '#3b82f6' },
            { label: 'Floods', value: stats.flood, icon: Waves, color: '#14b8a6' },
            { label: 'Fire/Heat', value: stats.fire, icon: Flame, color: '#ff8a4c' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border p-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <span className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {filters.map(f => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded border transition-colors',
                  active ? 'border-current' : 'border-white/10 hover:border-white/30'
                )}
                style={active ? { background: f.color + '22', color: f.color } : { color: 'rgba(255,255,255,0.55)' }}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                Live Environmental Feed · {envEvents.length} events
              </span>
            </div>
            <ScrollArea className="h-[calc(100%-32px)]">
              <div className="p-3 space-y-2">
                {loading && envEvents.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#181c22' }}>
                      <Skeleton className="h-4 w-1/3 mb-2" /><Skeleton className="h-3 w-full" />
                    </div>
                  ))
                ) : envEvents.length === 0 ? (
                  <div className="text-center py-12 text-white/30 font-mono text-sm">No environmental events</div>
                ) : (
                  envEvents.map(event => (
                    <EventCard key={event.id} event={event} isSelected={selectedEvent?.id === event.id} onClick={() => setSelectedEvent(event)} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {selectedEvent && (
            <div className="w-80 border-l flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            </div>
          )}
        </div>
      </div>
    </CrisisLayout>
  );
}
