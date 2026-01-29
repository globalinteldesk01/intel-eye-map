import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OSINT-focused search topics for geopolitical intelligence
const OSINT_TOPICS = [
  'military conflict breaking news',
  'terrorism attack threat',
  'civil unrest protests',
  'coup government overthrow',
  'diplomatic crisis international',
  'sanctions embargo',
  'missile strike bombing',
  'humanitarian crisis emergency',
  'border conflict tension',
  'cyber attack infrastructure'
];

// Location database with coordinates for geo-mapping
const LOCATION_DATABASE: Record<string, { lat: number; lon: number; region: string }> = {
  'Nigeria': { lat: 9.0820, lon: 8.6753, region: 'West Africa' },
  'Palestine': { lat: 31.9522, lon: 35.2332, region: 'Middle East' },
  'Gaza': { lat: 31.5, lon: 34.47, region: 'Middle East' },
  'Israel': { lat: 31.0461, lon: 34.8516, region: 'Middle East' },
  'Ukraine': { lat: 48.3794, lon: 31.1656, region: 'Eastern Europe' },
  'Russia': { lat: 55.7558, lon: 37.6173, region: 'Eastern Europe' },
  'Syria': { lat: 34.8021, lon: 38.9968, region: 'Middle East' },
  'Iran': { lat: 35.6892, lon: 51.3890, region: 'Middle East' },
  'United States': { lat: 38.9072, lon: -77.0369, region: 'North America' },
  'China': { lat: 39.9042, lon: 116.4074, region: 'East Asia' },
  'India': { lat: 28.6139, lon: 77.2090, region: 'South Asia' },
  'Taiwan': { lat: 25.0330, lon: 121.5654, region: 'East Asia' },
  'North Korea': { lat: 39.0392, lon: 125.7625, region: 'East Asia' },
  'South Korea': { lat: 37.5665, lon: 126.9780, region: 'East Asia' },
  'Yemen': { lat: 15.3694, lon: 44.1910, region: 'Middle East' },
  'Saudi Arabia': { lat: 24.7136, lon: 46.6753, region: 'Middle East' },
  'Iraq': { lat: 33.3152, lon: 44.3661, region: 'Middle East' },
  'Afghanistan': { lat: 34.5553, lon: 69.2075, region: 'Central Asia' },
  'Pakistan': { lat: 33.6844, lon: 73.0479, region: 'South Asia' },
  'Lebanon': { lat: 33.8938, lon: 35.5018, region: 'Middle East' },
  'Turkey': { lat: 39.9334, lon: 32.8597, region: 'Middle East' },
  'Ethiopia': { lat: 9.1450, lon: 40.4897, region: 'East Africa' },
  'Sudan': { lat: 15.5007, lon: 32.5599, region: 'North Africa' },
  'Libya': { lat: 32.8872, lon: 13.1913, region: 'North Africa' },
  'Myanmar': { lat: 19.7633, lon: 96.0785, region: 'Southeast Asia' },
  'Venezuela': { lat: 10.4806, lon: -66.9036, region: 'South America' },
  'Mexico': { lat: 19.4326, lon: -99.1332, region: 'North America' },
  'Philippines': { lat: 14.5995, lon: 120.9842, region: 'Southeast Asia' },
  'Somalia': { lat: 2.0469, lon: 45.3182, region: 'East Africa' },
  'Kenya': { lat: -1.2921, lon: 36.8219, region: 'East Africa' },
  'Mali': { lat: 12.6392, lon: -8.0029, region: 'West Africa' },
  'Burkina Faso': { lat: 12.3714, lon: -1.5197, region: 'West Africa' },
  'Niger': { lat: 13.5116, lon: 2.1254, region: 'West Africa' },
  'Democratic Republic of Congo': { lat: -4.4419, lon: 15.2663, region: 'Central Africa' },
  'South Africa': { lat: -25.7461, lon: 28.1881, region: 'Southern Africa' },
  'Egypt': { lat: 30.0444, lon: 31.2357, region: 'North Africa' },
  'Morocco': { lat: 33.9716, lon: -6.8498, region: 'North Africa' },
  'Algeria': { lat: 36.7538, lon: 3.0588, region: 'North Africa' },
  'Tunisia': { lat: 36.8065, lon: 10.1815, region: 'North Africa' },
  'Jordan': { lat: 31.9454, lon: 35.9284, region: 'Middle East' },
  'Kuwait': { lat: 29.3759, lon: 47.9774, region: 'Middle East' },
  'Bahrain': { lat: 26.0667, lon: 50.5577, region: 'Middle East' },
  'Qatar': { lat: 25.2854, lon: 51.5310, region: 'Middle East' },
  'UAE': { lat: 24.4539, lon: 54.3773, region: 'Middle East' },
  'Oman': { lat: 23.5880, lon: 58.3829, region: 'Middle East' },
  'Bangladesh': { lat: 23.8103, lon: 90.4125, region: 'South Asia' },
  'Sri Lanka': { lat: 6.9271, lon: 79.8612, region: 'South Asia' },
  'Nepal': { lat: 27.7172, lon: 85.3240, region: 'South Asia' },
  'Thailand': { lat: 13.7563, lon: 100.5018, region: 'Southeast Asia' },
  'Vietnam': { lat: 21.0278, lon: 105.8342, region: 'Southeast Asia' },
  'Indonesia': { lat: -6.2088, lon: 106.8456, region: 'Southeast Asia' },
  'Malaysia': { lat: 3.1390, lon: 101.6869, region: 'Southeast Asia' },
  'Singapore': { lat: 1.3521, lon: 103.8198, region: 'Southeast Asia' },
  'Japan': { lat: 35.6762, lon: 139.6503, region: 'East Asia' },
  'Australia': { lat: -35.2809, lon: 149.1300, region: 'Oceania' },
  'United Kingdom': { lat: 51.5074, lon: -0.1278, region: 'Western Europe' },
  'France': { lat: 48.8566, lon: 2.3522, region: 'Western Europe' },
  'Germany': { lat: 52.5200, lon: 13.4050, region: 'Western Europe' },
  'Italy': { lat: 41.9028, lon: 12.4964, region: 'Western Europe' },
  'Spain': { lat: 40.4168, lon: -3.7038, region: 'Western Europe' },
  'Poland': { lat: 52.2297, lon: 21.0122, region: 'Eastern Europe' },
  'Romania': { lat: 44.4268, lon: 26.1025, region: 'Eastern Europe' },
  'Hungary': { lat: 47.4979, lon: 19.0402, region: 'Eastern Europe' },
  'Czech Republic': { lat: 50.0755, lon: 14.4378, region: 'Eastern Europe' },
  'Greece': { lat: 37.9838, lon: 23.7275, region: 'Southern Europe' },
  'Serbia': { lat: 44.8176, lon: 20.4633, region: 'Eastern Europe' },
  'Kosovo': { lat: 42.6026, lon: 20.9030, region: 'Eastern Europe' },
  'Bosnia': { lat: 43.8563, lon: 18.4131, region: 'Eastern Europe' },
  'Croatia': { lat: 45.8150, lon: 15.9819, region: 'Eastern Europe' },
  'Canada': { lat: 45.4215, lon: -75.6972, region: 'North America' },
  'Brazil': { lat: -15.8267, lon: -47.9218, region: 'South America' },
  'Argentina': { lat: -34.6037, lon: -58.3816, region: 'South America' },
  'Colombia': { lat: 4.7110, lon: -74.0721, region: 'South America' },
  'Chile': { lat: -33.4489, lon: -70.6693, region: 'South America' },
  'Peru': { lat: -12.0464, lon: -77.0428, region: 'South America' },
  'Ecuador': { lat: -0.1807, lon: -78.4678, region: 'South America' },
};

// Map our categories to database enum values
type NewsCategory = 'security' | 'diplomacy' | 'economy' | 'conflict' | 'humanitarian' | 'technology';
type ThreatLevel = 'low' | 'elevated' | 'high' | 'critical';
type ConfidenceLevel = 'verified' | 'developing' | 'breaking';
type SourceCredibility = 'high' | 'medium' | 'low';
type ActorType = 'state' | 'non-state' | 'organization';

// Classify news into database-compatible categories
function classifyCategory(title: string, summary: string): NewsCategory {
  const text = (title + ' ' + summary).toLowerCase();
  
  if (/war|military|attack|conflict|strike|combat|offensive|troops|army|invasion|airstrike|bombing/i.test(text)) {
    return 'conflict';
  }
  if (/election|vote|political|government|diplomat|summit|treaty|sanction|embassy|bilateral|international relations/i.test(text)) {
    return 'diplomacy';
  }
  if (/security|threat|terror|terrorism|extremist|militant|armed group|insurgent/i.test(text)) {
    return 'security';
  }
  if (/economy|market|trade|inflation|currency|gdp|recession|sanctions|embargo|oil|energy|commodities/i.test(text)) {
    return 'economy';
  }
  if (/disaster|earthquake|flood|hurricane|refugee|humanitarian|famine|crisis|evacuation|emergency|aid/i.test(text)) {
    return 'humanitarian';
  }
  if (/cyber|hack|data breach|ransomware|malware|digital|technology|infrastructure attack/i.test(text)) {
    return 'technology';
  }
  
  return 'security'; // Default for OSINT relevance
}

// Determine threat level based on content severity
function determineThreatLevel(title: string, summary: string): ThreatLevel {
  const text = (title + ' ' + summary).toLowerCase();
  
  if (/killed|dead|massacre|coup|war declared|nuclear|bombing|mass casualty|invasion|genocide/i.test(text)) {
    return 'critical';
  }
  if (/injured|conflict|protest|crisis|hostage|attack|strike|violence|clashes/i.test(text)) {
    return 'high';
  }
  if (/dispute|tension|concern|warning|alert|threat|escalation|standoff/i.test(text)) {
    return 'elevated';
  }
  
  return 'low';
}

// Calculate source credibility
function calculateSourceCredibility(source: string): { credibility: SourceCredibility; score: number } {
  const sourceLower = source.toLowerCase();
  
  const highSources = ['bbc', 'reuters', 'ap news', 'associated press', 'afp', 'cnn', 'guardian', 'new york times', 'washington post', 'economist'];
  const mediumSources = ['aljazeera', 'france24', 'dw', 'independent', 'sky news', 'nbc', 'abc news', 'cbs', 'politico', 'foreign policy'];
  
  if (highSources.some(s => sourceLower.includes(s))) {
    return { credibility: 'high', score: 0.85 };
  }
  if (mediumSources.some(s => sourceLower.includes(s))) {
    return { credibility: 'medium', score: 0.70 };
  }
  
  return { credibility: 'low', score: 0.55 };
}

// Extract location from text and get coordinates
function extractLocation(text: string): { country: string; region: string; lat: number; lon: number } {
  const textLower = text.toLowerCase();
  
  // Check for specific locations
  for (const [location, data] of Object.entries(LOCATION_DATABASE)) {
    const keywords = location.toLowerCase().split(' ');
    if (keywords.some(kw => textLower.includes(kw))) {
      return { country: location, ...data };
    }
  }
  
  // Check for common aliases
  const aliases: Record<string, string> = {
    'kyiv': 'Ukraine', 'kiev': 'Ukraine',
    'moscow': 'Russia', 'kremlin': 'Russia',
    'tehran': 'Iran', 'persian gulf': 'Iran',
    'beijing': 'China', 'taipei': 'Taiwan',
    'pyongyang': 'North Korea', 'seoul': 'South Korea',
    'kabul': 'Afghanistan', 'islamabad': 'Pakistan',
    'damascus': 'Syria', 'aleppo': 'Syria',
    'baghdad': 'Iraq', 'mosul': 'Iraq',
    'tripoli': 'Libya', 'benghazi': 'Libya',
    'khartoum': 'Sudan', 'addis ababa': 'Ethiopia',
    'nairobi': 'Kenya', 'mogadishu': 'Somalia',
    'lagos': 'Nigeria', 'abuja': 'Nigeria',
    'johannesburg': 'South Africa', 'cape town': 'South Africa',
    'cairo': 'Egypt', 'tel aviv': 'Israel', 'jerusalem': 'Israel',
    'beirut': 'Lebanon', 'ankara': 'Turkey', 'istanbul': 'Turkey',
    'riyadh': 'Saudi Arabia', 'sanaa': 'Yemen', 'aden': 'Yemen',
    'west bank': 'Palestine', 'ramallah': 'Palestine',
    'crimea': 'Ukraine', 'donbas': 'Ukraine', 'kherson': 'Ukraine',
    'mariupol': 'Ukraine', 'zaporizhzhia': 'Ukraine',
    'houthi': 'Yemen', 'hezbollah': 'Lebanon', 'hamas': 'Palestine',
  };
  
  for (const [alias, country] of Object.entries(aliases)) {
    if (textLower.includes(alias)) {
      const data = LOCATION_DATABASE[country];
      if (data) {
        return { country, ...data };
      }
    }
  }
  
  // Default to unknown with generic coordinates
  return { country: 'Unknown', region: 'Global', lat: 0, lon: 0 };
}

// Determine actor type
function determineActorType(text: string): ActorType {
  const textLower = text.toLowerCase();
  
  if (/government|military|army|navy|air force|official|ministry|president|prime minister|parliament/i.test(textLower)) {
    return 'state';
  }
  if (/rebel|insurgent|militia|terrorist|extremist|guerrilla|faction|armed group|separatist/i.test(textLower)) {
    return 'non-state';
  }
  
  return 'organization';
}

// Check if article is OSINT relevant
function isOsintRelevant(title: string, summary: string): boolean {
  const text = (title + ' ' + summary).toLowerCase();
  
  const inclusionKeywords = [
    'military', 'conflict', 'war', 'attack', 'bombing', 'strike', 'troops',
    'terrorist', 'terrorism', 'extremist', 'militant', 'insurgent',
    'security', 'threat', 'intelligence', 'espionage', 'spy',
    'diplomatic', 'sanctions', 'embassy', 'bilateral', 'summit',
    'protest', 'unrest', 'riot', 'coup', 'revolution',
    'humanitarian', 'refugee', 'crisis', 'disaster',
    'cyber', 'hack', 'breach', 'infrastructure',
    'missile', 'nuclear', 'weapon', 'drone',
    'border', 'territory', 'invasion', 'occupation',
    'hostage', 'kidnap', 'assassination', 'execution'
  ];
  
  const exclusionKeywords = [
    'entertainment', 'celebrity', 'sports', 'movie', 'music', 'fashion',
    'recipe', 'lifestyle', 'shopping', 'sale', 'discount',
    'weather forecast', 'horoscope', 'lottery'
  ];
  
  if (exclusionKeywords.some(kw => text.includes(kw))) {
    return false;
  }
  
  return inclusionKeywords.some(kw => text.includes(kw));
}

// Scrape Google News RSS feed (reliable method for news aggregation)
async function scrapeGoogleNewsRss(query: string): Promise<Array<{
  title: string;
  link: string;
  source: string;
  summary: string;
  published: string;
}>> {
  const articles: Array<{ title: string; link: string; source: string; summary: string; published: string }> = [];
  
  try {
    const encodedQuery = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
    
    console.log(`Fetching RSS for: ${query}`);
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    
    if (!response.ok) {
      console.error(`RSS fetch failed: ${response.status}`);
      return articles;
    }
    
    const xml = await response.text();
    
    // Parse RSS XML
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    for (const item of items.slice(0, 10)) {
      try {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                          item.match(/<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                         item.match(/<description>(.*?)<\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);
        
        const title = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
        const link = linkMatch?.[1]?.trim() || '';
        const summary = descMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
        const published = pubDateMatch?.[1]?.trim() || new Date().toISOString();
        const source = sourceMatch?.[1]?.trim() || 'Google News';
        
        if (title && link) {
          articles.push({ title, link, source, summary, published });
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error(`RSS scrape error for "${query}":`, error);
  }
  
  return articles;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body for custom topics
    let topics = OSINT_TOPICS;
    let maxPerTopic = 5;
    
    try {
      const body = await req.json();
      if (body.topics && Array.isArray(body.topics)) {
        topics = body.topics;
      }
      if (body.maxPerTopic && typeof body.maxPerTopic === 'number') {
        maxPerTopic = Math.min(body.maxPerTopic, 10);
      }
    } catch {
      // Use defaults if no body
    }

    console.log(`Scraping ${topics.length} topics with max ${maxPerTopic} per topic`);

    const allArticles: Array<{
      title: string;
      summary: string;
      url: string;
      source: string;
      country: string;
      region: string;
      lat: number;
      lon: number;
      category: NewsCategory;
      threat_level: ThreatLevel;
      confidence_level: ConfidenceLevel;
      confidence_score: number;
      source_credibility: SourceCredibility;
      actor_type: ActorType;
      published_at: string;
      user_id: string;
      tags: string[];
    }> = [];

    const seenTitles = new Set<string>();

    // Scrape each topic
    for (const topic of topics) {
      try {
        const articles = await scrapeGoogleNewsRss(topic);
        
        for (const article of articles.slice(0, maxPerTopic)) {
          // Skip duplicates
          const titleKey = article.title.toLowerCase().substring(0, 50);
          if (seenTitles.has(titleKey)) continue;
          seenTitles.add(titleKey);
          
          // Check OSINT relevance
          if (!isOsintRelevant(article.title, article.summary)) continue;
          
          // Process article
          const location = extractLocation(article.title + ' ' + article.summary);
          const category = classifyCategory(article.title, article.summary);
          const threatLevel = determineThreatLevel(article.title, article.summary);
          const { credibility, score } = calculateSourceCredibility(article.source);
          const actorType = determineActorType(article.title + ' ' + article.summary);
          
          // Parse published date
          let publishedAt: string;
          try {
            publishedAt = new Date(article.published).toISOString();
          } catch {
            publishedAt = new Date().toISOString();
          }
          
          // Generate tags
          const tags = [topic.split(' ')[0], category, location.region].filter(Boolean);
          
          allArticles.push({
            title: article.title.substring(0, 500),
            summary: (article.summary || article.title).substring(0, 2000),
            url: article.link,
            source: article.source.substring(0, 200),
            country: location.country,
            region: location.region,
            lat: location.lat,
            lon: location.lon,
            category,
            threat_level: threatLevel,
            confidence_level: threatLevel === 'critical' ? 'breaking' : 'developing',
            confidence_score: score,
            source_credibility: credibility,
            actor_type: actorType,
            published_at: publishedAt,
            user_id: user.id,
            tags,
          });
        }
        
        // Rate limiting - wait between topics
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error scraping topic "${topic}":`, error);
        continue;
      }
    }

    console.log(`Scraped ${allArticles.length} OSINT-relevant articles`);

    // Insert into database (upsert to avoid duplicates)
    if (allArticles.length > 0) {
      // Use service role for insertion
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Check for existing URLs to avoid duplicates
      const urls = allArticles.map(a => a.url);
      const { data: existingItems } = await serviceClient
        .from('news_items')
        .select('url')
        .in('url', urls);
      
      const existingUrls = new Set((existingItems || []).map((item: { url: string }) => item.url));
      const newArticles = allArticles.filter(a => !existingUrls.has(a.url));

      if (newArticles.length > 0) {
        const { error: insertError } = await serviceClient
          .from('news_items')
          .insert(newArticles);

        if (insertError) {
          console.error('Insert error:', insertError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: insertError.message,
              scraped: allArticles.length,
              inserted: 0
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Inserted ${newArticles.length} new articles`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Scraped ${allArticles.length} articles, inserted ${newArticles.length} new`,
          scraped: allArticles.length,
          inserted: newArticles.length,
          duplicates: allArticles.length - newArticles.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'No OSINT-relevant articles found',
        scraped: 0,
        inserted: 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Scraper error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
