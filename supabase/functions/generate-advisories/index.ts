import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const advisoryTool = {
  type: "function",
  function: {
    name: "record_advisory",
    description: "Record a travel advisory brief for one country.",
    parameters: {
      type: "object",
      properties: {
        risk_level: { type: "string", enum: ["low", "elevated", "high", "critical"] },
        risk_score: { type: "integer", description: "0-100 overall country risk." },
        key_threats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              description: { type: "string" },
              severity: { type: "string", enum: ["low", "elevated", "high", "critical"] },
            },
            required: ["type", "description", "severity"],
          },
        },
        regions_to_avoid: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        narrative: { type: "string", description: "3-5 sentence executive summary." },
      },
      required: ["risk_level", "risk_score", "key_threats", "regions_to_avoid", "recommendations", "narrative"],
      additionalProperties: false,
    },
  },
};

async function generateForCountry(country: string, items: any[]) {
  const digest = items.slice(0, 30).map((it, i) =>
    `${i + 1}. [${it.threat_type ?? "n/a"}|sev${it.severity_score ?? 0}|${it.city ?? ""}] ${it.title}`
  ).join("\n");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You produce concise corporate travel security advisories. Be specific, neutral, actionable. No emojis." },
        { role: "user", content: `Country: ${country}\nRecent intelligence (last 30 days):\n${digest}\n\nCall record_advisory with the full brief.` },
      ],
      tools: [advisoryTool],
      tool_choice: { type: "function", function: { name: "record_advisory" } },
    }),
  });
  if (!resp.ok) throw new Error(`AI ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call");
  return JSON.parse(call.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token || token === anonKey) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (token !== SERVICE_ROLE) {
    const userClient = createClient(SUPABASE_URL, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data } = await userClient.auth.getUser(token);
    if (!data?.user) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let targetCountry: string | null = null;
  try { targetCountry = (await req.json())?.country ?? null; } catch {}

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  let q = supabase
    .from("news_items")
    .select("country,city,title,threat_type,severity_score,published_at")
    .gte("published_at", since)
    .not("country", "is", null)
    .not("enriched_at", "is", null)
    .order("severity_score", { ascending: false })
    .limit(2000);
  if (targetCountry) q = q.eq("country", targetCountry);

  const { data: items, error } = await q;
  if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders });

  const byCountry = new Map<string, any[]>();
  for (const it of items ?? []) {
    if (!it.country) continue;
    const arr = byCountry.get(it.country) ?? [];
    arr.push(it);
    byCountry.set(it.country, arr);
  }

  const results: any[] = [];
  for (const [country, arr] of byCountry) {
    try {
      const adv = await generateForCountry(country, arr);
      await supabase.from("country_advisories").upsert({
        country,
        risk_level: adv.risk_level,
        risk_score: adv.risk_score,
        key_threats: adv.key_threats,
        regions_to_avoid: adv.regions_to_avoid,
        recommendations: adv.recommendations,
        narrative: adv.narrative,
        source_count: arr.length,
        generated_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }, { onConflict: "country" });
      results.push({ country, ok: true, risk: adv.risk_score });
    } catch (e) {
      console.error(country, e);
      results.push({ country, ok: false, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ countries: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});