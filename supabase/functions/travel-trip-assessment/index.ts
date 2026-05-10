import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Phase = "destination" | "protocols" | "debrief" | "all";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: u, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const itineraryMapId: string | undefined = body.itinerary_map_id;
    const phase: Phase = body.phase ?? "all";
    const debriefNotes: string | undefined = body.debrief_notes;
    if (!itineraryMapId) return json({ error: "itinerary_map_id required" }, 400);

    // Load the map (RLS by user_id verified manually)
    const { data: map, error: mErr } = await admin
      .from("itinerary_maps")
      .select("id,user_id,name,city,features,notes")
      .eq("id", itineraryMapId)
      .single();
    if (mErr || !map) return json({ error: "map not found" }, 404);
    if (map.user_id !== userId) return json({ error: "forbidden" }, 403);

    // Extract markers (stops) from the GeoJSON FeatureCollection
    const features = (map.features as any)?.features ?? [];
    const stops = features
      .filter((f: any) => f?.geometry?.type === "Point")
      .map((f: any) => ({
        name: f.properties?.name ?? "Unnamed",
        category: f.properties?.category ?? "other",
        risk: f.properties?.risk ?? "medium",
        country: f.properties?.auto_country ?? null,
        score: f.properties?.auto_score ?? null,
        band: f.properties?.auto_band ?? null,
        baseline: f.properties?.auto_baseline ?? null,
        local_count: f.properties?.auto_local_count ?? 0,
        events: (f.properties?.auto_events ?? []).slice(0, 5),
        coords: f.geometry.coordinates, // [lon, lat]
      }));

    if (stops.length === 0) {
      return json({ error: "Itinerary has no pinned stops yet" }, 400);
    }

    // Pull last 7d intel for the countries on the route, used as additional grounding
    const countries = Array.from(new Set(stops.map((s: any) => s.country).filter(Boolean)));
    let intelLines = "";
    if (countries.length > 0) {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: intel } = await admin
        .from("news_items")
        .select("country,title,threat_level,category,published_at,source")
        .in("country", countries)
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(120);
      intelLines = (intel ?? [])
        .map((r: any) => `- [${r.threat_level?.toUpperCase()}] ${r.country} · ${r.category} · ${r.title} (${r.source})`)
        .join("\n");
    }

    const stopsSummary = stops
      .map(
        (s: any, i: number) =>
          `${i + 1}. ${s.name} — ${s.country ?? "?"} | risk=${s.risk} | score=${s.score ?? "n/a"} band=${s.band ?? "?"} | nearby_intel=${s.local_count}`,
      )
      .join("\n");

    const sysPrompt = `You are a senior travel-security analyst at Global Intel Desk. Produce a concise, operational, dark-OSINT-style briefing. Output strict JSON. No fluff. No emojis. Use UPPERCASE labels for severity bands (CRITICAL/HIGH/ELEVATED/LOW/QUIET).`;

    const phasePrompts: Record<Exclude<Phase, "all">, string> = {
      destination: `PHASE 1 — DESTINATION & ROUTE ASSESSMENT.
Return JSON:
{
  "executive_summary": string (3-5 sentences),
  "overall_risk_band": "CRITICAL"|"HIGH"|"ELEVATED"|"LOW"|"QUIET",
  "stops": [{
      "name": string, "country": string, "risk_band": string,
      "key_threats": string[], "recommended_posture": string,
      "movement_advice": string
  }],
  "route_corridor_risks": string[],
  "pre_departure_checklist": string[]
}`,
      protocols: `PHASE 3 — EMERGENCY PROTOCOLS.
Return JSON:
{
  "trigger_matrix": [{"trigger": string, "severity": string, "immediate_actions": string[]}],
  "evacuation": {"primary_route": string, "secondary_route": string, "muster_points": string[]},
  "medical": {"nearest_facilities": string[], "kit_required": string[]},
  "communications": {"check_in_cadence": string, "comms_failure_protocol": string},
  "local_contacts_required": string[]
}`,
      debrief: `PHASE 4 — POST-TRAVEL DEBRIEF.
Analyst notes from traveler: """${debriefNotes ?? "(no notes provided)"}"""
Return JSON:
{
  "incident_summary": string,
  "near_misses": string[],
  "what_worked": string[],
  "what_failed": string[],
  "lessons_learned": string[],
  "posture_updates": string[]
}`,
    };

    const phasesToRun: Array<Exclude<Phase, "all">> =
      phase === "all" ? ["destination", "protocols"] : [phase as Exclude<Phase, "all">];
    if (phase === "debrief") phasesToRun.push("debrief" as any);

    const results: Record<string, any> = {};
    for (const p of phasesToRun) {
      const userPrompt = `ITINERARY: ${map.name}${map.city ? " (" + map.city + ")" : ""}
TRAVELER NOTES: ${map.notes ?? "(none)"}

STOPS (auto-scored from live OSINT, last 7d, 25km radius):
${stopsSummary}

RAW INTEL FROM ROUTE COUNTRIES (last 7d, sample):
${intelLines || "(no recent intel)"}

TASK:
${phasePrompts[p]}`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        const txt = await aiRes.text();
        console.error("AI gateway error", aiRes.status, txt);
        if (aiRes.status === 429) return json({ error: "Rate limited — try again shortly" }, 429);
        if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
        return json({ error: "AI request failed" }, 500);
      }
      const aiJson = await aiRes.json();
      const content = aiJson.choices?.[0]?.message?.content ?? "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }
      results[p] = parsed;

      // Persist
      await admin.from("trip_assessments").insert({
        user_id: userId,
        itinerary_map_id: itineraryMapId,
        phase: p,
        title: `${p.toUpperCase()} — ${map.name}`,
        content: parsed,
        model: "google/gemini-2.5-flash",
      });
    }

    return json({
      ok: true,
      itinerary_map_id: itineraryMapId,
      countries,
      stop_count: stops.length,
      results,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("travel-trip-assessment error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}