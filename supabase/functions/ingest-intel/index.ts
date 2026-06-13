import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// ===================== FINGERPRINT DEDUPE =====================
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"].forEach(p => u.searchParams.delete(p));
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/,"")}${u.search}`.toLowerCase();
  } catch { return url.toLowerCase().split("?")[0]; }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
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
function buildSimilarityIndex(rows: { title: string; url: string }[]): SimIndex {
  const idx: SimIndex = { shingleIdx: new Map(), sigs: [], pathKeys: new Set() };
  for (const r of rows) addToSimilarityIndex(idx, r.title || "", r.url || "");
  return idx;
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

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===================== VALIDATION =====================
interface IntelPayload {
  title: string;
  summary: string;
  url: string;
  source: string;
  country: string;
  region?: string;
  lat?: number;
  lon?: number;
  category?: string;
  threatLevel?: string;
  confidenceLevel?: string;
  confidenceScore?: number;
  actorType?: string;
  sourceCredibility?: string;
  tags?: string[];
  publishedAt?: string;
  fingerprint?: string; // external collectors can provide their own
}

const VALID_CATEGORIES = ["security","diplomacy","economy","conflict","humanitarian","technology"];
const VALID_THREATS = ["low","elevated","high","critical"];
const VALID_CONFIDENCE = ["verified","developing","breaking"];
const VALID_ACTORS = ["state","non-state","organization"];
const VALID_CREDIBILITY = ["high","medium","low"];

function validatePayload(item: IntelPayload, index: number): string | null {
  if (!item.title || typeof item.title !== "string" || item.title.trim().length < 3) return `Row ${index}: Invalid title`;
  if (!item.summary || typeof item.summary !== "string") return `Row ${index}: Missing summary`;
  if (!item.url || typeof item.url !== "string") return `Row ${index}: Missing url`;
  if (!item.source || typeof item.source !== "string") return `Row ${index}: Missing source`;
  if (!item.country || typeof item.country !== "string") return `Row ${index}: Missing country`;
  // Validate enums if provided
  if (item.category && !VALID_CATEGORIES.includes(item.category)) return `Row ${index}: Invalid category '${item.category}'`;
  if (item.threatLevel && !VALID_THREATS.includes(item.threatLevel)) return `Row ${index}: Invalid threatLevel '${item.threatLevel}'`;
  if (item.confidenceLevel && !VALID_CONFIDENCE.includes(item.confidenceLevel)) return `Row ${index}: Invalid confidenceLevel`;
  if (item.actorType && !VALID_ACTORS.includes(item.actorType)) return `Row ${index}: Invalid actorType`;
  if (item.sourceCredibility && !VALID_CREDIBILITY.includes(item.sourceCredibility)) return `Row ${index}: Invalid sourceCredibility`;
  // Reject 0,0 coordinates
  if (item.lat === 0 && item.lon === 0) return `Row ${index}: Coordinates 0,0 rejected`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate with API key
    const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");
    if (!INGEST_API_KEY) {
      console.error("INGEST_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    if (!apiKey || apiKey !== INGEST_API_KEY) {
      console.warn("Unauthorized webhook attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const items: IntelPayload[] = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate
    const validItems: IntelPayload[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const err = validatePayload(items[i], i + 1);
      if (err) validationErrors.push(err);
      else validItems.push(items[i]);
    }

    if (validItems.length === 0) {
      return new Response(JSON.stringify({ error: "No valid items", details: validationErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find analyst user for ownership
    const { data: analysts } = await supabase.from("user_roles").select("user_id").eq("role", "analyst").limit(1);
    const userId = analysts?.[0]?.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "No analyst user found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fingerprint dedupe against DB
    const fingerprints: Map<string, IntelPayload> = new Map();
    for (const item of validItems) {
      const fp = item.fingerprint || await sha256(`${normalizeTitle(item.title)}|${normalizeUrl(item.url)}`);
      if (!fingerprints.has(fp)) fingerprints.set(fp, item);
    }

    // Check existing URLs + titles in DB
    const { data: existing } = await supabase
      .from("news_items")
      .select("url, title")
      .order("created_at", { ascending: false })
      .limit(1000);

    const existingUrls = new Set<string>();
    const existingTitles = new Set<string>();
    if (existing) {
      for (const e of existing) {
        existingUrls.add(normalizeUrl(e.url));
        existingTitles.add(normalizeTitle(e.title));
      }
    }

    // Filter out duplicates
    const newItems: IntelPayload[] = [];
    const duplicateCount = { url: 0, title: 0, similar: 0 };
    const simIdx = buildSimilarityIndex((existing || []) as { title: string; url: string }[]);

    for (const [, item] of fingerprints) {
      const nu = normalizeUrl(item.url);
      const nt = normalizeTitle(item.title);
      if (existingUrls.has(nu)) { duplicateCount.url++; continue; }
      if (existingTitles.has(nt)) { duplicateCount.title++; continue; }
      if (isSimilarToExisting(item.title, item.url, simIdx, 0.6)) { duplicateCount.similar++; continue; }
      addToSimilarityIndex(simIdx, item.title, item.url);
      newItems.push(item);
    }

    console.log(`[INGEST] ${validItems.length} valid, ${fingerprints.size} after fp dedupe, ${newItems.length} new (${duplicateCount.url} url dupes, ${duplicateCount.title} title dupes)`);

    if (newItems.length === 0) {
      return new Response(JSON.stringify({
        success: true, inserted: 0,
        message: "All items were duplicates",
        duplicates: duplicateCount,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map to DB format
    const rows = newItems.map(item => ({
      title: item.title.substring(0, 500),
      summary: item.summary.substring(0, 2000),
      url: item.url.substring(0, 2000),
      source: item.source.substring(0, 200),
      country: item.country.substring(0, 100),
      region: item.region || "Global",
      lat: item.lat || 0,
      lon: item.lon || 0,
      category: item.category || "security",
      threat_level: item.threatLevel || "low",
      confidence_level: item.confidenceLevel || "developing",
      confidence_score: item.confidenceScore ?? 0.7,
      actor_type: item.actorType || "organization",
      source_credibility: item.sourceCredibility || "medium",
      tags: item.tags || [],
      published_at: item.publishedAt || new Date().toISOString(),
      user_id: userId,
    }));

    const { data, error } = await supabase
      .from("news_items")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
      .select("id, token, title");

    if (error) {
      console.error("[INGEST] Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to insert", details: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[INGEST] Successfully ingested ${data.length} items`);

    return new Response(JSON.stringify({
      success: true,
      inserted: data.length,
      items: data,
      duplicates: duplicateCount,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[INGEST] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
