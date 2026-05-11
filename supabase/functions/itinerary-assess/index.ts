import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASSESSMENT_SYSTEM = `You are an elite geopolitical intelligence analyst producing travel risk briefings for a corporate security firm (Global Intel Desk). You will be given a traveler's itinerary plus recent verified OSINT for the destination country. Produce a realistic, balanced, actionable risk assessment.

Respond with ONLY a valid JSON object (no markdown, no code fences) in this exact shape:
{
  "overall_level": "LOW|MODERATE|HIGH|CRITICAL",
  "overall_score": 0-100,
  "scores": [
    {"category":"Political Stability","score":0-100,"level":"LOW|MODERATE|HIGH|CRITICAL","summary":"1-2 sentence briefing"},
    {"category":"Crime & Security","score":0-100,"level":"LOW|MODERATE|HIGH|CRITICAL","summary":"..."},
    {"category":"Health & Medical","score":0-100,"level":"LOW|MODERATE|HIGH|CRITICAL","summary":"..."},
    {"category":"Natural Hazards","score":0-100,"level":"LOW|MODERATE|HIGH|CRITICAL","summary":"..."},
    {"category":"Infrastructure & Travel","score":0-100,"level":"LOW|MODERATE|HIGH|CRITICAL","summary":"..."}
  ],
  "recommendations": ["actionable recommendation 1", "..."],
  "emergency_contacts": ["Local emergency services: 112", "Nearest embassy/consulate note", "Medical evacuation contact"]
}

Higher score = higher risk. Be specific to destination, city and travel purpose. Provide 5-7 recommendations.`;

const ALERTS_SYSTEM = `You are an intelligence operations officer generating realistic real-time threat alerts for a traveler's itinerary, grounded in the recent OSINT context provided. Produce 4-6 alerts.

Respond with ONLY a valid JSON array (no markdown):
[ {"severity":"LOW|MODERATE|HIGH|CRITICAL","category":"Political|Crime|Health|Weather|Transport|Cyber","headline":"short headline","detail":"1-2 sentence detail"} ]

Mix severities realistically. Reference the OSINT context where relevant.`;

function stripFences(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  return t;
}

async function callAI(lovableKey: string, system: string, user: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("AI gateway error", res.status, txt);
    throw new Response(JSON.stringify({ error: res.status === 429 ? "Rate limited" : res.status === 402 ? "AI credits exhausted" : "AI request failed" }), { status: res.status === 429 || res.status === 402 ? res.status : 502 });
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace("Bearer ", "").trim();
    if (!jwt) return jsonResp({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return jsonResp({ error: "unauthorized" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const itineraryId: string | undefined = body.itinerary_id;
    const mode: "all" | "alerts" = body.mode === "alerts" ? "alerts" : "all";
    if (!itineraryId) return jsonResp({ error: "itinerary_id required" }, 400);

    const { data: itin, error: ie } = await admin
      .from("travel_itineraries")
      .select("*")
      .eq("id", itineraryId)
      .single();
    if (ie || !itin) return jsonResp({ error: "itinerary not found" }, 404);
    if (itin.user_id !== userId) return jsonResp({ error: "forbidden" }, 403);

    // Pull last 7d OSINT for the destination country to ground the model
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    let osint: any[] = [];
    if (itin.destination_country) {
      const { data } = await admin
        .from("news_items")
        .select("title,threat_level,category,published_at,source,country")
        .ilike("country", itin.destination_country)
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(80);
      osint = data ?? [];
    }
    const osintBlock = osint.length
      ? osint.map((r) => `- [${(r.threat_level || "low").toUpperCase()}] ${r.category} · ${r.title} (${r.source})`).join("\n")
      : "(no recent OSINT for destination country)";

    const ctx = `Traveler: ${itin.traveler_name}\nDestination: ${itin.destination_city ?? "?"}, ${itin.destination_country ?? "?"}\nPurpose: ${itin.purpose}\nDates: ${itin.start_date} → ${itin.end_date}\nNotes: ${itin.notes || "none"}\n\nRECENT OSINT (last 7d, sample):\n${osintBlock}`;

    const updates: Record<string, unknown> = {};

    if (mode === "all") {
      const aRaw = await callAI(lovableKey, ASSESSMENT_SYSTEM, ctx + "\n\nProduce the JSON risk assessment now.");
      let assessment: any = {};
      try { assessment = JSON.parse(stripFences(aRaw)); } catch { assessment = { raw: aRaw }; }
      assessment.generated_at = new Date().toISOString();
      updates.assessment = assessment;
    }

    const lRaw = await callAI(lovableKey, ALERTS_SYSTEM, ctx + "\n\nReturn JSON object with key 'alerts' as array.");
    let parsedAlerts: any[] = [];
    try {
      const p = JSON.parse(stripFences(lRaw));
      parsedAlerts = Array.isArray(p) ? p : (p.alerts ?? []);
    } catch { parsedAlerts = []; }
    const now = Date.now();
    const alerts = parsedAlerts.slice(0, 8).map((a, i) => ({
      id: crypto.randomUUID(),
      severity: a.severity ?? "LOW",
      category: a.category ?? "General",
      headline: a.headline ?? "",
      detail: a.detail ?? "",
      timestamp: new Date(now - i * 27 * 60_000).toISOString(),
    }));
    updates.alerts = alerts;

    const { data: updated, error: ue } = await admin
      .from("travel_itineraries")
      .update(updates)
      .eq("id", itineraryId)
      .select()
      .single();
    if (ue) throw ue;

    return jsonResp({ ok: true, itinerary: updated });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("itinerary-assess error", e);
    return jsonResp({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});