import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const enrichmentTool = {
  type: "function",
  function: {
    name: "record_enrichment",
    description: "Record full analytical enrichment for one intelligence article.",
    parameters: {
      type: "object",
      properties: {
        original_language: { type: "string", description: "ISO-639-1 code of source language; 'en' if already English." },
        translated_title: { type: "string", description: "English title (same as input if already English)." },
        ai_summary: { type: "string", description: "2-sentence analyst-grade summary in English." },
        city: { type: "string", description: "Most specific city/town named in the article, or '' if unknown." },
        country: { type: "string", description: "Country name (English)." },
        region: { type: "string", description: "Geopolitical region (e.g. 'Middle East', 'South Asia')." },
        lat: { type: "number", description: "Latitude of the most specific location mentioned (decimal degrees, WGS84). Use city centroid if a city is named; otherwise country centroid. Must be between -90 and 90." },
        lon: { type: "number", description: "Longitude of the most specific location mentioned (decimal degrees, WGS84). Use city centroid if a city is named; otherwise country centroid. Must be between -180 and 180." },
        location_precision: { type: "string", enum: ["exact", "city", "region", "country", "unknown"], description: "How precise the coordinates are." },
        threat_type: {
          type: "string",
          enum: ["armed_conflict", "terrorism", "civil_unrest", "crime", "cyber", "natural_disaster", "political", "health", "economic", "diplomatic", "none"],
        },
        actors: { type: "array", items: { type: "string" }, description: "Named threat actors / groups." },
        targets: { type: "array", items: { type: "string" }, description: "Targets affected." },
        casualties: {
          type: "object",
          properties: {
            killed: { type: "integer" },
            wounded: { type: "integer" },
            displaced: { type: "integer" },
          },
        },
        severity_score: { type: "integer", description: "0-100. Casualties, scope, escalation potential." },
        severity_level: { type: "string", enum: ["low", "elevated", "high", "critical"] },
      },
      required: ["translated_title", "ai_summary", "threat_type", "severity_score", "severity_level", "country", "lat", "lon", "location_precision"],
      additionalProperties: false,
    },
  },
};

async function enrichOne(item: any) {
  const prompt = `Analyze this news article as an OSINT analyst.

Title: ${item.title}
Summary: ${item.summary || ""}
Source: ${item.source}
Reported country: ${item.country}
Currently stored coords: ${item.lat}, ${item.lon}

Call record_enrichment with full structured analysis.
- Translate to English if not already.
- LOCATION: Identify the most specific place actually mentioned in the article (neighborhood > city > province > country). Provide accurate lat/lon for that place using your geographic knowledge (city centroid if a city, country centroid otherwise). Set location_precision honestly. Do NOT default to the country centroid if a city is named.
- SEVERITY: Score 0-100 honestly — most articles are 10-40; only mass-casualty / war / coup / major attack reach 80+.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a precise OSINT analyst. Always call the provided tool." },
        { role: "user", content: prompt },
      ],
      tools: [enrichmentTool],
      tool_choice: { type: "function", function: { name: "record_enrichment" } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call returned");
  return JSON.parse(call.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    let ids: string[] | null = null;
    try {
      const body = await req.json();
      ids = Array.isArray(body?.ids) ? body.ids : null;
    } catch { /* empty body OK */ }

    let query = supabase
      .from("news_items")
      .select("id,title,summary,source,country,city,region,lat,lon")
      .is("enriched_at", null)
      .order("published_at", { ascending: false })
      .limit(10);
    if (ids) query = supabase.from("news_items").select("id,title,summary,source,country,city,region,lat,lon").in("id", ids);

    const { data: rows, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const row of rows ?? []) {
      try {
        const e = await enrichOne(row);
        const sev = e.severity_level as "low"|"elevated"|"high"|"critical";
        await supabase.from("news_items").update({
          ai_summary: e.ai_summary,
          original_title: e.original_language && e.original_language !== "en" ? row.title : null,
          original_language: e.original_language || "en",
          severity_score: Math.max(0, Math.min(100, e.severity_score ?? 0)),
          threat_level: sev,
          threat_type: e.threat_type,
          actors: e.actors ?? [],
          targets: e.targets ?? [],
          casualties: e.casualties ?? null,
          city: e.city || row.city,
          country: e.country || row.country,
          region: e.region || row.region,
        lat: (typeof e.lat === "number" && e.lat >= -90 && e.lat <= 90) ? e.lat : row.lat,
        lon: (typeof e.lon === "number" && e.lon >= -180 && e.lon <= 180) ? e.lon : row.lon,
          title: e.translated_title || row.title,
          enriched_at: new Date().toISOString(),
        }).eq("id", row.id);
        results.push({ id: row.id, ok: true, severity: e.severity_score });
      } catch (err) {
        console.error("enrich failed", row.id, err);
        // mark enriched_at so we don't loop forever, but keep raw fields
        await supabase.from("news_items").update({ enriched_at: new Date().toISOString() }).eq("id", row.id);
        results.push({ id: row.id, ok: false, error: String(err) });
      }
    }
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});