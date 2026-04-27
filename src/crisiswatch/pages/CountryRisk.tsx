import { useEffect, useState, useMemo } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, TrendingUp, Globe2 } from 'lucide-react';

type CountryScore = {
  country: string;
  total: number;
  critical: number;
  high: number;
  elevated: number;
  low: number;
  score: number;
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 5,
  elevated: 2,
  low: 1,
};

function bandFor(score: number) {
  if (score >= 50) return { label: 'EXTREME', color: '#ff3860' };
  if (score >= 25) return { label: 'HIGH', color: '#ff9f43' };
  if (score >= 10) return { label: 'ELEVATED', color: '#ffd43b' };
  return { label: 'LOW', color: '#2ed573' };
}

export default function CountryRisk() {
  const [rows, setRows] = useState<CountryScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('news_items')
        .select('country,threat_level')
        .gte('published_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .limit(1000);
      const map = new Map<string, CountryScore>();
      (data ?? []).forEach((r: any) => {
        if (!r.country) return;
        const c = map.get(r.country) ?? {
          country: r.country,
          total: 0,
          critical: 0,
          high: 0,
          elevated: 0,
          low: 0,
          score: 0,
        };
        c.total += 1;
        if (r.threat_level === 'critical') c.critical += 1;
        else if (r.threat_level === 'high') c.high += 1;
        else if (r.threat_level === 'elevated') c.elevated += 1;
        else c.low += 1;
        c.score += SEVERITY_WEIGHT[r.threat_level] ?? 1;
        map.set(r.country, c);
      });
      setRows(Array.from(map.values()).sort((a, b) => b.score - a.score));
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(
    () => ({
      countries: rows.length,
      critical: rows.reduce((s, r) => s + r.critical, 0),
      events: rows.reduce((s, r) => s + r.total, 0),
    }),
    [rows]
  );

  return (
    <CrisisLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-white">Country Risk</h1>
        </div>
        <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-6">
          7-day weighted threat score per country
        </p>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Stat icon={<Globe2 className="w-4 h-4" />} label="Countries" value={totals.countries} />
          <Stat icon={<TrendingUp className="w-4 h-4" />} label="Events (7d)" value={totals.events} />
          <Stat icon={<ShieldAlert className="w-4 h-4 text-red-400" />} label="Critical" value={totals.critical} />
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase font-mono text-white/40 tracking-widest" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <th className="text-left px-4 py-2.5">Country</th>
                <th className="text-left px-4 py-2.5">Risk Band</th>
                <th className="text-right px-4 py-2.5">Score</th>
                <th className="text-right px-4 py-2.5">Critical</th>
                <th className="text-right px-4 py-2.5">High</th>
                <th className="text-right px-4 py-2.5">Elevated</th>
                <th className="text-right px-4 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-white/40 text-xs">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-white/40 text-xs">No intel in the last 7 days.</td></tr>
              )}
              {rows.map((r) => {
                const b = bandFor(r.score);
                return (
                  <tr key={r.country} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <td className="px-4 py-3 text-white font-medium">{r.country}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: `${b.color}22`, color: b.color }}>
                        {b.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">{r.score}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">{r.critical}</td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">{r.high}</td>
                    <td className="px-4 py-3 text-right font-mono text-yellow-400">{r.elevated}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/60">{r.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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