import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map NewsAPI categories to our intel categories
const categoryMapping: Record<string, string> = {
  general: "security",
  business: "economy",
  technology: "technology",
  science: "technology",
  health: "humanitarian",
  sports: "diplomacy",
  entertainment: "diplomacy",
};

// Keywords for threat level detection
const criticalKeywords = ["attack", "bomb", "explosion", "terror", "war", "killed", "massacre", "crisis"];
const highKeywords = ["conflict", "military", "troops", "missile", "threat", "violence", "emergency"];
const elevatedKeywords = ["tension", "protest", "sanctions", "warning", "concern", "dispute"];

// Country coordinate mapping for geocoding
const countryCoordinates: Record<string, { lat: number; lon: number; region: string }> = {
  "us": { lat: 38.9072, lon: -77.0369, region: "North America" },
  "gb": { lat: 51.5074, lon: -0.1278, region: "Europe" },
  "de": { lat: 52.5200, lon: 13.4050, region: "Europe" },
  "fr": { lat: 48.8566, lon: 2.3522, region: "Europe" },
  "ru": { lat: 55.7558, lon: 37.6173, region: "Europe" },
  "cn": { lat: 39.9042, lon: 116.4074, region: "Asia" },
  "jp": { lat: 35.6762, lon: 139.6503, region: "Asia" },
  "in": { lat: 28.6139, lon: 77.2090, region: "Asia" },
  "br": { lat: -15.7801, lon: -47.9292, region: "South America" },
  "au": { lat: -35.2809, lon: 149.1300, region: "Oceania" },
  "za": { lat: -25.7461, lon: 28.1881, region: "Africa" },
  "eg": { lat: 30.0444, lon: 31.2357, region: "Middle East" },
  "sa": { lat: 24.7136, lon: 46.6753, region: "Middle East" },
  "ir": { lat: 35.6892, lon: 51.3890, region: "Middle East" },
  "il": { lat: 31.7683, lon: 35.2137, region: "Middle East" },
  "ua": { lat: 50.4501, lon: 30.5234, region: "Europe" },
  "kr": { lat: 37.5665, lon: 126.9780, region: "Asia" },
  "mx": { lat: 19.4326, lon: -99.1332, region: "North America" },
  "ca": { lat: 45.4215, lon: -75.6972, region: "North America" },
  "ng": { lat: 9.0765, lon: 7.3986, region: "Africa" },
  "pk": { lat: 33.6844, lon: 73.0479, region: "Asia" },
  "tr": { lat: 39.9334, lon: 32.8597, region: "Middle East" },
  "default": { lat: 0, lon: 0, region: "Global" },
};

// Country code to full name
const countryNames: Record<string, string> = {
  "us": "United States",
  "gb": "United Kingdom",
  "de": "Germany",
  "fr": "France",
  "ru": "Russia",
  "cn": "China",
  "jp": "Japan",
  "in": "India",
  "br": "Brazil",
  "au": "Australia",
  "za": "South Africa",
  "eg": "Egypt",
  "sa": "Saudi Arabia",
  "ir": "Iran",
  "il": "Israel",
  "ua": "Ukraine",
  "kr": "South Korea",
  "mx": "Mexico",
  "ca": "Canada",
  "ng": "Nigeria",
  "pk": "Pakistan",
  "tr": "Turkey",
};

function detectThreatLevel(title: string, description: string): "critical" | "high" | "elevated" | "low" {
  const text = `${title} ${description}`.toLowerCase();
  
  if (criticalKeywords.some(kw => text.includes(kw))) return "critical";
  if (highKeywords.some(kw => text.includes(kw))) return "high";
  if (elevatedKeywords.some(kw => text.includes(kw))) return "elevated";
  return "low";
}

function detectCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes("military") || text.includes("attack") || text.includes("defense") || text.includes("security")) {
    return "security";
  }
  if (text.includes("war") || text.includes("conflict") || text.includes("troops") || text.includes("combat")) {
    return "conflict";
  }
  if (text.includes("diplomat") || text.includes("treaty") || text.includes("summit") || text.includes("relations")) {
    return "diplomacy";
  }
  if (text.includes("economy") || text.includes("trade") || text.includes("market") || text.includes("financial")) {
    return "economy";
  }
  if (text.includes("humanitarian") || text.includes("refugee") || text.includes("aid") || text.includes("disaster")) {
    return "humanitarian";
  }
  if (text.includes("tech") || text.includes("cyber") || text.includes("digital") || text.includes("ai")) {
    return "technology";
  }
  
  return "security";
}

function extractTags(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const tags: string[] = [];
  
  const tagKeywords = [
    "military", "terrorism", "cyber", "economy", "trade", "politics",
    "election", "climate", "energy", "nuclear", "sanctions", "protest",
    "refugee", "humanitarian", "technology", "ai", "defense", "security"
  ];
  
  tagKeywords.forEach(tag => {
    if (text.includes(tag) && tags.length < 5) {
      tags.push(tag);
    }
  });
  
  return tags.length > 0 ? tags : ["breaking-news"];
}

function detectCountryFromContent(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  const countryPatterns: Record<string, string[]> = {
    "us": ["united states", "u.s.", "america", "washington", "pentagon", "white house"],
    "ua": ["ukraine", "kyiv", "kiev", "ukrainian"],
    "ru": ["russia", "russian", "moscow", "kremlin", "putin"],
    "cn": ["china", "chinese", "beijing"],
    "ir": ["iran", "iranian", "tehran"],
    "il": ["israel", "israeli", "tel aviv", "jerusalem"],
    "gb": ["britain", "british", "uk", "london", "england"],
    "de": ["germany", "german", "berlin"],
    "fr": ["france", "french", "paris"],
    "sa": ["saudi", "riyadh"],
    "tr": ["turkey", "turkish", "ankara"],
    "pk": ["pakistan", "pakistani", "islamabad"],
    "in": ["india", "indian", "delhi", "mumbai"],
    "kr": ["korea", "korean", "seoul"],
    "jp": ["japan", "japanese", "tokyo"],
  };
  
  for (const [code, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(p => text.includes(p))) {
      return code;
    }
  }
  
  return "us"; // Default
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    console.log("Fetching news for user:", userId);

    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    if (!newsApiKey) {
      console.error("NEWSAPI_KEY not configured");
      return new Response(JSON.stringify({ error: "News API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch top headlines from multiple categories
    const categories = ["general", "business", "technology"];
    const allArticles: any[] = [];

    for (const category of categories) {
      try {
        const response = await fetch(
          `https://newsapi.org/v2/top-headlines?category=${category}&language=en&pageSize=10`,
          {
            headers: {
              "X-Api-Key": newsApiKey,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.articles) {
            allArticles.push(...data.articles.map((a: any) => ({ ...a, apiCategory: category })));
          }
        } else {
          console.error(`Failed to fetch ${category}:`, response.status);
        }
      } catch (err) {
        console.error(`Error fetching ${category}:`, err);
      }
    }

    // Also fetch global news with geopolitical keywords
    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=(conflict OR military OR diplomacy OR crisis OR security)&language=en&sortBy=publishedAt&pageSize=20`,
        {
          headers: {
            "X-Api-Key": newsApiKey,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.articles) {
          allArticles.push(...data.articles.map((a: any) => ({ ...a, apiCategory: "general" })));
        }
      }
    } catch (err) {
      console.error("Error fetching global news:", err);
    }

    console.log(`Fetched ${allArticles.length} articles total`);

    // Deduplicate by title
    const uniqueArticles = allArticles.filter((article, index, self) =>
      article.title && 
      article.title !== "[Removed]" &&
      index === self.findIndex(a => a.title === article.title)
    );

    console.log(`${uniqueArticles.length} unique articles after deduplication`);

    // Get existing URLs to avoid duplicates
    const { data: existingItems } = await supabaseClient
      .from("news_items")
      .select("url")
      .order("created_at", { ascending: false })
      .limit(500);

    const existingUrls = new Set(existingItems?.map(item => item.url) || []);

    // Transform and insert new articles
    const newArticles = uniqueArticles
      .filter(article => article.url && !existingUrls.has(article.url))
      .slice(0, 30); // Limit to 30 new articles per fetch

    console.log(`${newArticles.length} new articles to insert`);

    let insertedCount = 0;

    for (const article of newArticles) {
      const title = article.title || "Untitled";
      const description = article.description || article.content || "";
      const countryCode = detectCountryFromContent(title, description);
      const coords = countryCoordinates[countryCode] || countryCoordinates["default"];
      
      const newsItem = {
        title: title.substring(0, 255),
        summary: description.substring(0, 1000) || "No description available.",
        url: article.url,
        source: article.source?.name || "Unknown Source",
        source_credibility: "medium" as const,
        published_at: article.publishedAt || new Date().toISOString(),
        lat: coords.lat + (Math.random() - 0.5) * 2, // Add small random offset
        lon: coords.lon + (Math.random() - 0.5) * 2,
        country: countryNames[countryCode] || "Unknown",
        region: coords.region,
        tags: extractTags(title, description),
        confidence_score: 0.7,
        confidence_level: "developing" as const,
        threat_level: detectThreatLevel(title, description),
        actor_type: "organization" as const,
        category: detectCategory(title, description) as any,
        user_id: userId,
      };

      const { error: insertError } = await supabaseClient
        .from("news_items")
        .insert(newsItem);

      if (insertError) {
        console.error("Error inserting article:", insertError.message);
      } else {
        insertedCount++;
      }
    }

    console.log(`Successfully inserted ${insertedCount} new articles`);

    return new Response(
      JSON.stringify({
        success: true,
        fetched: uniqueArticles.length,
        inserted: insertedCount,
        message: `Fetched ${uniqueArticles.length} articles, inserted ${insertedCount} new items`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-news:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
