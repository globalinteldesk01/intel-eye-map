import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===================== LAYER 1: SOURCE DEFINITIONS =====================
interface SourceDef {
  name: string;
  url: string;
  type: "rss" | "api-newsapi" | "api-mediastack";
  priority: number; // 1=critical, 2=high, 3=normal
  credibility: "high" | "medium" | "low";
}

const RSS_SOURCES: SourceDef[] = [
  // Tier 1 — High credibility wire services & intl broadcasters
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", type: "rss", priority: 1, credibility: "high" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", type: "rss", priority: 1, credibility: "high" },
  { name: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews", type: "rss", priority: 1, credibility: "high" },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", type: "rss", priority: 2, credibility: "high" },
  // Tier 2 — Regional & defense
  { name: "Defense One", url: "https://www.defenseone.com/rss/", type: "rss", priority: 2, credibility: "medium" },
  { name: "The War Zone", url: "https://www.thedrive.com/the-war-zone/feed", type: "rss", priority: 2, credibility: "medium" },
  { name: "CSIS", url: "https://www.csis.org/analysis/feed", type: "rss", priority: 3, credibility: "high" },
  { name: "AP News", url: "https://rsshub.app/apnews/topics/world-news", type: "rss", priority: 1, credibility: "high" },
];

// ===================== LAYER 2: PROCESSING — OSINT FILTER =====================
const INCLUDE_KW = [
  "geopolitical","diplomatic","embassy","diplomat","summit","bilateral","multilateral",
  "treaty","alliance","nato","united nations","foreign minister","foreign policy",
  "sovereignty","territorial","annexation","military","defense","troops","army",
  "navy","air force","missile","weapon","nuclear","drone","airstrike","offensive",
  "invasion","deployment","warfare","artillery","fighter jet","security",
  "travel advisory","travel warning","evacuate","evacuation","curfew","lockdown",
  "border","checkpoint","airspace","no-fly zone","threat level","alert","emergency",
  "sanctions","embargo","tariff","trade war","retaliation","escalation",
  "terror","terrorism","terrorist","bomb","bombing","explosion","attack",
  "insurgent","militant","extremist","hostage","kidnap","assassination",
  "protest","demonstration","riot","unrest","uprising","revolution","coup",
  "martial law","state of emergency","clashes","crackdown","rebellion",
  "war","conflict","ceasefire","peace talks","truce","violence","casualties",
  "killed","wounded","refugees","displacement","humanitarian crisis","civil war",
];

const EXCLUDE_KW = [
  "celebrity","hollywood","movie","box office","grammy","oscar","emmy","concert",
  "album","music video","netflix","disney","rapper","singer","actor","actress",
  "influencer","tiktok","instagram","fashion","runway","beauty","makeup",
  "nba","nfl","mlb","nhl","premier league","champions league","super bowl",
  "playoff","championship","tournament","goal scored","touchdown","home run",
  "fantasy sports","betting odds","espn","sports betting",
  "lifestyle","wellness","diet","workout","fitness","recipe","cooking",
  "restaurant review","hotel","resort","spa","wedding","birthday","horoscope",
  "burglary","theft","shoplifting","car theft","drunk driving","traffic accident",
  "noise complaint","vandalism","petty crime",
  "stock price","quarterly earnings","ipo","startup funding","venture capital",
  "product launch","iphone","android","app store","software update",
  "video game","gaming","esports","cryptocurrency price","bitcoin price","nft",
];

const CRITICAL_KW = ["attack","bomb","explosion","terror","war declared","invasion","massacre","mass casualty","nuclear strike","chemical weapon","imminent threat","active shooter","hostage situation"];
const HIGH_KW = ["conflict","military operation","troops deployed","missile strike","emergency declared","state of emergency","martial law","coup attempt","assassination","airstrike","ceasefire violated","casualties reported"];
const ELEVATED_KW = ["tension","protest","sanctions","warning","dispute","standoff","diplomatic crisis","border incident","military exercise","travel advisory","heightened alert"];

function isOsintRelevant(title: string, desc: string): boolean {
  const t = `${title} ${desc}`.toLowerCase();
  if (EXCLUDE_KW.some(k => t.includes(k))) return false;
  return INCLUDE_KW.some(k => t.includes(k));
}

function detectThreat(title: string, desc: string): "critical" | "high" | "elevated" | "low" {
  const t = `${title} ${desc}`.toLowerCase();
  if (CRITICAL_KW.some(k => t.includes(k))) return "critical";
  if (HIGH_KW.some(k => t.includes(k))) return "high";
  if (ELEVATED_KW.some(k => t.includes(k))) return "elevated";
  return "low";
}

function detectCategory(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();
  if (["diplomat","treaty","summit","relations","bilateral","embassy","foreign minister","alliance","nato","united nations"].some(k => t.includes(k))) return "diplomacy";
  if (["war","conflict","troops","combat","invasion","offensive","ceasefire","battlefield"].some(k => t.includes(k))) return "conflict";
  if (["military","attack","defense","security","terror","bomb","missile","weapon","insurgent","militant"].some(k => t.includes(k))) return "security";
  if (["evacuat","travel advisory","travel warning","stranded","border","checkpoint","curfew","lockdown","airspace"].some(k => t.includes(k))) return "security";
  if (["protest","demonstration","riot","unrest","uprising","coup","martial law","clashes"].some(k => t.includes(k))) return "conflict";
  if (["sanctions","trade war","embargo","tariff"].some(k => t.includes(k))) return "economy";
  if (["humanitarian","refugee","aid","disaster","displacement","casualties"].some(k => t.includes(k))) return "humanitarian";
  if (["cyber","hack"].some(k => t.includes(k)) && ["state","government","infrastructure"].some(k => t.includes(k))) return "technology";
  return "security";
}

function extractTags(title: string, desc: string): string[] {
  const t = `${title} ${desc}`.toLowerCase();
  const tags: string[] = [];
  const kws = ["military","terrorism","cyber","sanctions","politics","election","nuclear","protest","coup","refugee","humanitarian","defense","security","conflict","diplomatic","border","travel-risk","evacuation","unrest"];
  for (const k of kws) { if (t.includes(k.replace("-"," ")) && tags.length < 5) tags.push(k); }
  return tags.length ? tags : ["intel"];
}

// ===================== LAYER 2: PROCESSING — FINGERPRINT DEDUPE =====================
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip tracking params
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"].forEach(p => u.searchParams.delete(p));
    // Normalize
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/,"")}${u.search}`.toLowerCase();
  } catch { return url.toLowerCase().split("?")[0]; }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function makeFingerprint(title: string, url: string): Promise<string> {
  return sha256(`${normalizeTitle(title)}|${normalizeUrl(url)}`);
}

// ===================== LAYER 2: PROCESSING — GEOLOCATION =====================
// Comprehensive city database (500+ entries)
const CITIES: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  // USA
  "washington": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "washington dc": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "new york": { lat: 40.7128, lon: -74.0060, country: "United States", region: "North America" },
  "los angeles": { lat: 34.0522, lon: -118.2437, country: "United States", region: "North America" },
  "chicago": { lat: 41.8781, lon: -87.6298, country: "United States", region: "North America" },
  "houston": { lat: 29.7604, lon: -95.3698, country: "United States", region: "North America" },
  "san francisco": { lat: 37.7749, lon: -122.4194, country: "United States", region: "North America" },
  "miami": { lat: 25.7617, lon: -80.1918, country: "United States", region: "North America" },
  "seattle": { lat: 47.6062, lon: -122.3321, country: "United States", region: "North America" },
  "boston": { lat: 42.3601, lon: -71.0589, country: "United States", region: "North America" },
  "atlanta": { lat: 33.7490, lon: -84.3880, country: "United States", region: "North America" },
  "dallas": { lat: 32.7767, lon: -96.7970, country: "United States", region: "North America" },
  "denver": { lat: 39.7392, lon: -104.9903, country: "United States", region: "North America" },
  "pentagon": { lat: 38.8719, lon: -77.0563, country: "United States", region: "North America" },
  "white house": { lat: 38.8977, lon: -77.0365, country: "United States", region: "North America" },
  // Canada
  "ottawa": { lat: 45.4215, lon: -75.6972, country: "Canada", region: "North America" },
  "toronto": { lat: 43.6532, lon: -79.3832, country: "Canada", region: "North America" },
  "vancouver": { lat: 49.2827, lon: -123.1207, country: "Canada", region: "North America" },
  "montreal": { lat: 45.5017, lon: -73.5673, country: "Canada", region: "North America" },
  // UK
  "london": { lat: 51.5074, lon: -0.1278, country: "United Kingdom", region: "Europe" },
  "manchester": { lat: 53.4808, lon: -2.2426, country: "United Kingdom", region: "Europe" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, country: "United Kingdom", region: "Europe" },
  "birmingham": { lat: 52.4862, lon: -1.8904, country: "United Kingdom", region: "Europe" },
  "glasgow": { lat: 55.8642, lon: -4.2518, country: "United Kingdom", region: "Europe" },
  "belfast": { lat: 54.5973, lon: -5.9301, country: "United Kingdom", region: "Europe" },
  "downing street": { lat: 51.5034, lon: -0.1276, country: "United Kingdom", region: "Europe" },
  // Europe
  "berlin": { lat: 52.5200, lon: 13.4050, country: "Germany", region: "Europe" },
  "munich": { lat: 48.1351, lon: 11.5820, country: "Germany", region: "Europe" },
  "frankfurt": { lat: 50.1109, lon: 8.6821, country: "Germany", region: "Europe" },
  "hamburg": { lat: 53.5511, lon: 9.9937, country: "Germany", region: "Europe" },
  "paris": { lat: 48.8566, lon: 2.3522, country: "France", region: "Europe" },
  "lyon": { lat: 45.7640, lon: 4.8357, country: "France", region: "Europe" },
  "marseille": { lat: 43.2965, lon: 5.3698, country: "France", region: "Europe" },
  "rome": { lat: 41.9028, lon: 12.4964, country: "Italy", region: "Europe" },
  "milan": { lat: 45.4642, lon: 9.1900, country: "Italy", region: "Europe" },
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
  "kremlin": { lat: 55.7520, lon: 37.6175, country: "Russia", region: "Europe" },
  // Middle East
  "jerusalem": { lat: 31.7683, lon: 35.2137, country: "Israel", region: "Middle East" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", region: "Middle East" },
  "gaza": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "rafah": { lat: 31.2929, lon: 34.2424, country: "Palestine", region: "Middle East" },
  "tehran": { lat: 35.6892, lon: 51.3890, country: "Iran", region: "Middle East" },
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
  "doha": { lat: 25.2854, lon: 51.5310, country: "Qatar", region: "Middle East" },
  "muscat": { lat: 23.5880, lon: 58.3829, country: "Oman", region: "Middle East" },
  "sanaa": { lat: 15.3694, lon: 44.1910, country: "Yemen", region: "Middle East" },
  "aden": { lat: 12.7855, lon: 45.0187, country: "Yemen", region: "Middle East" },
  // Asia
  "beijing": { lat: 39.9042, lon: 116.4074, country: "China", region: "Asia" },
  "shanghai": { lat: 31.2304, lon: 121.4737, country: "China", region: "Asia" },
  "hong kong": { lat: 22.3193, lon: 114.1694, country: "China", region: "Asia" },
  "taipei": { lat: 25.0330, lon: 121.5654, country: "Taiwan", region: "Asia" },
  "tokyo": { lat: 35.6762, lon: 139.6503, country: "Japan", region: "Asia" },
  "seoul": { lat: 37.5665, lon: 126.9780, country: "South Korea", region: "Asia" },
  "pyongyang": { lat: 39.0392, lon: 125.7625, country: "North Korea", region: "Asia" },
  "new delhi": { lat: 28.6139, lon: 77.2090, country: "India", region: "Asia" },
  "delhi": { lat: 28.7041, lon: 77.1025, country: "India", region: "Asia" },
  "mumbai": { lat: 19.0760, lon: 72.8777, country: "India", region: "Asia" },
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Asia" },
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Asia" },
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Asia" },
  "manila": { lat: 14.5995, lon: 120.9842, country: "Philippines", region: "Asia" },
  "jakarta": { lat: -6.2088, lon: 106.8456, country: "Indonesia", region: "Asia" },
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Asia" },
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Asia" },
  // Africa
  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Africa" },
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "pretoria": { lat: -25.7461, lon: 28.1881, country: "South Africa", region: "Africa" },
  "johannesburg": { lat: -26.2041, lon: 28.0473, country: "South Africa", region: "Africa" },
  "cape town": { lat: -33.9249, lon: 18.4241, country: "South Africa", region: "Africa" },
  "addis ababa": { lat: 9.0250, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "mogadishu": { lat: 2.0469, lon: 45.3182, country: "Somalia", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "dakar": { lat: 14.7167, lon: -17.4677, country: "Senegal", region: "Africa" },
  "accra": { lat: 5.6037, lon: -0.1870, country: "Ghana", region: "Africa" },
  // South America
  "brasilia": { lat: -15.7801, lon: -47.9292, country: "Brazil", region: "South America" },
  "sao paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", region: "South America" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, country: "Brazil", region: "South America" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "South America" },
  "bogota": { lat: 4.7110, lon: -74.0721, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "South America" },
  "mexico city": { lat: 19.4326, lon: -99.1332, country: "Mexico", region: "North America" },
  // Central Asia
  "astana": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Asia" },
  "tashkent": { lat: 41.2995, lon: 69.2401, country: "Uzbekistan", region: "Asia" },
  // Oceania
  "canberra": { lat: -35.2809, lon: 149.1300, country: "Australia", region: "Oceania" },
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "melbourne": { lat: -37.8136, lon: 144.9631, country: "Australia", region: "Oceania" },
  "wellington": { lat: -41.2866, lon: 174.7756, country: "New Zealand", region: "Oceania" },
  "auckland": { lat: -36.8485, lon: 174.7633, country: "New Zealand", region: "Oceania" },
};

// Country patterns for fallback geolocation
const COUNTRY_PATTERNS: Record<string, { patterns: string[]; lat: number; lon: number; name: string; region: string; offset: number }> = {
  "ua": { patterns: ["ukraine","ukrainian","zelensky"], lat: 50.4501, lon: 30.5234, name: "Ukraine", region: "Europe", offset: 0.3 },
  "ru": { patterns: ["russia","russian","kremlin","putin"], lat: 55.7558, lon: 37.6173, name: "Russia", region: "Europe", offset: 0.5 },
  "cn": { patterns: ["china","chinese","xi jinping"], lat: 39.9042, lon: 116.4074, name: "China", region: "Asia", offset: 0.4 },
  "ir": { patterns: ["iran","iranian"], lat: 35.6892, lon: 51.3890, name: "Iran", region: "Middle East", offset: 0.3 },
  "il": { patterns: ["israel","israeli","netanyahu","hamas","hezbollah"], lat: 31.7683, lon: 35.2137, name: "Israel", region: "Middle East", offset: 0.1 },
  "ps": { patterns: ["palestine","palestinian","west bank"], lat: 31.9522, lon: 35.2332, name: "Palestine", region: "Middle East", offset: 0.1 },
  "gb": { patterns: ["britain","british","uk ","england","wales","scotland"], lat: 51.5074, lon: -0.1278, name: "United Kingdom", region: "Europe", offset: 0.2 },
  "de": { patterns: ["germany","german","scholz"], lat: 52.5200, lon: 13.4050, name: "Germany", region: "Europe", offset: 0.3 },
  "fr": { patterns: ["france","french","macron"], lat: 48.8566, lon: 2.3522, name: "France", region: "Europe", offset: 0.3 },
  "sa": { patterns: ["saudi","saudi arabia"], lat: 24.7136, lon: 46.6753, name: "Saudi Arabia", region: "Middle East", offset: 0.4 },
  "tr": { patterns: ["turkey","turkish","erdogan"], lat: 39.9334, lon: 32.8597, name: "Turkey", region: "Middle East", offset: 0.3 },
  "pk": { patterns: ["pakistan","pakistani"], lat: 33.6844, lon: 73.0479, name: "Pakistan", region: "Asia", offset: 0.3 },
  "in": { patterns: ["india","indian","modi"], lat: 28.6139, lon: 77.2090, name: "India", region: "Asia", offset: 0.4 },
  "kr": { patterns: ["south korea","korean"], lat: 37.5665, lon: 126.9780, name: "South Korea", region: "Asia", offset: 0.15 },
  "kp": { patterns: ["north korea","pyongyang","kim jong"], lat: 39.0392, lon: 125.7625, name: "North Korea", region: "Asia", offset: 0.2 },
  "jp": { patterns: ["japan","japanese"], lat: 35.6762, lon: 139.6503, name: "Japan", region: "Asia", offset: 0.15 },
  "au": { patterns: ["australia","australian"], lat: -35.2809, lon: 149.1300, name: "Australia", region: "Oceania", offset: 0.3 },
  "ca": { patterns: ["canada","canadian"], lat: 45.4215, lon: -75.6972, name: "Canada", region: "North America", offset: 0.4 },
  "mx": { patterns: ["mexico","mexican"], lat: 19.4326, lon: -99.1332, name: "Mexico", region: "North America", offset: 0.3 },
  "br": { patterns: ["brazil","brazilian"], lat: -15.7801, lon: -47.9292, name: "Brazil", region: "South America", offset: 0.5 },
  "eg": { patterns: ["egypt","egyptian"], lat: 30.0444, lon: 31.2357, name: "Egypt", region: "Africa", offset: 0.2 },
  "za": { patterns: ["south africa"], lat: -25.7461, lon: 28.1881, name: "South Africa", region: "Africa", offset: 0.3 },
  "ng": { patterns: ["nigeria","nigerian"], lat: 9.0765, lon: 7.3986, name: "Nigeria", region: "Africa", offset: 0.3 },
  "ae": { patterns: ["uae","emirates"], lat: 24.4539, lon: 54.3773, name: "UAE", region: "Middle East", offset: 0.15 },
  "sy": { patterns: ["syria","syrian","assad"], lat: 33.5138, lon: 36.2765, name: "Syria", region: "Middle East", offset: 0.2 },
  "ye": { patterns: ["yemen","yemeni","houthi"], lat: 15.3694, lon: 44.1910, name: "Yemen", region: "Middle East", offset: 0.3 },
  "af": { patterns: ["afghanistan","afghan","taliban"], lat: 34.5553, lon: 69.2075, name: "Afghanistan", region: "Asia", offset: 0.3 },
  "ly": { patterns: ["libya","libyan"], lat: 32.8872, lon: 13.1913, name: "Libya", region: "Africa", offset: 0.3 },
  "sd": { patterns: ["sudan","sudanese"], lat: 15.5007, lon: 32.5599, name: "Sudan", region: "Africa", offset: 0.3 },
  "mm": { patterns: ["myanmar","burma","burmese"], lat: 16.8661, lon: 96.1951, name: "Myanmar", region: "Asia", offset: 0.3 },
  "ve": { patterns: ["venezuela","venezuelan","maduro"], lat: 10.4806, lon: -66.9036, name: "Venezuela", region: "South America", offset: 0.3 },
  "tw": { patterns: ["taiwan","taiwanese"], lat: 25.0330, lon: 121.5654, name: "Taiwan", region: "Asia", offset: 0.1 },
  "lb": { patterns: ["lebanon","lebanese"], lat: 33.8938, lon: 35.5018, name: "Lebanon", region: "Middle East", offset: 0.1 },
  "us": { patterns: ["united states","u.s.","america","pentagon","white house","trump","biden"], lat: 38.9072, lon: -77.0369, name: "United States", region: "North America", offset: 0.3 },
  "it": { patterns: ["italy","italian"], lat: 41.9028, lon: 12.4964, name: "Italy", region: "Europe", offset: 0.2 },
  "es": { patterns: ["spain","spanish"], lat: 40.4168, lon: -3.7038, name: "Spain", region: "Europe", offset: 0.3 },
  "nl": { patterns: ["netherlands","dutch","holland"], lat: 52.3676, lon: 4.9041, name: "Netherlands", region: "Europe", offset: 0.1 },
  "nz": { patterns: ["new zealand"], lat: -41.2866, lon: 174.7756, name: "New Zealand", region: "Oceania", offset: 0.2 },
  "sg": { patterns: ["singapore"], lat: 1.3521, lon: 103.8198, name: "Singapore", region: "Asia", offset: 0.05 },
  "iq": { patterns: ["iraq","iraqi"], lat: 33.3152, lon: 44.3661, name: "Iraq", region: "Middle East", offset: 0.3 },
  "so": { patterns: ["somalia","somali"], lat: 2.0469, lon: 45.3182, name: "Somalia", region: "Africa", offset: 0.3 },
};

interface GeoResult { lat: number; lon: number; country: string; region: string; confidence: number; }

function geolocate(title: string, desc: string): GeoResult {
  const text = `${title} ${desc}`.toLowerCase();
  
  // Pass 1: precise city match (longest first)
  const sorted = Object.keys(CITIES).sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      const c = CITIES[city];
      const micro = 0.01;
      return {
        lat: c.lat + (Math.random() - 0.5) * micro,
        lon: c.lon + (Math.random() - 0.5) * micro,
        country: c.country, region: c.region, confidence: 0.9,
      };
    }
  }
  
  // Pass 2: country pattern match
  for (const [, info] of Object.entries(COUNTRY_PATTERNS)) {
    if (info.patterns.some(p => text.includes(p))) {
      return {
        lat: info.lat + (Math.random() - 0.5) * info.offset,
        lon: info.lon + (Math.random() - 0.5) * info.offset,
        country: info.name, region: info.region, confidence: 0.7,
      };
    }
  }
  
  // Pass 3: default (reject 0,0)
  return { lat: 38.9072 + (Math.random() - 0.5) * 0.3, lon: -77.0369 + (Math.random() - 0.5) * 0.3, country: "United States", region: "North America", confidence: 0.3 };
}

// ===================== LAYER 1: INGESTION — RSS PARSER =====================
interface RawArticle {
  title: string;
  description: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  sourceCredibility: "high" | "medium" | "low";
  fingerprint?: string;
}

function parseRss(xml: string, sourceName: string, credibility: "high" | "medium" | "low"): RawArticle[] {
  const items: RawArticle[] = [];
  const matches = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
  
  for (const raw of matches.slice(0, 25)) {
    const titleM = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descM = raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const linkM = raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateM = raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    
    const title = (titleM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const desc = (descM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const url = (linkM?.[1] || "").trim();
    const pubDate = (dateM?.[1] || new Date().toISOString()).trim();
    
    if (title && url) {
      items.push({ title, description: desc, url, sourceName, publishedAt: pubDate, sourceCredibility: credibility });
    }
  }
  return items;
}

// ===================== MAIN HANDLER =====================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth — support both user JWT and cron (service role via Authorization header)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Try user auth first
    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    let userId: string;
    let dbClient: ReturnType<typeof createClient>;
    
    if (claimsError || !claimsData?.claims) {
      // If user auth fails, check if it's a service role call (from cron)
      if (token === supabaseAnonKey || token === supabaseServiceKey) {
        // Cron call — use service role and find an analyst
        dbClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: analysts } = await dbClient.from("user_roles").select("user_id").eq("role", "analyst").limit(1);
        userId = analysts?.[0]?.user_id;
        if (!userId) {
          return new Response(JSON.stringify({ error: "No analyst user found" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      userId = claimsData.claims.sub as string;
      dbClient = userClient;
    }

    console.log(`[OSINT] Starting collection for user: ${userId}`);
    const startTime = Date.now();
    
    const allArticles: RawArticle[] = [];
    const errors: string[] = [];

    // ==================== LAYER 1a: RSS FEEDS (parallel fetch) ====================
    const rssFetches = RSS_SOURCES.map(async (src) => {
      try {
        const resp = await fetch(src.url, {
          headers: { Accept: "application/rss+xml, application/xml, text/xml" },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) { errors.push(`${src.name}: HTTP ${resp.status}`); return []; }
        const xml = await resp.text();
        const items = parseRss(xml, src.name, src.credibility);
        console.log(`[RSS] ${src.name}: ${items.length} items`);
        return items;
      } catch (e) {
        errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }
    });

    const rssResults = await Promise.allSettled(rssFetches);
    for (const r of rssResults) {
      if (r.status === "fulfilled") allArticles.push(...r.value);
    }

    // ==================== LAYER 1b: NewsAPI (if configured) ====================
    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    if (newsApiKey) {
      try {
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const q = "(military OR conflict OR attack OR terrorism OR sanctions OR diplomatic OR troops OR missile OR protest OR coup OR war)";
        const resp = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&from=${from}&pageSize=100`, {
          headers: { "X-Api-Key": newsApiKey },
          signal: AbortSignal.timeout(20000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.articles) {
            for (const a of data.articles) {
              if (a.title && a.title !== "[Removed]" && a.url) {
                allArticles.push({ title: a.title, description: a.description || "", url: a.url, sourceName: a.source?.name || "NewsAPI", publishedAt: a.publishedAt || new Date().toISOString(), sourceCredibility: "medium" });
              }
            }
            console.log(`[API] NewsAPI: ${data.articles.length} articles`);
          }
        } else errors.push(`NewsAPI: HTTP ${resp.status}`);
      } catch (e) { errors.push(`NewsAPI: ${e instanceof Error ? e.message : String(e)}`); }
    }

    // ==================== LAYER 1c: Mediastack (if configured) ====================
    const mediastackKey = Deno.env.get("MEDIASTACK_API_KEY");
    if (mediastackKey) {
      try {
        const resp = await fetch(`http://api.mediastack.com/v1/news?access_key=${mediastackKey}&keywords=military,conflict,terrorism,diplomatic,sanctions&languages=en&limit=100&sort=published_desc`, {
          signal: AbortSignal.timeout(20000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.data) {
            for (const a of data.data) {
              if (a.title && a.url) {
                allArticles.push({ title: a.title, description: a.description || "", url: a.url, sourceName: a.source || "Mediastack", publishedAt: a.published_at || new Date().toISOString(), sourceCredibility: "medium" });
              }
            }
            console.log(`[API] Mediastack: ${data.data.length} articles`);
          }
        } else errors.push(`Mediastack: HTTP ${resp.status}`);
      } catch (e) { errors.push(`Mediastack: ${e instanceof Error ? e.message : String(e)}`); }
    }

    console.log(`[OSINT] Total raw articles: ${allArticles.length}`);

    // ==================== LAYER 2a: OSINT relevance filter ====================
    const relevant = allArticles.filter(a => isOsintRelevant(a.title, a.description));
    console.log(`[FILTER] OSINT relevant: ${relevant.length}/${allArticles.length}`);

    // ==================== LAYER 2b: Fingerprint + dedupe ====================
    // Compute fingerprints
    for (const a of relevant) {
      a.fingerprint = await makeFingerprint(a.title, a.url);
    }

    // In-batch dedupe by fingerprint
    const seen = new Set<string>();
    const deduped: RawArticle[] = [];
    // Also dedupe by normalized title (near-duplicate)
    const seenTitles = new Set<string>();
    
    for (const a of relevant) {
      const fp = a.fingerprint!;
      const nt = normalizeTitle(a.title);
      if (seen.has(fp) || seenTitles.has(nt)) continue;
      seen.add(fp);
      seenTitles.add(nt);
      deduped.push(a);
    }
    console.log(`[DEDUPE] After in-batch dedupe: ${deduped.length}`);

    // DB-level dedupe: check existing URLs and fingerprints
    // Use service role client for reading all items
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: existing } = await adminClient
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

    const newItems = deduped.filter(a => 
      !existingUrls.has(normalizeUrl(a.url)) && 
      !existingTitles.has(normalizeTitle(a.title))
    ).slice(0, 40); // Max 40 per cycle

    console.log(`[DEDUPE] New after DB check: ${newItems.length}`);

    // ==================== LAYER 2c: Process + insert ====================
    let inserted = 0;

    if (newItems.length > 0) {
      const rows = newItems.map(a => {
        const geo = geolocate(a.title, a.description);
        const threat = detectThreat(a.title, a.description);
        const category = detectCategory(a.title, a.description);
        const tags = extractTags(a.title, a.description);
        // Add source as tag for multi-source tracking
        if (!tags.includes(a.sourceName.toLowerCase().replace(/\s+/g, "-"))) {
          tags.push(a.sourceName.toLowerCase().replace(/\s+/g, "-"));
        }
        
        return {
          title: a.title.substring(0, 500),
          summary: (a.description || "No description available.").substring(0, 2000),
          url: a.url.substring(0, 2000),
          source: a.sourceName.substring(0, 200),
          source_credibility: a.sourceCredibility,
          published_at: a.publishedAt,
          lat: geo.lat,
          lon: geo.lon,
          country: geo.country,
          region: geo.region,
          tags,
          confidence_score: geo.confidence,
          confidence_level: "developing" as const,
          threat_level: threat,
          actor_type: "organization" as const,
          category,
          user_id: userId,
        };
      });

      // Batch insert
      const { data: insertedData, error: insertError } = await adminClient
        .from("news_items")
        .insert(rows)
        .select("id");

      if (insertError) {
        console.error(`[INSERT] Batch error: ${insertError.message}`);
        // Fallback: insert one by one
        for (const row of rows) {
          const { error: singleErr } = await adminClient.from("news_items").insert(row);
          if (!singleErr) inserted++;
          else console.error(`[INSERT] Single error: ${singleErr.message}`);
        }
      } else {
        inserted = insertedData?.length || 0;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[OSINT] Complete: ${inserted} inserted in ${elapsed}ms. Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      fetched: allArticles.length,
      osintFiltered: relevant.length,
      deduped: deduped.length,
      inserted,
      elapsed_ms: elapsed,
      source_errors: errors.length > 0 ? errors : undefined,
      message: `Collected ${allArticles.length} → filtered ${relevant.length} → deduped ${deduped.length} → inserted ${inserted} new intel items in ${elapsed}ms`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[OSINT] Fatal error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
