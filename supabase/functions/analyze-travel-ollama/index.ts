import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Validate JWT and identify the user
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp?.user) return json({ error: "Unauthorized" }, 401);
    const user = userResp.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load Ollama config
    const { data: settings } = await admin
      .from("crisis_user_settings")
      .select("ollama_url, ollama_model, ollama_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const ollamaUrl = (settings?.ollama_url ?? "").trim().replace(/\/$/, "");
    const ollamaModel = (settings?.ollama_model ?? "llama3.2").trim();
    const ollamaToken = (settings?.ollama_token ?? "").trim();
    if (!ollamaUrl) {
      return json({ error: "Ollama is not configured. Add your Ollama URL in settings." }, 400);
    }

    // Pull user's itineraries + destinations
    const { data: trips } = await admin
      .from("travel_itineraries")
      .select("id, name, start_date, end_date, status")
      .eq("user_id", user.id);
    const tripIds = (trips ?? []).map((t: any) => t.id);
    const { data: dests } = tripIds.length
      ? await admin
          .from("itinerary_destinations")
          .select("itinerary_id, country, city, arrival_date, departure_date")
          .in("itinerary_id", tripIds)
      : { data: [] as any[] };

    if (!trips?.length || !dests?.length) {
      return json({ error: "No itineraries with destinations found." }, 400);
    }

    // Pull recent intel for the destination countries
    const countries = Array.from(
      new Set((dests ?? []).map((d: any) => (d.country ?? "").trim()).filter(Boolean)),
    );
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data: intel } = countries.length
      ? await admin
          .from("news_items")
          .select("id, title, summary, country, region, threat_level, category, token, published_at, url")
          .in("country", countries)
          .gte("published_at", since)
          .order("published_at", { ascending: false })
          .limit(80)
      : { data: [] as any[] };

    const compactIntel = (intel ?? []).slice(0, 40).map((i: any) => ({
      id: i.id,
      token: i.token,
      country: i.country,
      threat: i.threat_level,
      category: i.category,
      title: i.title,
      summary: (i.summary ?? "").slice(0, 320),
      published_at: i.published_at,
    }));

    const tripsPayload = (trips ?? []).map((t: any) => ({
      ...t,
      destinations: (dests ?? []).filter((d: any) => d.itinerary_id === t.id),
    }));

    const system = `You are a travel security analyst. You receive a traveler's itineraries and recent open-source intelligence (OSINT) for the destinations. Produce a strict JSON object describing concerns and recommendations. Be concise, factual, and avoid speculation. Cite intel by their token (e.g. INT-2025-0001). Output ONLY valid JSON, no prose, no markdown.`;

    const schema = `{
  "overall_risk": "low" | "elevated" | "high" | "critical",
  "overall_summary": string,
  "destinations": [
    {
      "country": string,
      "city": string | null,
      "risk": "low" | "elevated" | "high" | "critical",
      "summary": string,
      "recommendations": string[],
      "source_tokens": string[]
    }
  ],
  "global_recommendations": string[]
}`;

    const userPrompt = `Analyze the following traveler data and recent intel.\n\nITINERARIES:\n${JSON.stringify(tripsPayload, null, 2)}\n\nRECENT_INTEL (last 14 days, max 40 items):\n${JSON.stringify(compactIntel, null, 2)}\n\nReturn JSON matching this schema exactly:\n${schema}`;

    // Call Ollama (OpenAI-compatible chat endpoint preferred; fall back to /api/chat)
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ollamaToken) headers["Authorization"] = `Bearer ${ollamaToken}`;

    let raw = "";
    let endpointUsed = "";
    try {
      endpointUsed = `${ollamaUrl}/v1/chat/completions`;
      const r = await fetch(endpointUsed, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          stream: false,
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) throw new Error(`Ollama OAI error ${r.status}: ${await r.text()}`);
      const j = await r.json();
      raw = j.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      console.error("OAI endpoint failed, falling back to /api/chat", e);
      endpointUsed = `${ollamaUrl}/api/chat`;
      const r = await fetch(endpointUsed, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: ollamaModel,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          options: { temperature: 0.2 },
        }),
      });
      if (!r.ok) {
        return json(
          { error: `Ollama call failed: ${r.status} ${await r.text()}`, endpoint: endpointUsed },
          502,
        );
      }
      const j = await r.json();
      raw = j.message?.content ?? "";
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }
    if (!parsed) {
      return json({ error: "Model did not return valid JSON.", raw_preview: raw.slice(0, 600) }, 502);
    }

    // Cache result on the user's settings row
    await admin
      .from("crisis_user_settings")
      .upsert(
        { user_id: user.id, last_travel_analysis: parsed, last_travel_analysis_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    return json({ analysis: parsed, model: ollamaModel, endpoint: endpointUsed });
  } catch (e) {
    console.error("analyze-travel-ollama error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});