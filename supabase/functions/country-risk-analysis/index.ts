import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 5,
  elevated: 2,
  low: 1,
};
const CRED_WEIGHT: Record<string, number> = { high: 1.2, medium: 1.0, low: 0.7 };

function bandFor(score: number) {
  if (score >= 60) return "EXTREME";
  if (score >= 30) return "HIGH";
  if (score >= 12) return "ELEVATED";
  if (score > 0) return "LOW";
  return "QUIET";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(url, key);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === anonKey) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (token !== key) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser(token);
      if (!data?.user) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "list";
    const now = Date.now();
    const SEVEN_D = 7 * 24 * 3600 * 1000;

    // Pull last 14 days once (covers current 7d + prior 7d for trend)
    const since = new Date(now - 2 * SEVEN_D).toISOString();
    const { data: rows, error } = await supabase
      .from("news_items")
      .select(
        "id,title,summary,country,category,sub_category,threat_level,source,source_credibility,confidence_score,published_at,url"
      )
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    if (mode === "briefing") {
      const country: string | undefined = body.country;
      if (!country) {
        return new Response(JSON.stringify({ error: "country required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const events = (rows ?? [])
        .filter((r: any) => r.country === country && new Date(r.published_at).getTime() > now - SEVEN_D)
        .slice(0, 25);

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

      const eventLines = events
        .map((e: any, i: number) => `${i + 1}. [${e.threat_level?.toUpperCase()}] ${e.category}/${e.sub_category ?? "-"} — ${e.title} (${new Date(e.published_at).toISOString().slice(0, 10)}, src: ${e.source})`)
        .join("\n");

      const prompt = `You are a senior intelligence analyst. Produce a concise 7-day country risk briefing for ${country}.

Events (most recent first):
${eventLines || "No events in window."}

Output strict markdown sections (no preamble):
## Bottom Line
(2-3 sentence assessment of overall risk posture and direction)

## Key Drivers
(3-5 bullets, each tying specific events to a driver: armed conflict, civil unrest, terrorism, governance, cyber, economic, etc.)

## Outlook (next 14 days)
(2-4 sentences forecasting likely trajectory; flag escalation triggers)

## Recommended Posture
(3 bullets: travel, personnel, operations)

Be specific. Avoid hedging filler. No emojis.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!aiResp.ok) {
        const t = await aiResp.text();
        return new Response(JSON.stringify({ error: "AI gateway", status: aiResp.status, detail: t }), {
          status: aiResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ai = await aiResp.json();
      const briefing = ai.choices?.[0]?.message?.content ?? "";
      return new Response(JSON.stringify({ country, briefing, event_count: events.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== list mode: weighted analytics per country =====
    type Bucket = {
      country: string;
      score: number;
      prior_score: number;
      total: number;
      prior_total: number;
      severities: { critical: number; high: number; elevated: number; low: number };
      categories: Record<string, number>;
      sources: Set<string>;
      avg_confidence: number;
      _conf_sum: number;
      daily: number[]; // 7 buckets, oldest..newest
      latest_at: string;
      top_events: { id: string; title: string; threat_level: string; published_at: string; url: string }[];
    };
    const map = new Map<string, Bucket>();

    for (const r of rows ?? []) {
      const country = (r as any).country;
      if (!country) continue;
      const ts = new Date((r as any).published_at).getTime();
      const ageMs = now - ts;
      const inCurrent = ageMs <= SEVEN_D;
      const inPrior = ageMs > SEVEN_D && ageMs <= 2 * SEVEN_D;
      if (!inCurrent && !inPrior) continue;

      const sev = (r as any).threat_level ?? "low";
      const sevW = SEVERITY_WEIGHT[sev] ?? 1;
      const credW = CRED_WEIGHT[(r as any).source_credibility ?? "medium"] ?? 1;
      const conf = Number((r as any).confidence_score ?? 0.5);
      // Recency decay over 7 days: linear from 1.0 (now) to 0.4 (7d ago)
      const recencyW = inCurrent ? 1.0 - 0.6 * (ageMs / SEVEN_D) : 1.0;
      const contribution = sevW * credW * (0.5 + conf) * recencyW;

      let b = map.get(country);
      if (!b) {
        b = {
          country,
          score: 0,
          prior_score: 0,
          total: 0,
          prior_total: 0,
          severities: { critical: 0, high: 0, elevated: 0, low: 0 },
          categories: {},
          sources: new Set(),
          avg_confidence: 0,
          _conf_sum: 0,
          daily: [0, 0, 0, 0, 0, 0, 0],
          latest_at: (r as any).published_at,
          top_events: [],
        };
        map.set(country, b);
      }

      if (inCurrent) {
        b.score += contribution;
        b.total += 1;
        if (sev in b.severities) (b.severities as any)[sev] += 1;
        const cat = (r as any).category ?? "other";
        b.categories[cat] = (b.categories[cat] ?? 0) + 1;
        b.sources.add((r as any).source);
        b._conf_sum += conf;
        const dayIdx = Math.min(6, Math.max(0, 6 - Math.floor(ageMs / (24 * 3600 * 1000))));
        b.daily[dayIdx] += 1;
        if ((r as any).published_at > b.latest_at) b.latest_at = (r as any).published_at;
        if (b.top_events.length < 5 && (sev === "critical" || sev === "high")) {
          b.top_events.push({
            id: (r as any).id,
            title: (r as any).title,
            threat_level: sev,
            published_at: (r as any).published_at,
            url: (r as any).url,
          });
        }
      } else {
        b.prior_score += contribution;
        b.prior_total += 1;
      }
    }

    const countries = Array.from(map.values())
      .filter((b) => b.total > 0)
      .map((b) => {
        const score = Math.round(b.score * 10) / 10;
        const prior = Math.round(b.prior_score * 10) / 10;
        const delta_pct = prior > 0 ? Math.round(((score - prior) / prior) * 100) : score > 0 ? 100 : 0;
        const momentum: "escalating" | "stable" | "de-escalating" =
          delta_pct >= 25 ? "escalating" : delta_pct <= -25 ? "de-escalating" : "stable";
        return {
          country: b.country,
          score,
          prior_score: prior,
          delta_pct,
          momentum,
          band: bandFor(score),
          total: b.total,
          prior_total: b.prior_total,
          severities: b.severities,
          categories: b.categories,
          source_diversity: b.sources.size,
          avg_confidence: b.total ? Math.round((b._conf_sum / b.total) * 100) / 100 : 0,
          daily: b.daily,
          latest_at: b.latest_at,
          top_events: b.top_events,
        };
      })
      .sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({ generated_at: new Date().toISOString(), countries }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("country-risk-analysis error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});