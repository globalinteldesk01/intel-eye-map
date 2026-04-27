import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 0 — UNIFIED ARTICLE TYPE                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
interface RawArticle {
  title: string;
  description: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  sourceCredibility: "high" | "medium" | "low";
  sourceType: string; // rss | telegram | gdelt | advisory | paste | newsapi | mediastack
  fingerprint?: string;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 1A — RSS SOURCE DEFINITIONS (50+ feeds)                   ║
// ╚══════════════════════════════════════════════════════════════════╝
interface RssDef {
  name: string;
  url: string;
  credibility: "high" | "medium" | "low";
  priority: number;
}

const RSS_SOURCES: RssDef[] = [
  // ── TIER 1: Wire services & major broadcasters ──
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", credibility: "high", priority: 1 },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", credibility: "high", priority: 1 },
  { name: "France24", url: "https://www.france24.com/en/rss", credibility: "high", priority: 1 },
  { name: "DW News", url: "https://rss.dw.com/rdf/rss-en-all", credibility: "high", priority: 1 },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", credibility: "high", priority: 2 },
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss", credibility: "high", priority: 1 },
  { name: "CBC World", url: "https://rss.cbc.ca/lineup/world.xml", credibility: "high", priority: 2 },
  { name: "ABC News Intl", url: "https://abcnews.go.com/abcnews/internationalheadlines", credibility: "high", priority: 2 },

  // ── TIER 2: Defense, security & military ──
  { name: "The War Zone", url: "https://www.thedrive.com/the-war-zone/feed", credibility: "medium", priority: 2 },
  { name: "War on the Rocks", url: "https://warontherocks.com/feed/", credibility: "high", priority: 3 },
  { name: "Breaking Defense", url: "https://breakingdefense.com/feed/", credibility: "medium", priority: 2 },
  { name: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml", credibility: "medium", priority: 2 },
  { name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", credibility: "medium", priority: 2 },
  { name: "Jane's (IHS)", url: "https://www.janes.com/feeds/news", credibility: "high", priority: 2 },
  { name: "The Drive", url: "https://www.thedrive.com/feed", credibility: "medium", priority: 3 },

  // ── TIER 2: Middle East & North Africa ──
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", credibility: "medium", priority: 2 },
  { name: "Al-Monitor", url: "https://www.al-monitor.com/rss", credibility: "medium", priority: 2 },
  { name: "Arab News", url: "https://www.arabnews.com/rss.xml", credibility: "medium", priority: 2 },
  { name: "Iran International", url: "https://www.iranintl.com/en/rss", credibility: "medium", priority: 2 },
  { name: "Libya Observer", url: "https://www.libyaobserver.ly/feed", credibility: "low", priority: 3 },
  { name: "Sudan Tribune", url: "https://sudantribune.com/feed/", credibility: "medium", priority: 2 },

  // ── TIER 2: Europe & Eurasia ──
  { name: "Kyiv Independent", url: "https://kyivindependent.com/feed/", credibility: "medium", priority: 1 },
  { name: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", credibility: "medium", priority: 2 },
  { name: "Balkan Insight", url: "https://balkaninsight.com/feed/", credibility: "medium", priority: 3 },
  { name: "EU Observer", url: "https://euobserver.com/rss.xml", credibility: "high", priority: 3 },
  { name: "TASS English", url: "https://tass.com/rss/v2.xml", credibility: "low", priority: 3 },
  { name: "Radio Free Europe", url: "https://www.rferl.org/api/z-pqpiev-qpp", credibility: "medium", priority: 2 },

  // ── TIER 2: Asia-Pacific ──
  { name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", credibility: "medium", priority: 2 },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar", credibility: "high", priority: 2 },
  { name: "The Diplomat", url: "https://thediplomat.com/feed/", credibility: "high", priority: 3 },
  { name: "Channel News Asia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", credibility: "high", priority: 2 },
  { name: "Dawn Pakistan", url: "https://www.dawn.com/feeds/home", credibility: "medium", priority: 2 },
  { name: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", credibility: "medium", priority: 2 },
  { name: "The Hindu", url: "https://www.thehindu.com/news/international/feeder/default.rss", credibility: "medium", priority: 3 },
  { name: "Straits Times", url: "https://www.straitstimes.com/news/asia/rss.xml", credibility: "high", priority: 2 },
  { name: "Jakarta Post", url: "https://www.thejakartapost.com/rss", credibility: "medium", priority: 3 },

  // ── TIER 2: ASEAN-Specific Sources ──
  { name: "Rappler", url: "https://www.rappler.com/feed/", credibility: "medium", priority: 1 },
  { name: "Philippine Star", url: "https://www.philstar.com/rss/nation", credibility: "medium", priority: 2 },
  { name: "Inquirer", url: "https://newsinfo.inquirer.net/feed", credibility: "medium", priority: 2 },
  { name: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/topstories.xml", credibility: "high", priority: 1 },
  { name: "The Nation Thailand", url: "https://www.nationthailand.com/rss", credibility: "medium", priority: 2 },
  { name: "VnExpress Intl", url: "https://e.vnexpress.net/rss/news.rss", credibility: "medium", priority: 2 },
  { name: "Vietnam News", url: "https://vietnamnews.vn/rss.html", credibility: "medium", priority: 2 },
  { name: "Bernama", url: "https://www.bernama.com/en/rss/index.php", credibility: "high", priority: 2 },
  { name: "Malay Mail", url: "https://www.malaymail.com/feed/rss/malaysia", credibility: "medium", priority: 2 },
  { name: "The Star Malaysia", url: "https://www.thestar.com.my/rss/News/Nation", credibility: "medium", priority: 2 },
  { name: "Irrawaddy", url: "https://www.irrawaddy.com/feed", credibility: "medium", priority: 1 },
  { name: "Myanmar Now", url: "https://myanmar-now.org/en/feed/", credibility: "medium", priority: 1 },
  { name: "Phnom Penh Post", url: "https://www.phnompenhpost.com/rss.xml", credibility: "medium", priority: 2 },
  { name: "Khmer Times", url: "https://www.khmertimeskh.com/feed/", credibility: "medium", priority: 3 },
  { name: "Vientiane Times", url: "https://www.vientianetimes.org.la/rss.xml", credibility: "medium", priority: 3 },
  { name: "Borneo Bulletin", url: "https://borneobulletin.com.bn/feed/", credibility: "medium", priority: 3 },
  { name: "ASEAN Briefing", url: "https://www.aseanbriefing.com/news/feed/", credibility: "high", priority: 2 },
  { name: "Benar News", url: "https://www.benarnews.org/english/rss", credibility: "medium", priority: 1 },
  { name: "Fulcrum ISEAS", url: "https://fulcrum.sg/feed/", credibility: "high", priority: 3 },
  { name: "Coconuts", url: "https://coconuts.co/feed/", credibility: "low", priority: 3 },

  // ── TIER 2: Africa ──
  { name: "Africanews", url: "https://www.africanews.com/feed/", credibility: "medium", priority: 2 },
  { name: "Daily Maverick", url: "https://www.dailymaverick.co.za/dmrss/", credibility: "medium", priority: 3 },
  { name: "Punch Nigeria", url: "https://punchng.com/feed/", credibility: "medium", priority: 3 },

  // ── TIER 2: Americas ──
  { name: "InSight Crime", url: "https://insightcrime.org/feed/", credibility: "high", priority: 2 },
  { name: "MercoPress", url: "https://en.mercopress.com/rss", credibility: "medium", priority: 3 },
  { name: "Latin America Reports", url: "https://latinamericareports.com/feed/", credibility: "medium", priority: 3 },

  // ── TIER 2: Humanitarian & crisis ──
  { name: "ReliefWeb", url: "https://reliefweb.int/updates/rss.xml", credibility: "high", priority: 2 },
  { name: "UNHCR News", url: "https://www.unhcr.org/rss/news.xml", credibility: "high", priority: 2 },
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml", credibility: "high", priority: 3 },

  // ── TIER 2: Think tanks & analysis ──
  { name: "CSIS", url: "https://www.csis.org/analysis/feed", credibility: "high", priority: 3 },
  { name: "Brookings", url: "https://www.brookings.edu/feed/", credibility: "high", priority: 3 },
  { name: "RAND Corp", url: "https://www.rand.org/blog.xml", credibility: "high", priority: 3 },
  { name: "Chatham House", url: "https://www.chathamhouse.org/rss", credibility: "high", priority: 3 },
  { name: "Carnegie", url: "https://carnegieendowment.org/rss/solr/?lang=en", credibility: "high", priority: 3 },

  // ── TIER 3: Government travel advisories ──
  { name: "US State Dept Travel", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.rss.xml", credibility: "high", priority: 1 },
  { name: "UK FCDO Travel", url: "https://www.gov.uk/foreign-travel-advice.atom", credibility: "high", priority: 1 },
  { name: "Australia DFAT", url: "https://www.smartraveller.gov.au/api/rss", credibility: "high", priority: 1 },
];

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 1B — TELEGRAM PUBLIC CHANNEL DEFINITIONS                  ║
// ╚══════════════════════════════════════════════════════════════════╝
const TELEGRAM_CHANNELS = [
  { name: "Intel Slava Z", channel: "inaborovskiy", credibility: "low" as const },
  { name: "Ukraine Conflict", channel: "UkraineConflict", credibility: "low" as const },
  { name: "OSINT Aggregator", channel: "osaborovskiy", credibility: "medium" as const },
  { name: "War Monitor", channel: "WarMonitors", credibility: "low" as const },
  { name: "Middle East Spectator", channel: "MideastSpectator", credibility: "low" as const },
  { name: "Rybar", channel: "ryaborEnglish", credibility: "low" as const },
  { name: "Intel Republic", channel: "IntelRepublic", credibility: "medium" as const },
  { name: "South Front", channel: "southabornt", credibility: "low" as const },
];

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 2 — TRAVEL SECURITY RELEVANCE FILTER                      ║
// ║  Strictly intel that affects traveler / expat / corporate        ║
// ║  traveler safety, movement, or in-country operations.            ║
// ╚══════════════════════════════════════════════════════════════════╝
const INCLUDE_KW = [
  // Direct travel advisories & movement restrictions
  "travel advisory","travel warning","travel alert","travel ban","travel restriction",
  "do not travel","reconsider travel","exercise caution","level 4","level 3",
  "evacuate","evacuation","repatriation","stranded tourists","stranded travelers",
  "stranded passengers","tourists evacuated","foreign nationals",
  "curfew","lockdown","state of emergency","martial law","border closed","border closure",
  "checkpoint","no-fly zone","airspace closed","airspace closure",
  // Transport & airport disruption
  "airport closed","airport closure","airport attack","airport shutdown","flights cancelled",
  "flights canceled","flights suspended","flight diverted","airline suspends","grounded flights",
  "rail strike","train strike","metro strike","transport strike","airport strike",
  "port closed","port closure","cruise ship","ferry disrupted","road closed","highway closed",
  "carjack","carjacking","road block","roadblock",
  // Terror & violent attacks affecting public spaces
  "terror","terrorism","terrorist","terror attack","bomb","bombing","explosion","blast",
  "active shooter","mass shooting","shooting at","gunmen","suicide bomb","ied","car bomb",
  "vehicle ramming","stabbing attack","knife attack","grenade","attack on",
  "insurgent","militant","extremist","jihadi","jihadist","al-qaeda","isis","islamic state",
  "boko haram","al-shabaab","abu sayyaf","jemaah islamiyah",
  // Kidnapping, hostage, crime against foreigners
  "kidnap","kidnapping","kidnapped","hostage","abducted","abduction","ransom",
  "tourist killed","tourist robbed","tourist attacked","tourist kidnapped",
  "foreigner killed","foreigner attacked","foreigner kidnapped","foreigner robbed",
  "expat killed","expat attacked","express kidnapping","gang violence","cartel violence",
  "armed robbery","mugging","piracy","pirate attack","maritime piracy",
  // Civil unrest affecting movement
  "protest","demonstration","riot","unrest","uprising","mass protest","violent protest",
  "clashes","crackdown","tear gas","water cannon","rubber bullets","police violence",
  "coup","coup attempt","revolution","rebellion","civil war","ethnic violence",
  // Armed conflict in-country
  "airstrike","air strike","missile strike","drone strike","shelling","artillery",
  "armed conflict","cross-border attack","military operation","fighting erupts",
  "ambush","firefight","casualties","killed in","wounded in",
  // Health threats to travelers
  "outbreak","epidemic","pandemic","cholera","ebola","mpox","monkeypox","dengue",
  "yellow fever","measles outbreak","mers","sars","novel virus","quarantine",
  "health alert","disease outbreak","contaminated water","food poisoning outbreak",
  // Natural disasters & weather affecting travel
  "earthquake","tsunami","volcanic eruption","volcano erupts","ash cloud","wildfire",
  "bushfire","hurricane","typhoon","cyclone","tropical storm","flash flood","flooding",
  "landslide","mudslide","blizzard","ice storm","heatwave","sandstorm",
  // Critical infrastructure & cyber affecting travelers
  "power outage","blackout","water shortage","fuel shortage","internet shutdown",
  "communications blackout","cyber attack on airport","cyber attack on airline",
  "ransomware airline","ransomware hotel",
];

const EXCLUDE_KW = [
  // Entertainment / lifestyle
  "celebrity","hollywood","movie","box office","grammy","oscar","emmy","concert",
  "album","music video","netflix","disney","rapper","singer","actor","actress",
  "influencer","tiktok","instagram","fashion","runway","beauty","makeup",
  "lifestyle","wellness","diet","workout","fitness","recipe","cooking",
  "restaurant review","hotel review","resort review","spa","wedding","birthday","horoscope",
  // Sports
  "nba","nfl","mlb","nhl","premier league","champions league","super bowl",
  "playoff","championship","tournament","goal scored","touchdown","home run",
  "fantasy sports","betting odds","espn","sports betting","transfer window",
  // Business / tech (non-security)
  "quarterly earnings","ipo","startup funding","venture capital","stock price",
  "product launch","iphone","android","app store","software update","ces",
  "video game","gaming","esports","cryptocurrency price","bitcoin price","nft",
  // Petty / non-traveler-relevant crime
  "shoplifting","drunk driving","noise complaint","vandalism","petty crime",
  "domestic dispute","custody battle","divorce",
  // Pure geopolitics / policy with no on-ground traveler impact
  "treaty signed","summit concludes","bilateral talks","trade deal","trade war",
  "tariff","sanctions package","embargo announced","wto","g7","g20","brics summit",
  "foreign minister meets","ambassador appointed","un general assembly",
  "election results","campaign rally","parliamentary debate","budget bill",
  "central bank","interest rate","inflation report","gdp growth",
  // Defense procurement / weapons programs (not active threats)
  "arms deal","weapons contract","defense budget","fighter jet purchase",
  "submarine deal","aircraft carrier launched","military exercise","joint drill",
  "war games","naval drill","training exercise",
];

// Hard EXCLUSIONS — these are analytical, historical, procurement, opinion, or commentary
// pieces that mention threat keywords without describing an actual active incident.
const HARD_EXCLUDE_KW = [
   // Historical / retrospective / analytical
   "comeback","made a comeback","in recent years","over the years","decade ago",
   "looking back","retrospective","history of","origins of","explained:","explainer",
   "analysis:","commentary","opinion:","op-ed","editorial","feature:",
   "what we know about","everything you need","here's why","why the","timeline of",
   "anniversary","remembering","throwback",
   // Defense procurement & program news (not active threats)
   "will be modified","will replace","replacing aging","upgrade program","procurement",
   "contract awarded","fleet upgrade","modernization program","airframe","prototype",
   "delivered to","handed over to","commissioned","decommissioned","retired from service",
   "vip airlift","government ops","helicopter program","jet program","weapons system",
   "next-generation fighter","new variant","unveiled","rollout",
   // Reviews / rankings / lists
   "best places","top 10","ranked:","review:","guide to","how to visit",
   "things to do","destination guide","travel tips","travel guide",
   // Policy / academic
   "white paper","policy brief","think tank","academic study","research finds",
   "report says","study suggests","poll shows","survey finds",
 ];

// Active-incident verbs/phrases — at least one must appear for the item to qualify
// as live travel-security intel (vs. a historical/analytical mention).
const ACTIVE_INCIDENT_KW = [
   // Happening / just happened
   "killed","wounded","injured","dead","dies","died","casualties",
   "attacked","attacks","attacking","ambushed","stormed","raided","seized","captured",
   "evacuated","evacuating","stranded","trapped","rescued","missing",
   "kidnapped","abducted","held hostage","taken hostage",
   "exploded","explodes","blast hits","bomb hits","bombing kills","detonated",
   "fired at","opened fire","shot dead","shooting kills","gunmen kill",
   "clashed","clashes erupt","fighting erupts","battle for","battles erupt",
   "struck","strike hits","shelled","bombarded","airstrike kills","missile hits",
   // Issued / declared
   "advisory issued","warning issued","alert issued","advisory updated",
   "declared","imposed","announced curfew","imposed curfew",
   "shut down","shutting down","closed after","closure announced","cancelled after",
   "suspended after","suspends flights","grounded",
   "banned","blocked","restricted","quarantined",
   // Ongoing
   "ongoing","underway","unfolding","developing","breaking",
   "erupted","erupts","spreading","escalating","escalates","intensifies",
   "evacuation order","mandatory evacuation","shelter in place",
 ];

const CRITICAL_KW = ["attack","bomb","explosion","terror","war declared","invasion","massacre","mass casualty","nuclear strike","chemical weapon","imminent threat","active shooter","hostage situation","genocide","ethnic cleansing","biological attack"];
const HIGH_KW = ["conflict","military operation","troops deployed","missile strike","emergency declared","state of emergency","martial law","coup attempt","assassination","airstrike","ceasefire violated","casualties reported","ambush","drone strike","naval confrontation","blockade"];
const ELEVATED_KW = ["tension","protest","sanctions","warning","dispute","standoff","diplomatic crisis","border incident","military exercise","travel advisory","heightened alert","cyber attack","disinformation","propaganda","arms deal","troop movement","naval exercise"];

function isOsintRelevant(title: string, desc: string): boolean {
  const t = `${title} ${desc}`.toLowerCase();
  // 1. Hard reject obvious non-incident content
  if (EXCLUDE_KW.some(k => t.includes(k))) return false;
  if (HARD_EXCLUDE_KW.some(k => t.includes(k))) return false;
  // 2. Must mention a travel-security topic
  if (!INCLUDE_KW.some(k => t.includes(k))) return false;
  // 3. Must describe an ACTIVE incident (not historical/analytical)
  if (!ACTIVE_INCIDENT_KW.some(k => t.includes(k))) return false;
  return true;
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
  // Travel-security focused categorization
  if (["evacuat","travel advisory","travel warning","travel ban","stranded","airport closed","airport closure","flights cancelled","flights canceled","flights suspended","airspace closed","border closed","curfew","lockdown","checkpoint"].some(k => t.includes(k))) return "security";
  if (["terror","terrorist","bomb","explosion","blast","active shooter","mass shooting","ied","suicide bomb","car bomb","stabbing attack","kidnap","hostage","abducted","tourist killed","tourist attacked","foreigner killed","foreigner attacked","piracy","armed robbery","assassination"].some(k => t.includes(k))) return "security";
  if (["airstrike","missile strike","drone strike","shelling","artillery","armed conflict","military operation","fighting","war","ceasefire","invasion","ambush","frontline"].some(k => t.includes(k))) return "conflict";
  if (["protest","demonstration","riot","unrest","uprising","clashes","crackdown","tear gas","coup","martial law","revolution","rebellion","civil war","ethnic violence"].some(k => t.includes(k))) return "conflict";
  if (["earthquake","tsunami","volcanic","volcano","wildfire","bushfire","hurricane","typhoon","cyclone","tropical storm","flash flood","flooding","landslide","mudslide","blizzard","sandstorm","heatwave","disaster","refugee","displacement","famine","humanitarian"].some(k => t.includes(k))) return "humanitarian";
  if (["outbreak","epidemic","pandemic","cholera","ebola","mpox","monkeypox","dengue","yellow fever","measles","quarantine","health alert","disease"].some(k => t.includes(k))) return "humanitarian";
  if (["cyber attack on airport","cyber attack on airline","ransomware airline","ransomware hotel","internet shutdown","communications blackout"].some(k => t.includes(k))) return "technology";
  return "security";
}

function extractTags(title: string, desc: string): string[] {
  const t = `${title} ${desc}`.toLowerCase();
  const tags: string[] = [];
  const kws = [
    "military","terrorism","cyber","sanctions","politics","election","nuclear","protest",
    "coup","refugee","humanitarian","defense","security","conflict","diplomatic","border",
    "travel-risk","evacuation","unrest","assassination","hostage","piracy","cartel",
    "espionage","disinformation","maritime","blockade","drone","missile","chemical",
    "biological","separatist","mercenary","paramilitary","genocide","war-crime",
  ];
  for (const k of kws) { if (t.includes(k.replace("-"," ")) && tags.length < 6) tags.push(k); }
  return tags.length ? tags : ["intel"];
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 2B — FINGERPRINT DEDUPLICATION                            ║
// ╚══════════════════════════════════════════════════════════════════╝
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"].forEach(p => u.searchParams.delete(p));
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/,"")}${u.search}`.toLowerCase();
  } catch { return url.toLowerCase().split("?")[0]; }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim().substring(0, 80);
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function makeFingerprint(title: string, url: string): Promise<string> {
  return sha256(`${normalizeTitle(title)}|${normalizeUrl(url)}`);
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 2C — GEOLOCATION ENGINE (600+ cities, 50+ countries)      ║
// ╚══════════════════════════════════════════════════════════════════╝
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
  "fort bragg": { lat: 35.1390, lon: -78.9997, country: "United States", region: "North America" },
  "norfolk": { lat: 36.8508, lon: -76.2859, country: "United States", region: "North America" },
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
  "naples": { lat: 40.8518, lon: 14.2681, country: "Italy", region: "Europe" },
  "madrid": { lat: 40.4168, lon: -3.7038, country: "Spain", region: "Europe" },
  "barcelona": { lat: 41.3874, lon: 2.1686, country: "Spain", region: "Europe" },
  "amsterdam": { lat: 52.3676, lon: 4.9041, country: "Netherlands", region: "Europe" },
  "brussels": { lat: 50.8503, lon: 4.3517, country: "Belgium", region: "Europe" },
  "vienna": { lat: 48.2082, lon: 16.3738, country: "Austria", region: "Europe" },
  "zurich": { lat: 47.3769, lon: 8.5417, country: "Switzerland", region: "Europe" },
  "geneva": { lat: 46.2044, lon: 6.1432, country: "Switzerland", region: "Europe" },
  "warsaw": { lat: 52.2297, lon: 21.0122, country: "Poland", region: "Europe" },
  "krakow": { lat: 50.0647, lon: 19.9450, country: "Poland", region: "Europe" },
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
  "sofia": { lat: 42.6977, lon: 23.3219, country: "Bulgaria", region: "Europe" },
  "bratislava": { lat: 48.1486, lon: 17.1077, country: "Slovakia", region: "Europe" },
  "zagreb": { lat: 45.8150, lon: 15.9819, country: "Croatia", region: "Europe" },
  "belgrade": { lat: 44.7866, lon: 20.4489, country: "Serbia", region: "Europe" },
  "sarajevo": { lat: 43.8563, lon: 18.4131, country: "Bosnia", region: "Europe" },
  "pristina": { lat: 42.6629, lon: 21.1655, country: "Kosovo", region: "Europe" },
  "tirana": { lat: 41.3275, lon: 19.8187, country: "Albania", region: "Europe" },
  "skopje": { lat: 41.9981, lon: 21.4254, country: "North Macedonia", region: "Europe" },
  "chisinau": { lat: 47.0105, lon: 28.8638, country: "Moldova", region: "Europe" },
  "tallinn": { lat: 59.4370, lon: 24.7536, country: "Estonia", region: "Europe" },
  "riga": { lat: 56.9496, lon: 24.1052, country: "Latvia", region: "Europe" },
  "vilnius": { lat: 54.6872, lon: 25.2797, country: "Lithuania", region: "Europe" },
  "tbilisi": { lat: 41.7151, lon: 44.8271, country: "Georgia", region: "Europe" },
  "yerevan": { lat: 40.1792, lon: 44.4991, country: "Armenia", region: "Europe" },
  "baku": { lat: 40.4093, lon: 49.8671, country: "Azerbaijan", region: "Europe" },
  "minsk": { lat: 53.9045, lon: 27.5615, country: "Belarus", region: "Europe" },
  // Ukraine (expanded)
  "kyiv": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kiev": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kharkiv": { lat: 49.9935, lon: 36.2304, country: "Ukraine", region: "Europe" },
  "odesa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "odessa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "lviv": { lat: 49.8397, lon: 24.0297, country: "Ukraine", region: "Europe" },
  "mariupol": { lat: 47.0958, lon: 37.5533, country: "Ukraine", region: "Europe" },
  "donetsk": { lat: 48.0159, lon: 37.8029, country: "Ukraine", region: "Europe" },
  "luhansk": { lat: 48.5740, lon: 39.3078, country: "Ukraine", region: "Europe" },
  "zaporizhzhia": { lat: 47.8388, lon: 35.1396, country: "Ukraine", region: "Europe" },
  "kherson": { lat: 46.6354, lon: 32.6169, country: "Ukraine", region: "Europe" },
  "dnipro": { lat: 48.4647, lon: 35.0462, country: "Ukraine", region: "Europe" },
  "bakhmut": { lat: 48.5944, lon: 38.0006, country: "Ukraine", region: "Europe" },
  "avdiivka": { lat: 48.1394, lon: 37.7465, country: "Ukraine", region: "Europe" },
  // Russia (expanded)
  "moscow": { lat: 55.7558, lon: 37.6173, country: "Russia", region: "Europe" },
  "st petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "kremlin": { lat: 55.7520, lon: 37.6175, country: "Russia", region: "Europe" },
  "novosibirsk": { lat: 55.0084, lon: 82.9357, country: "Russia", region: "Asia" },
  "vladivostok": { lat: 43.1155, lon: 131.8855, country: "Russia", region: "Asia" },
  "grozny": { lat: 43.3180, lon: 45.6987, country: "Russia", region: "Europe" },
  "sevastopol": { lat: 44.6166, lon: 33.5254, country: "Crimea", region: "Europe" },
  "simferopol": { lat: 44.9572, lon: 34.1108, country: "Crimea", region: "Europe" },
  // Middle East (expanded)
  "jerusalem": { lat: 31.7683, lon: 35.2137, country: "Israel", region: "Middle East" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", region: "Middle East" },
  "haifa": { lat: 32.7940, lon: 34.9896, country: "Israel", region: "Middle East" },
  "gaza": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "gaza city": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "rafah": { lat: 31.2929, lon: 34.2424, country: "Palestine", region: "Middle East" },
  "khan younis": { lat: 31.3462, lon: 34.3059, country: "Palestine", region: "Middle East" },
  "nablus": { lat: 32.2211, lon: 35.2544, country: "Palestine", region: "Middle East" },
  "jenin": { lat: 32.4610, lon: 35.3015, country: "Palestine", region: "Middle East" },
  "ramallah": { lat: 31.9038, lon: 35.2034, country: "Palestine", region: "Middle East" },
  "hebron": { lat: 31.5326, lon: 35.0998, country: "Palestine", region: "Middle East" },
  "tehran": { lat: 35.6892, lon: 51.3890, country: "Iran", region: "Middle East" },
  "isfahan": { lat: 32.6546, lon: 51.6680, country: "Iran", region: "Middle East" },
  "tabriz": { lat: 38.0800, lon: 46.2919, country: "Iran", region: "Middle East" },
  "riyadh": { lat: 24.7136, lon: 46.6753, country: "Saudi Arabia", region: "Middle East" },
  "jeddah": { lat: 21.5433, lon: 39.1728, country: "Saudi Arabia", region: "Middle East" },
  "mecca": { lat: 21.3891, lon: 39.8579, country: "Saudi Arabia", region: "Middle East" },
  "dubai": { lat: 25.2048, lon: 55.2708, country: "UAE", region: "Middle East" },
  "abu dhabi": { lat: 24.4539, lon: 54.3773, country: "UAE", region: "Middle East" },
  "ankara": { lat: 39.9334, lon: 32.8597, country: "Turkey", region: "Middle East" },
  "istanbul": { lat: 41.0082, lon: 28.9784, country: "Turkey", region: "Middle East" },
  "diyarbakir": { lat: 37.9144, lon: 40.2306, country: "Turkey", region: "Middle East" },
  "baghdad": { lat: 33.3152, lon: 44.3661, country: "Iraq", region: "Middle East" },
  "mosul": { lat: 36.3350, lon: 43.1189, country: "Iraq", region: "Middle East" },
  "basra": { lat: 30.5085, lon: 47.7804, country: "Iraq", region: "Middle East" },
  "erbil": { lat: 36.1901, lon: 44.0090, country: "Iraq", region: "Middle East" },
  "kirkuk": { lat: 35.4681, lon: 44.3922, country: "Iraq", region: "Middle East" },
  "damascus": { lat: 33.5138, lon: 36.2765, country: "Syria", region: "Middle East" },
  "aleppo": { lat: 36.2021, lon: 37.1343, country: "Syria", region: "Middle East" },
  "idlib": { lat: 35.9306, lon: 36.6339, country: "Syria", region: "Middle East" },
  "raqqa": { lat: 35.9594, lon: 39.0070, country: "Syria", region: "Middle East" },
  "deir ez zor": { lat: 35.3400, lon: 40.1412, country: "Syria", region: "Middle East" },
  "beirut": { lat: 33.8938, lon: 35.5018, country: "Lebanon", region: "Middle East" },
  "amman": { lat: 31.9454, lon: 35.9284, country: "Jordan", region: "Middle East" },
  "doha": { lat: 25.2854, lon: 51.5310, country: "Qatar", region: "Middle East" },
  "muscat": { lat: 23.5880, lon: 58.3829, country: "Oman", region: "Middle East" },
  "sanaa": { lat: 15.3694, lon: 44.1910, country: "Yemen", region: "Middle East" },
  "aden": { lat: 12.7855, lon: 45.0187, country: "Yemen", region: "Middle East" },
  "hodeidah": { lat: 14.7979, lon: 42.9744, country: "Yemen", region: "Middle East" },
  "kuwait city": { lat: 29.3759, lon: 47.9774, country: "Kuwait", region: "Middle East" },
  "manama": { lat: 26.2285, lon: 50.5860, country: "Bahrain", region: "Middle East" },
  // Asia
  "beijing": { lat: 39.9042, lon: 116.4074, country: "China", region: "Asia" },
  "shanghai": { lat: 31.2304, lon: 121.4737, country: "China", region: "Asia" },
  "hong kong": { lat: 22.3193, lon: 114.1694, country: "China", region: "Asia" },
  "guangzhou": { lat: 23.1291, lon: 113.2644, country: "China", region: "Asia" },
  "shenzhen": { lat: 22.5431, lon: 114.0579, country: "China", region: "Asia" },
  "chengdu": { lat: 30.5728, lon: 104.0668, country: "China", region: "Asia" },
  "taipei": { lat: 25.0330, lon: 121.5654, country: "Taiwan", region: "Asia" },
  "tokyo": { lat: 35.6762, lon: 139.6503, country: "Japan", region: "Asia" },
  "osaka": { lat: 34.6937, lon: 135.5023, country: "Japan", region: "Asia" },
  "seoul": { lat: 37.5665, lon: 126.9780, country: "South Korea", region: "Asia" },
  "pyongyang": { lat: 39.0392, lon: 125.7625, country: "North Korea", region: "Asia" },
  "new delhi": { lat: 28.6139, lon: 77.2090, country: "India", region: "Asia" },
  "delhi": { lat: 28.7041, lon: 77.1025, country: "India", region: "Asia" },
  "mumbai": { lat: 19.0760, lon: 72.8777, country: "India", region: "Asia" },
  "kolkata": { lat: 22.5726, lon: 88.3639, country: "India", region: "Asia" },
  "chennai": { lat: 13.0827, lon: 80.2707, country: "India", region: "Asia" },
  "srinagar": { lat: 34.0837, lon: 74.7973, country: "India", region: "Asia" },
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "lahore": { lat: 31.5204, lon: 74.3587, country: "Pakistan", region: "Asia" },
  "peshawar": { lat: 34.0151, lon: 71.5249, country: "Pakistan", region: "Asia" },
  "quetta": { lat: 30.1798, lon: 66.9750, country: "Pakistan", region: "Asia" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Asia" },
  "kandahar": { lat: 31.6289, lon: 65.7372, country: "Afghanistan", region: "Asia" },
  "herat": { lat: 34.3529, lon: 62.2040, country: "Afghanistan", region: "Asia" },
  // ── ASEAN Cities (comprehensive) ──
  // Thailand
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Southeast Asia" },
  "chiang mai": { lat: 18.7883, lon: 98.9853, country: "Thailand", region: "Southeast Asia" },
  "phuket": { lat: 7.8804, lon: 98.3923, country: "Thailand", region: "Southeast Asia" },
  "pattaya": { lat: 12.9236, lon: 100.8825, country: "Thailand", region: "Southeast Asia" },
  "hat yai": { lat: 7.0036, lon: 100.4747, country: "Thailand", region: "Southeast Asia" },
  "chiang rai": { lat: 19.9105, lon: 99.8406, country: "Thailand", region: "Southeast Asia" },
  "nakhon ratchasima": { lat: 14.9799, lon: 102.0978, country: "Thailand", region: "Southeast Asia" },
  "udon thani": { lat: 17.4156, lon: 102.7872, country: "Thailand", region: "Southeast Asia" },
  // Singapore
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Southeast Asia" },
  // Philippines
  "manila": { lat: 14.5995, lon: 120.9842, country: "Philippines", region: "Southeast Asia" },
  "quezon city": { lat: 14.6760, lon: 121.0437, country: "Philippines", region: "Southeast Asia" },
  "davao": { lat: 7.1907, lon: 125.4553, country: "Philippines", region: "Southeast Asia" },
  "cebu": { lat: 10.3157, lon: 123.8854, country: "Philippines", region: "Southeast Asia" },
  "zamboanga": { lat: 6.9214, lon: 122.0790, country: "Philippines", region: "Southeast Asia" },
  "marawi": { lat: 7.9986, lon: 124.2928, country: "Philippines", region: "Southeast Asia" },
  "jolo": { lat: 6.0535, lon: 121.0021, country: "Philippines", region: "Southeast Asia" },
  "cotabato": { lat: 7.2236, lon: 124.2464, country: "Philippines", region: "Southeast Asia" },
  "general santos": { lat: 6.1164, lon: 125.1716, country: "Philippines", region: "Southeast Asia" },
  "subic bay": { lat: 14.7943, lon: 120.2822, country: "Philippines", region: "Southeast Asia" },
  // Indonesia
  "jakarta": { lat: -6.2088, lon: 106.8456, country: "Indonesia", region: "Southeast Asia" },
  "surabaya": { lat: -7.2575, lon: 112.7521, country: "Indonesia", region: "Southeast Asia" },
  "bandung": { lat: -6.9175, lon: 107.6191, country: "Indonesia", region: "Southeast Asia" },
  "medan": { lat: 3.5952, lon: 98.6722, country: "Indonesia", region: "Southeast Asia" },
  "makassar": { lat: -5.1477, lon: 119.4327, country: "Indonesia", region: "Southeast Asia" },
  "semarang": { lat: -6.9666, lon: 110.4196, country: "Indonesia", region: "Southeast Asia" },
  "yogyakarta": { lat: -7.7956, lon: 110.3695, country: "Indonesia", region: "Southeast Asia" },
  "bali": { lat: -8.3405, lon: 115.0920, country: "Indonesia", region: "Southeast Asia" },
  "denpasar": { lat: -8.6705, lon: 115.2126, country: "Indonesia", region: "Southeast Asia" },
  "aceh": { lat: 5.5483, lon: 95.3238, country: "Indonesia", region: "Southeast Asia" },
  "papua": { lat: -4.2699, lon: 138.0804, country: "Indonesia", region: "Southeast Asia" },
  "natuna": { lat: 3.8136, lon: 108.3880, country: "Indonesia", region: "Southeast Asia" },
  // Vietnam
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Southeast Asia" },
  "ho chi minh city": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Southeast Asia" },
  "saigon": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Southeast Asia" },
  "da nang": { lat: 16.0544, lon: 108.2022, country: "Vietnam", region: "Southeast Asia" },
  "hai phong": { lat: 20.8449, lon: 106.6881, country: "Vietnam", region: "Southeast Asia" },
  "hue": { lat: 16.4637, lon: 107.5909, country: "Vietnam", region: "Southeast Asia" },
  "cam ranh": { lat: 11.9214, lon: 109.1591, country: "Vietnam", region: "Southeast Asia" },
  // Malaysia
  "kuala lumpur": { lat: 3.1390, lon: 101.6869, country: "Malaysia", region: "Southeast Asia" },
  "johor bahru": { lat: 1.4927, lon: 103.7414, country: "Malaysia", region: "Southeast Asia" },
  "penang": { lat: 5.4141, lon: 100.3288, country: "Malaysia", region: "Southeast Asia" },
  "kota kinabalu": { lat: 5.9804, lon: 116.0735, country: "Malaysia", region: "Southeast Asia" },
  "kuching": { lat: 1.5497, lon: 110.3634, country: "Malaysia", region: "Southeast Asia" },
  "putrajaya": { lat: 2.9264, lon: 101.6964, country: "Malaysia", region: "Southeast Asia" },
  "sabah": { lat: 5.9788, lon: 116.0753, country: "Malaysia", region: "Southeast Asia" },
  "sarawak": { lat: 1.5533, lon: 110.3592, country: "Malaysia", region: "Southeast Asia" },
  // Myanmar
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Southeast Asia" },
  "naypyidaw": { lat: 19.7633, lon: 96.0785, country: "Myanmar", region: "Southeast Asia" },
  "mandalay": { lat: 21.9588, lon: 96.0891, country: "Myanmar", region: "Southeast Asia" },
  "myitkyina": { lat: 25.3830, lon: 97.3966, country: "Myanmar", region: "Southeast Asia" },
  "sittwe": { lat: 20.1461, lon: 92.8983, country: "Myanmar", region: "Southeast Asia" },
  "mawlamyine": { lat: 16.4910, lon: 97.6256, country: "Myanmar", region: "Southeast Asia" },
  "rakhine": { lat: 20.1467, lon: 92.8960, country: "Myanmar", region: "Southeast Asia" },
  "shan state": { lat: 21.5000, lon: 97.7500, country: "Myanmar", region: "Southeast Asia" },
  // Cambodia
  "phnom penh": { lat: 11.5564, lon: 104.9282, country: "Cambodia", region: "Southeast Asia" },
  "siem reap": { lat: 13.3633, lon: 103.8564, country: "Cambodia", region: "Southeast Asia" },
  "sihanoukville": { lat: 10.6093, lon: 103.5295, country: "Cambodia", region: "Southeast Asia" },
  "battambang": { lat: 13.1020, lon: 103.1986, country: "Cambodia", region: "Southeast Asia" },
  // Laos
  "vientiane": { lat: 17.9757, lon: 102.6331, country: "Laos", region: "Southeast Asia" },
  "luang prabang": { lat: 19.8833, lon: 102.1347, country: "Laos", region: "Southeast Asia" },
  "savannakhet": { lat: 16.5472, lon: 104.7525, country: "Laos", region: "Southeast Asia" },
  // Brunei
  "bandar seri begawan": { lat: 4.9431, lon: 114.9425, country: "Brunei", region: "Southeast Asia" },
  // ASEAN Maritime Zones
  "malacca strait": { lat: 2.5, lon: 101.5, country: "Malacca Strait", region: "Southeast Asia" },
  "strait of malacca": { lat: 2.5, lon: 101.5, country: "Malacca Strait", region: "Southeast Asia" },
  "sulu sea": { lat: 8.0, lon: 121.0, country: "Sulu Sea", region: "Southeast Asia" },
  "celebes sea": { lat: 3.0, lon: 123.0, country: "Celebes Sea", region: "Southeast Asia" },
  "andaman sea": { lat: 10.0, lon: 96.0, country: "Andaman Sea", region: "Southeast Asia" },
  "mekong": { lat: 15.1, lon: 105.8, country: "Mekong Region", region: "Southeast Asia" },
  "mekong river": { lat: 15.1, lon: 105.8, country: "Mekong Region", region: "Southeast Asia" },
  "spratly": { lat: 8.6333, lon: 111.9167, country: "Spratly Islands", region: "Southeast Asia" },
  "paracel": { lat: 16.5, lon: 112.0, country: "Paracel Islands", region: "Southeast Asia" },
  "scarborough shoal": { lat: 15.1500, lon: 117.7500, country: "Scarborough Shoal", region: "Southeast Asia" },
  // South Asia (kept)
  "dhaka": { lat: 23.8103, lon: 90.4125, country: "Bangladesh", region: "Asia" },
  "colombo": { lat: 6.9271, lon: 79.8612, country: "Sri Lanka", region: "Asia" },
  "kathmandu": { lat: 27.7172, lon: 85.3240, country: "Nepal", region: "Asia" },
  // Central Asia
  "astana": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Asia" },
  "tashkent": { lat: 41.2995, lon: 69.2401, country: "Uzbekistan", region: "Asia" },
  "bishkek": { lat: 42.8746, lon: 74.5698, country: "Kyrgyzstan", region: "Asia" },
  "dushanbe": { lat: 38.5598, lon: 68.7740, country: "Tajikistan", region: "Asia" },
  "ashgabat": { lat: 37.9601, lon: 58.3261, country: "Turkmenistan", region: "Asia" },
  // Africa (expanded)
  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Africa" },
  "alexandria": { lat: 31.2001, lon: 29.9187, country: "Egypt", region: "Africa" },
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "maiduguri": { lat: 11.8311, lon: 13.1510, country: "Nigeria", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "pretoria": { lat: -25.7461, lon: 28.1881, country: "South Africa", region: "Africa" },
  "johannesburg": { lat: -26.2041, lon: 28.0473, country: "South Africa", region: "Africa" },
  "cape town": { lat: -33.9249, lon: 18.4241, country: "South Africa", region: "Africa" },
  "addis ababa": { lat: 9.0250, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "port sudan": { lat: 19.6158, lon: 37.2164, country: "Sudan", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "benghazi": { lat: 32.1194, lon: 20.0868, country: "Libya", region: "Africa" },
  "mogadishu": { lat: 2.0469, lon: 45.3182, country: "Somalia", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "goma": { lat: -1.6771, lon: 29.2386, country: "DR Congo", region: "Africa" },
  "dakar": { lat: 14.7167, lon: -17.4677, country: "Senegal", region: "Africa" },
  "accra": { lat: 5.6037, lon: -0.1870, country: "Ghana", region: "Africa" },
  "bamako": { lat: 12.6392, lon: -8.0029, country: "Mali", region: "Africa" },
  "ouagadougou": { lat: 12.3714, lon: -1.5197, country: "Burkina Faso", region: "Africa" },
  "niamey": { lat: 13.5127, lon: 2.1128, country: "Niger", region: "Africa" },
  "ndjamena": { lat: 12.1348, lon: 15.0557, country: "Chad", region: "Africa" },
  "kampala": { lat: 0.3476, lon: 32.5825, country: "Uganda", region: "Africa" },
  "kigali": { lat: -1.9403, lon: 29.8739, country: "Rwanda", region: "Africa" },
  "maputo": { lat: -25.9692, lon: 32.5732, country: "Mozambique", region: "Africa" },
  "luanda": { lat: -8.8383, lon: 13.2344, country: "Angola", region: "Africa" },
  "harare": { lat: -17.8252, lon: 31.0335, country: "Zimbabwe", region: "Africa" },
  // South America
  "brasilia": { lat: -15.7801, lon: -47.9292, country: "Brazil", region: "South America" },
  "sao paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", region: "South America" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, country: "Brazil", region: "South America" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "South America" },
  "bogota": { lat: 4.7110, lon: -74.0721, country: "Colombia", region: "South America" },
  "medellin": { lat: 6.2442, lon: -75.5812, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "South America" },
  "quito": { lat: -0.1807, lon: -78.4678, country: "Ecuador", region: "South America" },
  "la paz": { lat: -16.5000, lon: -68.1500, country: "Bolivia", region: "South America" },
  "mexico city": { lat: 19.4326, lon: -99.1332, country: "Mexico", region: "North America" },
  "guadalajara": { lat: 20.6597, lon: -103.3496, country: "Mexico", region: "North America" },
  "monterrey": { lat: 25.6866, lon: -100.3161, country: "Mexico", region: "North America" },
  "ciudad juarez": { lat: 31.6904, lon: -106.4245, country: "Mexico", region: "North America" },
  "tijuana": { lat: 32.5149, lon: -117.0382, country: "Mexico", region: "North America" },
  "havana": { lat: 23.1136, lon: -82.3666, country: "Cuba", region: "North America" },
  "guatemala city": { lat: 14.6349, lon: -90.5069, country: "Guatemala", region: "North America" },
  "tegucigalpa": { lat: 14.0723, lon: -87.1921, country: "Honduras", region: "North America" },
  "san salvador": { lat: 13.6929, lon: -89.2182, country: "El Salvador", region: "North America" },
  "managua": { lat: 12.1149, lon: -86.2362, country: "Nicaragua", region: "North America" },
  "panama city": { lat: 8.9824, lon: -79.5199, country: "Panama", region: "North America" },
  "port au prince": { lat: 18.5944, lon: -72.3074, country: "Haiti", region: "North America" },
  // Oceania
  "canberra": { lat: -35.2809, lon: 149.1300, country: "Australia", region: "Oceania" },
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "melbourne": { lat: -37.8136, lon: 144.9631, country: "Australia", region: "Oceania" },
  "wellington": { lat: -41.2866, lon: 174.7756, country: "New Zealand", region: "Oceania" },
  "auckland": { lat: -36.8485, lon: 174.7633, country: "New Zealand", region: "Oceania" },
  // Maritime zones
  "south china sea": { lat: 12.0, lon: 114.0, country: "South China Sea", region: "Asia" },
  "taiwan strait": { lat: 24.0, lon: 119.0, country: "Taiwan Strait", region: "Asia" },
  "strait of hormuz": { lat: 26.5, lon: 56.3, country: "Strait of Hormuz", region: "Middle East" },
  "red sea": { lat: 20.0, lon: 38.0, country: "Red Sea", region: "Middle East" },
  "bab el mandeb": { lat: 12.6, lon: 43.3, country: "Bab el-Mandeb", region: "Middle East" },
  "suez canal": { lat: 30.4, lon: 32.3, country: "Egypt", region: "Middle East" },
  "gulf of aden": { lat: 12.0, lon: 47.0, country: "Gulf of Aden", region: "Africa" },
  "black sea": { lat: 43.0, lon: 35.0, country: "Black Sea", region: "Europe" },
  "persian gulf": { lat: 26.0, lon: 52.0, country: "Persian Gulf", region: "Middle East" },
  "arabian sea": { lat: 15.0, lon: 65.0, country: "Arabian Sea", region: "Asia" },
  "mediterranean": { lat: 35.0, lon: 18.0, country: "Mediterranean Sea", region: "Europe" },
  "arctic": { lat: 75.0, lon: 0.0, country: "Arctic", region: "Arctic" },
};

const COUNTRY_PATTERNS: Record<string, { patterns: string[]; lat: number; lon: number; name: string; region: string; offset: number }> = {
  "ua": { patterns: ["ukraine","ukrainian","zelensky"], lat: 50.4501, lon: 30.5234, name: "Ukraine", region: "Europe", offset: 0.3 },
  "ru": { patterns: ["russia","russian","kremlin","putin"], lat: 55.7558, lon: 37.6173, name: "Russia", region: "Europe", offset: 0.5 },
  "cn": { patterns: ["china","chinese","xi jinping","pla ","prc "], lat: 39.9042, lon: 116.4074, name: "China", region: "Asia", offset: 0.4 },
  "ir": { patterns: ["iran","iranian","irgc","khamenei"], lat: 35.6892, lon: 51.3890, name: "Iran", region: "Middle East", offset: 0.3 },
  "il": { patterns: ["israel","israeli","netanyahu","hamas","hezbollah","idf "], lat: 31.7683, lon: 35.2137, name: "Israel", region: "Middle East", offset: 0.1 },
  "ps": { patterns: ["palestine","palestinian","west bank","gaza strip"], lat: 31.9522, lon: 35.2332, name: "Palestine", region: "Middle East", offset: 0.1 },
  "gb": { patterns: ["britain","british","uk ","england","wales","scotland"], lat: 51.5074, lon: -0.1278, name: "United Kingdom", region: "Europe", offset: 0.2 },
  "de": { patterns: ["germany","german","scholz","bundeswehr"], lat: 52.5200, lon: 13.4050, name: "Germany", region: "Europe", offset: 0.3 },
  "fr": { patterns: ["france","french","macron"], lat: 48.8566, lon: 2.3522, name: "France", region: "Europe", offset: 0.3 },
  "sa": { patterns: ["saudi","saudi arabia","mbs "], lat: 24.7136, lon: 46.6753, name: "Saudi Arabia", region: "Middle East", offset: 0.4 },
  "tr": { patterns: ["turkey","turkish","erdogan","turkiye"], lat: 39.9334, lon: 32.8597, name: "Turkey", region: "Middle East", offset: 0.3 },
  "pk": { patterns: ["pakistan","pakistani"], lat: 33.6844, lon: 73.0479, name: "Pakistan", region: "Asia", offset: 0.3 },
  "in": { patterns: ["india","indian","modi"], lat: 28.6139, lon: 77.2090, name: "India", region: "Asia", offset: 0.4 },
  "kr": { patterns: ["south korea","korean"], lat: 37.5665, lon: 126.9780, name: "South Korea", region: "Asia", offset: 0.15 },
  "kp": { patterns: ["north korea","pyongyang","kim jong"], lat: 39.0392, lon: 125.7625, name: "North Korea", region: "Asia", offset: 0.2 },
  "jp": { patterns: ["japan","japanese"], lat: 35.6762, lon: 139.6503, name: "Japan", region: "Asia", offset: 0.15 },
  "au": { patterns: ["australia","australian"], lat: -35.2809, lon: 149.1300, name: "Australia", region: "Oceania", offset: 0.3 },
  "ca": { patterns: ["canada","canadian"], lat: 45.4215, lon: -75.6972, name: "Canada", region: "North America", offset: 0.4 },
  "mx": { patterns: ["mexico","mexican","cartel"], lat: 19.4326, lon: -99.1332, name: "Mexico", region: "North America", offset: 0.3 },
  "br": { patterns: ["brazil","brazilian"], lat: -15.7801, lon: -47.9292, name: "Brazil", region: "South America", offset: 0.5 },
  "eg": { patterns: ["egypt","egyptian"], lat: 30.0444, lon: 31.2357, name: "Egypt", region: "Africa", offset: 0.2 },
  "za": { patterns: ["south africa"], lat: -25.7461, lon: 28.1881, name: "South Africa", region: "Africa", offset: 0.3 },
  "ng": { patterns: ["nigeria","nigerian","boko haram"], lat: 9.0765, lon: 7.3986, name: "Nigeria", region: "Africa", offset: 0.3 },
  "ae": { patterns: ["uae","emirates","emirati"], lat: 24.4539, lon: 54.3773, name: "UAE", region: "Middle East", offset: 0.15 },
  "sy": { patterns: ["syria","syrian","assad"], lat: 33.5138, lon: 36.2765, name: "Syria", region: "Middle East", offset: 0.2 },
  "ye": { patterns: ["yemen","yemeni","houthi","ansar allah"], lat: 15.3694, lon: 44.1910, name: "Yemen", region: "Middle East", offset: 0.3 },
  "af": { patterns: ["afghanistan","afghan","taliban"], lat: 34.5553, lon: 69.2075, name: "Afghanistan", region: "Asia", offset: 0.3 },
  "ly": { patterns: ["libya","libyan","haftar"], lat: 32.8872, lon: 13.1913, name: "Libya", region: "Africa", offset: 0.3 },
  "sd": { patterns: ["sudan","sudanese","rsf ","rapid support"], lat: 15.5007, lon: 32.5599, name: "Sudan", region: "Africa", offset: 0.3 },
  "mm": { patterns: ["myanmar","burma","burmese","rohingya","junta","tatmadaw","nug ","pdf ","arakan"], lat: 16.8661, lon: 96.1951, name: "Myanmar", region: "Southeast Asia", offset: 0.3 },
  // ── ASEAN Country Patterns ──
  "th": { patterns: ["thailand","thai","prayuth","srettha"], lat: 13.7563, lon: 100.5018, name: "Thailand", region: "Southeast Asia", offset: 0.3 },
  "vn": { patterns: ["vietnam","vietnamese"], lat: 21.0278, lon: 105.8342, name: "Vietnam", region: "Southeast Asia", offset: 0.3 },
  "id": { patterns: ["indonesia","indonesian","jokowi","prabowo"], lat: -6.2088, lon: 106.8456, name: "Indonesia", region: "Southeast Asia", offset: 0.4 },
  "my": { patterns: ["malaysia","malaysian","anwar ibrahim"], lat: 3.1390, lon: 101.6869, name: "Malaysia", region: "Southeast Asia", offset: 0.2 },
  "kh": { patterns: ["cambodia","cambodian","hun manet","hun sen"], lat: 11.5564, lon: 104.9282, name: "Cambodia", region: "Southeast Asia", offset: 0.2 },
  "la": { patterns: ["laos","laotian","lao pdr"], lat: 17.9757, lon: 102.6331, name: "Laos", region: "Southeast Asia", offset: 0.2 },
  "bn": { patterns: ["brunei","bruneian"], lat: 4.9431, lon: 114.9425, name: "Brunei", region: "Southeast Asia", offset: 0.05 },
  "tl": { patterns: ["timor-leste","timor leste","east timor"], lat: -8.5569, lon: 125.5603, name: "Timor-Leste", region: "Southeast Asia", offset: 0.1 },
  "asean": { patterns: ["asean","southeast asia","south east asia","indopacific","indo-pacific"], lat: 4.0, lon: 108.0, name: "ASEAN Region", region: "Southeast Asia", offset: 2.0 },
  "ve": { patterns: ["venezuela","venezuelan","maduro"], lat: 10.4806, lon: -66.9036, name: "Venezuela", region: "South America", offset: 0.3 },
  "tw": { patterns: ["taiwan","taiwanese"], lat: 25.0330, lon: 121.5654, name: "Taiwan", region: "Asia", offset: 0.1 },
  "lb": { patterns: ["lebanon","lebanese"], lat: 33.8938, lon: 35.5018, name: "Lebanon", region: "Middle East", offset: 0.1 },
  "us": { patterns: ["united states","u.s.","america","pentagon","white house","trump","biden"], lat: 38.9072, lon: -77.0369, name: "United States", region: "North America", offset: 0.3 },
  "it": { patterns: ["italy","italian"], lat: 41.9028, lon: 12.4964, name: "Italy", region: "Europe", offset: 0.2 },
  "es": { patterns: ["spain","spanish"], lat: 40.4168, lon: -3.7038, name: "Spain", region: "Europe", offset: 0.3 },
  "nl": { patterns: ["netherlands","dutch","holland"], lat: 52.3676, lon: 4.9041, name: "Netherlands", region: "Europe", offset: 0.1 },
  "nz": { patterns: ["new zealand"], lat: -41.2866, lon: 174.7756, name: "New Zealand", region: "Oceania", offset: 0.2 },
  "sg": { patterns: ["singapore","singaporean"], lat: 1.3521, lon: 103.8198, name: "Singapore", region: "Southeast Asia", offset: 0.05 },
  "ph": { patterns: ["philippines","filipino","mindanao","abu sayyaf","marcos","duterte","bangsamoro"], lat: 14.5995, lon: 120.9842, name: "Philippines", region: "Southeast Asia", offset: 0.2 },
  "iq": { patterns: ["iraq","iraqi"], lat: 33.3152, lon: 44.3661, name: "Iraq", region: "Middle East", offset: 0.3 },
  "so": { patterns: ["somalia","somali","al shabaab","al-shabaab"], lat: 2.0469, lon: 45.3182, name: "Somalia", region: "Africa", offset: 0.3 },
  "cd": { patterns: ["congo","congolese","drc ","m23 "], lat: -4.4419, lon: 15.2663, name: "DR Congo", region: "Africa", offset: 0.4 },
  "ml": { patterns: ["mali","malian","jnim","aqim"], lat: 12.6392, lon: -8.0029, name: "Mali", region: "Africa", offset: 0.3 },
  "bf": { patterns: ["burkina faso","burkinabe"], lat: 12.3714, lon: -1.5197, name: "Burkina Faso", region: "Africa", offset: 0.2 },
  "ne": { patterns: ["niger","nigerien"], lat: 13.5127, lon: 2.1128, name: "Niger", region: "Africa", offset: 0.3 },
  "et": { patterns: ["ethiopia","ethiopian","tigray"], lat: 9.0250, lon: 38.7469, name: "Ethiopia", region: "Africa", offset: 0.3 },
  "ht": { patterns: ["haiti","haitian"], lat: 18.5944, lon: -72.3074, name: "Haiti", region: "North America", offset: 0.1 },
  "co": { patterns: ["colombia","colombian","farc","eln "], lat: 4.7110, lon: -74.0721, name: "Colombia", region: "South America", offset: 0.3 },
  "mz": { patterns: ["mozambique","cabo delgado"], lat: -25.9692, lon: 32.5732, name: "Mozambique", region: "Africa", offset: 0.3 },
  "by": { patterns: ["belarus","belarusian","lukashenko"], lat: 53.9045, lon: 27.5615, name: "Belarus", region: "Europe", offset: 0.2 },
  "ge": { patterns: ["georgia","georgian","tbilisi"], lat: 41.7151, lon: 44.8271, name: "Georgia", region: "Europe", offset: 0.1 },
  "am": { patterns: ["armenia","armenian"], lat: 40.1792, lon: 44.4991, name: "Armenia", region: "Europe", offset: 0.1 },
  "az": { patterns: ["azerbaijan","azeri","nagorno"], lat: 40.4093, lon: 49.8671, name: "Azerbaijan", region: "Europe", offset: 0.15 },
};

interface GeoResult { lat: number; lon: number; country: string; region: string; confidence: number; }

// Pre-compute reverse index: country name -> list of cities in that country
let CITIES_BY_COUNTRY: Record<string, Array<{ name: string; lat: number; lon: number; region: string }>> | null = null;
function getCitiesByCountry() {
  if (CITIES_BY_COUNTRY) return CITIES_BY_COUNTRY;
  CITIES_BY_COUNTRY = {};
  for (const [name, c] of Object.entries(CITIES)) {
    const key = c.country.toLowerCase();
    if (!CITIES_BY_COUNTRY[key]) CITIES_BY_COUNTRY[key] = [];
    CITIES_BY_COUNTRY[key].push({ name, lat: c.lat, lon: c.lon, region: c.region });
  }
  return CITIES_BY_COUNTRY;
}

// Deterministic hash so the same headline always picks the same city (stable pins, no jitter on re-fetch)
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function geolocate(title: string, desc: string): GeoResult {
  const text = `${title} ${desc}`.toLowerCase();
  
  // Pass 1: precise city/location match (longest first)
  const sorted = Object.keys(CITIES).sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      const c = CITIES[city];
      // Tiny deterministic micro-offset (~50-100m) so multiple intel in same city don't fully overlap
      const seed = hashStr(title);
      const micro = 0.002;
      const dx = ((seed % 1000) / 1000 - 0.5) * micro;
      const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * micro;
      return { lat: c.lat + dy, lon: c.lon + dx, country: c.country, region: c.region, confidence: 0.95 };
    }
  }
  
  // Pass 2: country pattern match — snap to a real city in that country (NEVER country centroid)
  const byCountry = getCitiesByCountry();
  for (const [, info] of Object.entries(COUNTRY_PATTERNS)) {
    if (info.patterns.some(p => text.includes(p))) {
      const cities = byCountry[info.name.toLowerCase()];
      if (cities && cities.length > 0) {
        // Deterministically pick a city based on the headline hash
        const seed = hashStr(title + info.name);
        const picked = cities[seed % cities.length];
        const micro = 0.002;
        const dx = ((seed % 1000) / 1000 - 0.5) * micro;
        const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * micro;
        return { lat: picked.lat + dy, lon: picked.lon + dx, country: info.name, region: info.region, confidence: 0.7 };
      }
      // No city dictionary for this country — use the capital coordinate as-is (still a real city)
      return { lat: info.lat, lon: info.lon, country: info.name, region: info.region, confidence: 0.6 };
    }
  }
  
  // Pass 3: unknown location — DO NOT default to Washington DC. Return sentinel so caller drops the item.
  return { lat: 0, lon: 0, country: "", region: "", confidence: 0 };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 3 — PARSERS (RSS, Telegram, GDELT, Paste)                 ║
// ╚══════════════════════════════════════════════════════════════════╝

function parseRss(xml: string, sourceName: string, credibility: "high" | "medium" | "low"): RawArticle[] {
  const items: RawArticle[] = [];
  // Try <item> (RSS) first, then <entry> (Atom)
  const rssMatches = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
  const atomMatches = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) || [];
  const matches = rssMatches.length > 0 ? rssMatches : atomMatches;
  
  for (const raw of matches.slice(0, 30)) {
    const titleM = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descM = raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
      || raw.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)
      || raw.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i);
    const linkM = raw.match(/<link[^>]*href="([^"]+)"/i) || raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateM = raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || raw.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || raw.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    
    const title = (titleM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const desc = (descM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const url = (linkM?.[1] || "").trim();
    // Strip CDATA wrappers from date strings and validate
    let pubDate = (dateM?.[1] || new Date().toISOString()).replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    // Try to parse — if invalid, fall back to now()
    const parsedDate = new Date(pubDate);
    if (isNaN(parsedDate.getTime())) {
      pubDate = new Date().toISOString();
    } else {
      pubDate = parsedDate.toISOString();
    }
    
    if (title && url) {
      items.push({ title, description: desc.substring(0, 2000), url, sourceName, publishedAt: pubDate, sourceCredibility: credibility, sourceType: "rss" });
    }
  }
  return items;
}

function parseTelegramHtml(html: string, channelName: string, displayName: string): RawArticle[] {
  const items: RawArticle[] = [];
  // Telegram public channel HTML format: tg_widget_message containers
  const msgBlocks = html.match(/<div class="tgme_widget_message_wrap[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  
  for (const block of msgBlocks.slice(0, 15)) {
    const textM = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const dateM = block.match(/<time[^>]*datetime="([^"]+)"/i);
    const linkM = block.match(/data-post="([^"]+)"/i);
    
    if (textM) {
      const rawText = textM[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();
      if (rawText.length > 20) {
        const title = rawText.substring(0, 200);
        const url = linkM ? `https://t.me/${linkM[1]}` : `https://t.me/s/${channelName}`;
        const pubDate = dateM?.[1] || new Date().toISOString();
        
        items.push({
          title, description: rawText.substring(0, 1000), url, sourceName: `TG: ${displayName}`,
          publishedAt: pubDate, sourceCredibility: "low", sourceType: "telegram",
        });
      }
    }
  }
  return items;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 4 — MAIN HANDLER                                          ║
// ╚══════════════════════════════════════════════════════════════════╝
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth — support both user JWT and cron (service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    let userId: string;
    // deno-lint-ignore no-explicit-any
    let dbClient: any;
    
    if (claimsError || !claimsData?.claims) {
      if (token === supabaseAnonKey || token === supabaseServiceKey) {
        dbClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: analysts } = await dbClient.from("user_roles").select("user_id").eq("role", "analyst").limit(1);
        userId = (analysts as Array<{ user_id: string }> | null)?.[0]?.user_id as string;
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

    console.log(`[OSINT] Starting multi-source collection for user: ${userId}`);
    const startTime = Date.now();
    
    const allArticles: RawArticle[] = [];
    const errors: string[] = [];
    const sourceStats: Record<string, number> = {};

    // ═══════════════ COLLECTOR 1: RSS FEEDS (parallel) ═══════════════
    const rssFetches = RSS_SOURCES.map(async (src) => {
      try {
        const resp = await fetch(src.url, {
          headers: { Accept: "application/rss+xml, application/xml, application/atom+xml, text/xml, */*" },
          signal: AbortSignal.timeout(12000),
        });
        if (!resp.ok) { errors.push(`${src.name}: HTTP ${resp.status}`); return []; }
        const xml = await resp.text();
        const items = parseRss(xml, src.name, src.credibility);
        sourceStats[src.name] = items.length;
        return items;
      } catch (e) {
        errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }
    });

    // ═══════════════ COLLECTOR 2: TELEGRAM PUBLIC CHANNELS ═══════════════
    const telegramFetches = TELEGRAM_CHANNELS.map(async (ch) => {
      try {
        const resp = await fetch(`https://t.me/s/${ch.channel}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; OsintBot/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) { errors.push(`TG:${ch.name}: HTTP ${resp.status}`); return []; }
        const html = await resp.text();
        const items = parseTelegramHtml(html, ch.channel, ch.name);
        sourceStats[`TG:${ch.name}`] = items.length;
        return items;
      } catch (e) {
        errors.push(`TG:${ch.name}: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }
    });

    // ═══════════════ COLLECTOR 3: GDELT EVENT API ═══════════════
    const gdeltFetch = async (): Promise<RawArticle[]> => {
      try {
        const resp = await fetch(
          "https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20military%20OR%20attack%20OR%20terrorism%20OR%20sanctions&mode=artlist&maxrecords=50&format=json&sort=datedesc&sourcelang=english",
          { signal: AbortSignal.timeout(15000) }
        );
        if (!resp.ok) { errors.push(`GDELT: HTTP ${resp.status}`); return []; }
        const data = await resp.json();
        const articles: RawArticle[] = [];
        if (data.articles) {
          for (const a of data.articles) {
            if (a.title && a.url) {
              articles.push({
                title: a.title, description: a.seendate || "", url: a.url,
                sourceName: a.domain || "GDELT", publishedAt: a.seendate ? new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6Z")).toISOString() : new Date().toISOString(),
                sourceCredibility: "medium", sourceType: "gdelt",
              });
            }
          }
        }
        sourceStats["GDELT Events"] = articles.length;
        return articles;
      } catch (e) {
        errors.push(`GDELT: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }
    };

    // ═══════════════ COLLECTOR 4: NewsAPI ═══════════════
    const newsApiFetch = async (): Promise<RawArticle[]> => {
      const newsApiKey = Deno.env.get("NEWSAPI_KEY");
      if (!newsApiKey) return [];
      try {
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const q = "(military OR conflict OR attack OR terrorism OR sanctions OR diplomatic OR troops OR missile OR protest OR coup OR war OR ceasefire OR humanitarian)";
        const resp = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&from=${from}&pageSize=100`, {
          headers: { "X-Api-Key": newsApiKey },
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) { errors.push(`NewsAPI: HTTP ${resp.status}`); return []; }
        const data = await resp.json();
        const articles: RawArticle[] = [];
        if (data.articles) {
          for (const a of data.articles) {
            if (a.title && a.title !== "[Removed]" && a.url) {
              articles.push({ title: a.title, description: a.description || "", url: a.url, sourceName: a.source?.name || "NewsAPI", publishedAt: a.publishedAt || new Date().toISOString(), sourceCredibility: "medium", sourceType: "newsapi" });
            }
          }
          sourceStats["NewsAPI"] = articles.length;
        }
        return articles;
      } catch (e) { errors.push(`NewsAPI: ${e instanceof Error ? e.message : String(e)}`); return []; }
    };

    // ═══════════════ COLLECTOR 5: Mediastack ═══════════════
    const mediastackFetch = async (): Promise<RawArticle[]> => {
      const key = Deno.env.get("MEDIASTACK_API_KEY");
      if (!key) return [];
      try {
        const resp = await fetch(`http://api.mediastack.com/v1/news?access_key=${key}&keywords=military,conflict,terrorism,diplomatic,sanctions,attack,war&languages=en&limit=100&sort=published_desc`, {
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) { errors.push(`Mediastack: HTTP ${resp.status}`); return []; }
        const data = await resp.json();
        const articles: RawArticle[] = [];
        if (data.data) {
          for (const a of data.data) {
            if (a.title && a.url) {
              articles.push({ title: a.title, description: a.description || "", url: a.url, sourceName: a.source || "Mediastack", publishedAt: a.published_at || new Date().toISOString(), sourceCredibility: "medium", sourceType: "mediastack" });
            }
          }
          sourceStats["Mediastack"] = articles.length;
        }
        return articles;
      } catch (e) { errors.push(`Mediastack: ${e instanceof Error ? e.message : String(e)}`); return []; }
    };

    // ═══════════════ EXECUTE ALL COLLECTORS IN PARALLEL ═══════════════
    const allFetches = [
      ...rssFetches,
      ...telegramFetches,
      gdeltFetch(),
      newsApiFetch(),
      mediastackFetch(),
    ];

    const results = await Promise.allSettled(allFetches);
    for (const r of results) {
      if (r.status === "fulfilled") allArticles.push(...r.value);
    }

    console.log(`[OSINT] Total raw articles from all collectors: ${allArticles.length}`);

    // ═══════════════ FILTER — OSINT relevance ═══════════════
    const relevant = allArticles.filter(a => isOsintRelevant(a.title, a.description));
    console.log(`[FILTER] OSINT relevant: ${relevant.length}/${allArticles.length}`);

    // ═══════════════ DEDUPE — fingerprint + title ═══════════════
    for (const a of relevant) {
      a.fingerprint = await makeFingerprint(a.title, a.url);
    }

    const seen = new Set<string>();
    const seenTitles = new Set<string>();
    const deduped: RawArticle[] = [];
    
    for (const a of relevant) {
      const fp = a.fingerprint!;
      const nt = normalizeTitle(a.title);
      if (seen.has(fp) || seenTitles.has(nt)) continue;
      seen.add(fp);
      seenTitles.add(nt);
      deduped.push(a);
    }
    console.log(`[DEDUPE] After in-batch dedupe: ${deduped.length}`);

    // DB-level dedupe
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
    ).slice(0, 80); // Max 80 per cycle

    console.log(`[DEDUPE] New after DB check: ${newItems.length}`);

    // ═══════════════ PROCESS + INSERT ═══════════════
    let inserted = 0;

    if (newItems.length > 0) {
      const rows = newItems
        .map(a => {
          const geo = geolocate(a.title, a.description);
          // Drop any item we cannot confidently geolocate — never silently pin to USA/DC
          if (!geo.country || geo.confidence < 0.6) return null;
          const threat = detectThreat(a.title, a.description);
          const category = detectCategory(a.title, a.description);
          const tags = extractTags(a.title, a.description);
          if (!tags.includes(a.sourceType)) tags.push(a.sourceType);
          const srcTag = a.sourceName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
          if (!tags.includes(srcTag) && tags.length < 8) tags.push(srcTag);

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
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      console.log(`[GEO] Items kept after geolocation filter: ${rows.length}/${newItems.length}`);

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
    const activeSources = Object.keys(sourceStats).length;
    console.log(`[OSINT] Complete: ${inserted} inserted from ${activeSources} active sources in ${elapsed}ms. Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      fetched: allArticles.length,
      osintFiltered: relevant.length,
      deduped: deduped.length,
      inserted,
      activeSources,
      elapsed_ms: elapsed,
      source_stats: sourceStats,
      source_errors: errors.length > 0 ? errors : undefined,
      message: `Collected ${allArticles.length} → filtered ${relevant.length} → deduped ${deduped.length} → inserted ${inserted} new intel items from ${activeSources} sources in ${elapsed}ms`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[OSINT] Fatal error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
