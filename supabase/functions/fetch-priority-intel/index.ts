// Lightweight, high-frequency fetcher for time-critical disaster APIs only.
// Runs in parallel with the full RSS sweep so USGS / GDACS / EONET / NOAA
// hit the dashboard within seconds instead of waiting behind the 60-80s
// full pipeline. Designed to complete in <10s.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DbRow {
  title: string;
  summary: string;
  url: string;
  source: string;
  source_credibility: "high" | "medium" | "low";
  published_at: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  city: string | null;
  tags: string[];
  confidence_score: number;
  confidence_level: "verified" | "developing" | "breaking";
  threat_level: "critical" | "high" | "elevated" | "low";
  actor_type: "state" | "non-state" | "organization";
  category: string;
  user_id: string;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"]
      .forEach(p => u.searchParams.delete(p));
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/,"")}${u.search}`.toLowerCase();
  } catch { return url.toLowerCase().split("?")[0]; }
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// ── Similarity dedupe (catches republished / copied stories) ──────────────
const _TITLE_STOPWORDS = new Set("a an the of and or to for in on at by from with as is are was were be been being this that it its their his her our your we you they them us has have had not no nor but if then so do does did new news update report says said amid after before over under into out".split(" "));
function tokenizeTitle(t: string): string[] {
  return normalizeTitle(t).split(" ").filter(w => w.length >= 3 && !_TITLE_STOPWORDS.has(w));
}
function shingles(tokens: string[], k = 2): string[] {
  if (tokens.length === 0) return [];
  if (tokens.length < k) return [tokens.join(" ")];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - k; i++) out.push(tokens.slice(i, i + k).join(" "));
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function urlPathKey(u: string): string {
  try {
    const x = new URL(u);
    const parts = x.pathname.split("/").filter(Boolean);
    const tail = parts.slice(-2).join("/").toLowerCase();
    return `${x.hostname.replace(/^www\./, "")}|${tail}`;
  } catch { return (u || "").toLowerCase(); }
}
interface SimIndex {
  shingleIdx: Map<string, number[]>;
  sigs: Set<string>[];
  pathKeys: Set<string>;
}
function buildSimilarityIndex(rows: { title: string; url: string }[]): SimIndex {
  const idx: SimIndex = { shingleIdx: new Map(), sigs: [], pathKeys: new Set() };
  for (const r of rows) addToSimilarityIndex(idx, r.title || "", r.url || "");
  return idx;
}
function addToSimilarityIndex(idx: SimIndex, title: string, url: string): void {
  const sh = new Set(shingles(tokenizeTitle(title || ""), 2));
  const i = idx.sigs.length;
  idx.sigs.push(sh);
  for (const s of sh) {
    let arr = idx.shingleIdx.get(s);
    if (!arr) { arr = []; idx.shingleIdx.set(s, arr); }
    arr.push(i);
  }
  if (url) idx.pathKeys.add(urlPathKey(url));
}
function isSimilarToExisting(title: string, url: string, idx: SimIndex, threshold = 0.6): boolean {
  if (url && idx.pathKeys.has(urlPathKey(url))) return true;
  const sh = new Set(shingles(tokenizeTitle(title || ""), 2));
  if (sh.size < 2) return false;
  const counts = new Map<number, number>();
  for (const s of sh) {
    const arr = idx.shingleIdx.get(s);
    if (!arr) continue;
    for (const i of arr) counts.set(i, (counts.get(i) || 0) + 1);
  }
  for (const [i, c] of counts) {
    if (c < 2) continue;
    if (jaccard(sh, idx.sigs[i]) >= threshold) return true;
  }
  return false;
}

// Reverse-geocode to country/region (minimal — uses lat/lon bands).
function reverseGeo(lat: number, lon: number): { country: string; region: string; city: string | null } {
  let region = "Global";
  if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 40) region = "Europe";
  else if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) region = "Africa";
  else if (lat >= 5 && lat <= 55 && lon >= 25 && lon <= 75) region = "Middle East";
  else if (lat >= -10 && lat <= 55 && lon >= 60 && lon <= 150) region = "Asia";
  else if (lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180) region = "Oceania";
  else if (lat >= 15 && lat <= 75 && lon >= -170 && lon <= -50) region = "North America";
  else if (lat >= -60 && lat <= 15 && lon >= -90 && lon <= -30) region = "South America";
  return { country: region, region, city: null };
}

function parseRssItems(xml: string): { title: string; description: string; url: string; publishedAt: string }[] {
  const out: { title: string; description: string; url: string; publishedAt: string }[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const decode = (s: string) => s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,"&");
  const strip = (s: string) => decode(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = strip((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || "");
    const description = strip((block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]) || "");
    const url = strip((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]) || "");
    const pub = strip((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]) || "");
    const ts = pub ? new Date(pub).toISOString() : new Date().toISOString();
    if (title && url) out.push({ title, description, url, publishedAt: ts });
  }
  return out;
}

// ===== USGS (every-minute live earthquakes >= M2.5) =====
async function fetchUSGS(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson", { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return out;
    const data = await r.json();
    for (const f of (data?.features || [])) {
      const p = f.properties || {};
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const [lon, lat, depth] = c;
      const mag = parseFloat(p.mag) || 0;
      if (mag < 4.0) continue; // only meaningful quakes via this fast path
      const geo = reverseGeo(lat, lon);
      const threat: DbRow["threat_level"] = mag >= 7 ? "critical" : mag >= 6 ? "high" : mag >= 5 ? "elevated" : "low";
      out.push({
        title: `[EARTHQUAKE M${mag.toFixed(1)}] ${p.place || geo.country}`.substring(0, 500),
        summary: `USGS Earthquake: M${mag.toFixed(1)} at depth ${depth?.toFixed(0) || "?"}km. ${p.place || ""}`.substring(0, 2000),
        url: (p.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${p.code}`).substring(0, 2000),
        source: "USGS Earthquake Hazards",
        source_credibility: "high",
        published_at: p.time ? new Date(p.time).toISOString() : new Date().toISOString(),
        lat, lon,
        country: geo.country, region: geo.region, city: geo.city,
        tags: ["earthquake","usgs","natural-disaster","seismic",`m${Math.floor(mag)}`],
        confidence_score: 0.99,
        confidence_level: "verified",
        threat_level: threat,
        actor_type: "organization",
        category: "humanitarian",
        user_id: userId,
      });
    }
  } catch (e) { console.warn(`[USGS-fast] ${e}`); }
  return out;
}

// ===== GDACS =====
async function fetchGDACS(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const r = await fetch("https://gdacs.org/xml/rss.xml", { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return out;
    const items = parseRssItems(await r.text());
    for (const it of items) {
      // GDACS items embed lat/lon in <georss:point> — try to parse.
      const m = it.description.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
      if (!m) continue;
      const lat = parseFloat(m[1]); const lon = parseFloat(m[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
      const geo = reverseGeo(lat, lon);
      const tt = it.title.toLowerCase();
      const isRed = tt.includes("red alert");
      const isOrange = tt.includes("orange alert");
      out.push({
        title: `[GDACS] ${it.title}`.substring(0, 500),
        summary: it.description.substring(0, 2000),
        url: it.url.substring(0, 2000),
        source: "GDACS/UNOCHA",
        source_credibility: "high",
        published_at: it.publishedAt,
        lat, lon,
        country: geo.country, region: geo.region, city: geo.city,
        tags: ["gdacs","disaster","alert","humanitarian", isRed ? "red-alert" : isOrange ? "orange-alert" : "green-alert"],
        confidence_score: 0.85,
        confidence_level: "verified",
        threat_level: isRed ? "critical" : isOrange ? "high" : "elevated",
        actor_type: "organization",
        category: "humanitarian",
        user_id: userId,
      });
    }
  } catch (e) { console.warn(`[GDACS-fast] ${e}`); }
  return out;
}

// ===== NASA EONET (open events, last 1 day) =====
async function fetchEONET(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const r = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=1&limit=200", { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return out;
    const data = await r.json();
    for (const f of (data?.features || [])) {
      const p = f.properties || {};
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const [lon, lat] = c;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const geo = reverseGeo(lat, lon);
      const catId = (p.categories?.[0]?.title || "natural-event").toLowerCase();
      out.push({
        title: `[EONET] ${p.title || catId}`.substring(0, 500),
        summary: `Active natural event (NASA EONET). Category: ${catId}.`.substring(0, 2000),
        url: (((p.sources || [])[0]?.url) || "https://eonet.gsfc.nasa.gov/").substring(0, 2000),
        source: "NASA EONET",
        source_credibility: "high",
        published_at: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
        lat, lon,
        country: geo.country, region: geo.region, city: geo.city,
        tags: ["natural-disaster","eonet","nasa", catId.replace(/\s+/g,"-")],
        confidence_score: 0.95,
        confidence_level: "verified",
        threat_level: "elevated",
        actor_type: "organization",
        category: "humanitarian",
        user_id: userId,
      });
    }
  } catch (e) { console.warn(`[EONET-fast] ${e}`); }
  return out;
}

// ===== NOAA active weather alerts (US severe + extreme only) =====
async function fetchNOAA(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const r = await fetch("https://api.weather.gov/alerts/active?severity=Severe,Extreme&status=actual", {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "GlobalIntelDesk (ops@globalinteldesk.local)" },
    });
    if (!r.ok) return out;
    const data = await r.json();
    for (const f of (data?.features || []).slice(0, 50)) {
      const p = f.properties || {};
      const g = f.geometry;
      let lat = 0, lon = 0;
      if (g?.coordinates) {
        const ring = g.type === "Polygon" ? g.coordinates[0] : g.coordinates;
        const pt = Array.isArray(ring?.[0]) ? ring[0] : ring;
        if (Array.isArray(pt) && pt.length >= 2) { lon = pt[0]; lat = pt[1]; }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
      const sev = (p.severity || "").toLowerCase();
      const threat: DbRow["threat_level"] = sev === "extreme" ? "critical" : sev === "severe" ? "high" : "elevated";
      out.push({
        title: `[NOAA] ${p.event || "Weather Alert"}: ${p.areaDesc || ""}`.substring(0, 500),
        summary: (p.headline || p.description || "").substring(0, 2000),
        url: (p.id || `https://api.weather.gov/alerts/${p.id}`).substring(0, 2000),
        source: "NOAA / NWS",
        source_credibility: "high",
        published_at: p.sent ? new Date(p.sent).toISOString() : new Date().toISOString(),
        lat, lon,
        country: "North America", region: "North America", city: null,
        tags: ["noaa","weather","alert", sev],
        confidence_score: 0.97,
        confidence_level: "verified",
        threat_level: threat,
        actor_type: "organization",
        category: "humanitarian",
        user_id: userId,
      });
    }
  } catch (e) { console.warn(`[NOAA-fast] ${e}`); }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const t0 = Date.now();
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, key);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === anonKey) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (token !== key) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser(token);
      if (!data?.user) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    // Owner = first analyst (matches the slow pipeline's behavior).
    const { data: analysts } = await admin.from("user_roles").select("user_id").eq("role", "analyst").limit(1);
    const userId = analysts?.[0]?.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "No analyst user" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const [usgs, gdacs, eonet, noaa] = await Promise.all([
      fetchUSGS(userId), fetchGDACS(userId), fetchEONET(userId), fetchNOAA(userId),
    ]);
    const all = [...usgs, ...gdacs, ...eonet, ...noaa];

    // DB-level dedup against recent rows.
    const { data: existing } = await admin.from("news_items")
      .select("url, title").order("created_at", { ascending: false }).limit(2000);
    const eu = new Set<string>((existing || []).map((e: any) => normalizeUrl(e.url)));
    const et = new Set<string>((existing || []).map((e: any) => normalizeTitle(e.title)));
    const simIdx = buildSimilarityIndex((existing || []) as { title: string; url: string }[]);
    const fresh: DbRow[] = [];
    for (const r of all) {
      if (eu.has(normalizeUrl(r.url))) continue;
      if (et.has(normalizeTitle(r.title))) continue;
      if (isSimilarToExisting(r.title, r.url, simIdx, 0.6)) continue;
      addToSimilarityIndex(simIdx, r.title, r.url);
      fresh.push(r);
    }

    let inserted = 0;
    // Sanitize numeric fields to fit DB column precision (numeric(9,6) for lat/lon → max ±999.999999;
    // numeric(3,2) for confidence_score → max 9.99). We clamp aggressively and round to 4 decimals
    // (well below the column's 6-decimal limit) so float drift can't push a value over precision.
    const safe = fresh
      .map((r) => {
        let lat = Number(r.lat);
        let lon = Number(r.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        // Hard clamp into valid earth coordinates.
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        lat = Math.max(-89.9999, Math.min(89.9999, lat));
        lon = Math.max(-179.9999, Math.min(179.9999, lon));
        const cs = Number(r.confidence_score);
        const safeCs = Number.isFinite(cs) ? Math.max(0.01, Math.min(0.99, cs)) : 0.5;
        return {
          ...r,
          lat: Math.round(lat * 1e4) / 1e4,
          lon: Math.round(lon * 1e4) / 1e4,
          confidence_score: Math.round(safeCs * 100) / 100,
        };
      })
      .filter((r): r is DbRow => r !== null);

    // Insert one row at a time so a single bad row can't kill a batch.
    for (const row of safe) {
      const { data, error } = await admin
        .from("news_items")
        .upsert([row], { onConflict: "url", ignoreDuplicates: true })
        .select("id");
      if (error) {
        console.error(`[priority] insert err: ${error.message}`);
        console.error(`[priority] failing row: src=${row.source} lat=${row.lat} lon=${row.lon} cs=${row.confidence_score} url=${String(row.url).slice(0,120)}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[priority] usgs=${usgs.length} gdacs=${gdacs.length} eonet=${eonet.length} noaa=${noaa.length} → ${inserted} inserted in ${elapsed}ms`);

    return new Response(JSON.stringify({
      success: true,
      inserted,
      breakdown: { usgs: usgs.length, gdacs: gdacs.length, eonet: eonet.length, noaa: noaa.length },
      elapsed_ms: elapsed,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[priority] fatal:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});