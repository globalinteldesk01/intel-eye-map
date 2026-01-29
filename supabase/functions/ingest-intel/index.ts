import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

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
  actorType?: string;
  sourceCredibility?: string;
  tags?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Authenticate webhook request with API key
    const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");
    
    if (!INGEST_API_KEY) {
      console.error("INGEST_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    
    if (!apiKey || apiKey !== INGEST_API_KEY) {
      console.warn("Unauthorized webhook attempt - invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key for inserting data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    // Support both single item and batch
    const items: IntelPayload[] = Array.isArray(body) ? body : [body];
    
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No intel items provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const validItems: IntelPayload[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.title || !item.summary || !item.url || !item.source || !item.country) {
        errors.push(`Row ${i + 1}: Missing required fields (title, summary, url, source, country)`);
      } else {
        validItems.push(item);
      }
    }

    if (validItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid items to insert", details: errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create a system user for webhook-ingested intel
    // Use the first analyst user as the owner
    const { data: analysts } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "analyst")
      .limit(1);
    
    const userId = analysts?.[0]?.user_id;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "No analyst user found to assign intel ownership" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map items to database format
    const newsItems = validItems.map((item) => ({
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
      actor_type: item.actorType || "organization",
      source_credibility: item.sourceCredibility || "medium",
      tags: item.tags || [],
      user_id: userId,
      confidence_score: 0.7,
    }));

    const { data, error } = await supabase
      .from("news_items")
      .insert(newsItems)
      .select("id, token, title");

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to insert intel items", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully ingested ${data.length} intel items from webhook`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: data.length,
        items: data,
        validationErrors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
