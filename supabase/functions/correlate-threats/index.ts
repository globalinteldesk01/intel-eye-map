import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsItem {
  id: string;
  token: string;
  title: string;
  summary: string;
  country: string;
  region: string;
  category: string;
  threat_level: string;
  actor_type: string;
  tags: string[];
  published_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { focusItemId, timeWindowDays = 7 } = await req.json();

    // Fetch recent intel items
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

    const { data: newsItems, error: fetchError } = await supabaseClient
      .from("news_items")
      .select("id, token, title, summary, country, region, category, threat_level, actor_type, tags, published_at")
      .gte("published_at", cutoffDate.toISOString())
      .order("published_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch news items: ${fetchError.message}`);
    }

    if (!newsItems || newsItems.length < 2) {
      return new Response(JSON.stringify({
        correlations: [],
        patterns: [],
        escalationPredictions: [],
        message: "Not enough data for correlation analysis"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Find focus item if specified
    const focusItem = focusItemId 
      ? newsItems.find(item => item.id === focusItemId)
      : null;

    // Prepare context for AI analysis
    const itemsSummary = newsItems.map((item: NewsItem) => ({
      token: item.token,
      title: item.title.slice(0, 100),
      country: item.country,
      region: item.region,
      category: item.category,
      threat_level: item.threat_level,
      actor_type: item.actor_type,
      tags: item.tags.slice(0, 5),
      date: item.published_at.split('T')[0]
    }));

    const systemPrompt = `You are an elite intelligence analyst specializing in threat correlation and pattern recognition. Analyze the provided intelligence items and identify:

1. CORRELATIONS: Events that are likely connected (same actors, cascading effects, coordinated actions, shared objectives)
2. PATTERNS: Recurring threat patterns, escalation sequences, or operational signatures
3. ESCALATION PREDICTIONS: Events likely to escalate based on historical patterns and current trajectory

Respond in valid JSON format only:
{
  "correlations": [
    {
      "tokens": ["INT-XXXX-XXXX", "INT-XXXX-XXXX"],
      "connection_type": "actor_linked|causal|geographic|temporal|thematic",
      "confidence": 0.0-1.0,
      "explanation": "Brief explanation of connection"
    }
  ],
  "patterns": [
    {
      "pattern_type": "escalation_sequence|coordinated_campaign|spillover_risk|actor_signature",
      "involved_tokens": ["INT-XXXX-XXXX"],
      "description": "Pattern description",
      "significance": "high|medium|low"
    }
  ],
  "escalation_predictions": [
    {
      "token": "INT-XXXX-XXXX",
      "current_level": "low|elevated|high|critical",
      "predicted_level": "low|elevated|high|critical",
      "probability": 0.0-1.0,
      "timeframe": "24h|48h|7d|30d",
      "triggers": ["potential triggers"],
      "rationale": "Brief explanation"
    }
  ],
  "threat_network": {
    "primary_actors": ["actor names or types"],
    "affected_regions": ["regions"],
    "dominant_category": "category",
    "overall_trajectory": "escalating|stable|de-escalating"
  }
}`;

    const userPrompt = focusItem 
      ? `Analyze correlations focusing on this intelligence item:
Focus Item: ${focusItem.token} - ${focusItem.title}
Region: ${focusItem.region}, ${focusItem.country}
Category: ${focusItem.category}
Threat Level: ${focusItem.threat_level}

All Recent Intelligence:
${JSON.stringify(itemsSummary, null, 2)}`
      : `Analyze these intelligence items for correlations, patterns, and escalation risks:
${JSON.stringify(itemsSummary, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI correlation analysis failed");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let analysisResult;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      analysisResult = {
        correlations: [],
        patterns: [],
        escalationPredictions: [],
        threat_network: null,
        raw_analysis: content
      };
    }

    // Enrich correlations with full item data
    const enrichedCorrelations = (analysisResult.correlations || []).map((corr: any) => ({
      ...corr,
      items: corr.tokens?.map((token: string) => 
        newsItems.find((item: NewsItem) => item.token === token)
      ).filter(Boolean) || []
    }));

    const enrichedPredictions = (analysisResult.escalation_predictions || []).map((pred: any) => ({
      ...pred,
      item: newsItems.find((item: NewsItem) => item.token === pred.token) || null
    }));

    return new Response(JSON.stringify({
      success: true,
      correlations: enrichedCorrelations,
      patterns: analysisResult.patterns || [],
      escalationPredictions: enrichedPredictions,
      threatNetwork: analysisResult.threat_network || null,
      analyzedCount: newsItems.length,
      timeWindow: `${timeWindowDays} days`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Correlation engine error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
