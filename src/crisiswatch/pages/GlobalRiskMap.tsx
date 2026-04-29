import { useEffect, useMemo, useRef, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type RiskLevel = 'critical' | 'high' | 'elevated' | 'low' | 'none';

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: '#ff4757',
  high: '#ffa502',
  elevated: '#a855f7',
  low: '#2ed573',
  none: '#3a3f47',
};

const THREAT_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  elevated: 2,
  low: 1,
};

// Map common name variants in news_items.country -> GeoJSON ADMIN names
const NAME_ALIASES: Record<string, string> = {
  'USA': 'United States of America',
  'United States': 'United States of America',
  'US': 'United States of America',
  'UK': 'United Kingdom',
  'Russia': 'Russia',
  'South Korea': 'South Korea',
  'North Korea': 'North Korea',
  'Czech Republic': 'Czechia',
  'Ivory Coast': "Côte d'Ivoire",
  'DRC': 'Democratic Republic of the Congo',
  'DR Congo': 'Democratic Republic of the Congo',
  'Congo': 'Republic of the Congo',
  'Burma': 'Myanmar',
  'Vatican': 'Vatican',
  'Palestine': 'Palestine',
  'Syria': 'Syria',
  'Iran': 'Iran',
  'Vietnam': 'Vietnam',
  'Laos': 'Laos',
  'Tanzania': 'United Republic of Tanzania',
  'Brunei': 'Brunei',
  'Bolivia': 'Bolivia',
  'Venezuela': 'Venezuela',
  'Moldova': 'Moldova',
  'Macedonia': 'North Macedonia',
  'Eswatini': 'eSwatini',
  'Swaziland': 'eSwatini',
  'Cape Verde': 'Cabo Verde',
  'East Timor': 'Timor-Leste',
};

function classify(score: number, count: number): RiskLevel {
  if (count === 0) return 'none';
  const avg = score / count;
  if (avg >= 3.2 || score >= 25) return 'critical';
  if (avg >= 2.2 || score >= 12) return 'high';
  if (avg >= 1.4 || score >= 4) return 'elevated';
  return 'low';
}

function normalize(name: string) {
  return (NAME_ALIASES[name] || name).trim();
}

export default function GlobalRiskMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [risk, setRisk] = useState<Record<string, { score: number; count: number; level: RiskLevel }>>({});
  const [geo, setGeo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  // Fetch country risk aggregates from live news_items
  const refetchRisk = async () => {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString();
    const { data, error } = await supabase
      .from('news_items')
      .select('country, threat_level')
      .gte('published_at', since)
      .limit(5000);
    if (error || !data) return;
    const acc: Record<string, { score: number; count: number; level: RiskLevel }> = {};
    for (const row of data as any[]) {
      const country = normalize(row.country || '');
      if (!country) continue;
      const w = THREAT_WEIGHT[(row.threat_level || '').toLowerCase()] || 0;
      if (!acc[country]) acc[country] = { score: 0, count: 0, level: 'none' };
      acc[country].score += w;
      acc[country].count += 1;
    }
    Object.keys(acc).forEach(k => { acc[k].level = classify(acc[k].score, acc[k].count); });
    setRisk(acc);
    setUpdated(new Date());
  };

  // Load world GeoJSON once
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(g => { setGeo(g); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetchRisk();
    const channel = supabase
      .channel('global-risk-map-news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_items' }, () => { refetchRisk(); })
      .subscribe();
    const interval = setInterval(refetchRisk, 60_000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, worldCopyJump: true, minZoom: 2 }).setView([20, 10], 2);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'shadowPane',
    }).addTo(map);
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    requestAnimationFrame(() => map.invalidateSize());
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Render choropleth
  useEffect(() => {
    if (!mapRef.current || !geo) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

    const styleFor = (feature: any): L.PathOptions => {
      const name = feature?.properties?.ADMIN || feature?.properties?.NAME || '';
      const r = risk[name] || risk[normalize(name)];
      const level: RiskLevel = r?.level || 'none';
      return {
        fillColor: RISK_COLORS[level],
        color: 'rgba(255,255,255,0.15)',
        weight: 0.7,
        fillOpacity: level === 'none' ? 0.25 : 0.75,
      };
    };

    layerRef.current = L.geoJSON(geo, {
      style: styleFor,
      onEachFeature: (feature, layer) => {
        const name = feature?.properties?.ADMIN || feature?.properties?.NAME || 'Unknown';
        const r = risk[name] || risk[normalize(name)];
        const level: RiskLevel = r?.level || 'none';
        const count = r?.count || 0;
        const score = r?.score || 0;
        layer.bindTooltip(
          `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fff">
             <div style="font-weight:700;margin-bottom:2px">${name}</div>
             <div style="color:${RISK_COLORS[level]};text-transform:uppercase;letter-spacing:0.08em">${level}</div>
             <div style="color:#aaa;margin-top:2px">${count} events · score ${score}</div>
           </div>`,
          { sticky: true, direction: 'top', opacity: 0.95, className: 'risk-map-tooltip' }
        );
        layer.on({
          mouseover: (e) => { (e.target as L.Path).setStyle({ weight: 1.5, color: '#00d4ff', fillOpacity: 0.9 }); (e.target as L.Path).bringToFront(); },
          mouseout: (e) => { layerRef.current?.resetStyle(e.target as any); },
        });
      },
    }).addTo(mapRef.current);
  }, [geo, risk]);

  const totals = useMemo(() => {
    const t = { critical: 0, high: 0, elevated: 0, low: 0 };
    Object.values(risk).forEach(r => { if (r.level !== 'none') t[r.level] += 1; });
    return t;
  }, [risk]);

  return (
    <CrisisLayout>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 relative crisiswatch-map">
          <div ref={containerRef} className="absolute inset-0" />

          {/* Header overlay */}
          <div className="absolute top-3 left-3 z-[400] px-3 py-2 rounded border" style={{ background: 'rgba(17,19,24,0.92)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">CrisisWatch</div>
            <div className="text-sm font-semibold text-white">Global Risk Map</div>
            <div className="text-[10px] font-mono text-white/40 mt-0.5">
              {loading ? 'loading basemap…' : updated ? `updated ${updated.toLocaleTimeString()}` : 'awaiting data'}
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-3 z-[400] px-3 py-2.5 rounded border" style={{ background: 'rgba(17,19,24,0.92)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5">Risk level</div>
            {(['critical','high','elevated','low','none'] as RiskLevel[]).map(l => (
              <div key={l} className="flex items-center gap-2 text-[11px] font-mono text-white/70 py-0.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: RISK_COLORS[l] }} />
                <span className="capitalize w-16">{l}</span>
                {l !== 'none' && <span className="text-white/40">{totals[l]} countries</span>}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="absolute top-3 right-14 z-[400] px-3 py-2 rounded border flex items-center gap-4" style={{ background: 'rgba(17,19,24,0.92)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">72h window</div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span style={{ color: RISK_COLORS.critical }}>● {totals.critical}</span>
              <span style={{ color: RISK_COLORS.high }}>● {totals.high}</span>
              <span style={{ color: RISK_COLORS.elevated }}>● {totals.elevated}</span>
              <span style={{ color: RISK_COLORS.low }}>● {totals.low}</span>
            </div>
          </div>
        </div>
      </div>
    </CrisisLayout>
  );
}
