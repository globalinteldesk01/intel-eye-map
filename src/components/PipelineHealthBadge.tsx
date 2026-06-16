import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PipelineStatus = "healthy" | "stale" | "down";

interface PipelineReport {
  name: string;
  label: string;
  status: PipelineStatus;
  last_insert_at: string | null;
  minutes_since_last: number | null;
  inserts_last_hour: number;
  inserts_last_24h: number;
}

interface HealthResponse {
  status: PipelineStatus;
  checked_at: string;
  pipelines: PipelineReport[];
}

const POLL_MS = 60_000;

const statusStyles: Record<PipelineStatus, { dot: string; label: string; text: string }> = {
  healthy: { dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]", label: "Operational", text: "text-emerald-400" },
  stale: { dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]", label: "Degraded", text: "text-amber-400" },
  down: { dot: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse", label: "Offline", text: "text-red-400" },
};

function formatSince(mins: number | null) {
  if (mins === null) return "no data";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PipelineHealthBadge() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pipeline-health`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const json: HealthResponse = await res.json();
        if (!cancelled) setData(json);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const overall = data?.status ?? (loading ? "stale" : "down");
  const s = statusStyles[overall];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/60 hover:border-border bg-background/40 hover:bg-background/70 transition"
          aria-label="Pipeline health"
        >
          <span className={cn("w-2 h-2 rounded-full", s.dot)} />
          <span className="hidden sm:inline text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Pipelines
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 bg-popover border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-wide uppercase font-mono">
              Pipeline Status
            </span>
          </div>
          <span className={cn("text-[10px] font-mono uppercase tracking-wider", s.text)}>
            {s.label}
          </span>
        </div>
        <div className="divide-y divide-border">
          {(data?.pipelines ?? []).map((p) => {
            const ps = statusStyles[p.status];
            return (
              <div key={p.name} className="px-4 py-3 flex items-start gap-3">
                <span className={cn("w-2 h-2 mt-1.5 rounded-full shrink-0", ps.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{p.label}</span>
                    <span className={cn("text-[10px] font-mono uppercase tracking-wider", ps.text)}>
                      {ps.label}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] font-mono text-muted-foreground">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider opacity-60">Last</div>
                      <div className="text-foreground/80">{formatSince(p.minutes_since_last)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider opacity-60">1h</div>
                      <div className="text-foreground/80">{p.inserts_last_hour}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider opacity-60">24h</div>
                      <div className="text-foreground/80">{p.inserts_last_24h}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!data && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground font-mono">
              {loading ? "Checking pipelines…" : "Health check unavailable"}
            </div>
          )}
        </div>
        {data?.checked_at && (
          <div className="px-4 py-2 border-t border-border text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
            Updated {new Date(data.checked_at).toLocaleTimeString()}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}