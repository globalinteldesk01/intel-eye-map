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

// Country coordinate mapping for geocoding - using major city coordinates with safe land offsets
const countryCoordinates: Record<string, { lat: number; lon: number; region: string; offsetRange: number }> = {
  "us": { lat: 38.9072, lon: -77.0369, region: "North America", offsetRange: 0.3 },      // Washington DC
  "gb": { lat: 51.5074, lon: -0.1278, region: "Europe", offsetRange: 0.2 },              // London
  "de": { lat: 52.5200, lon: 13.4050, region: "Europe", offsetRange: 0.3 },              // Berlin
  "fr": { lat: 48.8566, lon: 2.3522, region: "Europe", offsetRange: 0.3 },               // Paris
  "ru": { lat: 55.7558, lon: 37.6173, region: "Europe", offsetRange: 0.5 },              // Moscow
  "cn": { lat: 39.9042, lon: 116.4074, region: "Asia", offsetRange: 0.4 },               // Beijing
  "jp": { lat: 35.6762, lon: 139.6503, region: "Asia", offsetRange: 0.15 },              // Tokyo (small offset - island)
  "in": { lat: 28.6139, lon: 77.2090, region: "Asia", offsetRange: 0.4 },                // New Delhi
  "br": { lat: -15.7801, lon: -47.9292, region: "South America", offsetRange: 0.5 },     // Brasilia
  "au": { lat: -35.2809, lon: 149.1300, region: "Oceania", offsetRange: 0.3 },           // Canberra
  "za": { lat: -25.7461, lon: 28.1881, region: "Africa", offsetRange: 0.3 },             // Pretoria
  "eg": { lat: 30.0444, lon: 31.2357, region: "Middle East", offsetRange: 0.2 },         // Cairo
  "sa": { lat: 24.7136, lon: 46.6753, region: "Middle East", offsetRange: 0.4 },         // Riyadh
  "ir": { lat: 35.6892, lon: 51.3890, region: "Middle East", offsetRange: 0.3 },         // Tehran
  "il": { lat: 31.7683, lon: 35.2137, region: "Middle East", offsetRange: 0.1 },         // Jerusalem (small country)
  "ua": { lat: 50.4501, lon: 30.5234, region: "Europe", offsetRange: 0.3 },              // Kyiv
  "kr": { lat: 37.5665, lon: 126.9780, region: "Asia", offsetRange: 0.15 },              // Seoul (peninsula)
  "mx": { lat: 19.4326, lon: -99.1332, region: "North America", offsetRange: 0.3 },      // Mexico City
  "ca": { lat: 45.4215, lon: -75.6972, region: "North America", offsetRange: 0.4 },      // Ottawa
  "ng": { lat: 9.0765, lon: 7.3986, region: "Africa", offsetRange: 0.3 },                // Abuja
  "pk": { lat: 33.6844, lon: 73.0479, region: "Asia", offsetRange: 0.3 },                // Islamabad
  "tr": { lat: 39.9334, lon: 32.8597, region: "Middle East", offsetRange: 0.3 },         // Ankara
  "ae": { lat: 24.4539, lon: 54.3773, region: "Middle East", offsetRange: 0.15 },        // Abu Dhabi
  "sg": { lat: 1.3521, lon: 103.8198, region: "Asia", offsetRange: 0.05 },               // Singapore (tiny)
  "it": { lat: 41.9028, lon: 12.4964, region: "Europe", offsetRange: 0.2 },              // Rome
  "es": { lat: 40.4168, lon: -3.7038, region: "Europe", offsetRange: 0.3 },              // Madrid
  "nl": { lat: 52.3676, lon: 4.9041, region: "Europe", offsetRange: 0.1 },               // Amsterdam
  "be": { lat: 50.8503, lon: 4.3517, region: "Europe", offsetRange: 0.1 },               // Brussels
  "ie": { lat: 53.3498, lon: -6.2603, region: "Europe", offsetRange: 0.15 },             // Dublin
  "nz": { lat: -41.2866, lon: 174.7756, region: "Oceania", offsetRange: 0.2 },           // Wellington
  "default": { lat: 40.7128, lon: -74.0060, region: "Global", offsetRange: 0.2 },        // New York (fallback)
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
  "ae": "UAE",
  "sg": "Singapore",
  "it": "Italy",
  "es": "Spain",
  "nl": "Netherlands",
  "be": "Belgium",
  "ie": "Ireland",
  "nz": "New Zealand",
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

function detectCountryFromContent(title: string, description: string, sourceCountry?: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  const countryPatterns: Record<string, string[]> = {
    "ua": ["ukraine", "kyiv", "kiev", "ukrainian", "zelensky"],
    "ru": ["russia", "russian", "moscow", "kremlin", "putin"],
    "cn": ["china", "chinese", "beijing", "xi jinping"],
    "ir": ["iran", "iranian", "tehran"],
    "il": ["israel", "israeli", "tel aviv", "jerusalem", "netanyahu", "gaza", "hamas"],
    "gb": ["britain", "british", "uk ", "london", "england", "wales", "scotland", "westminster"],
    "de": ["germany", "german", "berlin", "merkel", "scholz"],
    "fr": ["france", "french", "paris", "macron"],
    "sa": ["saudi", "riyadh"],
    "tr": ["turkey", "turkish", "ankara", "erdogan"],
    "pk": ["pakistan", "pakistani", "islamabad", "karachi"],
    "in": ["india", "indian", "delhi", "mumbai", "modi"],
    "kr": ["south korea", "korean", "seoul"],
    "jp": ["japan", "japanese", "tokyo"],
    "au": ["australia", "australian", "sydney", "melbourne", "canberra"],
    "ca": ["canada", "canadian", "ottawa", "toronto"],
    "mx": ["mexico", "mexican", "mexico city"],
    "br": ["brazil", "brazilian", "brasilia", "sao paulo"],
    "eg": ["egypt", "egyptian", "cairo"],
    "za": ["south africa", "pretoria", "johannesburg"],
    "ng": ["nigeria", "nigerian", "lagos", "abuja"],
    "ae": ["uae", "dubai", "abu dhabi", "emirates"],
    "sg": ["singapore"],
    "it": ["italy", "italian", "rome", "milan"],
    "es": ["spain", "spanish", "madrid", "barcelona"],
    "nl": ["netherlands", "dutch", "amsterdam", "holland"],
    "nz": ["new zealand", "wellington", "auckland"],
    "us": ["united states", "u.s.", "america", "washington", "pentagon", "white house", "trump", "biden"],
  };
  
  // Check content first for more accurate detection
  for (const [code, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(p => text.includes(p))) {
      return code;
    }
  }
  
  // Use source country from API if available and valid
  if (sourceCountry && countryCoordinates[sourceCountry]) {
    return sourceCountry;
  }
  
  return "us"; // Default fallback
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
    const mediastackApiKey = Deno.env.get("MEDIASTACK_API_KEY");
    
    if (!newsApiKey && !mediastackApiKey) {
      console.error("No news API keys configured");
      return new Response(JSON.stringify({ error: "No news API configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allArticles: any[] = [];

    // ==================== NEWSAPI.ORG ====================
    if (newsApiKey) {
      console.log("Fetching from NewsAPI.org...");
      
      // Fetch breaking news from multiple countries worldwide
      const countries = ["us", "gb", "au", "ca", "in", "za", "ae", "sg", "de", "fr", "it", "es", "nl", "be", "ie", "nz"];

      // Fetch top headlines from each country for global coverage
      for (const country of countries) {
        try {
          const response = await fetch(
            `https://newsapi.org/v2/top-headlines?country=${country}&pageSize=5`,
            {
              headers: {
                "X-Api-Key": newsApiKey,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.articles) {
              allArticles.push(...data.articles.map((a: any) => ({ ...a, sourceCountry: country, apiSource: "newsapi" })));
            }
          } else {
            console.error(`NewsAPI: Failed to fetch ${country}:`, response.status);
          }
        } catch (err) {
          console.error(`NewsAPI: Error fetching ${country}:`, err);
        }
      }

      // Fetch latest breaking news globally with broad development keywords
      const breakingQueries = [
        "breaking OR developing OR urgent",
        "government OR parliament OR minister OR president",
        "military OR defense OR troops OR security",
        "economy OR market OR trade OR sanctions",
        "protest OR strike OR election OR vote",
        "disaster OR emergency OR crisis OR humanitarian"
      ];

      for (const query of breakingQueries) {
        try {
          const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 24 hours
          const response = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=10`,
            {
              headers: {
                "X-Api-Key": newsApiKey,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.articles) {
              allArticles.push(...data.articles.map((a: any) => ({ ...a, queryType: query, apiSource: "newsapi" })));
            }
          }
        } catch (err) {
          console.error(`NewsAPI: Error fetching query "${query}":`, err);
        }
      }
      
      console.log(`NewsAPI: Fetched ${allArticles.filter(a => a.apiSource === "newsapi").length} articles`);
    }

    // ==================== MEDIASTACK ====================
    if (mediastackApiKey) {
      console.log("Fetching from Mediastack...");
      
      // Mediastack countries - using ISO codes
      const mediastackCountries = ["us", "gb", "au", "ca", "in", "de", "fr", "it", "es", "jp", "cn", "ru", "br", "za", "ae"];
      
      for (const country of mediastackCountries) {
        try {
          const response = await fetch(
            `http://api.mediastack.com/v1/news?access_key=${mediastackApiKey}&countries=${country}&languages=en&limit=5&sort=published_desc`,
          );

          if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
              // Transform Mediastack format to match our structure
              const transformedArticles = data.data.map((article: any) => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: { name: article.source },
                publishedAt: article.published_at,
                content: article.description,
                sourceCountry: country,
                apiSource: "mediastack",
              }));
              allArticles.push(...transformedArticles);
            }
          } else {
            console.error(`Mediastack: Failed to fetch ${country}:`, response.status);
          }
        } catch (err) {
          console.error(`Mediastack: Error fetching ${country}:`, err);
        }
      }

      // Fetch breaking/live news with keywords
      const mediastackKeywords = ["breaking", "military", "government", "crisis", "economy"];
      
      for (const keyword of mediastackKeywords) {
        try {
          const response = await fetch(
            `http://api.mediastack.com/v1/news?access_key=${mediastackApiKey}&keywords=${keyword}&languages=en&limit=10&sort=published_desc`,
          );

          if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
              const transformedArticles = data.data.map((article: any) => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: { name: article.source },
                publishedAt: article.published_at,
                content: article.description,
                queryType: keyword,
                apiSource: "mediastack",
              }));
              allArticles.push(...transformedArticles);
            }
          }
        } catch (err) {
          console.error(`Mediastack: Error fetching keyword "${keyword}":`, err);
        }
      }
      
      console.log(`Mediastack: Fetched ${allArticles.filter(a => a.apiSource === "mediastack").length} articles`);
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
      const countryCode = detectCountryFromContent(title, description, article.sourceCountry);
      const coords = countryCoordinates[countryCode] || countryCoordinates["default"];
      
      // Use country-specific safe offset range to avoid placing pins in the sea
      const offsetRange = coords.offsetRange || 0.2;
      const latOffset = (Math.random() - 0.5) * offsetRange;
      const lonOffset = (Math.random() - 0.5) * offsetRange;
      
      const newsItem = {
        title: title.substring(0, 255),
        summary: description.substring(0, 1000) || "No description available.",
        url: article.url,
        source: article.source?.name || "Unknown Source",
        source_credibility: "medium" as const,
        published_at: article.publishedAt || new Date().toISOString(),
        lat: coords.lat + latOffset,
        lon: coords.lon + lonOffset,
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
