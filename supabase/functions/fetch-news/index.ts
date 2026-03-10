import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type Credibility = "high" | "medium" | "low";
type ThreatLevel = "critical" | "high" | "elevated" | "low";
type ConfidenceLevel = "confirmed" | "corroborated" | "developing" | "weak";
type ActorType =
  | "state"
  | "military"
  | "militant"
  | "terrorist"
  | "government"
  | "civilian"
  | "organization"
  | "corporate"
  | "humanitarian"
  | "unknown";

interface SourceDef {
  name: string;
  url: string;
  type: "rss" | "api-newsapi" | "api-mediastack";
  priority: 1 | 2 | 3;
  credibility: Credibility;
  language: string;
  region: string;
  tags: string[];
  enabled: boolean;
  maxItems?: number;
}

interface RawArticle {
  title: string;
  description: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  sourceCredibility: Credibility;
  sourcePriority: number;
  sourceRegion: string;
  sourceLanguage: string;
  sourceTags: string[];
  fingerprint?: string;
  relevanceScore?: number;
}

interface GeoResult {
  lat: number | null;
  lon: number | null;
  country: string;
  region: string;
  confidence: number;
  matchedBy: "city" | "country" | "unknown";
}

interface ProcessedRow {
  title: string;
  summary: string;
  url: string;
  source: string;
  source_credibility: Credibility;
  published_at: string;
  lat: number | null;
  lon: number | null;
  country: string;
  region: string;
  tags: string[];
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  threat_level: ThreatLevel;
  actor_type: ActorType;
  category: string;
  user_id: string;
}

const RSS_SOURCES: SourceDef[] = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", type: "rss", priority: 1, credibility: "high", language: "en", region: "Global", tags: ["world", "media", "wire"], enabled: true, maxItems: 25 },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", type: "rss", priority: 1, credibility: "high", language: "en", region: "Global", tags: ["world", "middle-east", "media"], enabled: true, maxItems: 25 },
  { name: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews", type: "rss", priority: 1, credibility: "high", language: "en", region: "Global", tags: ["wire", "world"], enabled: true, maxItems: 25 },
  { name: "AP News", url: "https://rsshub.app/apnews/topics/world-news", type: "rss", priority: 1, credibility: "high", language: "en", region: "Global", tags: ["wire", "world"], enabled: true, maxItems: 25 },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", type: "rss", priority: 2, credibility: "high", language: "en", region: "Global", tags: ["world", "media"], enabled: true, maxItems: 25 },
  { name: "France24", url: "https://www.france24.com/en/rss", type: "rss", priority: 1, credibility: "high", language: "en", region: "Global", tags: ["world", "broadcast"], enabled: true, maxItems: 25 },
  { name: "DW News", url: "https://rss.dw.com/rdf/rss-en-all", type: "rss", priority: 1, credibility: "high", language: "en", region: "Global", tags: ["world", "broadcast"], enabled: true, maxItems: 25 },

  { name: "Defense One", url: "https://www.defenseone.com/rss/", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Global", tags: ["defense", "security"], enabled: true, maxItems: 25 },
  { name: "The War Zone", url: "https://www.twz.com/feed", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Global", tags: ["defense", "security"], enabled: true, maxItems: 25 },
  { name: "CSIS", url: "https://www.csis.org/analysis/feed", type: "rss", priority: 3, credibility: "high", language: "en", region: "Global", tags: ["policy", "security"], enabled: true, maxItems: 20 },
  { name: "War on the Rocks", url: "https://warontherocks.com/feed/", type: "rss", priority: 3, credibility: "high", language: "en", region: "Global", tags: ["defense", "analysis"], enabled: true, maxItems: 20 },

  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Middle East", tags: ["middle-east", "regional"], enabled: true, maxItems: 25 },
  { name: "Times of Israel", url: "https://www.timesofisrael.com/feed/", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Middle East", tags: ["middle-east", "regional"], enabled: true, maxItems: 25 },
  { name: "Arab News", url: "https://www.arabnews.com/rss.xml", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Middle East", tags: ["middle-east", "regional"], enabled: true, maxItems: 25 },
  { name: "Africanews", url: "https://www.africanews.com/feed/", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Africa", tags: ["africa", "regional"], enabled: true, maxItems: 25 },
  { name: "ReliefWeb", url: "https://reliefweb.int/updates/rss.xml", type: "rss", priority: 2, credibility: "high", language: "en", region: "Global", tags: ["humanitarian", "crisis"], enabled: true, maxItems: 25 },

  { name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Asia", tags: ["asia", "regional"], enabled: true, maxItems: 25 },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar", type: "rss", priority: 2, credibility: "high", language: "en", region: "Asia", tags: ["asia", "regional"], enabled: true, maxItems: 25 },
  { name: "The Diplomat", url: "https://thediplomat.com/feed/", type: "rss", priority: 3, credibility: "high", language: "en", region: "Asia", tags: ["asia", "analysis"], enabled: true, maxItems: 20 },
  { name: "NDTV India", url: "https://feeds.feedburner.com/ndtvnews-top-stories", type: "rss", priority: 2, credibility: "medium", language: "en", region: "India", tags: ["india", "regional"], enabled: true, maxItems: 25 },
  { name: "Dawn Pakistan", url: "https://www.dawn.com/feeds/home", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Pakistan", tags: ["pakistan", "regional"], enabled: true, maxItems: 25 },
  { name: "Channel News Asia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", type: "rss", priority: 2, credibility: "high", language: "en", region: "Asia", tags: ["asia", "regional"], enabled: true, maxItems: 25 },

  { name: "Kyiv Independent", url: "https://kyivindependent.com/feed/", type: "rss", priority: 1, credibility: "medium", language: "en", region: "Europe", tags: ["ukraine", "regional"], enabled: true, maxItems: 25 },
  { name: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", type: "rss", priority: 2, credibility: "medium", language: "en", region: "Europe", tags: ["russia", "regional"], enabled: true, maxItems: 25 },
  { name: "Balkan Insight", url: "https://balkaninsight.com/feed/", type: "rss", priority: 3, credibility: "medium", language: "en", region: "Europe", tags: ["balkans", "regional"], enabled: true, maxItems: 20 },
  { name: "EUobserver", url: "https://euobserver.com/rss.xml", type: "rss", priority: 3, credibility: "high", language: "en", region: "Europe", tags: ["europe", "policy"], enabled: true, maxItems: 20 },

  { name: "InSight Crime", url: "https://insightcrime.org/feed/", type: "rss", priority: 2, credibility: "high", language: "en", region: "Americas", tags: ["crime", "security"], enabled: true, maxItems: 20 },
  { name: "MercoPress", url: "https://en.mercopress.com/rss", type: "rss", priority: 3, credibility: "medium", language: "en", region: "Americas", tags: ["latam", "regional"], enabled: true, maxItems: 20 },

  { name: "ICRC News", url: "https://www.icrc.org/en/rss", type: "rss", priority: 3, credibility: "high", language: "en", region: "Global", tags: ["humanitarian", "crisis"], enabled: true, maxItems: 20 },
  { name: "GDELT", url: "https://blog.gdeltproject.org/feed/", type: "rss", priority: 3, credibility: "medium", language: "en", region: "Global", tags: ["osint", "analysis"], enabled: true, maxItems: 20 },
];

const INCLUDE_KW = [
  "geopolitical", "diplomatic", "embassy", "diplomat", "summit", "bilateral", "multilateral",
  "treaty", "alliance", "nato", "united nations", "foreign minister", "foreign policy",
  "sovereignty", "territorial", "annexation", "military", "defense", "troops", "army",
  "navy", "air force", "missile", "weapon", "nuclear", "drone", "airstrike", "offensive",
  "invasion", "deployment", "warfare", "artillery", "fighter jet", "security",
  "travel advisory", "travel warning", "evacuate", "evacuation", "curfew", "lockdown",
  "border", "checkpoint", "airspace", "no-fly zone", "threat level", "alert", "emergency",
  "sanctions", "embargo", "tariff", "trade war", "retaliation", "escalation",
  "terror", "terrorism", "terrorist", "bomb", "bombing", "explosion", "attack",
  "insurgent", "militant", "extremist", "hostage", "kidnap", "assassination",
  "protest", "demonstration", "riot", "unrest", "uprising", "revolution", "coup",
  "martial law", "state of emergency", "clashes", "crackdown", "rebellion",
  "war", "conflict", "ceasefire", "peace talks", "truce", "violence", "casualties",
  "killed", "wounded", "refugees", "displacement", "humanitarian crisis", "civil war",
  "cyberattack", "cyber attack", "ransomware", "critical infrastructure", "air defense",
  "ballistic missile", "rocket fire", "drone strike", "naval exercise", "border crossing",
  "embassy warning", "consular warning", "travel disruption", "airport closure", "port closure"
];

const EXCLUDE_KW = [
  "celebrity", "hollywood", "movie", "box office", "grammy", "oscar", "emmy", "concert",
  "album", "music video", "netflix", "disney", "rapper", "singer", "actor", "actress",
  "influencer", "tiktok", "instagram", "fashion", "runway", "beauty", "makeup",
  "nba", "nfl", "mlb", "nhl", "premier league", "champions league", "super bowl",
  "playoff", "championship", "tournament", "goal scored", "touchdown", "home run",
  "fantasy sports", "betting odds", "espn", "sports betting",
  "lifestyle", "wellness", "diet", "workout", "fitness", "recipe", "cooking",
  "restaurant review", "resort", "spa", "wedding", "birthday", "horoscope",
  "burglary", "shoplifting", "car theft", "drunk driving", "noise complaint", "petty crime",
  "stock price", "quarterly earnings", "ipo", "startup funding", "venture capital",
  "iphone", "android", "app store", "software update", "video game", "gaming",
  "esports", "bitcoin price", "cryptocurrency price", "nft"
];

const CRITICAL_KW = [
  "active shooter", "hostage situation", "nuclear strike", "chemical weapon", "mass casualty",
  "massacre", "war declared", "invasion", "missile strike", "terror attack", "bombing",
  "airstrike", "drone strike", "imminent threat"
];

const HIGH_KW = [
  "conflict", "military operation", "troops deployed", "state of emergency", "martial law",
  "coup attempt", "assassination", "ceasefire violated", "casualties reported", "border clash",
  "rocket fire", "airspace closure", "airport closure", "port disruption", "evacuation order"
];

const ELEVATED_KW = [
  "tension", "protest", "sanctions", "warning", "dispute", "standoff",
  "diplomatic crisis", "border incident", "military exercise", "travel advisory",
  "heightened alert", "security alert", "curfew", "lockdown"
];

const EVENT_TYPE_RULES: Array<{ type: string; patterns: string[] }> = [
  { type: "attack", patterns: ["attack", "bombing", "explosion", "airstrike", "missile strike", "drone strike", "rocket fire"] },
  { type: "conflict", patterns: ["war", "conflict", "battle", "offensive", "invasion", "ceasefire"] },
  { type: "terrorism", patterns: ["terror", "terrorist", "extremist", "hostage", "militant"] },
  { type: "diplomacy", patterns: ["summit", "treaty", "bilateral", "alliance", "embassy", "foreign minister"] },
  { type: "civil_unrest", patterns: ["protest", "riot", "demonstration", "unrest", "clashes", "uprising"] },
  { type: "travel_risk", patterns: ["travel advisory", "airport closure", "airspace", "evacuation", "curfew", "lockdown"] },
  { type: "sanctions", patterns: ["sanctions", "embargo", "tariff", "trade war"] },
  { type: "humanitarian", patterns: ["refugees", "displacement", "humanitarian", "aid", "casualties"] },
  { type: "cyber", patterns: ["cyberattack", "cyber attack", "ransomware", "hack", "critical infrastructure"] },
];

const CITIES: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  "washington": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "washington dc": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "new york": { lat: 40.7128, lon: -74.006, country: "United States", region: "North America" },
  "los angeles": { lat: 34.0522, lon: -118.2437, country: "United States", region: "North America" },
  "chicago": { lat: 41.8781, lon: -87.6298, country: "United States", region: "North America" },
  "houston": { lat: 29.7604, lon: -95.3698, country: "United States", region: "North America" },
  "san francisco": { lat: 37.7749, lon: -122.4194, country: "United States", region: "North America" },
  "miami": { lat: 25.7617, lon: -80.1918, country: "United States", region: "North America" },
  "seattle": { lat: 47.6062, lon: -122.3321, country: "United States", region: "North America" },
  "boston": { lat: 42.3601, lon: -71.0589, country: "United States", region: "North America" },
  "atlanta": { lat: 33.749, lon: -84.388, country: "United States", region: "North America" },
  "dallas": { lat: 32.7767, lon: -96.797, country: "United States", region: "North America" },
  "denver": { lat: 39.7392, lon: -104.9903, country: "United States", region: "North America" },
  "pentagon": { lat: 38.8719, lon: -77.0563, country: "United States", region: "North America" },
  "white house": { lat: 38.8977, lon: -77.0365, country: "United States", region: "North America" },

  "ottawa": { lat: 45.4215, lon: -75.6972, country: "Canada", region: "North America" },
  "toronto": { lat: 43.6532, lon: -79.3832, country: "Canada", region: "North America" },
  "vancouver": { lat: 49.2827, lon: -123.1207, country: "Canada", region: "North America" },
  "montreal": { lat: 45.5017, lon: -73.5673, country: "Canada", region: "North America" },

  "london": { lat: 51.5074, lon: -0.1278, country: "United Kingdom", region: "Europe" },
  "manchester": { lat: 53.4808, lon: -2.2426, country: "United Kingdom", region: "Europe" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, country: "United Kingdom", region: "Europe" },
  "birmingham": { lat: 52.4862, lon: -1.8904, country: "United Kingdom", region: "Europe" },
  "glasgow": { lat: 55.8642, lon: -4.2518, country: "United Kingdom", region: "Europe" },
  "belfast": { lat: 54.5973, lon: -5.9301, country: "United Kingdom", region: "Europe" },
  "downing street": { lat: 51.5034, lon: -0.1276, country: "United Kingdom", region: "Europe" },

  "berlin": { lat: 52.52, lon: 13.405, country: "Germany", region: "Europe" },
  "munich": { lat: 48.1351, lon: 11.582, country: "Germany", region: "Europe" },
  "frankfurt": { lat: 50.1109, lon: 8.6821, country: "Germany", region: "Europe" },
  "hamburg": { lat: 53.5511, lon: 9.9937, country: "Germany", region: "Europe" },
  "paris": { lat: 48.8566, lon: 2.3522, country: "France", region: "Europe" },
  "lyon": { lat: 45.764, lon: 4.8357, country: "France", region: "Europe" },
  "marseille": { lat: 43.2965, lon: 5.3698, country: "France", region: "Europe" },
  "rome": { lat: 41.9028, lon: 12.4964, country: "Italy", region: "Europe" },
  "milan": { lat: 45.4642, lon: 9.19, country: "Italy", region: "Europe" },
  "madrid": { lat: 40.4168, lon: -3.7038, country: "Spain", region: "Europe" },
  "barcelona": { lat: 41.3874, lon: 2.1686, country: "Spain", region: "Europe" },
  "amsterdam": { lat: 52.3676, lon: 4.9041, country: "Netherlands", region: "Europe" },
  "brussels": { lat: 50.8503, lon: 4.3517, country: "Belgium", region: "Europe" },
  "vienna": { lat: 48.2082, lon: 16.3738, country: "Austria", region: "Europe" },
  "zurich": { lat: 47.3769, lon: 8.5417, country: "Switzerland", region: "Europe" },
  "geneva": { lat: 46.2044, lon: 6.1432, country: "Switzerland", region: "Europe" },
  "warsaw": { lat: 52.2297, lon: 21.0122, country: "Poland", region: "Europe" },
  "prague": { lat: 50.0755, lon: 14.4378, country: "Czech Republic", region: "Europe" },
  "budapest": { lat: 47.4979, lon: 19.0402, country: "Hungary", region: "Europe" },
  "bucharest": { lat: 44.4268, lon: 26.1025, country: "Romania", region: "Europe" },
  "athens": { lat: 37.9838, lon: 23.7275, country: "Greece", region: "Europe" },
  "stockholm": { lat: 59.3293, lon: 18.0686, country: "Sweden", region: "Europe" },
  "oslo": { lat: 59.9139, lon: 10.7522, country: "Norway", region: "Europe" },
  "copenhagen": { lat: 55.6761, lon: 12.5683, country: "Denmark", region: "Europe" },
  "helsinki": { lat: 60.1699, lon: 24.9384, country: "Finland", region: "Europe" },
  "lisbon": { lat: 38.7223, lon: -9.1393, country: "Portugal", region: "Europe" },
  "dublin": { lat: 53.3498, lon: -6.2603, country: "Ireland", region: "Europe" },
  "kyiv": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kiev": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kharkiv": { lat: 49.9935, lon: 36.2304, country: "Ukraine", region: "Europe" },
  "odesa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "lviv": { lat: 49.8397, lon: 24.0297, country: "Ukraine", region: "Europe" },
  "moscow": { lat: 55.7558, lon: 37.6173, country: "Russia", region: "Europe" },
  "st petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "kremlin": { lat: 55.752, lon: 37.6175, country: "Russia", region: "Europe" },

  "jerusalem": { lat: 31.7683, lon: 35.2137, country: "Israel", region: "Middle East" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", region: "Middle East" },
  "gaza": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "rafah": { lat: 31.2929, lon: 34.2424, country: "Palestine", region: "Middle East" },
  "tehran": { lat: 35.6892, lon: 51.389, country: "Iran", region: "Middle East" },
  "riyadh": { lat: 24.7136, lon: 46.6753, country: "Saudi Arabia", region: "Middle East" },
  "jeddah": { lat: 21.5433, lon: 39.1728, country: "Saudi Arabia", region: "Middle East" },
  "dubai": { lat: 25.2048, lon: 55.2708, country: "UAE", region: "Middle East" },
  "abu dhabi": { lat: 24.4539, lon: 54.3773, country: "UAE", region: "Middle East" },
  "ankara": { lat: 39.9334, lon: 32.8597, country: "Turkey", region: "Middle East" },
  "istanbul": { lat: 41.0082, lon: 28.9784, country: "Turkey", region: "Middle East" },
  "baghdad": { lat: 33.3152, lon: 44.3661, country: "Iraq", region: "Middle East" },
  "damascus": { lat: 33.5138, lon: 36.2765, country: "Syria", region: "Middle East" },
  "aleppo": { lat: 36.2021, lon: 37.1343, country: "Syria", region: "Middle East" },
  "beirut": { lat: 33.8938, lon: 35.5018, country: "Lebanon", region: "Middle East" },
  "amman": { lat: 31.9454, lon: 35.9284, country: "Jordan", region: "Middle East" },
  "doha": { lat: 25.2854, lon: 51.531, country: "Qatar", region: "Middle East" },
  "muscat": { lat: 23.588, lon: 58.3829, country: "Oman", region: "Middle East" },
  "sanaa": { lat: 15.3694, lon: 44.191, country: "Yemen", region: "Middle East" },
  "aden": { lat: 12.7855, lon: 45.0187, country: "Yemen", region: "Middle East" },

  "beijing": { lat: 39.9042, lon: 116.4074, country: "China", region: "Asia" },
  "shanghai": { lat: 31.2304, lon: 121.4737, country: "China", region: "Asia" },
  "hong kong": { lat: 22.3193, lon: 114.1694, country: "China", region: "Asia" },
  "taipei": { lat: 25.033, lon: 121.5654, country: "Taiwan", region: "Asia" },
  "tokyo": { lat: 35.6762, lon: 139.6503, country: "Japan", region: "Asia" },
  "seoul": { lat: 37.5665, lon: 126.978, country: "South Korea", region: "Asia" },
  "pyongyang": { lat: 39.0392, lon: 125.7625, country: "North Korea", region: "Asia" },
  "new delhi": { lat: 28.6139, lon: 77.209, country: "India", region: "Asia" },
  "delhi": { lat: 28.7041, lon: 77.1025, country: "India", region: "Asia" },
  "mumbai": { lat: 19.076, lon: 72.8777, country: "India", region: "Asia" },
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Asia" },
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Asia" },
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Asia" },
  "manila": { lat: 14.5995, lon: 120.9842, country: "Philippines", region: "Asia" },
  "jakarta": { lat: -6.2088, lon: 106.8456, country: "Indonesia", region: "Asia" },
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Asia" },
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Asia" },

  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Africa" },
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "pretoria": { lat: -25.7461, lon: 28.1881, country: "South Africa", region: "Africa" },
  "johannesburg": { lat: -26.2041, lon: 28.0473, country: "South Africa", region: "Africa" },
  "cape town": { lat: -33.9249, lon: 18.4241, country: "South Africa", region: "Africa" },
  "addis ababa": { lat: 9.025, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "mogadishu": { lat: 2.0469, lon: 45.3182, country: "Somalia", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "dakar": { lat: 14.7167, lon: -17.4677, country: "Senegal", region: "Africa" },
  "accra": { lat: 5.6037, lon: -0.187, country: "Ghana", region: "Africa" },

  "brasilia": { lat: -15.7801, lon: -47.9292, country: "Brazil", region: "South America" },
  "sao paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", region: "South America" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, country: "Brazil", region: "South America" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "South America" },
  "bogota": { lat: 4.711, lon: -74.0721, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "South America" },
  "mexico city": { lat: 19.4326, lon: -99.1332, country: "Mexico", region: "North America" },

  "astana": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Asia" },
  "tashkent": { lat: 41.2995, lon: 69.24, country: "Uzbekistan", region: "Asia" },

  "canberra": { lat: -35.2809, lon: 149.13, country: "Australia", region: "Oceania" },
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "melbourne": { lat: -37.8136, lon: 144.9631, country: "Australia", region: "Oceania" },
  "wellington": { lat: -41.2866, lon: 174.7756, country: "New Zealand", region: "Oceania" },
  "auckland": { lat: -36.8485, lon: 174.7633, country: "New Zealand", region: "Oceania" },
};

const COUNTRY_PATTERNS: Record<
  string,
  { patterns: string[]; lat: number; lon: number; name: string; region: string; offset: number }
> = {
  ua: { patterns: ["ukraine", "ukrainian", "zelensky"], lat: 50.4501, lon: 30.5234, name: "Ukraine", region: "Europe", offset: 0.3 },
  ru: { patterns: ["russia", "russian", "kremlin", "putin"], lat: 55.7558, lon: 37.6173, name: "Russia", region: "Europe", offset: 0.5 },
  cn: { patterns: ["china", "chinese", "xi jinping"], lat: 39.9042, lon: 116.4074, name: "China", region: "Asia", offset: 0.4 },
  ir: { patterns: ["iran", "iranian"], lat: 35.6892, lon: 51.389, name: "Iran", region: "Middle East", offset: 0.3 },
  il: { patterns: ["israel", "israeli", "netanyahu", "hamas", "hezbollah"], lat: 31.7683, lon: 35.2137, name: "Israel", region: "Middle East", offset: 0.2 },
  ps: { patterns: ["palestine", "palestinian", "west bank"], lat: 31.9522, lon: 35.2332, name: "Palestine", region: "Middle East", offset: 0.2 },
  gb: { patterns: ["britain", "british", "uk ", "england", "wales", "scotland"], lat: 51.5074, lon: -0.1278, name: "United Kingdom", region: "Europe", offset: 0.2 },
  de: { patterns: ["germany", "german", "scholz"], lat: 52.52, lon: 13.405, name: "Germany", region: "Europe", offset: 0.3 },
  fr: { patterns: ["france", "french", "macron"], lat: 48.8566, lon: 2.3522, name: "France", region: "Europe", offset: 0.3 },
  sa: { patterns: ["saudi", "saudi arabia"], lat: 24.7136, lon: 46.6753, name: "Saudi Arabia", region: "Middle East", offset: 0.4 },
  tr: { patterns: ["turkey", "turkish", "erdogan"], lat: 39.9334, lon: 32.8597, name: "Turkey", region: "Middle East", offset: 0.3 },
  pk: { patterns: ["pakistan", "pakistani"], lat: 33.6844, lon: 73.0479, name: "Pakistan", region: "Asia", offset: 0.3 },
  in: { patterns: ["india", "indian", "modi"], lat: 28.6139, lon: 77.209, name: "India", region: "Asia", offset: 0.4 },
  kr: { patterns: ["south korea", "korean"], lat: 37.5665, lon: 126.978, name: "South Korea", region: "Asia", offset: 0.15 },
  kp: { patterns: ["north korea", "pyongyang", "kim jong"], lat: 39.0392, lon: 125.7625, name: "North Korea", region: "Asia", offset: 0.2 },
  jp: { patterns: ["japan", "japanese"], lat: 35.6762, lon: 139.6503, name: "Japan", region: "Asia", offset: 0.15 },
  au: { patterns: ["australia", "australian"], lat: -35.2809, lon: 149.13, name: "Australia", region: "Oceania", offset: 0.3 },
  ca: { patterns: ["canada", "canadian"], lat: 45.4215, lon: -75.6972, name: "Canada", region: "North America", offset: 0.4 },
  mx: { patterns: ["mexico", "mexican"], lat: 19.4326, lon: -99.1332, name: "Mexico", region: "North America", offset: 0.3 },
  br: { patterns: ["brazil", "brazilian"], lat: -15.7801, lon: -47.9292, name: "Brazil", region: "South America", offset: 0.5 },
  eg: { patterns: ["egypt", "egyptian"], lat: 30.0444, lon: 31.2357, name: "Egypt", region: "Africa", offset: 0.2 },
  za: { patterns: ["south africa"], lat: -25.7461, lon: 28.1881, name: "South Africa", region: "Africa", offset: 0.3 },
  ng: { patterns: ["nigeria", "nigerian"], lat: 9.0765, lon: 7.3986, name: "Nigeria", region: "Africa", offset: 0.3 },
  ae: { patterns: ["uae", "emirates"], lat: 24.4539, lon: 54.3773, name: "UAE", region: "Middle East", offset: 0.15 },
  sy: { patterns: ["syria", "syrian", "assad"], lat: 33.5138, lon: 36.2765, name: "Syria", region: "Middle East", offset: 0.2 },
  ye: { patterns: ["yemen", "yemeni", "houthi"], lat: 15.3694, lon: 44.191, name: "Yemen", region: "Middle East", offset: 0.3 },
  af: { patterns: ["afghanistan", "afghan", "taliban"], lat: 34.5553, lon: 69.2075, name: "Afghanistan", region: "Asia", offset: 0.3 },
  ly: { patterns: ["libya", "libyan"], lat: 32.8872, lon: 13.1913, name: "Libya", region: "Africa", offset: 0.3 },
  sd: { patterns: ["sudan", "sudanese"], lat: 15.5007, lon: 32.5599, name: "Sudan", region: "Africa", offset: 0.3 },
  mm: { patterns: ["myanmar", "burma", "burmese"], lat: 16.8661, lon: 96.1951, name: "Myanmar", region: "Asia", offset: 0.3 },
  ve: { patterns: ["venezuela", "venezuelan", "maduro"], lat: 10.4806, lon: -66.9036, name: "Venezuela", region: "South America", offset: 0.3 },
  tw: { patterns: ["taiwan", "taiwanese"], lat: 25.033, lon: 121.5654, name: "Taiwan", region: "Asia", offset: 0.1 },
  lb: { patterns: ["lebanon", "lebanese"], lat: 33.8938, lon: 35.5018, name: "Lebanon", region: "Middle East", offset: 0.1 },
  us: { patterns: ["united states", "u.s.", "america", "pentagon", "white house", "trump", "biden"], lat: 38.9072, lon: -77.0369, name: "United States", region: "North America", offset: 0.3 },
  it: { patterns: ["italy", "italian"], lat: 41.9028, lon: 12.4964, name: "Italy", region: "Europe", offset: 0.2 },
  es: { patterns: ["spain", "spanish"], lat: 40.4168, lon: -3.7038, name: "Spain", region: "Europe", offset: 0.3 },
  nl: { patterns: ["netherlands", "dutch", "holland"], lat: 52.3676, lon: 4.9041, name: "Netherlands", region: "Europe", offset: 0.1 },
  nz: { patterns: ["new zealand"], lat: -41.2866, lon: 174.7756, name: "New Zealand", region: "Oceania", offset: 0.2 },
  sg: { patterns: ["singapore"], lat: 1.3521, lon: 103.8198, name: "Singapore", region: "Asia", offset: 0.05 },
  iq: { patterns: ["iraq", "iraqi"], lat: 33.3152, lon: 44.3661, name: "Iraq", region: "Middle East", offset: 0.3 },
  so: { patterns: ["somalia", "somali"], lat: 2.0469, lon: 45.3182, name: "Somalia", region: "Africa", offset: 0.3 },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function stripHtml(input: string): string {
  return normalizeWhitespace(
    input
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function safeDate(input?: string): string {
  if (!input) return new Date().toISOString();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const blocked = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "ref",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
      "ocid"
    ];
    for (const p of blocked) u.searchParams.delete(p);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.hostname}${path}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0].trim();
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeTitle(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function jaccardSimilarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersection = 0;
  for (const t of sa) {
    if (sb.has(t)) intersection++;
  }
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeFingerprint(title: string, url: string): Promise<string> {
  return sha256(`${normalizeTitle(title)}|${normalizeUrl(url)}`);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  retries = 2,
  timeoutMs = 15000
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (resp.ok) return resp;
      if (resp.status < 500 && resp.status !== 429) {
        return resp;
      }
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) {
      await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function textContainsAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

function countMatches(text: string, patterns: string[]): number {
  let count = 0;
  for (const p of patterns) {
    if (text.includes(p)) count++;
  }
  return count;
}

function getSourceBaseScore(sourcePriority: number, credibility: Credibility): number {
  const priorityScore = sourcePriority === 1 ? 0.95 : sourcePriority === 2 ? 0.82 : 0.7;
  const credibilityScore = credibility === "high" ? 0.95 : credibility === "medium" ? 0.75 : 0.55;
  return clamp((priorityScore * 0.55) + (credibilityScore * 0.45), 0, 1);
}

function getRecencyScore(publishedAt: string): number {
  const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60));
  if (ageHours <= 2) return 1;
  if (ageHours <= 6) return 0.9;
  if (ageHours <= 12) return 0.8;
  if (ageHours <= 24) return 0.7;
  if (ageHours <= 48) return 0.55;
  if (ageHours <= 72) return 0.4;
  return 0.25;
}

function computeRelevanceScore(title: string, desc: string): number {
  const t = `${title} ${desc}`.toLowerCase();
  if (EXCLUDE_KW.some((k) => t.includes(k))) return 0;

  const includeHits = countMatches(t, INCLUDE_KW);
  const criticalHits = countMatches(t, CRITICAL_KW);
  const highHits = countMatches(t, HIGH_KW);
  const elevatedHits = countMatches(t, ELEVATED_KW);

  let score = 0;
  score += includeHits * 0.06;
  score += criticalHits * 0.25;
  score += highHits * 0.16;
  score += elevatedHits * 0.08;

  if (title.length > 10) score += 0.05;
  if (desc.length > 30) score += 0.05;

  return clamp(score, 0, 1);
}

function isOsintRelevant(title: string, desc: string): boolean {
  return computeRelevanceScore(title, desc) >= 0.12;
}

function detectThreat(title: string, desc: string): ThreatLevel {
  const t = `${title} ${desc}`.toLowerCase();
  if (textContainsAny(t, CRITICAL_KW)) return "critical";
  if (textContainsAny(t, HIGH_KW)) return "high";
  if (textContainsAny(t, ELEVATED_KW)) return "elevated";
  return "low";
}

function detectCategory(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();

  if (["diplomat", "treaty", "summit", "relations", "bilateral", "embassy", "foreign minister", "alliance", "nato", "united nations"].some((k) => t.includes(k))) {
    return "diplomacy";
  }
  if (["war", "conflict", "troops", "combat", "invasion", "offensive", "ceasefire", "battlefield"].some((k) => t.includes(k))) {
    return "conflict";
  }
  if (["military", "attack", "defense", "security", "terror", "bomb", "missile", "weapon", "insurgent", "militant"].some((k) => t.includes(k))) {
    return "security";
  }
  if (["evacuat", "travel advisory", "travel warning", "airport closure", "stranded", "border", "checkpoint", "curfew", "lockdown", "airspace", "port closure"].some((k) => t.includes(k))) {
    return "travel-security";
  }
  if (["protest", "demonstration", "riot", "unrest", "uprising", "coup", "martial law", "clashes"].some((k) => t.includes(k))) {
    return "civil-unrest";
  }
  if (["sanctions", "trade war", "embargo", "tariff"].some((k) => t.includes(k))) {
    return "economy";
  }
  if (["humanitarian", "refugee", "aid", "disaster", "displacement", "casualties"].some((k) => t.includes(k))) {
    return "humanitarian";
  }
  if (["cyber", "hack", "ransomware", "infrastructure"].some((k) => t.includes(k))) {
    return "technology";
  }
  return "security";
}

function detectEventType(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.patterns.some((p) => t.includes(p))) return rule.type;
  }
  return "general_intel";
}

function detectActorType(title: string, desc: string): ActorType {
  const t = `${title} ${desc}`.toLowerCase();

  if (["ministry", "government", "president", "prime minister", "foreign minister", "parliament"].some((k) => t.includes(k))) return "government";
  if (["army", "navy", "air force", "troops", "military", "defense forces"].some((k) => t.includes(k))) return "military";
  if (["terrorist", "terror group"].some((k) => t.includes(k))) return "terrorist";
  if (["militant", "insurgent", "rebel", "armed group", "hezbollah", "hamas", "taliban", "houthi"].some((k) => t.includes(k))) return "militant";
  if (["state", "kremlin", "white house", "pentagon", "foreign office"].some((k) => t.includes(k))) return "state";
  if (["icrc", "relief", "humanitarian", "aid agency", "unhcr"].some((k) => t.includes(k))) return "humanitarian";
  if (["company", "corporate", "firm", "airline", "shipping company"].some((k) => t.includes(k))) return "corporate";
  if (["civilian", "residents", "people", "demonstrators", "protesters"].some((k) => t.includes(k))) return "civilian";

  return "organization";
}

function extractTags(title: string, desc: string, sourceTags: string[] = []): string[] {
  const t = `${title} ${desc}`.toLowerCase();
  const tags = new Set<string>();

  const kws = [
    "military", "terrorism", "cyber", "sanctions", "politics", "election", "nuclear",
    "protest", "coup", "refugee", "humanitarian", "defense", "security", "conflict",
    "diplomatic", "border", "travel-risk", "evacuation", "unrest", "airspace",
    "airport", "port", "missile", "drone", "ceasefire", "hostage"
  ];

  for (const k of kws) {
    const plain = k.replace("-", " ");
    if (t.includes(plain)) tags.add(k);
    if (tags.size >= 8) break;
  }

  for (const st of sourceTags) tags.add(st.toLowerCase().replace(/\s+/g, "-"));

  return Array.from(tags).slice(0, 10).length
    ? Array.from(tags).slice(0, 10)
    : ["intel"];
}

function geolocate(title: string, desc: string): GeoResult {
  const text = `${title} ${desc}`.toLowerCase();

  const sortedCities = Object.keys(CITIES).sort((a, b) => b.length - a.length);
  for (const city of sortedCities) {
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      const c = CITIES[city];
      return {
        lat: c.lat,
        lon: c.lon,
        country: c.country,
        region: c.region,
        confidence: 0.92,
        matchedBy: "city",
      };
    }
  }

  for (const [, info] of Object.entries(COUNTRY_PATTERNS)) {
    if (info.patterns.some((p) => text.includes(p))) {
      return {
        lat: info.lat,
        lon: info.lon,
        country: info.name,
        region: info.region,
        confidence: 0.72,
        matchedBy: "country",
      };
    }
  }

  return {
    lat: null,
    lon: null,
    country: "Unknown",
    region: "Unknown",
    confidence: 0.2,
    matchedBy: "unknown",
  };
}

function inferConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.86) return "confirmed";
  if (score >= 0.7) return "corroborated";
  if (score >= 0.45) return "developing";
  return "weak";
}

function computeConfidenceScore(article: RawArticle, geo: GeoResult, title: string, desc: string): number {
  const sourceBase = getSourceBaseScore(article.sourcePriority, article.sourceCredibility);
  const relevance = computeRelevanceScore(title, desc);
  const recency = getRecencyScore(article.publishedAt);
  const lengthQuality = clamp(
    (Math.min(desc.length, 400) / 400) * 0.25 + (Math.min(title.length, 120) / 120) * 0.15,
    0,
    0.4
  );
  const geoConfidence = geo.confidence;

  const score =
    sourceBase * 0.35 +
    relevance * 0.25 +
    recency * 0.2 +
    lengthQuality * 0.05 +
    geoConfidence * 0.15;

  return clamp(Number(score.toFixed(4)), 0, 1);
}

function parseXmlFeed(xml: string, source: SourceDef): RawArticle[] {
  const items: RawArticle[] = [];

  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (!doc) throw new Error("XML parse returned null");

    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      throw new Error("XML parsererror");
    }

    const rssItems = Array.from(doc.querySelectorAll("item"));
    const atomEntries = Array.from(doc.querySelectorAll("entry"));
    const nodes = rssItems.length > 0 ? rssItems : atomEntries;

    for (const node of nodes.slice(0, source.maxItems ?? 25)) {
      const title =
        stripHtml(
          node.querySelector("title")?.textContent ||
            ""
        );

      const description =
        stripHtml(
          node.querySelector("description")?.textContent ||
            node.querySelector("summary")?.textContent ||
            node.querySelector("content")?.textContent ||
            ""
        );

      const linkNode = node.querySelector("link");
      const link =
        linkNode?.getAttribute("href") ||
        linkNode?.textContent ||
        "";

      const pubDate =
        node.querySelector("pubDate")?.textContent ||
        node.querySelector("published")?.textContent ||
        node.querySelector("updated")?.textContent ||
        "";

      if (!title || !link) continue;

      items.push({
        title: title.slice(0, 800),
        description: description.slice(0, 4000),
        url: normalizeUrl(link),
        sourceName: source.name,
        publishedAt: safeDate(pubDate),
        sourceCredibility: source.credibility,
        sourcePriority: source.priority,
        sourceRegion: source.region,
        sourceLanguage: source.language,
        sourceTags: source.tags,
      });
    }

    return items;
  } catch {
    return parseRssFallback(xml, source);
  }
}

function parseRssFallback(xml: string, source: SourceDef): RawArticle[] {
  const items: RawArticle[] = [];
  const matches =
    xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) ||
    xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) ||
    [];

  for (const raw of matches.slice(0, source.maxItems ?? 25)) {
    const titleM = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descM =
      raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) ||
      raw.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
    const linkM =
      raw.match(/<link[^>]*href="([^"]+)"/i) ||
      raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateM =
      raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
      raw.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
      raw.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);

    const title = stripHtml(titleM?.[1] || "");
    const desc = stripHtml(descM?.[1] || "");
    const url = normalizeUrl((linkM?.[1] || "").trim());
    const pubDate = safeDate((dateM?.[1] || "").trim());

    if (!title || !url) continue;

    items.push({
      title: title.slice(0, 800),
      description: desc.slice(0, 4000),
      url,
      sourceName: source.name,
      publishedAt: pubDate,
      sourceCredibility: source.credibility,
      sourcePriority: source.priority,
      sourceRegion: source.region,
      sourceLanguage: source.language,
      sourceTags: source.tags,
    });
  }

  return items;
}

function sortArticlesForPriority(items: RawArticle[]): RawArticle[] {
  return [...items].sort((a, b) => {
    const threatOrder = { critical: 4, high: 3, elevated: 2, low: 1 };
    const ta = detectThreat(a.title, a.description);
    const tb = detectThreat(b.title, b.description);

    const ra = computeRelevanceScore(a.title, a.description);
    const rb = computeRelevanceScore(b.title, b.description);

    const sa = getSourceBaseScore(a.sourcePriority, a.sourceCredibility);
    const sb = getSourceBaseScore(b.sourcePriority, b.sourceCredibility);

    const da = new Date(a.publishedAt).getTime();
    const db = new Date(b.publishedAt).getTime();

    return (
      (threatOrder[tb] - threatOrder[ta]) ||
      (rb - ra) ||
      (sb - sa) ||
      (db - da)
    );
  });
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let userId: string;
    let dbClient: ReturnType<typeof createClient>;

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      if (token === supabaseAnonKey || token === supabaseServiceKey) {
        dbClient = createClient(supabaseUrl, supabaseServiceKey);

        const { data: analysts, error: analystError } = await dbClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "analyst")
          .limit(1);

        if (analystError) {
          return new Response(JSON.stringify({ error: `Analyst lookup failed: ${analystError.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = analysts?.[0]?.user_id;
        if (!userId) {
          return new Response(JSON.stringify({ error: "No analyst user found" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = claimsData.claims.sub as string;
      dbClient = userClient;
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[OSINT] Starting collection for user=${userId}`);
    const startTime = Date.now();

    const allArticles: RawArticle[] = [];
    const errors: string[] = [];
    const sourceStats: Record<string, number> = {};

    const enabledSources = RSS_SOURCES.filter((s) => s.enabled);

    const rssFetches = enabledSources.map(async (src) => {
      try {
        const resp = await fetchWithRetry(
          src.url,
          {
            headers: {
              Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml;q=0.9, */*;q=0.8",
              "User-Agent": "GlobalIntelDeskOSINT/1.0",
            },
          },
          2,
          15000
        );

        if (!resp.ok) {
          errors.push(`${src.name}: HTTP ${resp.status}`);
          return [];
        }

        const xml = await resp.text();
        const items = parseXmlFeed(xml, src);
        sourceStats[src.name] = items.length;
        console.log(`[RSS] ${src.name}: ${items.length} items`);
        return items;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${src.name}: ${msg}`);
        console.error(`[RSS] ${src.name} failed: ${msg}`);
        return [];
      }
    });

    const rssResults = await Promise.allSettled(rssFetches);
    for (const result of rssResults) {
      if (result.status === "fulfilled") {
        allArticles.push(...result.value);
      }
    }

    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    if (newsApiKey) {
      try {
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const q =
          '(military OR conflict OR attack OR terrorism OR sanctions OR diplomatic OR troops OR missile OR protest OR coup OR war OR cyberattack OR evacuation OR "travel advisory")';

        const resp = await fetchWithRetry(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&from=${from}&pageSize=100`,
          {
            headers: { "X-Api-Key": newsApiKey, "User-Agent": "GlobalIntelDeskOSINT/1.0" },
          },
          2,
          20000
        );

        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.articles)) {
            for (const a of data.articles) {
              if (a?.title && a.title !== "[Removed]" && a?.url) {
                allArticles.push({
                  title: stripHtml(a.title).slice(0, 800),
                  description: stripHtml(a.description || "").slice(0, 4000),
                  url: normalizeUrl(a.url),
                  sourceName: a.source?.name || "NewsAPI",
                  publishedAt: safeDate(a.publishedAt),
                  sourceCredibility: "medium",
                  sourcePriority: 2,
                  sourceRegion: "Global",
                  sourceLanguage: "en",
                  sourceTags: ["aggregator", "newsapi"],
                });
              }
            }
            sourceStats["NewsAPI"] = data.articles.length;
            console.log(`[API] NewsAPI: ${data.articles.length} articles`);
          }
        } else {
          errors.push(`NewsAPI: HTTP ${resp.status}`);
        }
      } catch (e) {
        errors.push(`NewsAPI: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const mediastackKey = Deno.env.get("MEDIASTACK_API_KEY");
    if (mediastackKey) {
      try {
        const resp = await fetchWithRetry(
          `http://api.mediastack.com/v1/news?access_key=${mediastackKey}&keywords=military,conflict,terrorism,diplomatic,sanctions,protest,evacuation&languages=en&limit=100&sort=published_desc`,
          { headers: { "User-Agent": "GlobalIntelDeskOSINT/1.0" } },
          2,
          20000
        );

        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.data)) {
            for (const a of data.data) {
              if (a?.title && a?.url) {
                allArticles.push({
                  title: stripHtml(a.title).slice(0, 800),
                  description: stripHtml(a.description || "").slice(0, 4000),
                  url: normalizeUrl(a.url),
                  sourceName: a.source || "Mediastack",
                  publishedAt: safeDate(a.published_at),
                  sourceCredibility: "medium",
                  sourcePriority: 2,
                  sourceRegion: "Global",
                  sourceLanguage: "en",
                  sourceTags: ["aggregator", "mediastack"],
                });
              }
            }
            sourceStats["Mediastack"] = data.data.length;
            console.log(`[API] Mediastack: ${data.data.length} articles`);
          }
        } else {
          errors.push(`Mediastack: HTTP ${resp.status}`);
        }
      } catch (e) {
        errors.push(`Mediastack: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    console.log(`[OSINT] Total raw articles: ${allArticles.length}`);

    const freshArticles = allArticles.filter((a) => {
      const ts = new Date(a.publishedAt).getTime();
      return Number.isFinite(ts) && ts >= new Date(daysAgoIso(7)).getTime();
    });

    const relevant = freshArticles
      .map((a) => ({
        ...a,
        relevanceScore: computeRelevanceScore(a.title, a.description),
      }))
      .filter((a) => isOsintRelevant(a.title, a.description));

    console.log(`[FILTER] Relevant: ${relevant.length}/${freshArticles.length}`);

    for (const article of relevant) {
      article.fingerprint = await makeFingerprint(article.title, article.url);
    }

    const seenFingerprints = new Set<string>();
    const deduped: RawArticle[] = [];

    for (const article of sortArticlesForPriority(relevant)) {
      const fp = article.fingerprint!;
      const normalized = normalizeTitle(article.title);

      if (seenFingerprints.has(fp)) continue;

      let nearDuplicate = false;
      for (const existing of deduped.slice(-150)) {
        const sameTitle = normalizeTitle(existing.title) === normalized;
        const titleSimilarity = jaccardSimilarity(existing.title, article.title);
        const sameCountryLikely =
          geolocate(existing.title, existing.description).country === geolocate(article.title, article.description).country;

        if (sameTitle || (titleSimilarity >= 0.88 && sameCountryLikely)) {
          nearDuplicate = true;
          break;
        }
      }

      if (!nearDuplicate) {
        seenFingerprints.add(fp);
        deduped.push(article);
      }
    }

    console.log(`[DEDUPE] In-memory deduped: ${deduped.length}`);

    const { data: existingRows, error: existingError } = await adminClient
      .from("news_items")
      .select("url, title, published_at")
      .gte("published_at", daysAgoIso(14))
      .order("created_at", { ascending: false })
      .limit(2000);

    if (existingError) {
      console.error(`[DB] Existing rows read failed: ${existingError.message}`);
    }

    const existingUrls = new Set<string>();
    const existingTitles = new Set<string>();

    if (existingRows) {
      for (const row of existingRows) {
        if (row.url) existingUrls.add(normalizeUrl(row.url));
        if (row.title) existingTitles.add(normalizeTitle(row.title));
      }
    }

    const newItems = deduped
      .filter((a) => {
        const nUrl = normalizeUrl(a.url);
        const nTitle = normalizeTitle(a.title);
        return !existingUrls.has(nUrl) && !existingTitles.has(nTitle);
      })
      .slice(0, 80);

    console.log(`[DEDUPE] New after DB check: ${newItems.length}`);

    let inserted = 0;

    if (newItems.length > 0) {
      const rows: ProcessedRow[] = newItems.map((a) => {
        const geo = geolocate(a.title, a.description);
        const threat = detectThreat(a.title, a.description);
        const category = detectCategory(a.title, a.description);
        const eventType = detectEventType(a.title, a.description);
        const actorType = detectActorType(a.title, a.description);
        const tags = extractTags(a.title, a.description, [...a.sourceTags, a.sourceName, a.sourceRegion, a.sourceLanguage]);
        if (!tags.includes(eventType)) tags.push(eventType);

        const confidenceScore = computeConfidenceScore(a, geo, a.title, a.description);
        const confidenceLevel = inferConfidenceLevel(confidenceScore);

        return {
          title: a.title.substring(0, 500),
          summary: (a.description || "No description available.").substring(0, 2000),
          url: a.url.substring(0, 2000),
          source: a.sourceName.substring(0, 200),
          source_credibility: a.sourceCredibility,
          published_at: safeDate(a.publishedAt),
          lat: geo.lat,
          lon: geo.lon,
          country: geo.country,
          region: geo.region,
          tags: Array.from(new Set(tags)).slice(0, 12),
          confidence_score: confidenceScore,
          confidence_level: confidenceLevel,
          threat_level: threat,
          actor_type: actorType,
          category,
          user_id: userId,
        };
      });

      rows.sort((a, b) => {
        const threatOrder = { critical: 4, high: 3, elevated: 2, low: 1 };
        return (
          (threatOrder[b.threat_level] - threatOrder[a.threat_level]) ||
          (b.confidence_score - a.confidence_score) ||
          (new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        );
      });

      const { data: insertedData, error: insertError } = await adminClient
        .from("news_items")
        .insert(rows)
        .select("id");

      if (insertError) {
        console.error(`[INSERT] Batch error: ${insertError.message}`);
        for (const row of rows) {
          const { error: singleErr } = await adminClient.from("news_items").insert(row);
          if (!singleErr) {
            inserted++;
          } else {
            console.error(`[INSERT] Single error: ${singleErr.message}`);
          }
        }
      } else {
        inserted = insertedData?.length || 0;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[OSINT] Complete: inserted=${inserted}, elapsed=${elapsed}ms, errors=${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        fetched: allArticles.length,
        fresh: freshArticles.length,
        osintFiltered: relevant.length,
        deduped: deduped.length,
        inserted,
        elapsed_ms: elapsed,
        source_stats: sourceStats,
        source_errors: errors.length > 0 ? errors : undefined,
        message: `Collected ${allArticles.length} → fresh ${freshArticles.length} → filtered ${relevant.length} → deduped ${deduped.length} → inserted ${inserted} intel items in ${elapsed}ms`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[OSINT] Fatal error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
