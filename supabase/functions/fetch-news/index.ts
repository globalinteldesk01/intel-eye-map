/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  fetch-news  —  COMPLETE SELF-CONTAINED OSINT COLLECTOR + INSERTER  ║
 * ║                                                                      ║
 * ║  Sources:                                                            ║
 * ║    • 75+ RSS feeds (security/conflict/humanitarian)                  ║
 * ║    • 40+ Telegram OSINT channels                                     ║
 * ║    • Google News city-targeted queries (rotating batch)              ║
 * ║    • GDELT v2 — 4 streams (DOC, GKG, Events/CAMEO, TV)              ║
 * ║    • NASA EONET — real-time natural disaster events                  ║
 * ║                                                                      ║
 * ║  Pipeline: Fetch → Filter → Dedupe → Geolocate → INSERT directly    ║
 * ║  No external ingest-intel call needed — this is the single source   ║
 * ║  of truth for your news_items table.                                 ║
 * ║                                                                      ║
 * ║  Deploy:  supabase functions deploy fetch-news                       ║
 * ║  Cron:    Every 15 minutes via pg_cron (SQL at bottom of file)       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * CRON SETUP — run this SQL in Supabase SQL editor once:
 *
 *   select cron.schedule(
 *     'fetch-news-every-15min',
 *     '* /15 * * * *',
 *     $$
 *     select net.http_post(
 *       url    := current_setting('app.supabase_url') || '/functions/v1/fetch-news',
 *       headers := jsonb_build_object(
 *         'Content-Type',  'application/json',
 *         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
 *       ),
 *       body   := '{}'::jsonb
 *     ) as request_id;
 *     $$
 *   );
 *
 *  Or hardcode the URL/key:
 *   select cron.schedule(
 *     'fetch-news-every-15min',
 *     '* /15 * * * *',
 *     $$
 *     select net.http_post(
 *       url    := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-news',
 *       headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
 *       body   := '{}'::jsonb
 *     );
 *     $$
 *   );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  TYPES                                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝
interface RawArticle {
  title: string;
  description: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  sourceCredibility: "high" | "medium" | "low";
  sourceType: string;
  fingerprint?: string;
}

interface DbRow {
  title: string;
  summary: string;
  url: string;
  source: string;
  source_credibility: "high" | "medium" | "low";
  published_at: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  city: string | null;
  tags: string[];
  confidence_score: number;
  confidence_level: "verified" | "developing" | "unverified";
  threat_level: "critical" | "high" | "elevated" | "low";
  actor_type: "organization" | "state" | "individual" | "unknown";
  category: string;
  user_id: string;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  RSS SOURCES                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝
const RSS_SOURCES = [
  // Wire services
  { name: "BBC World",           url: "https://feeds.bbci.co.uk/news/world/rss.xml",                                          credibility: "high" as const },
  { name: "Al Jazeera",          url: "https://www.aljazeera.com/xml/rss/all.xml",                                            credibility: "high" as const },
  { name: "France24",            url: "https://www.france24.com/en/rss",                                                      credibility: "high" as const },
  { name: "DW News",             url: "https://rss.dw.com/rdf/rss-en-all",                                                    credibility: "high" as const },
  { name: "VOA News",            url: "https://www.voanews.com/api/zqpiqe$pqu",                                               credibility: "high" as const },
  { name: "RFI English",         url: "https://www.rfi.fr/en/rss",                                                            credibility: "high" as const },
  { name: "Guardian World",      url: "https://www.theguardian.com/world/rss",                                                credibility: "high" as const },
  { name: "NYT World",           url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",                               credibility: "high" as const },
  { name: "Reuters World",       url: "https://feeds.reuters.com/reuters/worldNews",                                          credibility: "high" as const },
  { name: "AP Top News",         url: "https://rsshub.app/apnews/topics/apf-intlnews",                                        credibility: "high" as const },
  // Security & Defense
  { name: "The War Zone",        url: "https://www.thedrive.com/the-war-zone/feed",                                           credibility: "medium" as const },
  { name: "War on the Rocks",    url: "https://warontherocks.com/feed/",                                                      credibility: "high" as const },
  { name: "Breaking Defense",    url: "https://breakingdefense.com/feed/",                                                    credibility: "medium" as const },
  { name: "Defense News",        url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",                    credibility: "medium" as const },
  { name: "Military Times",      url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml",                  credibility: "medium" as const },
  // Middle East
  { name: "Middle East Eye",     url: "https://www.middleeasteye.net/rss",                                                    credibility: "medium" as const },
  { name: "Al-Monitor",          url: "https://www.al-monitor.com/rss",                                                      credibility: "medium" as const },
  { name: "Iran International",  url: "https://www.iranintl.com/en/rss",                                                     credibility: "medium" as const },
  { name: "Sudan Tribune",       url: "https://sudantribune.com/feed/",                                                       credibility: "medium" as const },
  // Europe & Eurasia
  { name: "Kyiv Independent",    url: "https://kyivindependent.com/feed/",                                                    credibility: "medium" as const },
  { name: "Moscow Times",        url: "https://www.themoscowtimes.com/rss/news",                                              credibility: "medium" as const },
  { name: "Radio Free Europe",   url: "https://www.rferl.org/api/z-pqpiev-qpp",                                              credibility: "medium" as const },
  { name: "EU Observer",         url: "https://euobserver.com/rss.xml",                                                       credibility: "high" as const },
  { name: "Eurasianet",          url: "https://eurasianet.org/rss.xml",                                                       credibility: "high" as const },
  // Asia-Pacific
  { name: "SCMP",                url: "https://www.scmp.com/rss/91/feed",                                                     credibility: "medium" as const },
  { name: "Nikkei Asia",         url: "https://asia.nikkei.com/rss/feed/nar",                                                 credibility: "high" as const },
  { name: "The Diplomat",        url: "https://thediplomat.com/feed/",                                                        credibility: "high" as const },
  { name: "Channel News Asia",   url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",                 credibility: "high" as const },
  { name: "Dawn Pakistan",       url: "https://www.dawn.com/feeds/home",                                                      credibility: "medium" as const },
  { name: "NDTV",                url: "https://feeds.feedburner.com/ndtvnews-top-stories",                                    credibility: "medium" as const },
  { name: "Straits Times",       url: "https://www.straitstimes.com/news/asia/rss.xml",                                       credibility: "high" as const },
  { name: "Irrawaddy",           url: "https://www.irrawaddy.com/feed",                                                       credibility: "medium" as const },
  { name: "Myanmar Now",         url: "https://myanmar-now.org/en/feed/",                                                     credibility: "medium" as const },
  { name: "Rappler",             url: "https://www.rappler.com/feed/",                                                        credibility: "medium" as const },
  { name: "Benar News",          url: "https://www.benarnews.org/english/rss",                                                credibility: "medium" as const },
  { name: "RNZ Pacific",         url: "https://www.rnz.co.nz/rss/pacific.rss",                                               credibility: "high" as const },
  // Africa
  { name: "RFI Africa",          url: "https://www.rfi.fr/en/africa/rss",                                                     credibility: "high" as const },
  { name: "Africa Report",       url: "https://www.theafricareport.com/feed/",                                                credibility: "high" as const },
  { name: "VOA Africa",          url: "https://www.voanews.com/api/zmpqmev_pq",                                               credibility: "high" as const },
  { name: "AllAfrica",           url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf",                       credibility: "medium" as const },
  { name: "East African",        url: "https://www.theeastafrican.co.ke/tea/rss",                                             credibility: "medium" as const },
  { name: "Africanews",          url: "https://www.africanews.com/feed/",                                                     credibility: "medium" as const },
  { name: "Daily Maverick",      url: "https://www.dailymaverick.co.za/dmrss/",                                               credibility: "medium" as const },
  // Humanitarian & Crisis
  { name: "ReliefWeb",           url: "https://reliefweb.int/updates/rss.xml",                                                credibility: "high" as const },
  { name: "UNHCR",               url: "https://www.unhcr.org/rss/news.xml",                                                   credibility: "high" as const },
  { name: "Crisis Group",        url: "https://www.crisisgroup.org/rss",                                                      credibility: "high" as const },
  { name: "ICRC",                url: "https://www.icrc.org/en/rss/news",                                                     credibility: "high" as const },
  { name: "InSight Crime",       url: "https://insightcrime.org/feed/",                                                       credibility: "high" as const },
  { name: "ACLED",               url: "https://acleddata.com/feed/",                                                          credibility: "high" as const },
  // Travel Advisories — HIGHEST PRIORITY
  { name: "US State Dept",       url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.rss.xml", credibility: "high" as const },
  { name: "UK FCDO",             url: "https://www.gov.uk/foreign-travel-advice.atom",                                        credibility: "high" as const },
  { name: "Australia DFAT",      url: "https://www.smartraveller.gov.au/api/rss",                                             credibility: "high" as const },
  { name: "Canada Travel",       url: "https://travel.gc.ca/travelling/advisories.rss",                                       credibility: "high" as const },
  // Think Tanks
  { name: "CSIS",                url: "https://www.csis.org/analysis/feed",                                                   credibility: "high" as const },
  { name: "Chatham House",       url: "https://www.chathamhouse.org/rss",                                                     credibility: "high" as const },
  { name: "Carnegie",            url: "https://carnegieendowment.org/rss/solr/?lang=en",                                      credibility: "high" as const },
  // Arctic
  { name: "Barents Observer",    url: "https://thebarentsobserver.com/en/rss.xml",                                            credibility: "high" as const },
  { name: "High North News",     url: "https://www.highnorthnews.com/en/rss.xml",                                             credibility: "high" as const },
];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  TELEGRAM CHANNELS                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
const TELEGRAM_CHANNELS = [
  { name: "Ukraine War Map",     channel: "ukrainewarmap",        credibility: "medium" as const, region: "Ukraine" },
  { name: "DeepState UA",        channel: "DeepStateUA",          credibility: "medium" as const, region: "Ukraine" },
  { name: "Mil Osint",           channel: "milosint",             credibility: "medium" as const, region: "Ukraine" },
  { name: "CIT",                 channel: "CITeam_en",            credibility: "medium" as const, region: "Global" },
  { name: "Intel Slava Z",       channel: "intelslava",           credibility: "low" as const,    region: "Ukraine" },
  { name: "Rybar EN",            channel: "rybar_en",             credibility: "low" as const,    region: "Ukraine" },
  { name: "War Monitor",         channel: "WarMonitors",          credibility: "low" as const,    region: "Global" },
  { name: "Gaza Now",            channel: "GazaNow",              credibility: "low" as const,    region: "Middle East" },
  { name: "Red Alert Israel",    channel: "redalertisrael",       credibility: "high" as const,   region: "Middle East" },
  { name: "AJA Breaking",        channel: "AJABreaking",          credibility: "medium" as const, region: "Middle East" },
  { name: "Iran Watch",          channel: "iranwatch1",           credibility: "low" as const,    region: "Middle East" },
  { name: "Yemen Monitor",       channel: "YemenWarMonitor",      credibility: "low" as const,    region: "Middle East" },
  { name: "OSINT Aggregator",    channel: "osint_aggregator",     credibility: "medium" as const, region: "Global" },
  { name: "Terror Monitor",      channel: "terrormonitor",        credibility: "medium" as const, region: "Global" },
  { name: "ACLED Conflict",      channel: "acledinfo",            credibility: "high" as const,   region: "Global" },
  { name: "Africa OSINT",        channel: "africaosint",          credibility: "medium" as const, region: "Africa" },
  { name: "Sudan Monitor",       channel: "sudanwarmonitor",      credibility: "low" as const,    region: "Africa" },
  { name: "Congo Watch",         channel: "congowatch",           credibility: "low" as const,    region: "Africa" },
  { name: "Myanmar OSINT",       channel: "myanmarosint",         credibility: "medium" as const, region: "Southeast Asia" },
  { name: "InSight Crime",       channel: "insightcrimeupdates",  credibility: "medium" as const, region: "Americas" },
  { name: "Haiti Security",      channel: "haitisecurity",        credibility: "low" as const,    region: "Caribbean" },
  { name: "Geopolitics Live",    channel: "GeopoliticsLive",      credibility: "medium" as const, region: "Global" },
];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CITY SECURITY QUERIES (rotating batch of 25 per cycle)             ║
// ╚══════════════════════════════════════════════════════════════════════╝
const CITY_TARGETS = [
  // India
  "Mumbai","Delhi","Srinagar","Guwahati","Imphal","Jammu","Pulwama","Leh","Kargil",
  // Middle East
  "Baghdad","Tehran","Riyadh","Gaza","Jerusalem","Beirut","Damascus","Sanaa","Aden","Mosul",
  // Europe/Eurasia
  "Kyiv","Kharkiv","Odesa","Moscow","Warsaw","Minsk",
  // Asia
  "Beijing","Taipei","Seoul","Pyongyang","Yangon","Manila","Jakarta","Kabul","Peshawar",
  // Pakistan/Afghanistan
  "Karachi","Lahore","Islamabad","Kandahar","Herat",
  // Africa Sahel/Horn
  "Bamako","Ouagadougou","Niamey","Khartoum","El Fasher","Mogadishu","Goma","Maiduguri",
  "Kinshasa","Juba","Tripoli","Nairobi","Addis Ababa","Mekelle",
  // Americas
  "Port-au-Prince","Bogota","Caracas","Guatemala City","Tegucigalpa",
  // Caucasus/Central Asia
  "Tbilisi","Baku","Yerevan","Tashkent","Bishkek",
  // Pacific
  "Port Moresby","Honiara",
  // Global majors
  "Washington","London","Paris","Tokyo","Sydney",
];

const CITY_SECURITY_CLAUSE =
  "(attack OR bombing OR terror OR hostage OR explosion OR curfew OR lockdown " +
  "OR evacuation OR shooting OR riot OR protest OR clash OR cyclone OR flood OR earthquake OR tsunami " +
  "OR kidnap OR airstrike OR militant OR casualties OR killed OR wounded)";

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  KEYWORD FILTERS                                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝
const INCLUDE_KW = [
  "travel advisory","travel warning","travel ban","do not travel","reconsider travel",
  "level 4","level 3","evacuate","evacuation","repatriation","stranded",
  "curfew","lockdown","state of emergency","martial law","border closed","no-fly zone",
  "airspace closed","airport closed","flights cancelled","flights suspended","flight diverted",
  "airport strike","port closed","road closed","carjacking","roadblock",
  "terror","terrorism","terrorist","bomb","bombing","explosion","blast","active shooter",
  "mass shooting","gunmen","suicide bomb","ied","car bomb","stabbing attack","grenade",
  "insurgent","militant","extremist","al-qaeda","isis","islamic state","boko haram",
  "al-shabaab","wagner","rsf","houthi","taliban","hamas","hezbollah",
  "kidnap","kidnapping","hostage","abducted","ransom",
  "tourist killed","tourist attacked","foreigner killed","expat attacked",
  "piracy","pirate attack","maritime piracy","armed robbery",
  "protest","riot","unrest","uprising","clashes","crackdown","coup","civil war",
  "airstrike","missile strike","drone strike","shelling","armed conflict","military operation",
  "ambush","firefight","casualties","killed in","wounded in",
  "outbreak","epidemic","cholera","ebola","mpox","dengue","quarantine","disease outbreak",
  "earthquake","tsunami","volcanic eruption","wildfire","hurricane","typhoon","cyclone",
  "flash flood","landslide","heatwave","power outage","internet shutdown",
];

const EXCLUDE_KW = [
  "celebrity","hollywood","grammy","oscar","concert","netflix","rapper","singer",
  "fashion","lifestyle","wellness","recipe","cooking","spa","wedding","horoscope",
  "nba","nfl","premier league","super bowl","playoffs","espn","sports betting",
  "quarterly earnings","ipo","startup funding","stock price","product launch",
  "video game","gaming","esports","bitcoin price","nft",
];

const HARD_EXCLUDE = [
  "history of","origins of","explained:","commentary","op-ed","editorial",
  "best places","top 10","review:","guide to","destination guide","travel tips","travel guide",
  "military exercise","joint drill","war games","naval drill","training exercise",
  "procurement","contract awarded","fleet upgrade","prototype","delivered to",
];

const ACTIVE_KW = [
  "killed","wounded","injured","dead","casualties","attacked","ambushed","stormed",
  "evacuated","stranded","trapped","kidnapped","abducted","held hostage",
  "exploded","blast hits","bomb hits","detonated","fired at","opened fire","shot dead",
  "clashes erupt","fighting erupts","airstrike kills","missile hits","shelled",
  "advisory issued","warning issued","curfew imposed","shut down","closed after",
  "suspended after","grounded","banned","quarantined","ongoing","breaking",
  "escalating","erupted","spreading","evacuation order","shelter in place",
  // Softer incident verbs to avoid dead-zones on calmer news cycles
  "warns","warning","condemns","condemn","deploys","deployed","threatens","threat",
  "sanctions","sanctioned","arrests","arrested","detained","raids","raid",
  "seized","seizes","strikes","strike","launches","launched","intercepts","intercepted",
  "imposes","imposed","violates","violated","accuses","accused","investigates","probe",
  "rises","surges","spikes","reports","reported","confirms","confirmed",
];

const CRITICAL_KW = [
  "attack","bomb","explosion","terror","invasion","massacre","mass casualty",
  "nuclear strike","chemical weapon","active shooter","hostage situation",
  "genocide","biological attack","war declared",
];
const HIGH_KW = [
  "conflict","military operation","missile strike","state of emergency","martial law",
  "coup","assassination","airstrike","ceasefire violated","ambush","drone strike","blockade",
];
const ELEVATED_KW = [
  "tension","protest","sanctions","warning","standoff","diplomatic crisis",
  "travel advisory","heightened alert","cyber attack","troop movement","border incident",
];

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  FILTER FUNCTIONS                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝
function isRelevant(title: string, desc: string): boolean {
  const t = `${title} ${desc}`.toLowerCase();
  if (EXCLUDE_KW.some(k => t.includes(k))) return false;
  if (HARD_EXCLUDE.some(k => t.includes(k))) return false;
  const hasTopic = INCLUDE_KW.some(k => t.includes(k));
  const hasActive = ACTIVE_KW.some(k => t.includes(k));
  // Accept if a topic keyword matches (most OSINT-relevant items),
  // OR if an active-incident verb matches (breaking incidents that may
  // not use our exact topic vocabulary). Hard/soft excludes still apply.
  return hasTopic || hasActive;
}

function threatLevel(title: string, desc: string): "critical" | "high" | "elevated" | "low" {
  const t = `${title} ${desc}`.toLowerCase();
  if (CRITICAL_KW.some(k => t.includes(k))) return "critical";
  if (HIGH_KW.some(k => t.includes(k))) return "high";
  if (ELEVATED_KW.some(k => t.includes(k))) return "elevated";
  return "low";
}

function category(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();
  if (["terror","bomb","explosion","kidnap","hostage","piracy","armed robbery","curfew","evacuat","airport closed","travel advisory","border closed"].some(k => t.includes(k))) return "security";
  if (["airstrike","missile","shelling","fighting","military operation","coup","civil war","ambush","invasion"].some(k => t.includes(k))) return "conflict";
  if (["protest","riot","unrest","crackdown","uprising","clashes"].some(k => t.includes(k))) return "conflict";
  if (["earthquake","tsunami","flood","wildfire","hurricane","cyclone","volcano","landslide","outbreak","disease","epidemic"].some(k => t.includes(k))) return "humanitarian";
  return "security";
}

function tags(title: string, desc: string): string[] {
  const t = `${title} ${desc}`.toLowerCase();
  const result: string[] = [];
  const kws = [
    "terrorism","military","protest","coup","refugee","humanitarian","security","conflict",
    "diplomatic","border","travel-risk","evacuation","hostage","piracy","cartel",
    "maritime","drone","missile","nuclear","chemical","biological","genocide",
    "sahel","caucasus","arctic","pacific","caribbean","separatist","mercenary",
  ];
  for (const k of kws) {
    if (t.includes(k.replace("-", " ")) && result.length < 6) result.push(k);
  }
  return result.length ? result : ["intel"];
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  DEDUP HELPERS                                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"]
      .forEach(p => u.searchParams.delete(p));
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0];
  }
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim().substring(0, 80);
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  GEOLOCATION ENGINE                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝
const CITY_COORDS: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  "washington":       { lat: 38.9072,  lon: -77.0369,  country: "United States",          region: "North America" },
  "washington dc":    { lat: 38.9072,  lon: -77.0369,  country: "United States",          region: "North America" },
  "new york":         { lat: 40.7128,  lon: -74.0060,  country: "United States",          region: "North America" },
  "london":           { lat: 51.5074,  lon: -0.1278,   country: "United Kingdom",         region: "Europe" },
  "paris":            { lat: 48.8566,  lon: 2.3522,    country: "France",                 region: "Europe" },
  "berlin":           { lat: 52.5200,  lon: 13.4050,   country: "Germany",                region: "Europe" },
  "moscow":           { lat: 55.7558,  lon: 37.6173,   country: "Russia",                 region: "Europe" },
  "kyiv":             { lat: 50.4501,  lon: 30.5234,   country: "Ukraine",                region: "Europe" },
  "kiev":             { lat: 50.4501,  lon: 30.5234,   country: "Ukraine",                region: "Europe" },
  "kharkiv":          { lat: 49.9935,  lon: 36.2304,   country: "Ukraine",                region: "Europe" },
  "odesa":            { lat: 46.4825,  lon: 30.7233,   country: "Ukraine",                region: "Europe" },
  "odessa":           { lat: 46.4825,  lon: 30.7233,   country: "Ukraine",                region: "Europe" },
  "lviv":             { lat: 49.8397,  lon: 24.0297,   country: "Ukraine",                region: "Europe" },
  "kherson":          { lat: 46.6354,  lon: 32.6169,   country: "Ukraine",                region: "Europe" },
  "zaporizhzhia":     { lat: 47.8388,  lon: 35.1396,   country: "Ukraine",                region: "Europe" },
  "dnipro":           { lat: 48.4647,  lon: 35.0462,   country: "Ukraine",                region: "Europe" },
  "bakhmut":          { lat: 48.5944,  lon: 38.0006,   country: "Ukraine",                region: "Europe" },
  "warsaw":           { lat: 52.2297,  lon: 21.0122,   country: "Poland",                 region: "Europe" },
  "minsk":            { lat: 53.9045,  lon: 27.5615,   country: "Belarus",                region: "Europe" },
  "belgrade":         { lat: 44.8176,  lon: 20.4569,   country: "Serbia",                 region: "Europe" },
  "beijing":          { lat: 39.9042,  lon: 116.4074,  country: "China",                  region: "Asia" },
  "shanghai":         { lat: 31.2304,  lon: 121.4737,  country: "China",                  region: "Asia" },
  "hong kong":        { lat: 22.3193,  lon: 114.1694,  country: "China",                  region: "Asia" },
  "taipei":           { lat: 25.0330,  lon: 121.5654,  country: "Taiwan",                 region: "Asia" },
  "tokyo":            { lat: 35.6762,  lon: 139.6503,  country: "Japan",                  region: "Asia" },
  "seoul":            { lat: 37.5665,  lon: 126.9780,  country: "South Korea",            region: "Asia" },
  "pyongyang":        { lat: 39.0392,  lon: 125.7625,  country: "North Korea",            region: "Asia" },
  "new delhi":        { lat: 28.6139,  lon: 77.2090,   country: "India",                  region: "Asia" },
  "delhi":            { lat: 28.7041,  lon: 77.1025,   country: "India",                  region: "Asia" },
  "mumbai":           { lat: 19.0760,  lon: 72.8777,   country: "India",                  region: "Asia" },
  "kolkata":          { lat: 22.5726,  lon: 88.3639,   country: "India",                  region: "Asia" },
  "chennai":          { lat: 13.0827,  lon: 80.2707,   country: "India",                  region: "Asia" },
  "bengaluru":        { lat: 12.9716,  lon: 77.5946,   country: "India",                  region: "Asia" },
  "hyderabad":        { lat: 17.3850,  lon: 78.4867,   country: "India",                  region: "Asia" },
  "srinagar":         { lat: 34.0837,  lon: 74.7973,   country: "India",                  region: "Asia" },
  "guwahati":         { lat: 26.1445,  lon: 91.7362,   country: "India",                  region: "Asia" },
  "imphal":           { lat: 24.8170,  lon: 93.9368,   country: "India",                  region: "Asia" },
  "jammu":            { lat: 32.7266,  lon: 74.8570,   country: "India",                  region: "Asia" },
  "leh":              { lat: 34.1526,  lon: 77.5770,   country: "India",                  region: "Asia" },
  "pulwama":          { lat: 33.8716,  lon: 74.8946,   country: "India",                  region: "Asia" },
  "anantnag":         { lat: 33.7311,  lon: 75.1487,   country: "India",                  region: "Asia" },
  "baramulla":        { lat: 34.2096,  lon: 74.3436,   country: "India",                  region: "Asia" },
  "kargil":           { lat: 34.5539,  lon: 76.1352,   country: "India",                  region: "Asia" },
  "islamabad":        { lat: 33.6844,  lon: 73.0479,   country: "Pakistan",               region: "Asia" },
  "karachi":          { lat: 24.8607,  lon: 67.0011,   country: "Pakistan",               region: "Asia" },
  "lahore":           { lat: 31.5204,  lon: 74.3587,   country: "Pakistan",               region: "Asia" },
  "peshawar":         { lat: 34.0151,  lon: 71.5249,   country: "Pakistan",               region: "Asia" },
  "quetta":           { lat: 30.1798,  lon: 66.9750,   country: "Pakistan",               region: "Asia" },
  "kabul":            { lat: 34.5553,  lon: 69.2075,   country: "Afghanistan",            region: "Asia" },
  "kandahar":         { lat: 31.6289,  lon: 65.7372,   country: "Afghanistan",            region: "Asia" },
  "herat":            { lat: 34.3529,  lon: 62.2040,   country: "Afghanistan",            region: "Asia" },
  "jalalabad":        { lat: 34.4415,  lon: 70.4372,   country: "Afghanistan",            region: "Asia" },
  "bangkok":          { lat: 13.7563,  lon: 100.5018,  country: "Thailand",               region: "Southeast Asia" },
  "manila":           { lat: 14.5995,  lon: 120.9842,  country: "Philippines",            region: "Southeast Asia" },
  "davao":            { lat: 7.1907,   lon: 125.4553,  country: "Philippines",            region: "Southeast Asia" },
  "zamboanga":        { lat: 6.9214,   lon: 122.0790,  country: "Philippines",            region: "Southeast Asia" },
  "marawi":           { lat: 7.9986,   lon: 124.2928,  country: "Philippines",            region: "Southeast Asia" },
  "jakarta":          { lat: -6.2088,  lon: 106.8456,  country: "Indonesia",              region: "Southeast Asia" },
  "singapore":        { lat: 1.3521,   lon: 103.8198,  country: "Singapore",              region: "Southeast Asia" },
  "kuala lumpur":     { lat: 3.1390,   lon: 101.6869,  country: "Malaysia",               region: "Southeast Asia" },
  "yangon":           { lat: 16.8661,  lon: 96.1951,   country: "Myanmar",                region: "Southeast Asia" },
  "naypyidaw":        { lat: 19.7633,  lon: 96.0785,   country: "Myanmar",                region: "Southeast Asia" },
  "sittwe":           { lat: 20.1461,  lon: 92.8983,   country: "Myanmar",                region: "Southeast Asia" },
  "hanoi":            { lat: 21.0278,  lon: 105.8342,  country: "Vietnam",                region: "Southeast Asia" },
  "ho chi minh city": { lat: 10.8231,  lon: 106.6297,  country: "Vietnam",                region: "Southeast Asia" },
  "phnom penh":       { lat: 11.5564,  lon: 104.9282,  country: "Cambodia",               region: "Southeast Asia" },
  "vientiane":        { lat: 17.9757,  lon: 102.6331,  country: "Laos",                   region: "Southeast Asia" },
  "jerusalem":        { lat: 31.7683,  lon: 35.2137,   country: "Israel",                 region: "Middle East" },
  "tel aviv":         { lat: 32.0853,  lon: 34.7818,   country: "Israel",                 region: "Middle East" },
  "gaza":             { lat: 31.5017,  lon: 34.4668,   country: "Palestine",              region: "Middle East" },
  "rafah":            { lat: 31.2929,  lon: 34.2424,   country: "Palestine",              region: "Middle East" },
  "ramallah":         { lat: 31.9038,  lon: 35.2034,   country: "Palestine",              region: "Middle East" },
  "tehran":           { lat: 35.6892,  lon: 51.3890,   country: "Iran",                   region: "Middle East" },
  "riyadh":           { lat: 24.7136,  lon: 46.6753,   country: "Saudi Arabia",           region: "Middle East" },
  "jeddah":           { lat: 21.5433,  lon: 39.1728,   country: "Saudi Arabia",           region: "Middle East" },
  "dubai":            { lat: 25.2048,  lon: 55.2708,   country: "UAE",                    region: "Middle East" },
  "ankara":           { lat: 39.9334,  lon: 32.8597,   country: "Turkey",                 region: "Middle East" },
  "istanbul":         { lat: 41.0082,  lon: 28.9784,   country: "Turkey",                 region: "Middle East" },
  "baghdad":          { lat: 33.3152,  lon: 44.3661,   country: "Iraq",                   region: "Middle East" },
  "mosul":            { lat: 36.3350,  lon: 43.1189,   country: "Iraq",                   region: "Middle East" },
  "damascus":         { lat: 33.5138,  lon: 36.2765,   country: "Syria",                  region: "Middle East" },
  "aleppo":           { lat: 36.2021,  lon: 37.1343,   country: "Syria",                  region: "Middle East" },
  "idlib":            { lat: 35.9306,  lon: 36.6339,   country: "Syria",                  region: "Middle East" },
  "beirut":           { lat: 33.8938,  lon: 35.5018,   country: "Lebanon",                region: "Middle East" },
  "amman":            { lat: 31.9454,  lon: 35.9284,   country: "Jordan",                 region: "Middle East" },
  "doha":             { lat: 25.2854,  lon: 51.5310,   country: "Qatar",                  region: "Middle East" },
  "sanaa":            { lat: 15.3694,  lon: 44.1910,   country: "Yemen",                  region: "Middle East" },
  "aden":             { lat: 12.7855,  lon: 45.0187,   country: "Yemen",                  region: "Middle East" },
  "muscat":           { lat: 23.5880,  lon: 58.3829,   country: "Oman",                   region: "Middle East" },
  "cairo":            { lat: 30.0444,  lon: 31.2357,   country: "Egypt",                  region: "Africa" },
  "lagos":            { lat: 6.5244,   lon: 3.3792,    country: "Nigeria",                region: "Africa" },
  "abuja":            { lat: 9.0765,   lon: 7.3986,    country: "Nigeria",                region: "Africa" },
  "maiduguri":        { lat: 11.8311,  lon: 13.1510,   country: "Nigeria",                region: "Africa" },
  "nairobi":          { lat: -1.2921,  lon: 36.8219,   country: "Kenya",                  region: "Africa" },
  "addis ababa":      { lat: 9.0250,   lon: 38.7469,   country: "Ethiopia",               region: "Africa" },
  "mekelle":          { lat: 13.4967,  lon: 39.4753,   country: "Ethiopia",               region: "Africa" },
  "khartoum":         { lat: 15.5007,  lon: 32.5599,   country: "Sudan",                  region: "Africa" },
  "el fasher":        { lat: 13.6290,  lon: 25.3490,   country: "Sudan",                  region: "Africa" },
  "tripoli":          { lat: 32.8872,  lon: 13.1913,   country: "Libya",                  region: "Africa" },
  "benghazi":         { lat: 32.1194,  lon: 20.0868,   country: "Libya",                  region: "Africa" },
  "mogadishu":        { lat: 2.0469,   lon: 45.3182,   country: "Somalia",                region: "Africa" },
  "kinshasa":         { lat: -4.4419,  lon: 15.2663,   country: "DR Congo",               region: "Africa" },
  "goma":             { lat: -1.6771,  lon: 29.2386,   country: "DR Congo",               region: "Africa" },
  "bukavu":           { lat: -2.5083,  lon: 28.8608,   country: "DR Congo",               region: "Africa" },
  "bamako":           { lat: 12.6392,  lon: -8.0029,   country: "Mali",                   region: "Africa" },
  "ouagadougou":      { lat: 12.3714,  lon: -1.5197,   country: "Burkina Faso",           region: "Africa" },
  "niamey":           { lat: 13.5127,  lon: 2.1128,    country: "Niger",                  region: "Africa" },
  "ndjamena":         { lat: 12.1348,  lon: 15.0557,   country: "Chad",                   region: "Africa" },
  "bangui":           { lat: 4.3947,   lon: 18.5582,   country: "CAR",                    region: "Africa" },
  "juba":             { lat: 4.8594,   lon: 31.5713,   country: "South Sudan",            region: "Africa" },
  "kampala":          { lat: 0.3476,   lon: 32.5825,   country: "Uganda",                 region: "Africa" },
  "kigali":           { lat: -1.9403,  lon: 29.8739,   country: "Rwanda",                 region: "Africa" },
  "maputo":           { lat: -25.9692, lon: 32.5732,   country: "Mozambique",             region: "Africa" },
  "dakar":            { lat: 14.7167,  lon: -17.4677,  country: "Senegal",                region: "Africa" },
  "tbilisi":          { lat: 41.7151,  lon: 44.8271,   country: "Georgia",                region: "Caucasus" },
  "yerevan":          { lat: 40.1792,  lon: 44.4991,   country: "Armenia",                region: "Caucasus" },
  "baku":             { lat: 40.4093,  lon: 49.8671,   country: "Azerbaijan",             region: "Caucasus" },
  "grozny":           { lat: 43.3180,  lon: 45.6987,   country: "Russia",                 region: "Caucasus" },
  "tashkent":         { lat: 41.2995,  lon: 69.2401,   country: "Uzbekistan",             region: "Central Asia" },
  "bishkek":          { lat: 42.8746,  lon: 74.5698,   country: "Kyrgyzstan",             region: "Central Asia" },
  "dushanbe":         { lat: 38.5598,  lon: 68.7740,   country: "Tajikistan",             region: "Central Asia" },
  "almaty":           { lat: 43.2220,  lon: 76.8512,   country: "Kazakhstan",             region: "Central Asia" },
  "port moresby":     { lat: -9.4438,  lon: 147.1803,  country: "Papua New Guinea",       region: "Pacific" },
  "honiara":          { lat: -9.4319,  lon: 160.0562,  country: "Solomon Islands",        region: "Pacific" },
  "suva":             { lat: -18.1416, lon: 178.4419,  country: "Fiji",                   region: "Pacific" },
  "havana":           { lat: 23.1136,  lon: -82.3666,  country: "Cuba",                   region: "Caribbean" },
  "port-au-prince":   { lat: 18.5944,  lon: -72.3074,  country: "Haiti",                  region: "Caribbean" },
  "kingston":         { lat: 17.9714,  lon: -76.7920,  country: "Jamaica",                region: "Caribbean" },
  "bogota":           { lat: 4.7110,   lon: -74.0721,  country: "Colombia",               region: "South America" },
  "caracas":          { lat: 10.4806,  lon: -66.9036,  country: "Venezuela",              region: "South America" },
  "lima":             { lat: -12.0464, lon: -77.0428,  country: "Peru",                   region: "South America" },
  "tegucigalpa":      { lat: 14.0723,  lon: -87.1921,  country: "Honduras",               region: "Central America" },
  "san salvador":     { lat: 13.6929,  lon: -89.2182,  country: "El Salvador",            region: "Central America" },
  "guatemala city":   { lat: 14.6349,  lon: -90.5069,  country: "Guatemala",              region: "Central America" },
  "murmansk":         { lat: 68.9585,  lon: 33.0827,   country: "Russia",                 region: "Arctic" },
  "sydney":           { lat: -33.8688, lon: 151.2093,  country: "Australia",              region: "Oceania" },
  "south china sea":  { lat: 12.0,     lon: 114.0,     country: "South China Sea",        region: "Asia" },
  "red sea":          { lat: 20.0,     lon: 38.0,      country: "Red Sea",                region: "Middle East" },
  "strait of hormuz": { lat: 26.5,     lon: 56.3,      country: "Strait of Hormuz",       region: "Middle East" },
  "gulf of aden":     { lat: 12.0,     lon: 47.0,      country: "Gulf of Aden",           region: "Africa" },
  "suez canal":       { lat: 30.4,     lon: 32.3,      country: "Egypt",                  region: "Middle East" },
  "black sea":        { lat: 43.0,     lon: 35.0,      country: "Black Sea",              region: "Europe" },
};

const COUNTRY_GEO: Record<string, { patterns: string[]; lat: number; lon: number; name: string; region: string }> = {
  "ua": { patterns: ["ukraine","ukrainian","zelensky"],                        lat: 50.4501, lon: 30.5234, name: "Ukraine",              region: "Europe" },
  "ru": { patterns: ["russia","russian","kremlin","putin"],                     lat: 55.7558, lon: 37.6173, name: "Russia",               region: "Europe" },
  "cn": { patterns: ["china","chinese","xi jinping","pla ","prc "],             lat: 39.9042, lon: 116.4074,name: "China",                region: "Asia" },
  "ir": { patterns: ["iran","iranian","irgc","khamenei"],                       lat: 35.6892, lon: 51.3890, name: "Iran",                 region: "Middle East" },
  "il": { patterns: ["israel","israeli","netanyahu","hamas","hezbollah","idf "],lat: 31.7683, lon: 35.2137, name: "Israel",               region: "Middle East" },
  "ps": { patterns: ["palestine","palestinian","west bank","gaza strip"],        lat: 31.9522, lon: 35.2332, name: "Palestine",            region: "Middle East" },
  "gb": { patterns: ["britain","british","uk ","england","scotland"],            lat: 51.5074, lon: -0.1278, name: "United Kingdom",       region: "Europe" },
  "pk": { patterns: ["pakistan","pakistani"],                                   lat: 33.6844, lon: 73.0479, name: "Pakistan",             region: "Asia" },
  "in": { patterns: ["india","indian","modi"],                                  lat: 28.6139, lon: 77.2090, name: "India",                region: "Asia" },
  "af": { patterns: ["afghanistan","afghan","taliban"],                         lat: 34.5553, lon: 69.2075, name: "Afghanistan",          region: "Asia" },
  "mm": { patterns: ["myanmar","burma","burmese","junta","tatmadaw","arakan"],  lat: 16.8661, lon: 96.1951, name: "Myanmar",              region: "Southeast Asia" },
  "ph": { patterns: ["philippines","filipino","mindanao","abu sayyaf"],         lat: 14.5995, lon: 120.9842,name: "Philippines",          region: "Southeast Asia" },
  "ye": { patterns: ["yemen","yemeni","houthi","ansar allah"],                  lat: 15.3694, lon: 44.1910, name: "Yemen",                region: "Middle East" },
  "sy": { patterns: ["syria","syrian","assad"],                                 lat: 33.5138, lon: 36.2765, name: "Syria",                region: "Middle East" },
  "iq": { patterns: ["iraq","iraqi"],                                           lat: 33.3152, lon: 44.3661, name: "Iraq",                 region: "Middle East" },
  "lb": { patterns: ["lebanon","lebanese"],                                     lat: 33.8938, lon: 35.5018, name: "Lebanon",              region: "Middle East" },
  "ly": { patterns: ["libya","libyan","haftar"],                                lat: 32.8872, lon: 13.1913, name: "Libya",                region: "Africa" },
  "sd": { patterns: ["sudan","sudanese","rsf ","rapid support","janjaweed"],    lat: 15.5007, lon: 32.5599, name: "Sudan",                region: "Africa" },
  "et": { patterns: ["ethiopia","ethiopian","tigray","amhara"],                 lat: 9.0250,  lon: 38.7469, name: "Ethiopia",             region: "Africa" },
  "so": { patterns: ["somalia","somali","al-shabaab","al shabaab"],             lat: 2.0469,  lon: 45.3182, name: "Somalia",              region: "Africa" },
  "cd": { patterns: ["congo","congolese","drc ","m23 ","adf "],                 lat: -4.4419, lon: 15.2663, name: "DR Congo",             region: "Africa" },
  "ml": { patterns: ["mali","malian","jnim","aqim"],                            lat: 12.6392, lon: -8.0029, name: "Mali",                 region: "Africa" },
  "bf": { patterns: ["burkina faso","burkinabe"],                               lat: 12.3714, lon: -1.5197, name: "Burkina Faso",         region: "Africa" },
  "ne": { patterns: ["niger","nigerien"],                                       lat: 13.5127, lon: 2.1128,  name: "Niger",                region: "Africa" },
  "ng": { patterns: ["nigeria","nigerian","boko haram"],                        lat: 9.0765,  lon: 7.3986,  name: "Nigeria",              region: "Africa" },
  "mz": { patterns: ["mozambique","cabo delgado"],                              lat: -25.9692,lon: 32.5732, name: "Mozambique",           region: "Africa" },
  "co": { patterns: ["colombia","colombian","farc","eln "],                     lat: 4.7110,  lon: -74.0721,name: "Colombia",             region: "South America" },
  "ve": { patterns: ["venezuela","venezuelan","maduro"],                        lat: 10.4806, lon: -66.9036,name: "Venezuela",            region: "South America" },
  "mx": { patterns: ["mexico","mexican","cartel"],                              lat: 19.4326, lon: -99.1332,name: "Mexico",               region: "North America" },
  "ht": { patterns: ["haiti","haitian"],                                        lat: 18.5944, lon: -72.3074,name: "Haiti",                region: "Caribbean" },
  "by": { patterns: ["belarus","belarusian","lukashenko"],                      lat: 53.9045, lon: 27.5615, name: "Belarus",              region: "Europe" },
  "kp": { patterns: ["north korea","kim jong"],                                 lat: 39.0392, lon: 125.7625,name: "North Korea",          region: "Asia" },
  "tw": { patterns: ["taiwan","taiwanese"],                                     lat: 25.0330, lon: 121.5654,name: "Taiwan",               region: "Asia" },
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function prettyCity(k: string): string {
  return k.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface GeoResult { lat: number; lon: number; country: string; region: string; confidence: number; city: string | null; }

function geolocate(title: string, desc: string): GeoResult {
  const text = `${title} ${desc}`.toLowerCase();
  const sorted = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      const c = CITY_COORDS[city];
      const seed = hashStr(title);
      const dx = ((seed % 1000) / 1000 - 0.5) * 0.002;
      const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * 0.002;
      return { lat: c.lat + dy, lon: c.lon + dx, country: c.country, region: c.region, confidence: 0.95, city: prettyCity(city) };
    }
  }
  for (const info of Object.values(COUNTRY_GEO)) {
    if (info.patterns.some(p => text.includes(p))) {
      const seed = hashStr(title + info.name);
      const dx = ((seed % 1000) / 1000 - 0.5) * 0.5;
      const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * 0.5;
      return { lat: info.lat + dy, lon: info.lon + dx, country: info.name, region: info.region, confidence: 0.6, city: null };
    }
  }
  const seed = hashStr(title);
  return { lat: 20 + ((seed % 1000) / 1000 - 0.5) * 30, lon: ((seed >> 10) % 1000) / 1000 * 30 - 15, country: "International", region: "Global", confidence: 0.3, city: null };
}

function reverseGeo(lat: number, lon: number): { country: string; region: string; city: string | null } {
  let best: { name: string; d: number; info: typeof CITY_COORDS[string] } | null = null;
  for (const [name, info] of Object.entries(CITY_COORDS)) {
    const d = Math.abs(info.lat - lat) + Math.abs(info.lon - lon);
    if (d < 3 && (!best || d < best.d)) best = { name, d, info };
  }
  if (best) return { country: best.info.country, region: best.info.region, city: prettyCity(best.name) };
  let region = "Global";
  if (lon >= -25 && lon <= 60 && lat >= -35 && lat <= 38) region = "Africa";
  else if (lon >= -170 && lon <= -30 && lat >= 7 && lat <= 72) region = "North America";
  else if (lon >= -82 && lon <= -34 && lat >= -56 && lat <= 13) region = "South America";
  else if (lon >= -10 && lon <= 60 && lat >= 35 && lat <= 72) region = "Europe";
  else if (lon >= 25 && lon <= 75 && lat >= 12 && lat <= 42) region = "Middle East";
  else if (lon >= 60 && lon <= 150 && lat >= -10 && lat <= 55) region = "Asia";
  else if (lon >= 110 && lon <= 180 && lat >= -50 && lat <= 0) region = "Oceania";
  return { country: "International", region, city: null };
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  PARSERS                                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝
function parseRss(xml: string, sourceName: string, credibility: "high" | "medium" | "low"): RawArticle[] {
  const items: RawArticle[] = [];
  const rssM = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
  const atomM = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) || [];
  const matches = rssM.length > 0 ? rssM : atomM;
  for (const raw of matches.slice(0, 30)) {
    const titleM = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descM  = raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
                || raw.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
    const linkM  = raw.match(/<link[^>]*href="([^"]+)"/i) || raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateM  = raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
                || raw.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
                || raw.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const title = (titleM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const desc  = (descM?.[1]  || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const url   = (linkM?.[1]  || "").trim();
    const parsed = new Date((dateM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim());
    const pubDate = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    if (title && url) items.push({ title, description: desc.substring(0, 2000), url, sourceName, publishedAt: pubDate, sourceCredibility: credibility, sourceType: "rss" });
  }
  return items;
}

function parseTelegram(html: string, channel: string, displayName: string): RawArticle[] {
  const items: RawArticle[] = [];
  const blocks = html.match(/<div class="tgme_widget_message_wrap[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  for (const block of blocks.slice(0, 20)) {
    const textM = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const dateM = block.match(/<time[^>]*datetime="([^"]+)"/i);
    const linkM = block.match(/data-post="([^"]+)"/i);
    if (!textM) continue;
    const rawText = textM[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();
    if (rawText.length > 20) {
      items.push({
        title: rawText.substring(0, 200),
        description: rawText.substring(0, 1000),
        url: linkM ? `https://t.me/${linkM[1]}` : `https://t.me/s/${channel}`,
        sourceName: `TG: ${displayName}`,
        publishedAt: dateM?.[1] || new Date().toISOString(),
        sourceCredibility: "low",
        sourceType: "telegram",
      });
    }
  }
  return items;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CHUNKED PARALLEL RUNNER                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function runChunked<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const settled = await Promise.allSettled(tasks.slice(i, i + size).map(fn => fn()));
    for (const r of settled) if (r.status === "fulfilled") out.push(r.value);
  }
  return out;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  NASA EONET                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function fetchEonet(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const urls = [
      "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=1&limit=200",
      "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=10&limit=200",
    ];
    let features: any[] = [];
    for (const url of urls) {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const d = await r.json();
      if (Array.isArray(d?.features) && d.features.length > 0) { features = d.features; break; }
    }
    const flatten = (g: any): number[][] => {
      if (!g) return [];
      if (g.type === "Point") return [g.coordinates];
      if (g.type === "Polygon") return g.coordinates?.[0] || [];
      if (g.type === "MultiPolygon") return g.coordinates?.[0]?.[0] || [];
      if (g.type === "GeometryCollection") return (g.geometries || []).flatMap(flatten);
      return [];
    };
    const catMap = (id: string) => {
      const c = id.toLowerCase();
      if (c.includes("wildfire"))  return { tag: "wildfire",      threat: "high" as const };
      if (c.includes("volcano"))   return { tag: "volcano",       threat: "critical" as const };
      if (c.includes("earthquake"))return { tag: "earthquake",    threat: "critical" as const };
      if (c.includes("storm"))     return { tag: "severe-storm",  threat: "high" as const };
      if (c.includes("flood"))     return { tag: "flood",         threat: "high" as const };
      if (c.includes("landslide")) return { tag: "landslide",     threat: "high" as const };
      return                              { tag: "natural-event", threat: "elevated" as const };
    };
    for (const f of features) {
      const props = f?.properties || {};
      const coords = flatten(f?.geometry);
      if (!coords.length) continue;
      const [lon, lat] = coords[0];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const cats: any[] = Array.isArray(props.categories) ? props.categories : [];
      const catId = cats[0]?.id || cats[0]?.title || "";
      if (catId.toLowerCase().includes("ice") || String(props.title).toLowerCase().includes("iceberg")) continue;
      const cm = catMap(String(catId));
      const geo = reverseGeo(lat, lon);
      const sources: any[] = Array.isArray(props.sources) ? props.sources : [];
      out.push({
        title: String(props.title || "Natural Event").substring(0, 500),
        summary: `Active ${cm.tag} event (NASA EONET). Location: ${geo.city || geo.country}.`.substring(0, 2000),
        url: (sources[0]?.url || `https://eonet.gsfc.nasa.gov/api/v3/events/${props.id}`).substring(0, 2000),
        source: "NASA EONET",
        source_credibility: "high",
        published_at: props.date || new Date().toISOString(),
        lat, lon,
        country: geo.country, region: geo.region, city: geo.city,
        tags: ["natural-disaster", cm.tag, "eonet"],
        confidence_score: 0.98,
        confidence_level: "verified",
        threat_level: cm.threat,
        actor_type: "organization",
        category: "humanitarian",
        user_id: userId,
      });
    }
    console.log(`[EONET] ${out.length} events`);
  } catch (e) { console.error(`[EONET] ${e}`); }
  return out;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  GDELT — ALL 4 STREAMS                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── GDELT CAMEO codes ──
const CAMEO_T1 = new Set(["14","140","141","142","143","144","145","17","170","171","172","173","174","175","18","180","181","182","183","184","185","19","190","191","192","193","194","195","20","200","201","202","203","204"]);
const CAMEO_T2 = new Set(["13","130","131","132","133","134","135","15","150","151","152","153","154","155","16","160","161","162","163","164","165"]);
const CAMEO_LABELS: Record<string, string> = {
  "14":"Protest","140":"Demonstrate","141":"Demonstrate violently","142":"Hunger strike","143":"Strike","144":"Obstruct","145":"Protest violently",
  "17":"Coerce","170":"Coerce","171":"Seize/arrest","172":"Detain","173":"Expel","174":"Sanction","175":"Threaten with force",
  "18":"Assault","180":"Assault","181":"Sexually assault","182":"Torture","183":"Kill","184":"Beat","185":"Assassinate",
  "19":"Fight","190":"Use military force","191":"Impose blockade","192":"Occupy territory","193":"Fight small arms","194":"Conduct airstrike","195":"Employ aerial weapons",
  "20":"Mass violence","200":"Mass violence","201":"Genocide","202":"Assassinate civilian","203":"Car bombing","204":"Unconventional mass violence",
  "13":"Threaten","130":"Threaten","131":"Political sanction threat","132":"Military force threat","133":"Bio/chem threat","134":"Political violence threat","135":"Accuse of crime",
  "15":"Force posture","150":"Increase military capacity","151":"Mobilize military","152":"Increase police alert","153":"Request military assistance","154":"Position military","155":"Activate reserves",
  "16":"Reduce relations","160":"Reduce relations","161":"Reduce diplomatic contacts","162":"Reduce economic activity","163":"Break ties","164":"Halt negotiations","165":"Halt mediation",
};

const GKG_THEMES = new Set([
  "TERROR","TERROR_ATTACK","BOMBING","SUICIDE_BOMBING","CONFLICT","ARMED_CONFLICT","CIVIL_WAR","INSURGENCY",
  "PROTEST","RIOT","UNREST","COUP","MARTIAL_LAW","CURFEW","HOSTAGE","KIDNAPPING","PIRACY","ASSASSINATION",
  "TRAVEL_ADVISORY","EVACUATION","EMERGENCY","NATURAL_DISASTER","EARTHQUAKE","FLOOD","HURRICANE","CYCLONE","TSUNAMI",
  "MILITARY","AIRSTRIKE","DRONE_STRIKE","MISSILE","CHEMICAL_WEAPONS","NUCLEAR","BIOLOGICAL_WEAPONS",
  "HEALTH_PANDEMIC","DISEASE_OUTBREAK",
  "CRISISLEX_C01_SRSLY_INJURED_DEAD","CRISISLEX_C02_INJURED_DEAD","CRISISLEX_C03_MISSING_TRAPPED",
  "CRISISLEX_C04_SEEKING_HELP","CRISISLEX_CRISISLEXREC",
]);

// Stream 1: DOC API
async function gdeltDoc(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  const queries = [
    "theme:TERROR OR theme:TERROR_ATTACK OR theme:BOMBING",
    "theme:CONFLICT AND (airstrike OR shelling OR missile OR casualties)",
    "theme:EVACUATION OR theme:TRAVEL_ADVISORY OR (curfew AND emergency)",
    "theme:HOSTAGE OR theme:KIDNAPPING OR (kidnapped AND tourists)",
    "theme:NATURAL_DISASTER AND (killed OR casualties OR evacuat)",
    "theme:COUP OR theme:ASSASSINATION OR theme:MARTIAL_LAW",
    "theme:PIRACY OR (hijacked AND ship) OR (attack AND maritime)",
    "theme:PROTEST AND (clashes OR arrested OR casualties OR killed)",
  ];
  for (const q of queries) {
    try {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=ArtList&maxrecords=20&timespan=1440&sort=DateDesc&format=json`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const data = await r.json();
      for (const art of (data?.articles || []).slice(0, 20)) {
        const title = (art.title || "").substring(0, 500);
        const artUrl = (art.url || "").substring(0, 2000);
        if (!title || !artUrl) continue;
        let lat: number | null = null, lon: number | null = null;
        let country = "International", region = "Global", city: string | null = null;
        if (art.geolocation?.lat && art.geolocation?.lon) {
          lat = parseFloat(art.geolocation.lat); lon = parseFloat(art.geolocation.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = null; lon = null; }
          else { const rg = reverseGeo(lat, lon); country = rg.country; region = rg.region; city = rg.city; }
        }
        if (lat === null) {
          const geo = geolocate(title, art.excerpt || "");
          if (geo.confidence >= 0.5) { lat = geo.lat; lon = geo.lon; country = geo.country; region = geo.region; city = geo.city; }
        }
        let pubDate = new Date().toISOString();
        const m = (art.seendate || "").match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/);
        if (m) pubDate = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
        const summary = (art.excerpt || title).substring(0, 2000);
        out.push({
          title, summary, url: artUrl,
          source: `GDELT DOC/${art.domain || ""}`.substring(0, 200),
          source_credibility: "medium",
          published_at: pubDate,
          lat: lat ?? 0, lon: lon ?? 0, country, region, city,
          tags: [...tags(title, summary), "gdelt", "gdelt-doc"],
          confidence_score: lat !== null ? 0.75 : 0.5,
          confidence_level: "developing",
          threat_level: threatLevel(title, summary),
          actor_type: "organization",
          category: category(title, summary),
          user_id: userId,
        });
      }
    } catch (e) { console.warn(`[GDELT-DOC] ${e}`); }
  }
  console.log(`[GDELT-DOC] ${out.length}`);
  return out;
}

// Stream 2: GKG
async function gdeltGkg(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const masterResp = await fetch("http://data.gdeltproject.org/gdeltv2/lastupdate.txt", { signal: AbortSignal.timeout(6000) });
    if (!masterResp.ok) return [];
    const master = await masterResp.text();
    const gkgUrl = master.split("\n").find(l => l.includes(".gkg.csv"))?.trim().split(" ")[2];
    if (!gkgUrl) return [];
    const csvResp = await fetch(gkgUrl, { signal: AbortSignal.timeout(20000) });
    if (!csvResp.ok) return [];
    const csv = await csvResp.text();
    for (const line of csv.split("\n").slice(0, 500)) {
      try {
        const cols = line.split("\t");
        if (cols.length < 27) continue;
        const dateStr = cols[1] || "";
        const themeRaw = cols[7] || "";
        const locRaw = cols[9] || "";
        const toneRaw = cols[15] || "";
        const srcUrl = (cols[4] || "").trim();
        if (!srcUrl) continue;
        const tone = parseFloat(toneRaw.split(",")[0]) || 0;
        if (tone > -2) continue; // only crisis-tone articles
        const matched = themeRaw.split(";").map(t => t.trim().split(",")[0].toUpperCase()).filter(t => GKG_THEMES.has(t));
        if (!matched.length) continue;
        // Parse first location
        let lat: number | null = null, lon: number | null = null;
        let country = "International", region = "Global", city: string | null = null;
        for (const loc of locRaw.split(";")) {
          const p = loc.split("#");
          if (p.length >= 6) {
            const la = parseFloat(p[4]), lo = parseFloat(p[5]);
            if (Number.isFinite(la) && Number.isFinite(lo)) { lat = la; lon = lo; break; }
          }
        }
        if (lat !== null && lon !== null) { const rg = reverseGeo(lat, lon); country = rg.country; region = rg.region; city = rg.city; }
        else {
          const title2 = cols[5] || "";
          const geo = geolocate(title2, matched.join(" "));
          if (geo.confidence >= 0.5) { lat = geo.lat; lon = geo.lon; country = geo.country; region = geo.region; city = geo.city; }
        }
        if (lat === null) continue;
        let pubDate = new Date().toISOString();
        if (dateStr.length >= 14) pubDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${dateStr.substring(8,10)}:${dateStr.substring(10,12)}:${dateStr.substring(12,14)}Z`;
        const title = (cols[5] || `GDELT GKG: ${matched.slice(0,3).join(", ")}`).substring(0, 500);
        const summary = `GKG themes: ${matched.slice(0,5).join(", ")}. Tone: ${tone.toFixed(2)}. Location: ${city || country}.`.substring(0, 2000);
        const isCrit = matched.some(t => ["TERROR","TERROR_ATTACK","BOMBING","SUICIDE_BOMBING"].includes(t));
        const isHigh = matched.some(t => ["CONFLICT","ARMED_CONFLICT","CIVIL_WAR","COUP","ASSASSINATION"].includes(t));
        out.push({
          title, summary, url: srcUrl.substring(0, 2000),
          source: "GDELT GKG v2",
          source_credibility: "high",
          published_at: pubDate,
          lat, lon, country, region, city,
          tags: ["gdelt", "gdelt-gkg", ...matched.slice(0,4).map(t => t.toLowerCase().replace(/_/g, "-"))],
          confidence_score: 0.88,
          confidence_level: "verified",
          threat_level: isCrit ? "critical" : isHigh ? "high" : "elevated",
          actor_type: "organization",
          category: matched.some(t => t.includes("NATURAL") || t.includes("CRISIS") || t.includes("DISASTER")) ? "humanitarian" : "conflict",
          user_id: userId,
        });
      } catch { /* skip */ }
    }
    console.log(`[GDELT-GKG] ${out.length}`);
  } catch (e) { console.error(`[GDELT-GKG] ${e}`); }
  return out;
}

// Stream 3: Events CSV (CAMEO)
async function gdeltEvents(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  try {
    const masterResp = await fetch("http://data.gdeltproject.org/gdeltv2/lastupdate.txt", { signal: AbortSignal.timeout(6000) });
    if (!masterResp.ok) return [];
    const master = await masterResp.text();
    const evtUrl = master.split("\n").find(l => l.includes(".export.CSV"))?.trim().split(" ")[2];
    if (!evtUrl) return [];
    const csvResp = await fetch(evtUrl, { signal: AbortSignal.timeout(20000) });
    if (!csvResp.ok) return [];
    const csv = await csvResp.text();
    let count = 0;
    for (const line of csv.split("\n").slice(0, 2000)) {
      if (count >= 200) break;
      try {
        const cols = line.split("\t");
        if (cols.length < 61) continue;
        const code = cols[26]?.trim() || "";
        const base = cols[27]?.trim() || "";
        const isTier1 = CAMEO_T1.has(code) || CAMEO_T1.has(base);
        const isTier2 = CAMEO_T2.has(code) || CAMEO_T2.has(base);
        if (!isTier1 && !isTier2) continue;
        const numMentions = parseInt(cols[45]) || 0;
        const numArticles = parseInt(cols[47]) || 0;
        const avgTone = parseFloat(cols[43]) || 0;
        const isRoot = cols[40] === "1";
        if (!isRoot && numMentions < 3 && numArticles < 2) continue;
        if (avgTone > 3) continue;
        const lat = parseFloat(cols[55]);
        const lon = parseFloat(cols[56]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const geo = reverseGeo(lat, lon);
        const geoName = (cols[53] || "").trim() || geo.city || geo.country;
        const srcUrl = (cols[60] || "").trim();
        const dayStr = (cols[1] || "").trim();
        let pubDate = new Date().toISOString();
        if (dayStr.length === 8) pubDate = `${dayStr.substring(0,4)}-${dayStr.substring(4,6)}-${dayStr.substring(6,8)}T00:00:00Z`;
        const label = CAMEO_LABELS[code] || CAMEO_LABELS[base] || `CAMEO ${code}`;
        const title = `${label} — ${geoName}`.substring(0, 500);
        const summary = `CAMEO ${code} (${label}). Actors: ${cols[30]||"?"} vs ${cols[35]||"?"}. Tone: ${avgTone.toFixed(1)}. Mentions: ${numMentions}.`.substring(0, 2000);
        out.push({
          title, summary,
          url: srcUrl ? srcUrl.substring(0, 2000) : "https://www.gdeltproject.org/",
          source: `GDELT Events/${cols[57]||""}`.substring(0, 200),
          source_credibility: "high",
          published_at: pubDate,
          lat, lon, country: geo.country, region: geo.region, city: geo.city,
          tags: ["gdelt", "gdelt-events", `cameo-${code}`, label.toLowerCase().replace(/\s+/g, "-")],
          confidence_score: isRoot ? 0.85 : 0.70,
          confidence_level: isRoot ? "verified" : "developing",
          threat_level: isTier1 && numMentions >= 10 ? "critical" : isTier1 ? "high" : numMentions >= 5 ? "elevated" : "low",
          actor_type: "state",
          category: isTier1 ? "conflict" : "security",
          user_id: userId,
        });
        count++;
      } catch { /* skip */ }
    }
    console.log(`[GDELT-EVT] ${out.length}`);
  } catch (e) { console.error(`[GDELT-EVT] ${e}`); }
  return out;
}

// Stream 4: TV News
async function gdeltTv(userId: string): Promise<DbRow[]> {
  const out: DbRow[] = [];
  const keywords = ["terror attack","bombing kills","coup attempt","airstrike kills","evacuation order","hostage crisis"];
  for (const kw of keywords) {
    try {
      const url = `https://api.gdeltproject.org/api/v2/tv/tv?query=${encodeURIComponent(`"${kw}"`)}&mode=clipgallery&maxrecords=5&timespan=1440&sort=DateDesc&format=json`;
      const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) continue;
      const data = await r.json();
      for (const clip of (data?.clips || []).slice(0, 5)) {
        const snippet = (clip.snippet || "").substring(0, 1000);
        const geo = geolocate(`${kw} ${clip.show || ""} ${snippet}`, snippet);
        if (geo.confidence < 0.5) continue;
        out.push({
          title: `[TV] ${kw.toUpperCase()}: ${clip.station || "Broadcast"}`.substring(0, 500),
          summary: `TV: ${clip.station}. Keyword: "${kw}". ${snippet}`.substring(0, 2000),
          url: (clip.preview_url || clip.url || `https://api.gdeltproject.org/api/v2/tv/tv`).substring(0, 2000),
          source: `GDELT TV/${clip.station || ""}`.substring(0, 200),
          source_credibility: "medium",
          published_at: clip.date || new Date().toISOString(),
          lat: geo.lat, lon: geo.lon, country: geo.country, region: geo.region, city: geo.city,
          tags: ["gdelt", "gdelt-tv", "broadcast", kw.replace(/\s+/g, "-")],
          confidence_score: geo.confidence,
          confidence_level: "developing",
          threat_level: threatLevel(kw, snippet),
          actor_type: "organization",
          category: category(kw, snippet),
          user_id: userId,
        });
      }
    } catch (e) { console.warn(`[GDELT-TV] ${kw}: ${e}`); }
  }
  console.log(`[GDELT-TV] ${out.length}`);
  return out;
}

async function fetchAllGdelt(userId: string): Promise<DbRow[]> {
  const [d, g, e, t] = await Promise.allSettled([gdeltDoc(userId), gdeltGkg(userId), gdeltEvents(userId), gdeltTv(userId)]);
  const all = [
    ...(d.status === "fulfilled" ? d.value : []),
    ...(g.status === "fulfilled" ? g.value : []),
    ...(e.status === "fulfilled" ? e.value : []),
    ...(t.status === "fulfilled" ? t.value : []),
  ];
  // Internal dedup by title+geo
  const seen = new Set<string>();
  const deduped: DbRow[] = [];
  for (const row of all) {
    const key = await sha256(`${normalizeTitle(row.title)}|${row.lat?.toFixed(2)}|${row.lon?.toFixed(2)}`);
    if (!seen.has(key)) { seen.add(key); deduped.push(row); }
  }
  console.log(`[GDELT] Total: ${all.length} → deduped: ${deduped.length}`);
  return deduped;
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MAIN HANDLER                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
    const anonKey         = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient     = createClient(supabaseUrl, serviceKey);

    // ── Auth: accept user JWT, service_role key, or anon key (for cron) ──
    const authHeader = req.headers.get("Authorization") || "";
    const token      = authHeader.replace("Bearer ", "").trim();
    let userId       = "";

    if (token && token !== anonKey && token !== serviceKey) {
      // Try user JWT
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser(token);
      if (data?.user) userId = data.user.id;
    }

    // Fallback for cron / service_role callers — pick first analyst
    if (!userId) {
      // Try JWT role claim
      try {
        const payload = JSON.parse(atob(token.split(".")[1] || "e30="));
        if (payload?.role === "service_role" || payload?.role === "anon") {
          const { data: analysts } = await adminClient.from("user_roles").select("user_id").eq("role", "analyst").limit(1);
          userId = (analysts as any[])?.[0]?.user_id || "";
        }
      } catch { /* not a JWT */ }
    }

    // Last resort — any user in the system
    if (!userId) {
      const { data: anyUser } = await adminClient.from("user_roles").select("user_id").limit(1);
      userId = (anyUser as any[])?.[0]?.user_id || "system";
    }

    console.log(`[fetch-news] user: ${userId}`);
    const t0 = Date.now();
    const errors: string[] = [];
    const sourceStats: Record<string, number> = {};

    // ──────────────────────────────────────────────────────────────────
    // COLLECT from all sources in parallel
    // ──────────────────────────────────────────────────────────────────
    const rssTasks = RSS_SOURCES.map(src => async (): Promise<RawArticle[]> => {
      try {
        const r = await fetch(src.url, { headers: { Accept: "application/rss+xml,application/xml,text/xml,*/*" }, signal: AbortSignal.timeout(6000) });
        if (!r.ok) { errors.push(`${src.name}: HTTP ${r.status}`); return []; }
        const items = parseRss(await r.text(), src.name, src.credibility);
        sourceStats[src.name] = items.length;
        return items;
      } catch (e) { errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`); return []; }
    });

    const tgTasks = TELEGRAM_CHANNELS.map(ch => async (): Promise<RawArticle[]> => {
      try {
        const r = await fetch(`https://t.me/s/${ch.channel}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) { errors.push(`TG:${ch.name}: HTTP ${r.status}`); return []; }
        const items = parseTelegram(await r.text(), ch.channel, ch.name);
        items.forEach(it => it.sourceType = `telegram-${ch.region.toLowerCase().replace(/\s+/g, "-")}`);
        sourceStats[`TG:${ch.name}`] = items.length;
        return items;
      } catch (e) { errors.push(`TG:${ch.name}: ${e instanceof Error ? e.message : String(e)}`); return []; }
    });

    // City queries — rotate through all targets in batches of 25
    const BATCH = 25;
    const totalCycles = Math.ceil(CITY_TARGETS.length / BATCH);
    const slot = Math.floor(Date.now() / 60000) % totalCycles;
    const cityBatch = CITY_TARGETS.slice(slot * BATCH, slot * BATCH + BATCH);
    console.log(`[CITY] Cycle ${slot + 1}/${totalCycles}: ${cityBatch.slice(0, 5).join(", ")}...`);

    const cityTasks = cityBatch.map(city => async (): Promise<RawArticle[]> => {
      try {
        const q = encodeURIComponent(`"${city}" ${CITY_SECURITY_CLAUSE}`);
        const r = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(7000) });
        if (!r.ok) return [];
        const items = parseRss(await r.text(), `GNews:${city}`, "medium");
        items.forEach(it => it.sourceType = "googlenews-city");
        sourceStats[`GN:${city}`] = items.length;
        return items.slice(0, 5);
      } catch { return []; }
    });

    // Fire everything at once
    const [rssArr, tgArr, cityArr, eonetRows, gdeltRows] = await Promise.all([
      runChunked(rssTasks,  15),
      runChunked(tgTasks,   10),
      runChunked(cityTasks, 10),
      fetchEonet(userId),
      fetchAllGdelt(userId),
    ]);

    // ──────────────────────────────────────────────────────────────────
    // FILTER RSS/TG/City articles
    // ──────────────────────────────────────────────────────────────────
    const allRaw: RawArticle[] = [...rssArr, ...tgArr, ...cityArr];
    console.log(`[RAW] ${allRaw.length} total`);
    if (allRaw.length > 0) {
      console.log(`[RAW-SAMPLE] ${allRaw.slice(0, 5).map(a => `"${(a.title||'').slice(0,80)}"`).join(' | ')}`);
    }

    const relevant = allRaw.filter(a => isRelevant(a.title, a.description));
    console.log(`[FILTER] ${relevant.length} relevant`);

    const nowMs = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000;
    const fresh = relevant.filter(a => {
      const ts = Date.parse(a.publishedAt);
      return Number.isFinite(ts) && ts <= nowMs + 3600000 && nowMs - ts <= MAX_AGE;
    });
    console.log(`[FRESH] ${fresh.length} ≤24h`);

    // Fingerprint + in-batch dedup
    for (const a of fresh) a.fingerprint = await sha256(`${normalizeTitle(a.title)}|${normalizeUrl(a.url)}`);
    const seenFp = new Set<string>(), seenT = new Set<string>();
    const deduped: RawArticle[] = [];
    for (const a of fresh) {
      const nt = normalizeTitle(a.title);
      if (seenFp.has(a.fingerprint!) || seenT.has(nt)) continue;
      seenFp.add(a.fingerprint!); seenT.add(nt); deduped.push(a);
    }
    console.log(`[DEDUP] ${deduped.length} unique`);

    // ──────────────────────────────────────────────────────────────────
    // DB-LEVEL DEDUP — fetch last 1000 known URLs + titles
    // ──────────────────────────────────────────────────────────────────
    const { data: existing } = await adminClient
      .from("news_items")
      .select("url, title")
      .order("created_at", { ascending: false })
      .limit(1000);

    const existUrls  = new Set<string>((existing || []).map((e: any) => normalizeUrl(e.url)));
    const existTitles = new Set<string>((existing || []).map((e: any) => normalizeTitle(e.title)));

    // ──────────────────────────────────────────────────────────────────
    // BUILD DB ROWS from RSS/TG/City
    // ──────────────────────────────────────────────────────────────────
    const rssRows: DbRow[] = deduped
      .filter(a => !existUrls.has(normalizeUrl(a.url)) && !existTitles.has(normalizeTitle(a.title)))
      .slice(0, 100)
      .map(a => {
        const geo = geolocate(a.title, a.description);
        if (geo.confidence < 0.5) return null;
        return {
          title:             a.title.substring(0, 500),
          summary:           (a.description || "No description.").substring(0, 2000),
          url:               a.url.substring(0, 2000),
          source:            a.sourceName.substring(0, 200),
          source_credibility:a.sourceCredibility,
          published_at:      a.publishedAt,
          lat:               geo.lat, lon: geo.lon,
          country:           geo.country, region: geo.region, city: geo.city,
          tags:              [...tags(a.title, a.description), a.sourceType.split("-")[0]],
          confidence_score:  geo.confidence,
          confidence_level:  "developing" as const,
          threat_level:      threatLevel(a.title, a.description),
          actor_type:        "organization" as const,
          category:          category(a.title, a.description),
          user_id:           userId,
        };
      })
      .filter((r): r is DbRow => r !== null);

    console.log(`[ROWS] RSS/TG/City: ${rssRows.length}`);

    // ──────────────────────────────────────────────────────────────────
    // MERGE: EONET + GDELT (deduped against DB)
    // ──────────────────────────────────────────────────────────────────
    const eonetNew = eonetRows.filter(r => !existUrls.has(normalizeUrl(r.url)));
    const gdeltNew  = gdeltRows
      .filter(r => !r.url.startsWith("https://www.gdeltproject.org") ? (!existUrls.has(normalizeUrl(r.url)) && !existTitles.has(normalizeTitle(r.title))) : true)
      .slice(0, 150);

    console.log(`[ROWS] EONET: ${eonetNew.length} | GDELT: ${gdeltNew.length}`);

    // ──────────────────────────────────────────────────────────────────
    // INSERT in batches of 20
    // ──────────────────────────────────────────────────────────────────
    const allRows: DbRow[] = [...rssRows, ...eonetNew, ...gdeltNew];
    console.log(`[INSERT] ${allRows.length} total rows`);
    let inserted = 0;
    for (let i = 0; i < allRows.length; i += 20) {
      const { data: ins, error: insErr } = await adminClient
        .from("news_items")
        .insert(allRows.slice(i, i + 20))
        .select("id");
      if (insErr) console.error(`[INSERT] batch ${i}: ${insErr.message}`);
      else inserted += ins?.length || 0;
    }

    const elapsed = Date.now() - t0;
    console.log(`[DONE] ${inserted} inserted in ${elapsed}ms`);

    return new Response(JSON.stringify({
      success: true,
      message: `${allRaw.length} fetched → ${relevant.length} relevant → ${deduped.length} unique → ${inserted} inserted in ${elapsed}ms`,
      breakdown: {
        raw_total:            allRaw.length,
        after_filter:         relevant.length,
        after_freshness:      fresh.length,
        after_dedup:          deduped.length,
        rss_tg_city_inserted: rssRows.length,
        eonet_inserted:       eonetNew.length,
        gdelt_inserted:       gdeltNew.length,
        gdelt_streams: {
          doc:    gdeltRows.filter(r => r.tags.includes("gdelt-doc")).length,
          gkg:    gdeltRows.filter(r => r.tags.includes("gdelt-gkg")).length,
          events: gdeltRows.filter(r => r.tags.includes("gdelt-events")).length,
          tv:     gdeltRows.filter(r => r.tags.includes("gdelt-tv")).length,
        },
      },
      total_inserted:  inserted,
      active_sources:  Object.keys(sourceStats).length,
      city_cycle:      `${slot + 1}/${totalCycles}`,
      elapsed_ms:      elapsed,
      errors:          errors.slice(0, 20),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[fetch-news] fatal:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
