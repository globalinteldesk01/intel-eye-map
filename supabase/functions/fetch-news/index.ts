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

const ACTIVE_KW = 
