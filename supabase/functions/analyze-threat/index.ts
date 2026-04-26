import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id);

    const { newsItem, analysisType } = await req.json();
    
    // Validate analysisType
    const VALID_ANALYSIS_TYPES = ['summary', 'threat-assessment', 'trend-prediction', 'related-events'];
    if (!analysisType || !VALID_ANALYSIS_TYPES.includes(analysisType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid analysis type' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate newsItem structure
    if (!newsItem || typeof newsItem !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid news item' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newsItem.title || typeof newsItem.title !== 'string' || 
        !newsItem.summary || typeof newsItem.summary !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid news item structure: title and summary are required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize and truncate inputs to prevent abuse
    const sanitizedTitle = String(newsItem.title).slice(0, 500);
    const sanitizedSummary = String(newsItem.summary).slice(0, 2000);
    const sanitizedRegion = String(newsItem.region || '').slice(0, 100);
    const sanitizedCountry = String(newsItem.country || '').slice(0, 100);
    const sanitizedCategory = String(newsItem.category || '').slice(0, 50);
    const sanitizedThreatLevel = String(newsItem.threatLevel || '').slice(0, 20);
    const sanitizedActorType = String(newsItem.actorType || '').slice(0, 50);
    const sanitizedTags = Array.isArray(newsItem.tags) 
      ? newsItem.tags.slice(0, 10).map((t: unknown) => String(t).slice(0, 50)).join(", ")
      : '';

    console.log("Processing analysis type:", analysisType, "for item:", sanitizedTitle.slice(0, 50));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (analysisType) {
      case "summary":
        systemPrompt = "You are an OSINT analyst. Provide a concise 2-3 sentence intelligence summary.";
        userPrompt = `Summarize this intelligence report:\nTitle: ${sanitizedTitle}\nSummary: ${sanitizedSummary}\nRegion: ${sanitizedRegion}, ${sanitizedCountry}\nCategory: ${sanitizedCategory}\nThreat Level: ${sanitizedThreatLevel}`;
        break;
      case "threat-assessment":
        systemPrompt = "You are a threat intelligence analyst. Assess the threat level and provide recommendations.";
        userPrompt = `Assess this threat:\nTitle: ${sanitizedTitle}\nDetails: ${sanitizedSummary}\nLocation: ${sanitizedCountry}\nCurrent Assessment: ${sanitizedThreatLevel}\n\nProvide: 1) Threat analysis 2) Potential impact 3) Recommended actions`;
        break;
      case "trend-prediction":
        systemPrompt = "You are a geopolitical analyst. Predict potential developments based on this intelligence.";
        userPrompt = `Based on this intel, predict likely developments:\nTitle: ${sanitizedTitle}\nDetails: ${sanitizedSummary}\nRegion: ${sanitizedRegion}\nCategory: ${sanitizedCategory}\nActor Type: ${sanitizedActorType}`;
        break;
      case "related-events":
        systemPrompt = "You are an intelligence analyst. Identify related events and patterns.";
        userPrompt = `Identify potential related events and patterns for:\nTitle: ${sanitizedTitle}\nDetails: ${sanitizedSummary}\nTags: ${sanitizedTags}\nCategory: ${sanitizedCategory}`;
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI analysis failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Analyze threat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
