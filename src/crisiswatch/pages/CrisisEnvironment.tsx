import { useState, useMemo, useEffect, useCallback } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { EventCard } from '../components/EventCard';
import { EventDetail } from '../components/EventDetail';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { CrisisEvent } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CloudRain, Waves, Wind, Flame, Mountain, AlertTriangle, Activity,
  Thermometer, Droplets, Gauge, Sun,
} from 'lucide-react';
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

/* ---------------- Regions (shared by quakes + weather) ---------------- */

interface Region { id: string; label: string; lat: number; lon: number; }

const REGIONS: Region[] = [
  { id: 'global',    label: 'Global (no radius)', lat: 0,       lon: 0 },
  { id: 'singapore', label: 'Singapore',          lat: 1.3521,  lon: 103.8198 },
  { id: 'jakarta',   label: 'Jakarta, ID',        lat: -6.2088, lon: 106.8456 },
  { id: 'manila',    label: 'Manila, PH',         lat: 14.5995, lon: 120.9842 },
  { id: 'bangkok',   label: 'Bangkok, TH',        lat: 13.7563, lon: 100.5018 },
  { id: 'hanoi',     label: 'Hanoi, VN',          lat: 21.0285, lon: 105.8542 },
  { id: 'kl',        label: 'Kuala Lumpur, MY',   lat: 3.139,   lon: 101.6869 },
  { id: 'tokyo',     label: 'Tokyo, JP',          lat: 35.6762, lon: 139.6503 },
  { id: 'taipei',    label: 'Taipei, TW',         lat: 25.033,  lon: 121.5654 },
  { id: 'mumbai',    label: 'Mumbai, IN',         lat: 19.076,  lon: 72.8777 },
  { id: 'dubai',     label: 'Dubai, AE',          lat: 25.2048, lon: 55.2708 },
  { id: 'istanbul',  label: 'Istanbul, TR',       lat: 41.0082, lon: 28.9784 },
  { id: 'london',    label: 'London, UK',         lat: 51.5074, lon: -0.1278 },
  { id: 'newyork',   label: 'New York, US',       lat: 40.7128, lon: -74.006 },
  { id: 'la',        label: 'Los Angeles, US',    lat: 34.0522, lon: -118.2437 },
  { id: 'sydney',    label: 'Sydney, AU',         lat: -33.8688, lon: 151.2093 },
];

/* ---------------- USGS earthquake feed with controls ---------------- */

interface QuakeQuery {
  minMag: number;
  maxMag: number;
  windowDays: number;          // 1 / 7 / 30
  center?: { lat: number; lon: number } | null;
  radiusKm?: number;
}

function quakeToEvent(f: any): CrisisEvent {
  const p = f.properties || {};
  const c = f.geometry?.coordinates || [0, 0, 0];
  const mag = Number(p.mag) || 0;
  const sev: CrisisEvent['severity'] =
    mag >= 7 ? 'critical' : mag >= 6 ? 'high' : mag >= 5 ? 'medium' : 'low';
  return {
    id: `usgs-${f.id}`,
    title: p.title || `M${mag.toFixed(1)} earthquake`,
    summary: `${p.place || 'Unknown location'} — depth ${(c[2] || 0).toFixed(1)} km`,
    location: p.place || 'Unknown',
    latitude: c[1], longitude: c[0],
    category: 'Weather',
    source_type: 'USGS',
    severity: sev,
    status: 'verified',
    confidence: 100,
    sources_count: 1,
    affected_area: p.place || 'Unknown',
    impacts: [`Magnitude ${mag.toFixed(1)}`],
    actions: [],
    pipeline_stage: 'verified',
    created_at: new Date(p.time || Date.now()).toISOString(),
    updated_at: new Date(p.updated || p.time || Date.now()).toISOString(),
  };
}

function useUsgsQuakes(q: QuakeQuery) {
  const [quakes, setQuakes] = useState<CrisisEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date(end.getTime() - q.windowDays * 86400_000);
        const params = new URLSearchParams({
          format: 'geojson',
          starttime: start.toISOString(),
          endtime: end.toISOString(),
          minmagnitude: String(q.minMag),
          maxmagnitude: String(q.maxMag),
          orderby: 'time',
          limit: '500',
        });
        if (q.center && q.radiusKm) {
          params.set('latitude', String(q.center.lat));
          params.set('longitude', String(q.center.lon));
          params.set('maxradiuskm', String(q.radiusKm));
        }
        const r = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`);
        const j = await r.json();
        const items = (j.features || []).map(quakeToEvent);
        if (!cancelled) setQuakes(items);
      } catch {
        if (!cancelled) setQuakes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [q.minMag, q.maxMag, q.windowDays, q.center?.lat, q.center?.lon, q.radiusKm]);

  return { quakes, loading };
}

/* ---------------- Open-Meteo weather ---------------- */

interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
    pressure_msl: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
}

const WMO: Record<number, string> = {
  0:'Clear sky',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Rain showers',81:'Heavy showers',82:'Violent showers',
  85:'Snow showers',86:'Heavy snow showers',
  95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Severe thunderstorm w/ hail',
};

function useOpenMeteo(region: Region | null) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!region || region.id === 'global') { setData(null); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast`
          + `?latitude=${region!.lat}&longitude=${region!.lon}`
          + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,pressure_msl`
          + `&hourly=temperature_2m,precipitation,wind_speed_10m,weather_code`
          + `&forecast_days=2&timezone=auto`;
        const r = await fetch(url);
        const j = await r.json();
        if (!cancelled) setData(j as WeatherData);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [region?.id]);

  return { data, loading };
}

/** Derive alerts from forecast (Open-Meteo has no universal alerts feed). */
function deriveAlerts(d: WeatherData | null) {
  if (!d) return [] as { level: 'critical'|'high'|'medium'; label: string; detail: string; at: string }[];
  const out: { level: 'critical'|'high'|'medium'; label: string; detail: string; at: string }[] = [];
  const { hourly } = d;
  for (let i = 0; i < Math.min(hourly.time.length, 48); i++) {
    const w = hourly.weather_code[i];
    const wind = hourly.wind_speed_10m[i];
    const pr = hourly.precipitation[i];
    if (w >= 95) out.push({ level: 'critical', label: 'Severe thunderstorm', detail: WMO[w] || `WMO ${w}`, at: hourly.time[i] });
    else if (w === 82 || w === 75 || w === 86 || w === 67) out.push({ level: 'high', label: 'Severe precipitation', detail: WMO[w], at: hourly.time[i] });
    if (wind >= 75) out.push({ level: 'critical', label: 'Hurricane-force wind', detail: `${wind.toFixed(0)} km/h`, at: hourly.time[i] });
    else if (wind >= 50) out.push({ level: 'high', label: 'Damaging wind', detail: `${wind.toFixed(0)} km/h`, at: hourly.time[i] });
    if (pr >= 20) out.push({ level: 'high', label: 'Heavy precipitation', detail: `${pr.toFixed(1)} mm/h`, at: hourly.time[i] });
  }
  // Dedup by label+detail keeping earliest time
  const seen = new Set<string>();
  return out.filter(a => { const k = a.label+a.detail; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}

/* ---------------- Component ---------------- */

export default function CrisisEnvironment() {
  const { events, loading: loadingEvents } = useCrisisEvents();

  // Controls
  const [regionId, setRegionId] = useState<string>('global');
  const region = REGIONS.find(r => r.id === regionId) || REGIONS[0];
  const [magRange, setMagRange] = useState<[number, number]>([4.5, 10]);
  const [windowDays, setWindowDays] = useState<number>(7);
  const [radiusKm, setRadiusKm] = useState<number>(1000);
  const [filter, setFilter] = useState<EnvType>('all');
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);

  const quakeQuery = useMemo<QuakeQuery>(() => ({
    minMag: magRange[0],
    maxMag: magRange[1],
    windowDays,
    center: region.id === 'global' ? null : { lat: region.lat, lon: region.lon },
    radiusKm: region.id === 'global' ? undefined : radiusKm,
  }), [magRange, windowDays, region, radiusKm]);

  const { quakes, loading: loadingQuakes } = useUsgsQuakes(quakeQuery);
  const { data: weather, loading: loadingWeather } = useOpenMeteo(region);
  const alerts = useMemo(() => deriveAlerts(weather), [weather]);

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

  const SEV: Record<string, string> = { critical: '#ff4757', high: '#ff8a4c', medium: '#ffc857', low: '#94a3b8' };

  return (
    <CrisisLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <CloudRain className="w-5 h-5 text-[#00d4ff]" />
            <h1 className="text-lg font-semibold text-white">Environment & Natural Hazards</h1>
          </div>
          <p className="text-xs font-mono text-white/40 uppercase tracking-wider">
            USGS · Open-Meteo · Weather · Earthquakes · Floods · Wildfires
          </p>
        </div>

        {/* Region + Controls strip */}
        <div className="mx-4 mb-3 rounded-lg border p-3 grid grid-cols-12 gap-4"
             style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* Region */}
          <div className="col-span-12 lg:col-span-3">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Region</label>
            <Select value={regionId} onValueChange={setRegionId}>
              <SelectTrigger className="mt-1 h-9 bg-[#0f1216] border-white/10 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Magnitude range */}
          <div className="col-span-12 lg:col-span-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">USGS Magnitude</label>
              <span className="text-[11px] font-mono text-[#00d4ff]">M {magRange[0].toFixed(1)} – {magRange[1].toFixed(1)}</span>
            </div>
            <Slider
              className="mt-3"
              min={0} max={10} step={0.1}
              value={magRange}
              onValueChange={(v) => setMagRange([v[0], v[1]] as [number, number])}
            />
          </div>

          {/* Time window */}
          <div className="col-span-6 lg:col-span-3">
            <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Time Window</label>
            <div className="mt-1 flex gap-1">
              {[
                { d: 1,  l: '24h' },
                { d: 7,  l: '7d'  },
                { d: 30, l: '30d' },
              ].map(o => (
                <button
                  key={o.d}
                  onClick={() => setWindowDays(o.d)}
                  className={cn(
                    'flex-1 h-9 rounded text-xs font-mono border transition-colors',
                    windowDays === o.d
                      ? 'border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]'
                      : 'border-white/10 text-white/55 hover:border-white/30'
                  )}
                >{o.l}</button>
              ))}
            </div>
          </div>

          {/* Radius */}
          <div className="col-span-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Map Radius</label>
              <span className="text-[11px] font-mono text-[#00d4ff]">
                {region.id === 'global' ? '— Global —' : `${radiusKm} km`}
              </span>
            </div>
            <Slider
              className="mt-3"
              min={50} max={5000} step={50}
              value={[radiusKm]}
              onValueChange={(v) => setRadiusKm(v[0])}
              disabled={region.id === 'global'}
            />
          </div>
        </div>

        {/* Stats */}
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

        {/* Category filters */}
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

        {/* Main split: feed + weather + detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Feed */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                Live Feed · {envEvents.length} events
              </span>
              {(loadingQuakes || loadingEvents) && (
                <span className="text-[10px] font-mono text-[#00d4ff]">LOADING…</span>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {loadingEvents && envEvents.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#181c22' }}>
                      <Skeleton className="h-4 w-1/3 mb-2" /><Skeleton className="h-3 w-full" />
                    </div>
                  ))
                ) : envEvents.length === 0 ? (
                  <div className="text-center py-12 text-white/30 font-mono text-sm">
                    No events match the current filters
                  </div>
                ) : (
                  envEvents.map(event => (
                    <EventCard key={event.id} event={event} isSelected={selectedEvent?.id === event.id} onClick={() => setSelectedEvent(event)} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Weather panel (Open-Meteo) */}
          <div className="w-[340px] border-l flex-shrink-0 flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#111318' }}>
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Open-Meteo · {region.label}</span>
              {loadingWeather && <span className="text-[10px] font-mono text-[#00d4ff]">…</span>}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {region.id === 'global' ? (
                  <div className="text-center py-8 text-white/40 font-mono text-xs">
                    Select a specific region to view live weather data.
                  </div>
                ) : !weather ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Current */}
                    <div className="rounded-lg border p-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Current</div>
                      <div className="flex items-end gap-3">
                        <div className="text-4xl font-bold text-white">{weather.current.temperature_2m.toFixed(0)}°</div>
                        <div className="pb-1 text-xs text-white/60">
                          {WMO[weather.current.weather_code] || `WMO ${weather.current.weather_code}`}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5 text-white/60"><Thermometer className="w-3.5 h-3.5" />Feels {weather.current.apparent_temperature.toFixed(0)}°</div>
                        <div className="flex items-center gap-1.5 text-white/60"><Droplets className="w-3.5 h-3.5" />{weather.current.relative_humidity_2m.toFixed(0)}%</div>
                        <div className="flex items-center gap-1.5 text-white/60"><Wind className="w-3.5 h-3.5" />{weather.current.wind_speed_10m.toFixed(0)} km/h</div>
                        <div className="flex items-center gap-1.5 text-white/60"><Gauge className="w-3.5 h-3.5" />{weather.current.pressure_msl.toFixed(0)} hPa</div>
                        <div className="flex items-center gap-1.5 text-white/60"><Sun className="w-3.5 h-3.5" />Gust {weather.current.wind_gusts_10m.toFixed(0)}</div>
                        <div className="flex items-center gap-1.5 text-white/60"><Droplets className="w-3.5 h-3.5" />{weather.current.precipitation.toFixed(1)} mm</div>
                      </div>
                    </div>

                    {/* Alerts derived from forecast */}
                    <div>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Alerts (next 48h)</div>
                      {alerts.length === 0 ? (
                        <div className="text-[11px] font-mono text-white/40 px-2 py-3 rounded border border-dashed border-white/10">
                          No severe weather signals detected
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {alerts.map((a, i) => (
                            <div key={i} className="rounded border p-2"
                                 style={{ borderColor: SEV[a.level] + '55', background: SEV[a.level] + '11' }}>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5" style={{ color: SEV[a.level] }} />
                                <span className="text-[11px] font-mono uppercase" style={{ color: SEV[a.level] }}>{a.level}</span>
                                <span className="text-[11px] text-white ml-auto">{new Date(a.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })}</span>
                              </div>
                              <div className="text-[12px] text-white mt-1">{a.label}</div>
                              <div className="text-[11px] text-white/55">{a.detail}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Hourly */}
                    <div>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Next 24 hours</div>
                      <div className="rounded-lg border overflow-hidden" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
                        {weather.hourly.time.slice(0, 24).map((t, i) => {
                          const temp = weather.hourly.temperature_2m[i];
                          const pr = weather.hourly.precipitation[i];
                          const wind = weather.hourly.wind_speed_10m[i];
                          const code = weather.hourly.weather_code[i];
                          return (
                            <div key={t} className="flex items-center gap-3 px-3 py-1.5 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                              <span className="text-[11px] font-mono text-white/50 w-12">
                                {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[12px] text-white w-10 font-mono">{temp.toFixed(0)}°</span>
                              <span className="text-[11px] text-white/60 flex-1 truncate">{WMO[code] || `WMO ${code}`}</span>
                              <span className="text-[11px] font-mono text-[#14b8a6] w-12 text-right">{pr.toFixed(1)}mm</span>
                              <span className="text-[11px] font-mono text-[#3b82f6] w-14 text-right">{wind.toFixed(0)}km/h</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Detail */}
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