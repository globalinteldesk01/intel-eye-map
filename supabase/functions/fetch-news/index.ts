import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  TYPES                                                            ║
// ╚══════════════════════════════════════════════════════════════════╝
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

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 1A — RSS SOURCE DEFINITIONS (90+ feeds)                   ║
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
  { name: "VOA News", url: "https://www.voanews.com/api/zqpiqe$pqu", credibility: "high", priority: 1 },
  { name: "RFI English", url: "https://www.rfi.fr/en/rss", credibility: "high", priority: 1 },
  // ── TIER 2: Defense & security ──
  { name: "The War Zone", url: "https://www.thedrive.com/the-war-zone/feed", credibility: "medium", priority: 2 },
  { name: "War on the Rocks", url: "https://warontherocks.com/feed/", credibility: "high", priority: 3 },
  { name: "Breaking Defense", url: "https://breakingdefense.com/feed/", credibility: "medium", priority: 2 },
  { name: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml", credibility: "medium", priority: 2 },
  { name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", credibility: "medium", priority: 2 },
  { name: "Jane's (IHS)", url: "https://www.janes.com/feeds/news", credibility: "high", priority: 2 },
  // ── Middle East & North Africa ──
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", credibility: "medium", priority: 2 },
  { name: "Al-Monitor", url: "https://www.al-monitor.com/rss", credibility: "medium", priority: 2 },
  { name: "Arab News", url: "https://www.arabnews.com/rss.xml", credibility: "medium", priority: 2 },
  { name: "Iran International", url: "https://www.iranintl.com/en/rss", credibility: "medium", priority: 2 },
  { name: "Sudan Tribune", url: "https://sudantribune.com/feed/", credibility: "medium", priority: 2 },
  { name: "The New Arab", url: "https://www.newarab.com/rss.xml", credibility: "medium", priority: 2 },
  // ── Europe & Eurasia ──
  { name: "Kyiv Independent", url: "https://kyivindependent.com/feed/", credibility: "medium", priority: 1 },
  { name: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", credibility: "medium", priority: 2 },
  { name: "Balkan Insight", url: "https://balkaninsight.com/feed/", credibility: "medium", priority: 3 },
  { name: "EU Observer", url: "https://euobserver.com/rss.xml", credibility: "high", priority: 3 },
  { name: "Radio Free Europe", url: "https://www.rferl.org/api/z-pqpiev-qpp", credibility: "medium", priority: 2 },
  // ── Central Asia & Caucasus ──
  { name: "Eurasianet", url: "https://eurasianet.org/rss.xml", credibility: "high", priority: 2 },
  { name: "OC Media", url: "https://oc-media.org/feed/", credibility: "medium", priority: 2 },
  { name: "Kazinform", url: "https://www.inform.kz/en/rss", credibility: "medium", priority: 3 },
  { name: "Trend Azerbaijan", url: "https://en.trend.az/rss", credibility: "medium", priority: 3 },
  // ── Asia-Pacific ──
  { name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", credibility: "medium", priority: 2 },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar", credibility: "high", priority: 2 },
  { name: "The Diplomat", url: "https://thediplomat.com/feed/", credibility: "high", priority: 3 },
  { name: "Channel News Asia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", credibility: "high", priority: 2 },
  { name: "Dawn Pakistan", url: "https://www.dawn.com/feeds/home", credibility: "medium", priority: 2 },
  { name: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", credibility: "medium", priority: 2 },
  { name: "Straits Times", url: "https://www.straitstimes.com/news/asia/rss.xml", credibility: "high", priority: 2 },
  // ── ASEAN ──
  { name: "Rappler", url: "https://www.rappler.com/feed/", credibility: "medium", priority: 1 },
  { name: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/topstories.xml", credibility: "high", priority: 1 },
  { name: "VnExpress Intl", url: "https://e.vnexpress.net/rss/news.rss", credibility: "medium", priority: 2 },
  { name: "Bernama", url: "https://www.bernama.com/en/rss/index.php", credibility: "high", priority: 2 },
  { name: "Irrawaddy", url: "https://www.irrawaddy.com/feed", credibility: "medium", priority: 1 },
  { name: "Myanmar Now", url: "https://myanmar-now.org/en/feed/", credibility: "medium", priority: 1 },
  { name: "Benar News", url: "https://www.benarnews.org/english/rss", credibility: "medium", priority: 1 },
  { name: "ASEAN Briefing", url: "https://www.aseanbriefing.com/news/feed/", credibility: "high", priority: 2 },
  // ── Pacific Islands ──
  { name: "RNZ Pacific", url: "https://www.rnz.co.nz/rss/pacific.rss", credibility: "high", priority: 1 },
  { name: "Pacific Beat ABC", url: "https://www.abc.net.au/pacific/feed/51/rss.xml", credibility: "high", priority: 2 },
  { name: "PNG Post-Courier", url: "https://www.postcourier.com.pg/feed/", credibility: "medium", priority: 2 },
  // ── Africa ──
  { name: "RFI Afrique (EN)", url: "https://www.rfi.fr/en/africa/rss", credibility: "high", priority: 1 },
  { name: "Africa Report", url: "https://www.theafricareport.com/feed/", credibility: "high", priority: 2 },
  { name: "VOA Africa", url: "https://www.voanews.com/api/zmpqmev_pq", credibility: "high", priority: 1 },
  { name: "AllAfrica", url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", credibility: "medium", priority: 2 },
  { name: "The East African", url: "https://www.theeastafrican.co.ke/tea/rss", credibility: "medium", priority: 2 },
  { name: "Sahel Intelligence", url: "https://sahel-intelligence.com/feed/", credibility: "medium", priority: 2 },
  { name: "Congo Research Group", url: "https://www.congoresearchgroup.org/feed/", credibility: "high", priority: 3 },
  { name: "Africanews", url: "https://www.africanews.com/feed/", credibility: "medium", priority: 2 },
  { name: "Daily Maverick", url: "https://www.dailymaverick.co.za/dmrss/", credibility: "medium", priority: 3 },
  // ── Caribbean & Central America ──
  { name: "InSight Crime", url: "https://insightcrime.org/feed/", credibility: "high", priority: 2 },
  { name: "El Faro", url: "https://elfaro.net/rss", credibility: "high", priority: 2 },
  // ── Arctic ──
  { name: "High North News", url: "https://www.highnorthnews.com/en/rss.xml", credibility: "high", priority: 2 },
  { name: "Arctic Today", url: "https://www.arctictoday.com/feed/", credibility: "high", priority: 2 },
  { name: "Barents Observer", url: "https://thebarentsobserver.com/en/rss.xml", credibility: "high", priority: 2 },
  // ── Americas ──
  { name: "MercoPress", url: "https://en.mercopress.com/rss", credibility: "medium", priority: 3 },
  { name: "El Pais America", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada", credibility: "high", priority: 2 },
  // ── Humanitarian & crisis ──
  { name: "ReliefWeb", url: "https://reliefweb.int/updates/rss.xml", credibility: "high", priority: 2 },
  { name: "UNHCR News", url: "https://www.unhcr.org/rss/news.xml", credibility: "high", priority: 2 },
  { name: "International Crisis Group", url: "https://www.crisisgroup.org/rss", credibility: "high", priority: 2 },
  { name: "ICRC", url: "https://www.icrc.org/en/rss/news", credibility: "high", priority: 3 },
  // ── Think tanks ──
  { name: "CSIS", url: "https://www.csis.org/analysis/feed", credibility: "high", priority: 3 },
  { name: "Chatham House", url: "https://www.chathamhouse.org/rss", credibility: "high", priority: 3 },
  { name: "Carnegie", url: "https://carnegieendowment.org/rss/solr/?lang=en", credibility: "high", priority: 3 },
  { name: "ACLED", url: "https://acleddata.com/feed/", credibility: "high", priority: 2 },
  // ── Travel advisories ──
  { name: "US State Dept Travel", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.rss.xml", credibility: "high", priority: 1 },
  { name: "UK FCDO Travel", url: "https://www.gov.uk/foreign-travel-advice.atom", credibility: "high", priority: 1 },
  { name: "Australia DFAT", url: "https://www.smartraveller.gov.au/api/rss", credibility: "high", priority: 1 },
  { name: "Canada Travel", url: "https://travel.gc.ca/travelling/advisories.rss", credibility: "high", priority: 1 },
];

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 1B — TELEGRAM PUBLIC CHANNELS (EXPANDED)                  ║
// ╚══════════════════════════════════════════════════════════════════╝
interface TelegramDef {
  name: string;
  channel: string;
  credibility: "high" | "medium" | "low";
  region: string;
}

const TELEGRAM_CHANNELS: TelegramDef[] = [
  // ── Ukraine / Russia conflict ──
  { name: "Intel Slava Z", channel: "intelslava", credibility: "low", region: "Ukraine" },
  { name: "Ukraine Conflict Monitor", channel: "UkraineConflictUpdates", credibility: "low", region: "Ukraine" },
  { name: "Rybar English", channel: "rybar_en", credibility: "low", region: "Ukraine" },
  { name: "Ukraine War Map", channel: "ukrainewarmap", credibility: "medium", region: "Ukraine" },
  { name: "DeepState UA", channel: "DeepStateUA", credibility: "medium", region: "Ukraine" },
  { name: "UA War Report", channel: "uawarreport", credibility: "low", region: "Ukraine" },
  { name: "Mil Osint", channel: "milosint", credibility: "medium", region: "Ukraine" },
  { name: "Conflict Intelligence Team", channel: "CITeam_en", credibility: "medium", region: "Global" },
  { name: "Ukraine NOW", channel: "ukrainenow", credibility: "low", region: "Ukraine" },
  { name: "War Monitor", channel: "WarMonitors", credibility: "low", region: "Global" },
  // ── Middle East ──
  { name: "Middle East Spectator", channel: "MideastSpectator", credibility: "low", region: "Middle East" },
  { name: "Gaza Now", channel: "GazaNow", credibility: "low", region: "Middle East" },
  { name: "Quds News Network", channel: "QudsNen", credibility: "low", region: "Middle East" },
  { name: "Eye on Palestine", channel: "EyeOnPalestine", credibility: "low", region: "Middle East" },
  { name: "Al Jazeera Arabic Updates", channel: "AJABreaking", credibility: "medium", region: "Middle East" },
  { name: "Jerusalem Post Alerts", channel: "JerusalemPostAlerts", credibility: "medium", region: "Middle East" },
  { name: "Lebanon News", channel: "LebanonNewsEN", credibility: "low", region: "Middle East" },
  { name: "Iran Watch", channel: "iranwatch1", credibility: "low", region: "Middle East" },
  { name: "Yemen War Monitor", channel: "YemenWarMonitor", credibility: "low", region: "Middle East" },
  { name: "Syria Civil War Map", channel: "syriancivilwarmap", credibility: "low", region: "Middle East" },
  { name: "Red Alert Israel", channel: "redalertisrael", credibility: "high", region: "Middle East" },
  // ── OSINT & Global Intel ──
  { name: "OSINT Aggregator", channel: "osint_aggregator", credibility: "medium", region: "Global" },
  { name: "Intel Republic", channel: "IntelRepublic", credibility: "medium", region: "Global" },
  { name: "OSINT Ukraine", channel: "osintukraine", credibility: "medium", region: "Ukraine" },
  { name: "Global Intel Hub", region: "Global", channel: "globalintelhub", credibility: "low" },
  { name: "Real World OSINT", channel: "realworldosint", credibility: "medium", region: "Global" },
  { name: "Geopolitics Live", channel: "GeopoliticsLive", credibility: "medium", region: "Global" },
  { name: "Breaking Intel", channel: "breakingintel", credibility: "low", region: "Global" },
  { name: "Terror Monitor", channel: "terrormonitor", credibility: "medium", region: "Global" },
  { name: "ACLED Conflict", channel: "acledinfo", credibility: "high", region: "Global" },
  { name: "Conflict Monitor", channel: "conflictmonitor", credibility: "medium", region: "Global" },
  // ── Africa ──
  { name: "Sahel Watch", channel: "sahelwatch", credibility: "low", region: "Africa" },
  { name: "Sudan War Monitor", channel: "sudanwarmonitor", credibility: "low", region: "Africa" },
  { name: "Africa OSINT", channel: "africaosint", credibility: "medium", region: "Africa" },
  { name: "DRC Congo Watch", channel: "congowatch", credibility: "low", region: "Africa" },
  { name: "Tigray Update", channel: "tigrayupdate", credibility: "low", region: "Africa" },
  // ── Asia-Pacific ──
  { name: "Myanmar OSINT", channel: "myanmarosint", credibility: "medium", region: "Southeast Asia" },
  { name: "South China Sea News", channel: "southchinaseanews", credibility: "medium", region: "Asia" },
  { name: "INDOPACOM Watch", channel: "indopacomwatch", credibility: "medium", region: "Asia" },
  { name: "Pakistan Security", channel: "paksecurity", credibility: "low", region: "Asia" },
  // ── Americas ──
  { name: "InSight Crime Updates", channel: "insightcrimeupdates", credibility: "medium", region: "Americas" },
  { name: "Haiti Security", channel: "haitisecurity", credibility: "low", region: "Caribbean" },
  { name: "Cartel Chronicle", channel: "cartelchronicle", credibility: "low", region: "Americas" },
];

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 1C — CITY QUERY TARGETS                                   ║
// ╚══════════════════════════════════════════════════════════════════╝
const CITY_QUERY_TARGETS: string[] = [
  // India
  "Mumbai","Delhi","New Delhi","Bengaluru","Hyderabad","Chennai","Kolkata","Ahmedabad","Pune",
  "Jaipur","Lucknow","Srinagar","Guwahati","Imphal","Shillong","Ranchi","Bhubaneswar",
  "Dehradun","Jammu","Leh","Pulwama","Anantnag","Kargil","Baramulla",
  // Middle East
  "Baghdad","Mosul","Basra","Tehran","Riyadh","Jeddah","Dubai","Doha","Sanaa","Aden",
  "Beirut","Damascus","Aleppo","Idlib","Gaza","Jerusalem","Tel Aviv","Ankara","Istanbul","Muscat",
  // Europe
  "Kyiv","Kharkiv","Odesa","Lviv","Zaporizhzhia","Kherson","Dnipro","Bakhmut",
  "Moscow","London","Paris","Berlin","Warsaw","Belgrade","Minsk",
  // Asia
  "Beijing","Shanghai","Hong Kong","Taipei","Tokyo","Seoul","Pyongyang","Urumqi",
  "Bangkok","Manila","Jakarta","Kuala Lumpur","Singapore","Ho Chi Minh City","Hanoi",
  "Yangon","Phnom Penh","Vientiane","Davao","Zamboanga","Marawi","Sittwe","Rakhine",
  // Pakistan/Afghanistan
  "Karachi","Lahore","Islamabad","Peshawar","Quetta","Kabul","Kandahar","Herat","Jalalabad",
  // Central Asia
  "Tashkent","Bishkek","Dushanbe","Almaty","Astana","Ashgabat",
  // Caucasus
  "Tbilisi","Yerevan","Baku","Grozny","Stepanakert",
  // Africa — Sahel/Horn/Central
  "Bamako","Ouagadougou","Niamey","Ndjamena","Bangui","Khartoum","El Fasher",
  "Juba","Goma","Bukavu","Kinshasa","Mogadishu","Nairobi","Kampala","Kigali","Addis Ababa","Mekelle",
  "Lagos","Abuja","Maiduguri","Tripoli","Benghazi","Cairo","Dakar","Maputo","Pemba",
  // Pacific Islands
  "Port Moresby","Honiara","Suva","Port Vila","Noumea",
  // Caribbean / Central America
  "Havana","Port-au-Prince","Kingston","Tegucigalpa","San Salvador","Guatemala City","Panama City",
  // Arctic
  "Murmansk","Tromsø","Reykjavik","Nuuk",
  // South America
  "Bogota","Caracas","Lima","Quito","Manaus","Belem",
  // Global majors
  "Washington","New York","London","Moscow","Beijing","Tokyo","Sydney",
];

const CITY_SECURITY_CLAUSE =
  "(security OR attack OR protest OR riot OR bombing OR shooting OR terror OR hostage OR kidnap " +
  "OR explosion OR curfew OR lockdown OR evacuation OR strike OR clash OR cyclone OR flood OR earthquake OR tsunami)";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 2 — FILTERS                                               ║
// ╚══════════════════════════════════════════════════════════════════╝
const INCLUDE_KW = [
  "travel advisory","travel warning","travel alert","travel ban","travel restriction",
  "do not travel","reconsider travel","exercise caution","level 4","level 3",
  "evacuate","evacuation","repatriation","stranded tourists","stranded travelers",
  "stranded passengers","tourists evacuated","foreign nationals",
  "curfew","lockdown","state of emergency","martial law","border closed","border closure",
  "checkpoint","no-fly zone","airspace closed","airspace closure",
  "airport closed","airport closure","airport attack","airport shutdown","flights cancelled",
  "flights canceled","flights suspended","flight diverted","airline suspends","grounded flights",
  "rail strike","train strike","metro strike","transport strike","airport strike",
  "port closed","port closure","cruise ship","ferry disrupted","road closed","highway closed",
  "carjack","carjacking","road block","roadblock",
  "terror","terrorism","terrorist","terror attack","bomb","bombing","explosion","blast",
  "active shooter","mass shooting","shooting at","gunmen","suicide bomb","ied","car bomb",
  "vehicle ramming","stabbing attack","knife attack","grenade","attack on",
  "insurgent","militant","extremist","jihadi","jihadist","al-qaeda","isis","islamic state",
  "boko haram","al-shabaab","abu sayyaf","jemaah islamiyah","wagner group","rsf","janjaweed",
  "kidnap","kidnapping","kidnapped","hostage","abducted","abduction","ransom",
  "tourist killed","tourist robbed","tourist attacked","tourist kidnapped",
  "foreigner killed","foreigner attacked","foreigner kidnapped","foreigner robbed",
  "expat killed","expat attacked","express kidnapping","gang violence","cartel violence",
  "armed robbery","mugging","piracy","pirate attack","maritime piracy",
  "protest","demonstration","riot","unrest","uprising","mass protest","violent protest",
  "clashes","crackdown","tear gas","water cannon","rubber bullets","police violence",
  "coup","coup attempt","revolution","rebellion","civil war","ethnic violence",
  "airstrike","air strike","missile strike","drone strike","shelling","artillery",
  "armed conflict","cross-border attack","military operation","fighting erupts",
  "ambush","firefight","casualties","killed in","wounded in",
  "outbreak","epidemic","pandemic","cholera","ebola","mpox","monkeypox","dengue",
  "yellow fever","measles outbreak","quarantine","health alert","disease outbreak",
  "earthquake","tsunami","volcanic eruption","volcano erupts","ash cloud","wildfire",
  "bushfire","hurricane","typhoon","cyclone","tropical storm","flash flood","flooding",
  "landslide","mudslide","blizzard","ice storm","heatwave","sandstorm","snowstorm",
  "power outage","blackout","water shortage","fuel shortage","internet shutdown",
  "communications blackout","cyber attack on airport","cyber attack on airline",
];

const EXCLUDE_KW = [
  "celebrity","hollywood","movie","box office","grammy","oscar","emmy","concert",
  "album","music video","netflix","disney","rapper","singer","actor","actress",
  "influencer","tiktok","instagram","fashion","runway","beauty","makeup",
  "lifestyle","wellness","diet","workout","fitness","recipe","cooking",
  "restaurant review","hotel review","resort review","spa","wedding","birthday","horoscope",
  "nba","nfl","mlb","nhl","premier league","champions league","super bowl",
  "playoff","championship","tournament","goal scored","touchdown","home run",
  "fantasy sports","betting odds","espn","sports betting","transfer window",
  "quarterly earnings","ipo","startup funding","venture capital","stock price",
  "product launch","iphone","android","app store","software update","ces",
  "video game","gaming","esports","cryptocurrency price","bitcoin price","nft",
  "shoplifting","drunk driving","noise complaint","vandalism","petty crime",
  "domestic dispute","custody battle","divorce",
];

const HARD_EXCLUDE_KW = [
  "comeback","made a comeback","in recent years","over the years","decade ago",
  "looking back","retrospective","history of","origins of","explained:","explainer",
  "analysis:","commentary","opinion:","op-ed","editorial","feature:",
  "best places","top 10","ranked:","review:","guide to","how to visit",
  "things to do","destination guide","travel tips","travel guide",
  "arms deal","weapons contract","defense budget","fighter jet purchase",
  "submarine deal","aircraft carrier launched","military exercise","joint drill",
  "war games","naval drill","training exercise","procurement","contract awarded",
  "fleet upgrade","modernization program","airframe","prototype","delivered to",
];

const ACTIVE_INCIDENT_KW = [
  "killed","wounded","injured","dead","dies","died","casualties",
  "attacked","attacks","attacking","ambushed","stormed","raided","seized","captured",
  "evacuated","evacuating","stranded","trapped","rescued","missing",
  "kidnapped","abducted","held hostage","taken hostage",
  "exploded","explodes","blast hits","bomb hits","bombing kills","detonated",
  "fired at","opened fire","shot dead","shooting kills","gunmen kill",
  "clashed","clashes erupt","fighting erupts","battle for","battles erupt",
  "struck","strike hits","shelled","bombarded","airstrike kills","missile hits",
  "advisory issued","warning issued","alert issued","advisory updated",
  "declared","imposed","announced curfew","imposed curfew",
  "shut down","shutting down","closed after","closure announced","cancelled after",
  "suspended after","suspends flights","grounded",
  "banned","blocked","restricted","quarantined",
  "ongoing","underway","unfolding","developing","breaking",
  "erupted","erupts","spreading","escalating","escalates","intensifies",
  "evacuation order","mandatory evacuation","shelter in place",
];

const CRITICAL_KW = ["attack","bomb","explosion","terror","war declared","invasion","massacre","mass casualty","nuclear strike","chemical weapon","imminent threat","active shooter","hostage situation","genocide","ethnic cleansing","biological attack"];
const HIGH_KW = ["conflict","military operation","troops deployed","missile strike","emergency declared","state of emergency","martial law","coup attempt","assassination","airstrike","ceasefire violated","casualties reported","ambush","drone strike","naval confrontation","blockade"];
const ELEVATED_KW = ["tension","protest","sanctions","warning","dispute","standoff","diplomatic crisis","border incident","travel advisory","heightened alert","cyber attack","disinformation","propaganda","troop movement"];

function isOsintRelevant(title: string, desc: string): boolean {
  const t = `${title} ${desc}`.toLowerCase();
  if (EXCLUDE_KW.some(k => t.includes(k))) return false;
  if (HARD_EXCLUDE_KW.some(k => t.includes(k))) return false;
  if (!INCLUDE_KW.some(k => t.includes(k))) return false;
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
  if (["evacuat","travel advisory","travel warning","travel ban","stranded","airport closed","flights cancelled","flights canceled","flights suspended","airspace closed","border closed","curfew","lockdown","checkpoint"].some(k => t.includes(k))) return "security";
  if (["terror","terrorist","bomb","explosion","blast","active shooter","mass shooting","ied","suicide bomb","car bomb","stabbing attack","kidnap","hostage","abducted","tourist killed","tourist attacked","foreigner killed","foreigner attacked","piracy","armed robbery","assassination"].some(k => t.includes(k))) return "security";
  if (["airstrike","missile strike","drone strike","shelling","artillery","armed conflict","military operation","fighting","war","ceasefire","invasion","ambush","frontline"].some(k => t.includes(k))) return "conflict";
  if (["protest","demonstration","riot","unrest","uprising","clashes","crackdown","tear gas","coup","martial law","revolution","rebellion","civil war","ethnic violence"].some(k => t.includes(k))) return "conflict";
  if (["earthquake","tsunami","volcanic","volcano","wildfire","bushfire","hurricane","typhoon","cyclone","tropical storm","flash flood","flooding","landslide","mudslide","blizzard","sandstorm","heatwave","disaster","refugee","displacement","famine","humanitarian"].some(k => t.includes(k))) return "humanitarian";
  if (["outbreak","epidemic","pandemic","cholera","ebola","mpox","monkeypox","dengue","yellow fever","measles","quarantine","health alert","disease"].some(k => t.includes(k))) return "humanitarian";
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
    "arctic","pacific","sahel","caucasus","caribbean",
  ];
  for (const k of kws) {
    if (t.includes(k.replace("-", " ")) && tags.length < 6) tags.push(k);
  }
  return tags.length ? tags : ["intel"];
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 2B — DEDUPLICATION                                        ║
// ╚══════════════════════════════════════════════════════════════════╝
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"].forEach(p => u.searchParams.delete(p));
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0];
  }
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
// ║  LAYER 2C — GEOLOCATION ENGINE                                   ║
// ╚══════════════════════════════════════════════════════════════════╝
const CITIES: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  "washington": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "washington dc": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "new york": { lat: 40.7128, lon: -74.0060, country: "United States", region: "North America" },
  "london": { lat: 51.5074, lon: -0.1278, country: "United Kingdom", region: "Europe" },
  "paris": { lat: 48.8566, lon: 2.3522, country: "France", region: "Europe" },
  "berlin": { lat: 52.5200, lon: 13.4050, country: "Germany", region: "Europe" },
  "moscow": { lat: 55.7558, lon: 37.6173, country: "Russia", region: "Europe" },
  "kyiv": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kiev": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kharkiv": { lat: 49.9935, lon: 36.2304, country: "Ukraine", region: "Europe" },
  "odesa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "odessa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "lviv": { lat: 49.8397, lon: 24.0297, country: "Ukraine", region: "Europe" },
  "zaporizhzhia": { lat: 47.8388, lon: 35.1396, country: "Ukraine", region: "Europe" },
  "kherson": { lat: 46.6354, lon: 32.6169, country: "Ukraine", region: "Europe" },
  "dnipro": { lat: 48.4647, lon: 35.0462, country: "Ukraine", region: "Europe" },
  "bakhmut": { lat: 48.5944, lon: 38.0006, country: "Ukraine", region: "Europe" },
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
  "kolkata": { lat: 22.5726, lon: 88.3639, country: "India", region: "Asia" },
  "chennai": { lat: 13.0827, lon: 80.2707, country: "India", region: "Asia" },
  "srinagar": { lat: 34.0837, lon: 74.7973, country: "India", region: "Asia" },
  "bengaluru": { lat: 12.9716, lon: 77.5946, country: "India", region: "Asia" },
  "hyderabad": { lat: 17.3850, lon: 78.4867, country: "India", region: "Asia" },
  "guwahati": { lat: 26.1445, lon: 91.7362, country: "India", region: "Asia" },
  "imphal": { lat: 24.8170, lon: 93.9368, country: "India", region: "Asia" },
  "shillong": { lat: 25.5788, lon: 91.8933, country: "India", region: "Asia" },
  "leh": { lat: 34.1526, lon: 77.5770, country: "India", region: "Asia" },
  "jammu": { lat: 32.7266, lon: 74.8570, country: "India", region: "Asia" },
  "pulwama": { lat: 33.8716, lon: 74.8946, country: "India", region: "Asia" },
  "anantnag": { lat: 33.7311, lon: 75.1487, country: "India", region: "Asia" },
  "baramulla": { lat: 34.2096, lon: 74.3436, country: "India", region: "Asia" },
  "kargil": { lat: 34.5539, lon: 76.1352, country: "India", region: "Asia" },
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "lahore": { lat: 31.5204, lon: 74.3587, country: "Pakistan", region: "Asia" },
  "peshawar": { lat: 34.0151, lon: 71.5249, country: "Pakistan", region: "Asia" },
  "quetta": { lat: 30.1798, lon: 66.9750, country: "Pakistan", region: "Asia" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Asia" },
  "kandahar": { lat: 31.6289, lon: 65.7372, country: "Afghanistan", region: "Asia" },
  "herat": { lat: 34.3529, lon: 62.2040, country: "Afghanistan", region: "Asia" },
  "jalalabad": { lat: 34.4415, lon: 70.4372, country: "Afghanistan", region: "Asia" },
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Southeast Asia" },
  "manila": { lat: 14.5995, lon: 120.9842, country: "Philippines", region: "Southeast Asia" },
  "davao": { lat: 7.1907, lon: 125.4553, country: "Philippines", region: "Southeast Asia" },
  "zamboanga": { lat: 6.9214, lon: 122.0790, country: "Philippines", region: "Southeast Asia" },
  "marawi": { lat: 7.9986, lon: 124.2928, country: "Philippines", region: "Southeast Asia" },
  "jakarta": { lat: -6.2088, lon: 106.8456, country: "Indonesia", region: "Southeast Asia" },
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Southeast Asia" },
  "kuala lumpur": { lat: 3.1390, lon: 101.6869, country: "Malaysia", region: "Southeast Asia" },
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Southeast Asia" },
  "naypyidaw": { lat: 19.7633, lon: 96.0785, country: "Myanmar", region: "Southeast Asia" },
  "sittwe": { lat: 20.1461, lon: 92.8983, country: "Myanmar", region: "Southeast Asia" },
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Southeast Asia" },
  "ho chi minh city": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Southeast Asia" },
  "phnom penh": { lat: 11.5564, lon: 104.9282, country: "Cambodia", region: "Southeast Asia" },
  "vientiane": { lat: 17.9757, lon: 102.6331, country: "Laos", region: "Southeast Asia" },
  "jerusalem": { lat: 31.7683, lon: 35.2137, country: "Israel", region: "Middle East" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", region: "Middle East" },
  "gaza": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "gaza city": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "rafah": { lat: 31.2929, lon: 34.2424, country: "Palestine", region: "Middle East" },
  "ramallah": { lat: 31.9038, lon: 35.2034, country: "Palestine", region: "Middle East" },
  "tehran": { lat: 35.6892, lon: 51.3890, country: "Iran", region: "Middle East" },
  "riyadh": { lat: 24.7136, lon: 46.6753, country: "Saudi Arabia", region: "Middle East" },
  "jeddah": { lat: 21.5433, lon: 39.1728, country: "Saudi Arabia", region: "Middle East" },
  "dubai": { lat: 25.2048, lon: 55.2708, country: "UAE", region: "Middle East" },
  "ankara": { lat: 39.9334, lon: 32.8597, country: "Turkey", region: "Middle East" },
  "istanbul": { lat: 41.0082, lon: 28.9784, country: "Turkey", region: "Middle East" },
  "baghdad": { lat: 33.3152, lon: 44.3661, country: "Iraq", region: "Middle East" },
  "mosul": { lat: 36.3350, lon: 43.1189, country: "Iraq", region: "Middle East" },
  "damascus": { lat: 33.5138, lon: 36.2765, country: "Syria", region: "Middle East" },
  "aleppo": { lat: 36.2021, lon: 37.1343, country: "Syria", region: "Middle East" },
  "idlib": { lat: 35.9306, lon: 36.6339, country: "Syria", region: "Middle East" },
  "beirut": { lat: 33.8938, lon: 35.5018, country: "Lebanon", region: "Middle East" },
  "amman": { lat: 31.9454, lon: 35.9284, country: "Jordan", region: "Middle East" },
  "doha": { lat: 25.2854, lon: 51.5310, country: "Qatar", region: "Middle East" },
  "sanaa": { lat: 15.3694, lon: 44.1910, country: "Yemen", region: "Middle East" },
  "aden": { lat: 12.7855, lon: 45.0187, country: "Yemen", region: "Middle East" },
  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Africa" },
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "maiduguri": { lat: 11.8311, lon: 13.1510, country: "Nigeria", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "addis ababa": { lat: 9.0250, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "mekelle": { lat: 13.4967, lon: 39.4753, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "el fasher": { lat: 13.6290, lon: 25.3490, country: "Sudan", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "benghazi": { lat: 32.1194, lon: 20.0868, country: "Libya", region: "Africa" },
  "mogadishu": { lat: 2.0469, lon: 45.3182, country: "Somalia", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "goma": { lat: -1.6771, lon: 29.2386, country: "DR Congo", region: "Africa" },
  "bukavu": { lat: -2.5083, lon: 28.8608, country: "DR Congo", region: "Africa" },
  "bamako": { lat: 12.6392, lon: -8.0029, country: "Mali", region: "Africa" },
  "ouagadougou": { lat: 12.3714, lon: -1.5197, country: "Burkina Faso", region: "Africa" },
  "niamey": { lat: 13.5127, lon: 2.1128, country: "Niger", region: "Africa" },
  "ndjamena": { lat: 12.1348, lon: 15.0557, country: "Chad", region: "Africa" },
  "bangui": { lat: 4.3947, lon: 18.5582, country: "Central African Republic", region: "Africa" },
  "juba": { lat: 4.8594, lon: 31.5713, country: "South Sudan", region: "Africa" },
  "kampala": { lat: 0.3476, lon: 32.5825, country: "Uganda", region: "Africa" },
  "kigali": { lat: -1.9403, lon: 29.8739, country: "Rwanda", region: "Africa" },
  "maputo": { lat: -25.9692, lon: 32.5732, country: "Mozambique", region: "Africa" },
  "pemba": { lat: -13.0000, lon: 40.5167, country: "Mozambique", region: "Africa" },
  "dakar": { lat: 14.7167, lon: -17.4677, country: "Senegal", region: "Africa" },
  "tbilisi": { lat: 41.7151, lon: 44.8271, country: "Georgia", region: "Caucasus" },
  "yerevan": { lat: 40.1792, lon: 44.4991, country: "Armenia", region: "Caucasus" },
  "baku": { lat: 40.4093, lon: 49.8671, country: "Azerbaijan", region: "Caucasus" },
  "grozny": { lat: 43.3180, lon: 45.6987, country: "Russia", region: "Caucasus" },
  "stepanakert": { lat: 39.8174, lon: 46.7514, country: "Nagorno-Karabakh", region: "Caucasus" },
  "tashkent": { lat: 41.2995, lon: 69.2401, country: "Uzbekistan", region: "Central Asia" },
  "bishkek": { lat: 42.8746, lon: 74.5698, country: "Kyrgyzstan", region: "Central Asia" },
  "dushanbe": { lat: 38.5598, lon: 68.7740, country: "Tajikistan", region: "Central Asia" },
  "almaty": { lat: 43.2220, lon: 76.8512, country: "Kazakhstan", region: "Central Asia" },
  "astana": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Central Asia" },
  "ashgabat": { lat: 37.9601, lon: 58.3261, country: "Turkmenistan", region: "Central Asia" },
  "port moresby": { lat: -9.4438, lon: 147.1803, country: "Papua New Guinea", region: "Pacific" },
  "honiara": { lat: -9.4319, lon: 160.0562, country: "Solomon Islands", region: "Pacific" },
  "suva": { lat: -18.1416, lon: 178.4419, country: "Fiji", region: "Pacific" },
  "port vila": { lat: -17.7333, lon: 168.3167, country: "Vanuatu", region: "Pacific" },
  "noumea": { lat: -22.2758, lon: 166.4580, country: "New Caledonia", region: "Pacific" },
  "havana": { lat: 23.1136, lon: -82.3666, country: "Cuba", region: "Caribbean" },
  "port-au-prince": { lat: 18.5944, lon: -72.3074, country: "Haiti", region: "Caribbean" },
  "kingston": { lat: 17.9714, lon: -76.7920, country: "Jamaica", region: "Caribbean" },
  "tegucigalda": { lat: 14.0723, lon: -87.1921, country: "Honduras", region: "Central America" },
  "san salvador": { lat: 13.6929, lon: -89.2182, country: "El Salvador", region: "Central America" },
  "guatemala city": { lat: 14.6349, lon: -90.5069, country: "Guatemala", region: "Central America" },
  "panama city": { lat: 8.9824, lon: -79.5199, country: "Panama", region: "Central America" },
  "bogota": { lat: 4.7110, lon: -74.0721, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "quito": { lat: -0.1807, lon: -78.4678, country: "Ecuador", region: "South America" },
  "manaus": { lat: -3.1190, lon: -60.0217, country: "Brazil", region: "South America" },
  "belem": { lat: -1.4558, lon: -48.5044, country: "Brazil", region: "South America" },
  "murmansk": { lat: 68.9585, lon: 33.0827, country: "Russia", region: "Arctic" },
  "reykjavik": { lat: 64.1265, lon: -21.8174, country: "Iceland", region: "Arctic" },
  "nuuk": { lat: 64.1836, lon: -51.7214, country: "Greenland", region: "Arctic" },
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "canberra": { lat: -35.2809, lon: 149.1300, country: "Australia", region: "Oceania" },
  "south china sea": { lat: 12.0, lon: 114.0, country: "South China Sea", region: "Asia" },
  "red sea": { lat: 20.0, lon: 38.0, country: "Red Sea", region: "Middle East" },
  "strait of hormuz": { lat: 26.5, lon: 56.3, country: "Strait of Hormuz", region: "Middle East" },
  "gulf of aden": { lat: 12.0, lon: 47.0, country: "Gulf of Aden", region: "Africa" },
  "suez canal": { lat: 30.4, lon: 32.3, country: "Egypt", region: "Middle East" },
  "black sea": { lat: 43.0, lon: 35.0, country: "Black Sea", region: "Europe" },
};

const COUNTRY_PATTERNS: Record<string, { patterns: string[]; lat: number; lon: number; name: string; region: string }> = {
  "ua": { patterns: ["ukraine","ukrainian","zelensky"], lat: 50.4501, lon: 30.5234, name: "Ukraine", region: "Europe" },
  "ru": { patterns: ["russia","russian","kremlin","putin"], lat: 55.7558, lon: 37.6173, name: "Russia", region: "Europe" },
  "cn": { patterns: ["china","chinese","xi jinping","pla ","prc "], lat: 39.9042, lon: 116.4074, name: "China", region: "Asia" },
  "ir": { patterns: ["iran","iranian","irgc","khamenei"], lat: 35.6892, lon: 51.3890, name: "Iran", region: "Middle East" },
  "il": { patterns: ["israel","israeli","netanyahu","hamas","hezbollah","idf "], lat: 31.7683, lon: 35.2137, name: "Israel", region: "Middle East" },
  "ps": { patterns: ["palestine","palestinian","west bank","gaza strip"], lat: 31.9522, lon: 35.2332, name: "Palestine", region: "Middle East" },
  "gb": { patterns: ["britain","british","uk ","england","wales","scotland"], lat: 51.5074, lon: -0.1278, name: "United Kingdom", region: "Europe" },
  "de": { patterns: ["germany","german","bundeswehr"], lat: 52.5200, lon: 13.4050, name: "Germany", region: "Europe" },
  "fr": { patterns: ["france","french","macron"], lat: 48.8566, lon: 2.3522, name: "France", region: "Europe" },
  "sa": { patterns: ["saudi","saudi arabia","mbs "], lat: 24.7136, lon: 46.6753, name: "Saudi Arabia", region: "Middle East" },
  "tr": { patterns: ["turkey","turkish","erdogan","turkiye"], lat: 39.9334, lon: 32.8597, name: "Turkey", region: "Middle East" },
  "pk": { patterns: ["pakistan","pakistani"], lat: 33.6844, lon: 73.0479, name: "Pakistan", region: "Asia" },
  "in": { patterns: ["india","indian","modi"], lat: 28.6139, lon: 77.2090, name: "India", region: "Asia" },
  "kr": { patterns: ["south korea","korean"], lat: 37.5665, lon: 126.9780, name: "South Korea", region: "Asia" },
  "kp": { patterns: ["north korea","kim jong"], lat: 39.0392, lon: 125.7625, name: "North Korea", region: "Asia" },
  "jp": { patterns: ["japan","japanese"], lat: 35.6762, lon: 139.6503, name: "Japan", region: "Asia" },
  "tw": { patterns: ["taiwan","taiwanese"], lat: 25.0330, lon: 121.5654, name: "Taiwan", region: "Asia" },
  "mm": { patterns: ["myanmar","burma","burmese","rohingya","junta","tatmadaw","arakan"], lat: 16.8661, lon: 96.1951, name: "Myanmar", region: "Southeast Asia" },
  "th": { patterns: ["thailand","thai"], lat: 13.7563, lon: 100.5018, name: "Thailand", region: "Southeast Asia" },
  "id": { patterns: ["indonesia","indonesian","prabowo"], lat: -6.2088, lon: 106.8456, name: "Indonesia", region: "Southeast Asia" },
  "ph": { patterns: ["philippines","filipino","mindanao","abu sayyaf","marcos","bangsamoro"], lat: 14.5995, lon: 120.9842, name: "Philippines", region: "Southeast Asia" },
  "my": { patterns: ["malaysia","malaysian"], lat: 3.1390, lon: 101.6869, name: "Malaysia", region: "Southeast Asia" },
  "vn": { patterns: ["vietnam","vietnamese"], lat: 21.0278, lon: 105.8342, name: "Vietnam", region: "Southeast Asia" },
  "kh": { patterns: ["cambodia","cambodian"], lat: 11.5564, lon: 104.9282, name: "Cambodia", region: "Southeast Asia" },
  "sg": { patterns: ["singapore","singaporean"], lat: 1.3521, lon: 103.8198, name: "Singapore", region: "Southeast Asia" },
  "af": { patterns: ["afghanistan","afghan","taliban"], lat: 34.5553, lon: 69.2075, name: "Afghanistan", region: "Asia" },
  "ye": { patterns: ["yemen","yemeni","houthi","ansar allah"], lat: 15.3694, lon: 44.1910, name: "Yemen", region: "Middle East" },
  "sy": { patterns: ["syria","syrian","assad"], lat: 33.5138, lon: 36.2765, name: "Syria", region: "Middle East" },
  "iq": { patterns: ["iraq","iraqi"], lat: 33.3152, lon: 44.3661, name: "Iraq", region: "Middle East" },
  "lb": { patterns: ["lebanon","lebanese"], lat: 33.8938, lon: 35.5018, name: "Lebanon", region: "Middle East" },
  "ly": { patterns: ["libya","libyan","haftar"], lat: 32.8872, lon: 13.1913, name: "Libya", region: "Africa" },
  "sd": { patterns: ["sudan","sudanese","rsf ","rapid support","janjaweed"], lat: 15.5007, lon: 32.5599, name: "Sudan", region: "Africa" },
  "ss": { patterns: ["south sudan"], lat: 4.8594, lon: 31.5713, name: "South Sudan", region: "Africa" },
  "et": { patterns: ["ethiopia","ethiopian","tigray","amhara"], lat: 9.0250, lon: 38.7469, name: "Ethiopia", region: "Africa" },
  "so": { patterns: ["somalia","somali","al shabaab","al-shabaab"], lat: 2.0469, lon: 45.3182, name: "Somalia", region: "Africa" },
  "cd": { patterns: ["congo","congolese","drc ","m23 ","adf "], lat: -4.4419, lon: 15.2663, name: "DR Congo", region: "Africa" },
  "ml": { patterns: ["mali","malian","jnim","aqim"], lat: 12.6392, lon: -8.0029, name: "Mali", region: "Africa" },
  "bf": { patterns: ["burkina faso","burkinabe"], lat: 12.3714, lon: -1.5197, name: "Burkina Faso", region: "Africa" },
  "ne": { patterns: ["niger","nigerien"], lat: 13.5127, lon: 2.1128, name: "Niger", region: "Africa" },
  "td": { patterns: ["chad","chadian"], lat: 12.1348, lon: 15.0557, name: "Chad", region: "Africa" },
  "ng": { patterns: ["nigeria","nigerian","boko haram"], lat: 9.0765, lon: 7.3986, name: "Nigeria", region: "Africa" },
  "eg": { patterns: ["egypt","egyptian"], lat: 30.0444, lon: 31.2357, name: "Egypt", region: "Africa" },
  "cf": { patterns: ["central african republic","car ","bangui"], lat: 4.3947, lon: 18.5582, name: "Central African Republic", region: "Africa" },
  "mz": { patterns: ["mozambique","cabo delgado"], lat: -25.9692, lon: 32.5732, name: "Mozambique", region: "Africa" },
  "ge": { patterns: ["georgia","georgian"], lat: 41.7151, lon: 44.8271, name: "Georgia", region: "Caucasus" },
  "am": { patterns: ["armenia","armenian"], lat: 40.1792, lon: 44.4991, name: "Armenia", region: "Caucasus" },
  "az": { patterns: ["azerbaijan","azeri","nagorno","karabakh"], lat: 40.4093, lon: 49.8671, name: "Azerbaijan", region: "Caucasus" },
  "kz": { patterns: ["kazakhstan","kazakhstani"], lat: 51.1694, lon: 71.4491, name: "Kazakhstan", region: "Central Asia" },
  "uz": { patterns: ["uzbekistan","uzbek"], lat: 41.2995, lon: 69.2401, name: "Uzbekistan", region: "Central Asia" },
  "kg": { patterns: ["kyrgyzstan","kyrgyz"], lat: 42.8746, lon: 74.5698, name: "Kyrgyzstan", region: "Central Asia" },
  "tj": { patterns: ["tajikistan","tajik"], lat: 38.5598, lon: 68.7740, name: "Tajikistan", region: "Central Asia" },
  "tm": { patterns: ["turkmenistan","turkmen"], lat: 37.9601, lon: 58.3261, name: "Turkmenistan", region: "Central Asia" },
  "ht": { patterns: ["haiti","haitian"], lat: 18.5944, lon: -72.3074, name: "Haiti", region: "Caribbean" },
  "cu": { patterns: ["cuba","cuban"], lat: 23.1136, lon: -82.3666, name: "Cuba", region: "Caribbean" },
  "co": { patterns: ["colombia","colombian","farc","eln "], lat: 4.7110, lon: -74.0721, name: "Colombia", region: "South America" },
  "ve": { patterns: ["venezuela","venezuelan","maduro"], lat: 10.4806, lon: -66.9036, name: "Venezuela", region: "South America" },
  "mx": { patterns: ["mexico","mexican","cartel"], lat: 19.4326, lon: -99.1332, name: "Mexico", region: "North America" },
  "us": { patterns: ["united states","u.s.","pentagon","white house","trump","biden"], lat: 38.9072, lon: -77.0369, name: "United States", region: "North America" },
  "by": { patterns: ["belarus","belarusian","lukashenko"], lat: 53.9045, lon: 27.5615, name: "Belarus", region: "Europe" },
  "au": { patterns: ["australia","australian"], lat: -35.2809, lon: 149.1300, name: "Australia", region: "Oceania" },
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function prettyCity(key: string): string {
  return key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface GeoResult {
  lat: number; lon: number; country: string; region: string; confidence: number; city: string | null;
}

function geolocate(title: string, desc: string): GeoResult {
  const text = `${title} ${desc}`.toLowerCase();
  const sorted = Object.keys(CITIES).sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      const c = CITIES[city];
      const seed = hashStr(title);
      const micro = 0.002;
      const dx = ((seed % 1000) / 1000 - 0.5) * micro;
      const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * micro;
      return { lat: c.lat + dy, lon: c.lon + dx, country: c.country, region: c.region, confidence: 0.95, city: prettyCity(city) };
    }
  }
  for (const [, info] of Object.entries(COUNTRY_PATTERNS)) {
    if (info.patterns.some(p => text.includes(p))) {
      const seed = hashStr(title + info.name);
      const micro = 0.5;
      const dx = ((seed % 1000) / 1000 - 0.5) * micro;
      const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * micro;
      return { lat: info.lat + dy, lon: info.lon + dx, country: info.name, region: info.region, confidence: 0.6, city: null };
    }
  }
  // Fallback: scatter globally
  const seed = hashStr(title);
  const dx = ((seed % 1000) / 1000 - 0.5) * 30;
  const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * 30;
  return { lat: 20 + dy, lon: 0 + dx, country: "International", region: "Global", confidence: 0.5, city: null };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 3 — PARSERS                                               ║
// ╚══════════════════════════════════════════════════════════════════╝
function parseRss(xml: string, sourceName: string, credibility: "high" | "medium" | "low"): RawArticle[] {
  const items: RawArticle[] = [];
  const rssMatches = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
  const atomMatches = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) || [];
  const matches = rssMatches.length > 0 ? rssMatches : atomMatches;

  for (const raw of matches.slice(0, 30)) {
    const titleM = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descM = raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
      || raw.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
    const linkM = raw.match(/<link[^>]*href="([^"]+)"/i) || raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateM = raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
      || raw.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
      || raw.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);

    const title = (titleM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const desc = (descM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const url = (linkM?.[1] || "").trim();
    const rawDate = (dateM?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const parsed = new Date(rawDate);
    const pubDate = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();

    if (title && url) {
      items.push({ title, description: desc.substring(0, 2000), url, sourceName, publishedAt: pubDate, sourceCredibility: credibility, sourceType: "rss" });
    }
  }
  return items;
}

function parseTelegramHtml(html: string, channelName: string, displayName: string): RawArticle[] {
  const items: RawArticle[] = [];
  const msgBlocks = html.match(/<div class="tgme_widget_message_wrap[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];

  for (const block of msgBlocks.slice(0, 20)) {
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
          title, description: rawText.substring(0, 1000), url,
          sourceName: `TG: ${displayName}`, publishedAt: pubDate,
          sourceCredibility: "low", sourceType: "telegram",
        });
      }
    }
  }
  return items;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 4 — UTILITY: chunked parallel execution                   ║
// ╚══════════════════════════════════════════════════════════════════╝
async function runInChunks<T>(
  tasks: (() => Promise<T>)[],
  chunkSize: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize).map(fn => fn());
    const settled = await Promise.allSettled(chunk);
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 4B — NASA EONET REAL-TIME NATURAL EVENTS                  ║
// ║  https://eonet.gsfc.nasa.gov/api/v3/events/geojson                ║
// ║  Active disasters in the last 24h: wildfires, severe storms,     ║
// ║  volcanoes, earthquakes, floods, landslides.                     ║
// ╚══════════════════════════════════════════════════════════════════╝
interface EonetRow {
  title: string;
  summary: string;
  url: string;
  source: string;
  source_credibility: "high";
  published_at: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  city: string | null;
  tags: string[];
  confidence_score: number;
  confidence_level: "verified";
  threat_level: "critical" | "high" | "elevated" | "low";
  actor_type: "organization";
  category: string;
  user_id: string;
}

function eonetCategoryMap(catId: string): { category: string; threat: "critical" | "high" | "elevated" | "low"; tag: string } {
  const c = (catId || "").toLowerCase();
  if (c.includes("wildfire")) return { category: "humanitarian", threat: "high", tag: "wildfire" };
  if (c.includes("severestorm") || c.includes("storm")) return { category: "humanitarian", threat: "high", tag: "severe-storm" };
  if (c.includes("volcano")) return { category: "humanitarian", threat: "critical", tag: "volcano" };
  if (c.includes("earthquake")) return { category: "humanitarian", threat: "critical", tag: "earthquake" };
  if (c.includes("flood")) return { category: "humanitarian", threat: "high", tag: "flood" };
  if (c.includes("landslide")) return { category: "humanitarian", threat: "high", tag: "landslide" };
  if (c.includes("drought")) return { category: "humanitarian", threat: "elevated", tag: "drought" };
  if (c.includes("ice") || c.includes("snow")) return { category: "humanitarian", threat: "elevated", tag: "ice-snow" };
  return { category: "humanitarian", threat: "elevated", tag: "natural-event" };
}

function reverseGeoLookup(lat: number, lon: number): { country: string; region: string; city: string | null } {
  // Coarse reverse-geo using existing CITIES table — find nearest known city within ~3°
  let best: { name: string; d: number; info: { lat: number; lon: number; country: string; region: string } } | null = null;
  for (const [name, info] of Object.entries(CITIES)) {
    const d = Math.abs(info.lat - lat) + Math.abs(info.lon - lon);
    if (d < 3 && (!best || d < best.d)) best = { name, d, info };
  }
  if (best) return { country: best.info.country, region: best.info.region, city: prettyCity(best.name) };
  // Fallback by lon/lat region buckets
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

async function fetchEonetEvents(userId: string): Promise<EonetRow[]> {
  // Try 24h first (most "real-time"); if empty, fall back to all currently open events.
  const urls = [
    "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=1&limit=200",
    "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=20&limit=200",
  ];
  let features: any[] = [];
  try {
    for (const url of urls) {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) { console.error(`[EONET] HTTP ${resp.status} ${url}`); continue; }
      const data = await resp.json();
      const f: any[] = Array.isArray(data?.features) ? data.features : [];
      if (f.length > 0) { features = f; console.log(`[EONET] ${f.length} features from ${url}`); break; }
    }
  } catch (e) {
    console.error(`[EONET] Fetch error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  try {
    const out: EonetRow[] = [];
    for (const f of features) {
      const props = f?.properties || {};
      const geom = f?.geometry || {};
      // Extract a representative coordinate (point or first poly vertex)
      let lat: number | null = null, lon: number | null = null;
      const flatten = (g: any): number[][] => {
        if (!g) return [];
        if (g.type === "Point" && Array.isArray(g.coordinates)) return [g.coordinates];
        if (g.type === "Polygon") return (g.coordinates?.[0] || []);
        if (g.type === "MultiPolygon") return (g.coordinates?.[0]?.[0] || []);
        if (g.type === "GeometryCollection") return (g.geometries || []).flatMap(flatten);
        return [];
      };
      const coords = flatten(geom);
      if (coords.length > 0) {
        const [x, y] = coords[0];
        if (Number.isFinite(x) && Number.isFinite(y)) { lon = x; lat = y; }
      }
      if (lat === null || lon === null) continue;

      const catArr: any[] = Array.isArray(props.categories) ? props.categories : [];
      const catId: string = catArr[0]?.id || catArr[0]?.title || "";
      // Skip iceberg / sea & lake ice events — not relevant intel
      const catLower = String(catId).toLowerCase();
      const titleLower = String(props.title || "").toLowerCase();
      if (
        catLower.includes("ice") ||
        catLower.includes("sealakeice") ||
        titleLower.includes("iceberg")
      ) continue;
      const map = eonetCategoryMap(String(catId));

      const sources: any[] = Array.isArray(props.sources) ? props.sources : [];
      const primarySource = sources[0]?.url || `https://eonet.gsfc.nasa.gov/api/v3/events/${props.id}`;
      const sourceName = sources[0]?.id ? `NASA EONET / ${sources[0].id}` : "NASA EONET";

      const title: string = (props.title || "Natural Event").substring(0, 500);
      const date: string = props.date || new Date().toISOString();
      const geo = reverseGeoLookup(lat, lon);
      const summary = `Active ${map.tag.replace("-", " ")} event detected by NASA EONET. Category: ${catArr[0]?.title || "Natural Event"}. Location: ${geo.city || geo.country}. Source: ${sourceName}.`;

      out.push({
        title,
        summary: summary.substring(0, 2000),
        url: String(primarySource).substring(0, 2000),
        source: sourceName.substring(0, 200),
        source_credibility: "high",
        published_at: date,
        lat, lon,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        tags: ["natural-disaster", map.tag, "eonet"],
        confidence_score: 0.98,
        confidence_level: "verified",
        threat_level: map.threat,
        actor_type: "organization",
        category: map.category,
        user_id: userId,
      });
    }
    console.log(`[EONET] Collected ${out.length} active natural events`);
    return out;
  } catch (e) {
    console.error(`[EONET] Parse error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 5 — MAIN HANDLER                                          ║
// ╚══════════════════════════════════════════════════════════════════╝
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── FIX #1: Use getUser() instead of deprecated getClaims() ──
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");

    let userId: string;
    // deno-lint-ignore no-explicit-any
    let dbClient: any;

    const { data: userData, error: userError } = await userClient.auth.getUser(token);

    if (userError || !userData?.user) {
      // Fallback: allow service-role / anon key callers (e.g. cron jobs)
      if (token === supabaseAnonKey || token === supabaseServiceKey) {
        dbClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: analysts } = await dbClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "analyst")
          .limit(1);
        userId = (analysts as Array<{ user_id: string }> | null)?.[0]?.user_id as string;
        if (!userId) {
          return new Response(JSON.stringify({ error: "No analyst user found" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = userData.user.id;
      dbClient = userClient;
    }

    console.log(`[OSINT] Starting collection for user: ${userId}`);
    const startTime = Date.now();
    const errors: string[] = [];
    const sourceStats: Record<string, number> = {};

    // ─────────────────────────────────────────────────────────────
    // FIX #2: CHUNKED RSS fetching — 15 concurrent max
    // Each feed gets a 6s timeout (was 12s)
    // ─────────────────────────────────────────────────────────────
    const rssTasks = RSS_SOURCES.map(src => async (): Promise<RawArticle[]> => {
      try {
        const resp = await fetch(src.url, {
          headers: { Accept: "application/rss+xml, application/xml, application/atom+xml, text/xml, */*" },
          signal: AbortSignal.timeout(6000), // FIX: was 12000
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

    // ─────────────────────────────────────────────────────────────
    // TELEGRAM: chunked fetching — 10 concurrent max
    // ─────────────────────────────────────────────────────────────
    const telegramTasks = TELEGRAM_CHANNELS.map(ch => async (): Promise<RawArticle[]> => {
      try {
        const resp = await fetch(`https://t.me/s/${ch.channel}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; OsintBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { errors.push(`TG:${ch.name}: HTTP ${resp.status}`); return []; }
        const html = await resp.text();
        const items = parseTelegramHtml(html, ch.channel, ch.name);
        // Tag with region
        for (const it of items) it.sourceType = `telegram-${ch.region.toLowerCase().replace(/\s+/g, "-")}`;
        sourceStats[`TG:${ch.name}`] = items.length;
        return items;
      } catch (e) {
        errors.push(`TG:${ch.name}: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }
    });

    // ─────────────────────────────────────────────────────────────
    // CITY QUERIES: rotate through all cities in batches of 25/cycle
    // Each cycle covers a different slice → full coverage over time
    // ─────────────────────────────────────────────────────────────
    const CITIES_PER_CYCLE = 25;
    const totalCycles = Math.ceil(CITY_QUERY_TARGETS.length / CITIES_PER_CYCLE);
    const cycleSlot = Math.floor(Date.now() / 60000) % totalCycles;
    const cityBatch = CITY_QUERY_TARGETS.slice(cycleSlot * CITIES_PER_CYCLE, cycleSlot * CITIES_PER_CYCLE + CITIES_PER_CYCLE);
    console.log(`[CITY] Cycle ${cycleSlot + 1}/${totalCycles}, querying: ${cityBatch.join(", ")}`);

    const googleNewsCityTask = (city: string) => async (): Promise<RawArticle[]> => {
      try {
        const q = encodeURIComponent(`"${city}" ${CITY_SECURITY_CLAUSE}`);
        const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; OsintBot/1.0)" },
          signal: AbortSignal.timeout(7000),
        });
        if (!resp.ok) return [];
        const xml = await resp.text();
        const items = parseRss(xml, `Google News: ${city}`, "medium");
        for (const it of items) it.sourceType = "googlenews-city";
        sourceStats[`GN:${city}`] = items.length;
        return items.slice(0, 5);
      } catch { return []; }
    };

    const cityTasks = cityBatch.map(c => googleNewsCityTask(c));

    // ─────────────────────────────────────────────────────────────
    // FIX #3: Run all collector groups in chunked parallel batches
    // This prevents the 130+ simultaneous requests that killed runtime
    // ─────────────────────────────────────────────────────────────
    const [rssResults, telegramResults, cityResults, eonetRows] = await Promise.all([
      runInChunks(rssTasks, 15),       // RSS: 15 at a time
      runInChunks(telegramTasks, 10),  // Telegram: 10 at a time
      runInChunks(cityTasks, 10),      // City: 10 at a time
      fetchEonetEvents(userId),        // NASA EONET real-time disasters
    ]);

    // ─────────────────────────────────────────────────────────────
    // FIX #4: Filter BEFORE accumulating — never hold all raw in memory
    // Process each batch's results immediately
    // ─────────────────────────────────────────────────────────────
    const allRaw = [...rssResults, ...telegramResults, ...cityResults];
    console.log(`[OSINT] Total raw articles: ${allRaw.length}`);

    // Filter relevance immediately
    const relevant = allRaw.filter(a => isOsintRelevant(a.title, a.description));
    console.log(`[FILTER] OSINT relevant: ${relevant.length}/${allRaw.length}`);

    // Freshness filter (≤24h)
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const fresh = relevant.filter(a => {
      const t = Date.parse(a.publishedAt);
      if (!Number.isFinite(t)) return false;
      if (t > nowMs + 60 * 60 * 1000) return false; // skip future-dated
      return nowMs - t <= MAX_AGE_MS;
    });
    console.log(`[FILTER] Fresh (≤24h): ${fresh.length}/${relevant.length}`);

    // Fingerprint
    for (const a of fresh) {
      a.fingerprint = await makeFingerprint(a.title, a.url);
    }

    // In-batch dedupe
    const seen = new Set<string>();
    const seenTitles = new Set<string>();
    const deduped: RawArticle[] = [];
    for (const a of fresh) {
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

    const newItems = deduped
      .filter(a => !existingUrls.has(normalizeUrl(a.url)) && !existingTitles.has(normalizeTitle(a.title)))
      .slice(0, 100);

    console.log(`[DEDUPE] New after DB check: ${newItems.length}`);

    // ─────────────────────────────────────────────────────────────
    // FIX #5: Stream inserts in batches of 20 instead of one giant batch
    // Partial results survive if the function is killed near deadline
    // ─────────────────────────────────────────────────────────────
    let inserted = 0;
    const INSERT_BATCH = 20;

    const rows = newItems
      .map(a => {
        const geo = geolocate(a.title, a.description);
        if (geo.confidence < 0.5) return null;
        const threat = detectThreat(a.title, a.description);
        const category = detectCategory(a.title, a.description);
        const tags = extractTags(a.title, a.description);
        if (!tags.includes(a.sourceType)) tags.push(a.sourceType.split("-")[0]);
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
          city: geo.city,
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

    console.log(`[GEO] Items after geolocation filter: ${rows.length}/${newItems.length}`);

    // ─── EONET dedupe by URL against existing news_items ───
    const eonetNew = eonetRows.filter(r => !existingUrls.has(normalizeUrl(r.url)));
    console.log(`[EONET] New after dedupe: ${eonetNew.length}/${eonetRows.length}`);
    const allRows = [...rows, ...eonetNew];

    for (let i = 0; i < allRows.length; i += INSERT_BATCH) {
      const batch = allRows.slice(i, i + INSERT_BATCH);
      const { data: insertedData, error: insertError } = await adminClient
        .from("news_items")
        .insert(batch)
        .select("id");
      if (insertError) {
        console.error(`[INSERT] Batch ${i}-${i + INSERT_BATCH} error: ${insertError.message}`);
      } else {
        inserted += insertedData?.length || 0;
      }
    }

    const elapsed = Date.now() - startTime;
    const activeSources = Object.keys(sourceStats).length;
    console.log(`[OSINT] Done: ${inserted} inserted from ${activeSources} sources in ${elapsed}ms`);

    return new Response(JSON.stringify({
      success: true,
      fetched: allRaw.length,
      osint_filtered: relevant.length,
      fresh: fresh.length,
      deduped: deduped.length,
      inserted,
      eonet_events: eonetRows.length,
      eonet_new: eonetNew.length,
      active_sources: activeSources,
      elapsed_ms: elapsed,
      city_cycle: `${cycleSlot + 1}/${totalCycles}`,
      source_errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      message: `${allRaw.length} fetched → ${relevant.length} relevant → ${deduped.length} deduped → ${inserted} inserted in ${elapsed}ms`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[OSINT] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
