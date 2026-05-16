import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Simple geohash bucket (~50km at precision 4)
function geohashBucket(lat: number, lon: number, precision = 1): string {
  const f = Math.pow(10, precision);
  return `${Math.round(Number(lat) * f) / f},${Math.round(Number(lon) * f) / f}`;
}

function dayBucket(iso: string): string {
  return iso.slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Items enriched in last 7 days, not yet clustered
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: items, error } = await supabase
    .from("news_items")
    .select("id,title,country,city,region,lat,lon,published_at,severity_score,threat_type,ai_summary")
    .gte("enriched_at", since)
    .is("incident_id", null)
    .not("threat_type", "is", null)
    .neq("threat_type", "none")
    .limit(500);
  if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders });

  const groups = new Map<string, any[]>();
  for (const it of items ?? []) {
    if (!it.threat_type || it.threat_type === "none") continue;
    const key = [
      it.threat_type,
      it.country || "",
      geohashBucket(Number(it.lat), Number(it.lon)),
      dayBucket(it.published_at),
    ].join("|");
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }

  let createdOrUpdated = 0;
  for (const [key, arr] of groups) {
    const first = arr[0];
    const severityMax = arr.reduce((m, x) => Math.max(m, x.severity_score ?? 0), 0);
    const firstSeen = arr.reduce((m, x) => (x.published_at < m ? x.published_at : m), arr[0].published_at);
    const lastSeen = arr.reduce((m, x) => (x.published_at > m ? x.published_at : m), arr[0].published_at);

    const { data: existing } = await supabase
      .from("incidents")
      .select("id,item_count")
      .eq("cluster_key", key)
      .maybeSingle();

    let incidentId: string;
    if (existing) {
      incidentId = existing.id;
      await supabase.from("incidents").update({
        item_count: (existing.item_count ?? 0) + arr.length,
        severity_max: severityMax,
        last_seen: lastSeen,
      }).eq("id", incidentId);
    } else {
      const { data: ins, error: ie } = await supabase.from("incidents").insert({
        cluster_key: key,
        title: first.title,
        summary: first.ai_summary ?? "",
        threat_type: first.threat_type,
        country: first.country,
        city: first.city,
        region: first.region,
        lat: first.lat,
        lon: first.lon,
        severity_max: severityMax,
        item_count: arr.length,
        first_seen: firstSeen,
        last_seen: lastSeen,
      }).select("id").single();
      if (ie) { console.error(ie); continue; }
      incidentId = ins!.id;
    }

    await supabase.from("news_items").update({ incident_id: incidentId }).in("id", arr.map(a => a.id));
    createdOrUpdated++;
  }

  return new Response(JSON.stringify({ groups: createdOrUpdated, items: items?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});