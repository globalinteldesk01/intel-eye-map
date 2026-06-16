import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

type PipelineStatus = "healthy" | "stale" | "down";

interface PipelineReport {
  name: string;
  label: string;
  status: PipelineStatus;
  last_insert_at: string | null;
  minutes_since_last: number | null;
  inserts_last_hour: number;
  inserts_last_24h: number;
  notes?: string;
}

// thresholds (minutes) per pipeline before we degrade health
const RULES: Record<string, { stale: number; down: number; label: string; sources: string[] | null }> = {
  "fetch-news": { stale: 15, down: 60, label: "News Ingestion", sources: null }, // anything not in priority list
  "fetch-priority-intel": {
    stale: 30,
    down: 180,
    label: "Priority Intel (USGS / GDACS / EONET / NOAA)",
    sources: ["USGS Earthquake Hazards", "GDACS/UNOCHA", "NASA EONET", "NOAA / NWS"],
  },
  "enrich-intel": { stale: 30, down: 180, label: "AI Enrichment", sources: null }, // uses enriched_at column instead
};

function classify(minutes: number | null, stale: number, down: number, hasAny: boolean): PipelineStatus {
  if (minutes === null) return hasAny ? "stale" : "down";
  if (minutes <= stale) return "healthy";
  if (minutes <= down) return "stale";
  return "down";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // auth: any authenticated user may read pipeline health
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (token !== SERVICE) {
      const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser(token);
      if (!data?.user) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    const admin = createClient(URL, SERVICE);
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const priorityList = RULES["fetch-priority-intel"].sources!;
    const reports: PipelineReport[] = [];

    // ---- fetch-priority-intel (rows from priority sources) ----
    {
      const cfg = RULES["fetch-priority-intel"];
      const { data: last } = await admin
        .from("news_items")
        .select("created_at")
        .in("source", cfg.sources!)
        .order("created_at", { ascending: false })
        .limit(1);
      const { count: h } = await admin
        .from("news_items")
        .select("*", { count: "exact", head: true })
        .in("source", cfg.sources!)
        .gte("created_at", hourAgo);
      const { count: d } = await admin
        .from("news_items")
        .select("*", { count: "exact", head: true })
        .in("source", cfg.sources!)
        .gte("created_at", dayAgo);
      const last_at = last?.[0]?.created_at ?? null;
      const mins = last_at ? Math.floor((now - new Date(last_at).getTime()) / 60000) : null;
      reports.push({
        name: "fetch-priority-intel",
        label: cfg.label,
        status: classify(mins, cfg.stale, cfg.down, (d ?? 0) > 0),
        last_insert_at: last_at,
        minutes_since_last: mins,
        inserts_last_hour: h ?? 0,
        inserts_last_24h: d ?? 0,
      });
    }

    // ---- fetch-news (everything not in the priority list) ----
    {
      const cfg = RULES["fetch-news"];
      const notPriority = `(${priorityList.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")})`;
      const { data: last } = await admin
        .from("news_items")
        .select("created_at")
        .not("source", "in", notPriority)
        .order("created_at", { ascending: false })
        .limit(1);
      const { count: h } = await admin
        .from("news_items")
        .select("*", { count: "exact", head: true })
        .not("source", "in", notPriority)
        .gte("created_at", hourAgo);
      const { count: d } = await admin
        .from("news_items")
        .select("*", { count: "exact", head: true })
        .not("source", "in", notPriority)
        .gte("created_at", dayAgo);
      const last_at = last?.[0]?.created_at ?? null;
      const mins = last_at ? Math.floor((now - new Date(last_at).getTime()) / 60000) : null;
      reports.push({
        name: "fetch-news",
        label: cfg.label,
        status: classify(mins, cfg.stale, cfg.down, (d ?? 0) > 0),
        last_insert_at: last_at,
        minutes_since_last: mins,
        inserts_last_hour: h ?? 0,
        inserts_last_24h: d ?? 0,
      });
    }

    // ---- enrich-intel (rows enriched recently) ----
    {
      const cfg = RULES["enrich-intel"];
      const { data: last } = await admin
        .from("news_items")
        .select("enriched_at")
        .not("enriched_at", "is", null)
        .order("enriched_at", { ascending: false })
        .limit(1);
      const { count: h } = await admin
        .from("news_items")
        .select("*", { count: "exact", head: true })
        .gte("enriched_at", hourAgo);
      const { count: d } = await admin
        .from("news_items")
        .select("*", { count: "exact", head: true })
        .gte("enriched_at", dayAgo);
      const last_at = last?.[0]?.enriched_at ?? null;
      const mins = last_at ? Math.floor((now - new Date(last_at).getTime()) / 60000) : null;
      reports.push({
        name: "enrich-intel",
        label: cfg.label,
        status: classify(mins, cfg.stale, cfg.down, (d ?? 0) > 0),
        last_insert_at: last_at,
        minutes_since_last: mins,
        inserts_last_hour: h ?? 0,
        inserts_last_24h: d ?? 0,
      });
    }

    const worst: PipelineStatus = reports.some((r) => r.status === "down")
      ? "down"
      : reports.some((r) => r.status === "stale")
        ? "stale"
        : "healthy";

    return new Response(JSON.stringify({
      status: worst,
      checked_at: new Date().toISOString(),
      pipelines: reports,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});