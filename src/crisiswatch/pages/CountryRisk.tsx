import { useEffect, useMemo, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import {
  ShieldAlert, TrendingUp, TrendingDown, Minus, Globe2, Activity,
  Sparkles, Loader2, ExternalLink, X, ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type CountryRow = {
  country: string;
  score: number;
  prior_score: number;
  delta_pct: number;
  momentum: 'escalating' | 'stable' | 'de-escalating';
  band: 'EXTREME' | 'HIGH' | 'ELEVATED' | 'LOW' | 'QUIET';
  total: number;
  prior_total: number;
  severities: { critical: number; high: number; elevated: number; low: number };
  categories: Record<string, number>;
  source_diversity: number;
  avg_confidence: number;
  daily: number[];
  latest_at: string;
  top_events: { id: string; title: string; threat_level: string; published_at: string; url: string }[];
};

const BAND_COLOR: Record<CountryRow['band'], string> = {
  EXTREME: '#ff3860',
  HIGH: '#ff9f43',
  ELEVATED: '#ffd43b',
  LOW: '#2ed573',
  QUIET: '#6b7280',
};

type SortKey = 'score' | 'delta_pct' | 'total' | 'avg_confidence' | 'source_diversity';

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const w = 80, h = 22;
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * h} r={1.5} fill={color} />
      ))}
    </svg>
  );
}

function MomentumIcon({ m }: { m: CountryRow['momentum'] }) {
  if (m === 'escalating') return <TrendingUp className="w-3.5 h-3.5 text-red-400" />;
  if (m === 'de-escalating') return <TrendingDown className="w-3.5 h-3.5 text-green-400" />;
  return <Minus className="w-3.5 h-3.5 text-white/40" />;
}

function renderBriefing(md: string) {
  // minimal markdown: ## headers + bullets
  const blocks = md.split(/\n(?=## )/g);
  return blocks.map((blk, i) => {
    const m = blk.match(/^## (.+)\n?([\s\S]*)$/);
    const heading = m ? m[1] : null;
    const body = m ? m[2] : blk;
    const lines = body.split('\n').filter(l => l.trim());
    const isList = lines.every(l => /^[-*]\s+/.test(l)) && lines.length > 0;
    return (
      <div key={i} className="mb-4">
        {heading && (
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#00d4ff] mb-1.5">{heading}</div>
        )}
        {isList ? (
          <ul className="space-y-1 text-sm text-white/80">
            {lines.map((l, j) => (
              <li key={j} className="flex gap-2"><span className="text-white/30">›</span><span>{l.replace(/^[-*]\s+/, '')}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{body.trim()}</p>
        )}
      </div>
    );
  });
}

export default function CountryRisk() {
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('score');
  const [selected, setSelected] = useState<CountryRow | null>(null);
  const [briefing, setBriefing] = useState<string>('');
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke('country-risk-analysis', { body: { mode: 'list' } });
    if (!error && data?.countries) setRows(data.countries);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  }, [rows, sort]);

  const totals = useMemo(() => ({
    countries: rows.length,
    events: rows.reduce((s, r) => s + r.total, 0),
    critical: rows.reduce((s, r) => s + r.severities.critical, 0),
    escalating: rows.filter(r => r.momentum === 'escalating').length,
  }), [rows]);

  const openBriefing = async (country: string) => {
    setBriefingFor(country);
    setBriefing('');
    setBriefingLoading(true);
    const { data, error } = await supabase.functions.invoke('country-risk-analysis', {
      body: { mode: 'briefing', country },
    });
    setBriefingLoading(false);
    if (error) { setBriefing('Failed to generate briefing.'); return; }
    setBriefing(data?.briefing ?? '');
  };

  return (
    <CrisisLayout>
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#00d4ff]" />
            <h1 className="text-xl font-bold text-white">Country Risk Analytics</h1>
          </div>
        </div>
        <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-6">
          7-day weighted score · severity × source credibility × confidence × recency
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Stat icon={<Globe2 className="w-4 h-4" />} label="Countries" value={totals.countries} />
          <Stat icon={<Activity className="w-4 h-4" />} label="Events (7d)" value={totals.events} />
          <Stat icon={<ShieldAlert className="w-4 h-4 text-red-400" />} label="Critical" value={totals.critical} />
          <Stat icon={<TrendingUp className="w-4 h-4 text-orange-400" />} label="Escalating" value={totals.escalating} />
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase font-mono text-white/40 tracking-widest" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <th className="text-left px-4 py-2.5">Country</th>
                <th className="text-left px-4 py-2.5">Band</th>
                <SortableTh label="Score" k="score" sort={sort} setSort={setSort} />
                <SortableTh label="Δ 7d" k="delta_pct" sort={sort} setSort={setSort} />
                <th className="text-left px-4 py-2.5">Trend</th>
                <SortableTh label="Events" k="total" sort={sort} setSort={setSort} />
                <th className="text-left px-4 py-2.5">Severity Mix</th>
                <SortableTh label="Confidence" k="avg_confidence" sort={sort} setSort={setSort} />
                <SortableTh label="Sources" k="source_diversity" sort={sort} setSort={setSort} />
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-white/40 text-xs">Computing analytics…</td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-white/40 text-xs">No intel in the last 7 days.</td></tr>
              )}
              {sorted.map((r) => {
                const color = BAND_COLOR[r.band];
                const total = r.severities.critical + r.severities.high + r.severities.elevated + r.severities.low || 1;
                return (
                  <tr
                    key={r.country}
                    className="border-t cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-3 text-white font-medium">{r.country}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: `${color}22`, color }}>
                        {r.band}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">{r.score.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                        <MomentumIcon m={r.momentum} />
                        <span className={r.delta_pct > 0 ? 'text-red-400' : r.delta_pct < 0 ? 'text-green-400' : 'text-white/40'}>
                          {r.delta_pct > 0 ? '+' : ''}{r.delta_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Sparkline data={r.daily} color={color} /></td>
                    <td className="px-4 py-3 text-right font-mono text-white/70">{r.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex h-1.5 w-32 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{ width: `${(r.severities.critical / total) * 100}%`, background: '#ff3860' }} />
                        <div style={{ width: `${(r.severities.high / total) * 100}%`, background: '#ff9f43' }} />
                        <div style={{ width: `${(r.severities.elevated / total) * 100}%`, background: '#ffd43b' }} />
                        <div style={{ width: `${(r.severities.low / total) * 100}%`, background: '#2ed573' }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/60">{(r.avg_confidence * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right font-mono text-white/60">{r.source_diversity}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] font-mono uppercase tracking-widest text-[#00d4ff] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10"
                        onClick={(e) => { e.stopPropagation(); setSelected(r); openBriefing(r.country); }}
                      >
                        <Sparkles className="w-3 h-3 mr-1" /> Brief
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" onClick={() => { setSelected(null); setBriefingFor(null); setBriefing(''); }}>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" />
          <div
            className="w-[560px] h-full overflow-y-auto border-l"
            style={{ background: '#0d1015', borderColor: 'rgba(255,255,255,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b" style={{ background: '#0d1015', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Country Brief</div>
                <h2 className="text-lg font-bold text-white">{selected.country}</h2>
              </div>
              <button onClick={() => { setSelected(null); setBriefingFor(null); setBriefing(''); }} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Score" value={selected.score.toFixed(1)} color={BAND_COLOR[selected.band]} />
                <MiniStat label="Δ vs prior 7d" value={`${selected.delta_pct > 0 ? '+' : ''}${selected.delta_pct}%`} color={selected.delta_pct > 0 ? '#ff3860' : selected.delta_pct < 0 ? '#2ed573' : '#9ca3af'} />
                <MiniStat label="Confidence" value={`${(selected.avg_confidence * 100).toFixed(0)}%`} color="#00d4ff" />
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">Category breakdown</div>
                <div className="space-y-1.5">
                  {Object.entries(selected.categories).sort((a, b) => b[1] - a[1]).map(([cat, n]) => {
                    const pct = (n / selected.total) * 100;
                    return (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <div className="w-24 text-white/60 capitalize">{cat}</div>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ width: `${pct}%`, background: '#00d4ff' }} className="h-full" />
                        </div>
                        <div className="w-8 text-right font-mono text-white/60">{n}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.top_events.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">Top driving events</div>
                  <div className="space-y-2">
                    {selected.top_events.map((e) => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer"
                         className="block p-3 rounded border hover:border-[#00d4ff]/40 transition-colors"
                         style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-white/90 leading-snug">{e.title}</div>
                          <ExternalLink className="w-3 h-3 text-white/30 flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-white/40">
                          <span style={{ color: e.threat_level === 'critical' ? '#ff3860' : '#ff9f43' }}>{e.threat_level.toUpperCase()}</span>
                          <span>·</span>
                          <span>{new Date(e.published_at).toLocaleString()}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Analyst Briefing</div>
                  {!briefingFor && (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] font-mono uppercase tracking-widest text-[#00d4ff] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10" onClick={() => openBriefing(selected.country)}>
                      <Sparkles className="w-3 h-3 mr-1" /> Generate
                    </Button>
                  )}
                </div>
                {briefingLoading && (
                  <div className="flex items-center gap-2 text-xs text-white/40 py-4">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating briefing…
                  </div>
                )}
                {!briefingLoading && briefing && (
                  <div className="rounded border p-4" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
                    {renderBriefing(briefing)}
                  </div>
                )}
                {!briefingFor && !briefingLoading && (
                  <div className="text-xs text-white/40">Run an AI-generated 7-day country briefing for {selected.country}.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </CrisisLayout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-mono tracking-widest">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold font-mono text-white mt-1">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border p-3" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="text-[9px] font-mono uppercase tracking-widest text-white/40">{label}</div>
      <div className="text-lg font-bold font-mono mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function SortableTh({ label, k, sort, setSort }: { label: string; k: SortKey; sort: SortKey; setSort: (k: SortKey) => void }) {
  const active = sort === k;
  return (
    <th className="px-4 py-2.5 text-right">
      <button
        onClick={() => setSort(k)}
        className={`inline-flex items-center gap-1 ${active ? 'text-[#00d4ff]' : 'text-white/40 hover:text-white/70'}`}
      >
        {label} <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );
}