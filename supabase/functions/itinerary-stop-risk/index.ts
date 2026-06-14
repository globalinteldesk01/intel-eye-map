import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEVERITY_WEIGHT: Record<string, number> = { critical: 10, high: 5, elevated: 2, low: 1 };
const CRED_WEIGHT: Record<string, number> = { high: 1.2, medium: 1.0, low: 0.7 };

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bandFor(score: number): "EXTREME" | "HIGH" | "ELEVATED" | "LOW" | "QUIET" {
  if (score >= 60) return "EXTREME";
  if (score >= 30) return "HIGH";
  if (score >= 12) return "ELEVATED";
  if (score > 0) return "LOW";
  return "QUIET";
}

function levelFor(score: number): "high" | "medium" | "safe" {
  if (score >= 30) return "high";
  if (score >= 8) return "medium";
  return "safe";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(url, key);

    // ── Auth: require service-role or signed-in user ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === anonKey) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (token !== key) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser(token);
      if (!data?.user) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const lat: number = body.lat;
    const lon: number = body.lon;
    const radiusKm: number = body.radius_km ?? 25;
    let country: string | undefined = body.country;

    if (typeof lat !== "number" || typeof lon !== "number") {
      return new Response(JSON.stringify({ error: "lat and lon required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reverse geocode if country missing (server-side, no rate-limit issues from browser)
    if (!country) {
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=5`,
          { headers: { "Accept-Language": "en", "User-Agent": "GlobalIntelDesk/1.0" } }
        );
        const gj = await geo.json();
        country = gj?.address?.country;
      } catch (_) {
        country = undefined;
      }
    }

    const now = Date.now();
    const SEVEN_D = 7 * 24 * 3600 * 1000;
    const since = new Date(now - SEVEN_D).toISOString();

    // Pull last 7d intel for the country (or worldwide if unknown)
    let q = supabase
      .from("news_items")
      .select("id,title,country,city,category,sub_category,threat_level,source,source_credibility,confidence_score,published_at,url,lat,lon")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(2000);
    if (country) q = q.eq("country", country);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Country baseline = weighted score for entire country (last 7d)
    let baseline = 0;
    let baselineTotal = 0;
    const sevCount: Record<string, number> = { critical: 0, high: 0, elevated: 0, low: 0 };
    // Local = within radius
    let localScore = 0;
    const localEvents: any[] = [];

    for (const r of rows ?? []) {
      const sev = (r as any).threat_level ?? "low";
      const sevW = SEVERITY_WEIGHT[sev] ?? 1;
      const credW = CRED_WEIGHT[(r as any).source_credibility ?? "medium"] ?? 1;
      const conf = Number((r as any).confidence_score ?? 0.5);
      const ts = new Date((r as any).published_at).getTime();
      const ageMs = now - ts;
      const recencyW = 1.0 - 0.6 * Math.min(1, ageMs / SEVEN_D);
      const contribution = sevW * credW * (0.5 + conf) * recencyW;

      baseline += contribution;
      baselineTotal += 1;
      if (sev in sevCount) sevCount[sev] += 1;

      const rLat = Number((r as any).lat);
      const rLon = Number((r as any).lon);
      if (Number.isFinite(rLat) && Number.isFinite(rLon)) {
        const d = haversineKm(lat, lon, rLat, rLon);
        if (d <= radiusKm) {
          // Distance decay: 1.0 at 0km → 0.2 at radiusKm
          const distW = 1.0 - 0.8 * (d / radiusKm);
          const localContribution = contribution * (1 + distW); // local hits weighted heavier
          localScore += localContribution;
          if (localEvents.length < 8) {
            localEvents.push({
              id: (r as any).id,
              title: (r as any).title,
              threat_level: sev,
              category: (r as any).category,
              sub_category: (r as any).sub_category,
              source: (r as any).source,
              published_at: (r as any).published_at,
              url: (r as any).url,
              distance_km: Math.round(d * 10) / 10,
            });
          }
        }
      }
    }

    localEvents.sort((a, b) => a.distance_km - b.distance_km);

    const baselineScore = Math.round(baseline * 10) / 10;
    const localScoreRounded = Math.round(localScore * 10) / 10;
    // Final = 40% baseline + 60% local. If no local intel, fall back to baseline alone (scaled).
    const combinedRaw = localScoreRounded > 0
      ? 0.4 * baselineScore + 0.6 * localScoreRounded * 3 // amplify local because few events
      : baselineScore * 0.5;
    const combined = Math.round(combinedRaw * 10) / 10;

    const reasoning = [
      country
        ? `Country baseline (${country}, 7d): ${baselineScore} from ${baselineTotal} events (${sevCount.critical} critical, ${sevCount.high} high).`
        : `Country could not be resolved from coordinates; baseline omitted.`,
      localEvents.length > 0
        ? `Local intel within ${radiusKm}km: ${localEvents.length} events (closest ${localEvents[0]?.distance_km}km).`
        : `No verified intel within ${radiusKm}km in the last 7 days.`,
      `Composite risk score: ${combined} → ${bandFor(combined)} band.`,
    ].join(" ");

    return new Response(
      JSON.stringify({
        country,
        radius_km: radiusKm,
        baseline_score: baselineScore,
        baseline_total: baselineTotal,
        baseline_severities: sevCount,
        local_score: localScoreRounded,
        local_count: localEvents.length,
        local_events: localEvents,
        combined_score: combined,
        band: bandFor(combined),
        risk_level: levelFor(combined),
        reasoning,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("itinerary-stop-risk error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});