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
  sourceType: string;
  fingerprint?: string;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 1A — RSS SOURCE DEFINITIONS (90+ feeds, global coverage)  ║
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
  { name: "The New Arab", url: "https://www.newarab.com/rss.xml", credibility: "medium", priority: 2 },
  { name: "Morocco World News", url: "https://www.moroccoworldnews.com/feed/", credibility: "medium", priority: 3 },

  // ── TIER 2: Europe & Eurasia ──
  { name: "Kyiv Independent", url: "https://kyivindependent.com/feed/", credibility: "medium", priority: 1 },
  { name: "Moscow Times", url: "https://www.themoscowtimes.com/rss/news", credibility: "medium", priority: 2 },
  { name: "Balkan Insight", url: "https://balkaninsight.com/feed/", credibility: "medium", priority: 3 },
  { name: "EU Observer", url: "https://euobserver.com/rss.xml", credibility: "high", priority: 3 },
  { name: "TASS English", url: "https://tass.com/rss/v2.xml", credibility: "low", priority: 3 },
  { name: "Radio Free Europe", url: "https://www.rferl.org/api/z-pqpiev-qpp", credibility: "medium", priority: 2 },

  // ── CENTRAL ASIA & CAUCASUS (NEW) ──
  { name: "Eurasianet", url: "https://eurasianet.org/rss.xml", credibility: "high", priority: 2 },
  { name: "OC Media", url: "https://oc-media.org/feed/", credibility: "medium", priority: 2 },
  { name: "Jam News", url: "https://jam-news.net/feed/", credibility: "medium", priority: 3 },
  { name: "Caravanserai", url: "https://caravanserai.com/feed/", credibility: "medium", priority: 3 },
  { name: "Kazinform", url: "https://www.inform.kz/en/rss", credibility: "medium", priority: 3 },
  { name: "Asia-Plus Tajikistan", url: "https://asiaplustj.info/en/rss.xml", credibility: "medium", priority: 3 },
  { name: "Kabar Kyrgyzstan", url: "https://kabar.kg/eng/rss/", credibility: "medium", priority: 3 },
  { name: "Trend Azerbaijan", url: "https://en.trend.az/rss", credibility: "medium", priority: 3 },
  { name: "Georgia Today", url: "https://georgiatoday.ge/rss", credibility: "medium", priority: 3 },
  { name: "Turkmen News", url: "https://en.turkmen.news/rss.xml", credibility: "low", priority: 3 },

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

  // ── PACIFIC ISLANDS (NEW) ──
  { name: "RNZ Pacific", url: "https://www.rnz.co.nz/rss/pacific.rss", credibility: "high", priority: 1 },
  { name: "Islands Business", url: "https://islandsbusiness.com/feed/", credibility: "medium", priority: 2 },
  { name: "Pacific Beat ABC", url: "https://www.abc.net.au/pacific/feed/51/rss.xml", credibility: "high", priority: 2 },
  { name: "Devpolicy Blog", url: "https://devpolicy.org/feed/", credibility: "high", priority: 3 },
  { name: "Fiji Times", url: "https://www.fijitimes.com/feed/", credibility: "medium", priority: 3 },
  { name: "PNG Post-Courier", url: "https://www.postcourier.com.pg/feed/", credibility: "medium", priority: 2 },
  { name: "Solomon Star", url: "https://www.solomonstarnews.com/feed/", credibility: "medium", priority: 3 },
  { name: "Vanuatu Daily Post", url: "https://www.dailypost.vu/feed/", credibility: "medium", priority: 3 },
  { name: "Samoa Observer", url: "https://www.samoaobserver.ws/feed/", credibility: "medium", priority: 3 },
  { name: "Pacific Guardian", url: "https://pacificguardian.com/feed/", credibility: "medium", priority: 3 },

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

  // ── CENTRAL & WEST AFRICA / SAHEL (NEW) ──
  { name: "RFI Afrique (EN)", url: "https://www.rfi.fr/en/africa/rss", credibility: "high", priority: 1 },
  { name: "Africa Report", url: "https://www.theafricareport.com/feed/", credibility: "high", priority: 2 },
  { name: "Jeune Afrique", url: "https://www.jeuneafrique.com/feed/", credibility: "medium", priority: 2 },
  { name: "VOA Africa", url: "https://www.voanews.com/api/zmpqmev_pq", credibility: "high", priority: 1 },
  { name: "Africa Confidential", url: "https://www.africa-confidential.com/rss", credibility: "high", priority: 2 },
  { name: "AllAfrica", url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", credibility: "medium", priority: 2 },
  { name: "The East African", url: "https://www.theeastafrican.co.ke/tea/rss", credibility: "medium", priority: 2 },
  { name: "Business Day Nigeria", url: "https://businessday.ng/feed/", credibility: "medium", priority: 3 },
  { name: "Sahel Intelligence", url: "https://sahel-intelligence.com/feed/", credibility: "medium", priority: 2 },
  { name: "West Africa Weekly", url: "https://www.westafricaweekly.com/feed/", credibility: "medium", priority: 3 },
  { name: "Congo Research Group", url: "https://www.congoresearchgroup.org/feed/", credibility: "high", priority: 3 },
  { name: "Horn of Africa Hub", url: "https://hornofafrica.net/feed/", credibility: "medium", priority: 3 },

  // ── TIER 2: Africa (existing) ──
  { name: "Africanews", url: "https://www.africanews.com/feed/", credibility: "medium", priority: 2 },
  { name: "Daily Maverick", url: "https://www.dailymaverick.co.za/dmrss/", credibility: "medium", priority: 3 },
  { name: "Punch Nigeria", url: "https://punchng.com/feed/", credibility: "medium", priority: 3 },

  // ── CARIBBEAN & CENTRAL AMERICA (NEW) ──
  { name: "Caribbean Journal", url: "https://caribjournal.com/feed/", credibility: "medium", priority: 2 },
  { name: "El Faro", url: "https://elfaro.net/rss", credibility: "high", priority: 2 },
  { name: "Prensa Libre", url: "https://www.prensalibre.com/feeds/rss/", credibility: "medium", priority: 2 },
  { name: "La Prensa Honduras", url: "https://www.laprensa.hn/feed/", credibility: "medium", priority: 3 },
  { name: "Haiti Liberte", url: "https://haitiliberte.com/feed/", credibility: "low", priority: 3 },
  { name: "Gleaner Jamaica", url: "https://jamaica-gleaner.com/feeds/latest", credibility: "medium", priority: 3 },
  { name: "Trinidad Guardian", url: "https://www.guardian.co.tt/feed/", credibility: "medium", priority: 3 },
  { name: "Barbados Today", url: "https://barbadostoday.bb/feed/", credibility: "medium", priority: 3 },
  { name: "Caribbean360", url: "https://www.caribbean360.com/feed", credibility: "medium", priority: 2 },
  { name: "InSight Crime", url: "https://insightcrime.org/feed/", credibility: "high", priority: 2 },

  // ── ARCTIC / POLAR (NEW) ──
  { name: "High North News", url: "https://www.highnorthnews.com/en/rss.xml", credibility: "high", priority: 2 },
  { name: "Arctic Today", url: "https://www.arctictoday.com/feed/", credibility: "high", priority: 2 },
  { name: "Barents Observer", url: "https://thebarentsobserver.com/en/rss.xml", credibility: "high", priority: 2 },
  { name: "Eye on the Arctic", url: "https://www.rcinet.ca/eye-on-the-arctic/feed/", credibility: "medium", priority: 3 },
  { name: "Arctic Now", url: "https://arcticnow.com/feed/", credibility: "medium", priority: 3 },

  // ── TIER 2: Americas ──
  { name: "MercoPress", url: "https://en.mercopress.com/rss", credibility: "medium", priority: 3 },
  { name: "Latin America Reports", url: "https://latinamericareports.com/feed/", credibility: "medium", priority: 3 },
  { name: "El Pais America", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada", credibility: "high", priority: 2 },
  { name: "Colombia Reports", url: "https://colombiareports.com/feed/", credibility: "medium", priority: 3 },

  // ── TIER 2: Humanitarian & crisis ──
  { name: "ReliefWeb", url: "https://reliefweb.int/updates/rss.xml", credibility: "high", priority: 2 },
  { name: "UNHCR News", url: "https://www.unhcr.org/rss/news.xml", credibility: "high", priority: 2 },
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml", credibility: "high", priority: 3 },
  { name: "OCHA Situation Reports", url: "https://reliefweb.int/updates/rss.xml?primary_country=0", credibility: "high", priority: 2 },
  { name: "MSF", url: "https://www.msf.org/rss/all", credibility: "high", priority: 3 },
  { name: "ICRC", url: "https://www.icrc.org/en/rss/news", credibility: "high", priority: 3 },

  // ── TIER 2: Think tanks & analysis ──
  { name: "CSIS", url: "https://www.csis.org/analysis/feed", credibility: "high", priority: 3 },
  { name: "Brookings", url: "https://www.brookings.edu/feed/", credibility: "high", priority: 3 },
  { name: "RAND Corp", url: "https://www.rand.org/blog.xml", credibility: "high", priority: 3 },
  { name: "Chatham House", url: "https://www.chathamhouse.org/rss", credibility: "high", priority: 3 },
  { name: "Carnegie", url: "https://carnegieendowment.org/rss/solr/?lang=en", credibility: "high", priority: 3 },
  { name: "International Crisis Group", url: "https://www.crisisgroup.org/rss", credibility: "high", priority: 2 },
  { name: "ACLED", url: "https://acleddata.com/feed/", credibility: "high", priority: 2 },
  { name: "SIPRI", url: "https://www.sipri.org/rss.xml", credibility: "high", priority: 3 },

  // ── TIER 3: Government travel advisories ──
  { name: "US State Dept Travel", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.rss.xml", credibility: "high", priority: 1 },
  { name: "UK FCDO Travel", url: "https://www.gov.uk/foreign-travel-advice.atom", credibility: "high", priority: 1 },
  { name: "Australia DFAT", url: "https://www.smartraveller.gov.au/api/rss", credibility: "high", priority: 1 },
  { name: "Canada Travel", url: "https://travel.gc.ca/travelling/advisories.rss", credibility: "high", priority: 1 },
  { name: "New Zealand SAFETRAVEL", url: "https://safetravel.govt.nz/rss", credibility: "high", priority: 1 },
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
  "yellow fever","measles outbreak","mers","sars","novel virus","quarantine",
  "health alert","disease outbreak","contaminated water","food poisoning outbreak",
  "earthquake","tsunami","volcanic eruption","volcano erupts","ash cloud","wildfire",
  "bushfire","hurricane","typhoon","cyclone","tropical storm","flash flood","flooding",
  "landslide","mudslide","blizzard","ice storm","heatwave","sandstorm","snowstorm",
  "power outage","blackout","water shortage","fuel shortage","internet shutdown",
  "communications blackout","cyber attack on airport","cyber attack on airline",
  "ransomware airline","ransomware hotel",
  // Arctic/polar specific
  "polar vortex","arctic blast","ice storm warning","whiteout conditions",
  "icebreaker","polar route closure",
  // Pacific island specific
  "cyclone warning","tsunami warning","volcanic alert","evacuation order island",
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
  "treaty signed","summit concludes","bilateral talks","trade deal","trade war",
  "tariff","sanctions package","embargo announced","wto","g7","g20","brics summit",
  "foreign minister meets","ambassador appointed","un general assembly",
  "election results","campaign rally","parliamentary debate","budget bill",
  "central bank","interest rate","inflation report","gdp growth",
  "arms deal","weapons contract","defense budget","fighter jet purchase",
  "submarine deal","aircraft carrier launched","military exercise","joint drill",
  "war games","naval drill","training exercise",
];

const HARD_EXCLUDE_KW = [
  "comeback","made a comeback","in recent years","over the years","decade ago",
  "looking back","retrospective","history of","origins of","explained:","explainer",
  "analysis:","commentary","opinion:","op-ed","editorial","feature:",
  "what we know about","everything you need","here's why","why the","timeline of",
  "anniversary","remembering","throwback",
  "will be modified","will replace","replacing aging","upgrade program","procurement",
  "contract awarded","fleet upgrade","modernization program","airframe","prototype",
  "delivered to","handed over to","commissioned","decommissioned","retired from service",
  "vip airlift","government ops","helicopter program","jet program","weapons system",
  "next-generation fighter","new variant","unveiled","rollout",
  "best places","top 10","ranked:","review:","guide to","how to visit",
  "things to do","destination guide","travel tips","travel guide",
  "white paper","policy brief","think tank","academic study","research finds",
  "report says","study suggests","poll shows","survey finds",
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
const ELEVATED_KW = ["tension","protest","sanctions","warning","dispute","standoff","diplomatic crisis","border incident","military exercise","travel advisory","heightened alert","cyber attack","disinformation","propaganda","arms deal","troop movement","naval exercise"];

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
    "arctic","pacific","sahel","caucasus","caribbean",
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
// ║  LAYER 2C — GEOLOCATION ENGINE (800+ locations, global coverage) ║
// ╚══════════════════════════════════════════════════════════════════╝
const CITIES: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  // ── USA ──
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
  "anchorage": { lat: 61.2181, lon: -149.9003, country: "United States", region: "North America" },
  "honolulu": { lat: 21.3069, lon: -157.8583, country: "United States", region: "North America" },
  // ── Canada ──
  "ottawa": { lat: 45.4215, lon: -75.6972, country: "Canada", region: "North America" },
  "toronto": { lat: 43.6532, lon: -79.3832, country: "Canada", region: "North America" },
  "vancouver": { lat: 49.2827, lon: -123.1207, country: "Canada", region: "North America" },
  "montreal": { lat: 45.5017, lon: -73.5673, country: "Canada", region: "North America" },
  "yellowknife": { lat: 62.4540, lon: -114.3718, country: "Canada", region: "Arctic" },
  "whitehorse": { lat: 60.7212, lon: -135.0568, country: "Canada", region: "Arctic" },
  "iqaluit": { lat: 63.7467, lon: -68.5170, country: "Canada", region: "Arctic" },
  // ── UK ──
  "london": { lat: 51.5074, lon: -0.1278, country: "United Kingdom", region: "Europe" },
  "manchester": { lat: 53.4808, lon: -2.2426, country: "United Kingdom", region: "Europe" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, country: "United Kingdom", region: "Europe" },
  "birmingham": { lat: 52.4862, lon: -1.8904, country: "United Kingdom", region: "Europe" },
  "glasgow": { lat: 55.8642, lon: -4.2518, country: "United Kingdom", region: "Europe" },
  "belfast": { lat: 54.5973, lon: -5.9301, country: "United Kingdom", region: "Europe" },
  "downing street": { lat: 51.5034, lon: -0.1276, country: "United Kingdom", region: "Europe" },
  // ── Europe ──
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
  "tbilisi": { lat: 41.7151, lon: 44.8271, country: "Georgia", region: "Caucasus" },
  "yerevan": { lat: 40.1792, lon: 44.4991, country: "Armenia", region: "Caucasus" },
  "baku": { lat: 40.4093, lon: 49.8671, country: "Azerbaijan", region: "Caucasus" },
  "minsk": { lat: 53.9045, lon: 27.5615, country: "Belarus", region: "Europe" },
  "reykjavik": { lat: 64.1265, lon: -21.8174, country: "Iceland", region: "Arctic" },
  "nuuk": { lat: 64.1836, lon: -51.7214, country: "Greenland", region: "Arctic" },
  "tromsø": { lat: 69.6489, lon: 18.9551, country: "Norway", region: "Arctic" },
  "murmansk": { lat: 68.9585, lon: 33.0827, country: "Russia", region: "Arctic" },
  // ── Ukraine ──
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
  // ── Russia ──
  "moscow": { lat: 55.7558, lon: 37.6173, country: "Russia", region: "Europe" },
  "st petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "kremlin": { lat: 55.7520, lon: 37.6175, country: "Russia", region: "Europe" },
  "novosibirsk": { lat: 55.0084, lon: 82.9357, country: "Russia", region: "Asia" },
  "vladivostok": { lat: 43.1155, lon: 131.8855, country: "Russia", region: "Asia" },
  "grozny": { lat: 43.3180, lon: 45.6987, country: "Russia", region: "Caucasus" },
  "sevastopol": { lat: 44.6166, lon: 33.5254, country: "Crimea", region: "Europe" },
  "simferopol": { lat: 44.9572, lon: 34.1108, country: "Crimea", region: "Europe" },
  // ── Middle East ──
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
  // ── Asia ──
  "beijing": { lat: 39.9042, lon: 116.4074, country: "China", region: "Asia" },
  "shanghai": { lat: 31.2304, lon: 121.4737, country: "China", region: "Asia" },
  "hong kong": { lat: 22.3193, lon: 114.1694, country: "China", region: "Asia" },
  "guangzhou": { lat: 23.1291, lon: 113.2644, country: "China", region: "Asia" },
  "shenzhen": { lat: 22.5431, lon: 114.0579, country: "China", region: "Asia" },
  "chengdu": { lat: 30.5728, lon: 104.0668, country: "China", region: "Asia" },
  "xinjiang": { lat: 43.7937, lon: 87.6311, country: "China", region: "Asia" },
  "lhasa": { lat: 29.6516, lon: 91.1721, country: "China", region: "Asia" },
  "urumqi": { lat: 43.8256, lon: 87.6168, country: "China", region: "Asia" },
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
  "bengaluru": { lat: 12.9716, lon: 77.5946, country: "India", region: "Asia" },
  "bangalore": { lat: 12.9716, lon: 77.5946, country: "India", region: "Asia" },
  "hyderabad": { lat: 17.3850, lon: 78.4867, country: "India", region: "Asia" },
  "ahmedabad": { lat: 23.0225, lon: 72.5714, country: "India", region: "Asia" },
  "pune": { lat: 18.5204, lon: 73.8567, country: "India", region: "Asia" },
  "surat": { lat: 21.1702, lon: 72.8311, country: "India", region: "Asia" },
  "jaipur": { lat: 26.9124, lon: 75.7873, country: "India", region: "Asia" },
  "lucknow": { lat: 26.8467, lon: 80.9462, country: "India", region: "Asia" },
  "kanpur": { lat: 26.4499, lon: 80.3319, country: "India", region: "Asia" },
  "nagpur": { lat: 21.1458, lon: 79.0882, country: "India", region: "Asia" },
  "indore": { lat: 22.7196, lon: 75.8577, country: "India", region: "Asia" },
  "bhopal": { lat: 23.2599, lon: 77.4126, country: "India", region: "Asia" },
  "patna": { lat: 25.5941, lon: 85.1376, country: "India", region: "Asia" },
  "vadodara": { lat: 22.3072, lon: 73.1812, country: "India", region: "Asia" },
  "ludhiana": { lat: 30.9010, lon: 75.8573, country: "India", region: "Asia" },
  "agra": { lat: 27.1767, lon: 78.0081, country: "India", region: "Asia" },
  "varanasi": { lat: 25.3176, lon: 82.9739, country: "India", region: "Asia" },
  "amritsar": { lat: 31.6340, lon: 74.8723, country: "India", region: "Asia" },
  "chandigarh": { lat: 30.7333, lon: 76.7794, country: "India", region: "Asia" },
  "thiruvananthapuram": { lat: 8.5241, lon: 76.9366, country: "India", region: "Asia" },
  "kochi": { lat: 9.9312, lon: 76.2673, country: "India", region: "Asia" },
  "kozhikode": { lat: 11.2588, lon: 75.7804, country: "India", region: "Asia" },
  "coimbatore": { lat: 11.0168, lon: 76.9558, country: "India", region: "Asia" },
  "madurai": { lat: 9.9252, lon: 78.1198, country: "India", region: "Asia" },
  "tiruchirappalli": { lat: 10.7905, lon: 78.7047, country: "India", region: "Asia" },
  "visakhapatnam": { lat: 17.6868, lon: 83.2185, country: "India", region: "Asia" },
  "vijayawada": { lat: 16.5062, lon: 80.6480, country: "India", region: "Asia" },
  "guwahati": { lat: 26.1445, lon: 91.7362, country: "India", region: "Asia" },
  "shillong": { lat: 25.5788, lon: 91.8933, country: "India", region: "Asia" },
  "imphal": { lat: 24.8170, lon: 93.9368, country: "India", region: "Asia" },
  "agartala": { lat: 23.8315, lon: 91.2868, country: "India", region: "Asia" },
  "aizawl": { lat: 23.7271, lon: 92.7176, country: "India", region: "Asia" },
  "kohima": { lat: 25.6747, lon: 94.1086, country: "India", region: "Asia" },
  "itanagar": { lat: 27.0844, lon: 93.6053, country: "India", region: "Asia" },
  "gangtok": { lat: 27.3389, lon: 88.6065, country: "India", region: "Asia" },
  "ranchi": { lat: 23.3441, lon: 85.3096, country: "India", region: "Asia" },
  "raipur": { lat: 21.2514, lon: 81.6296, country: "India", region: "Asia" },
  "bhubaneswar": { lat: 20.2961, lon: 85.8245, country: "India", region: "Asia" },
  "cuttack": { lat: 20.4625, lon: 85.8828, country: "India", region: "Asia" },
  "dehradun": { lat: 30.3165, lon: 78.0322, country: "India", region: "Asia" },
  "shimla": { lat: 31.1048, lon: 77.1734, country: "India", region: "Asia" },
  "jammu": { lat: 32.7266, lon: 74.8570, country: "India", region: "Asia" },
  "leh": { lat: 34.1526, lon: 77.5770, country: "India", region: "Asia" },
  "panaji": { lat: 15.4909, lon: 73.8278, country: "India", region: "Asia" },
  "goa": { lat: 15.2993, lon: 74.1240, country: "India", region: "Asia" },
  "noida": { lat: 28.5355, lon: 77.3910, country: "India", region: "Asia" },
  "gurgaon": { lat: 28.4595, lon: 77.0266, country: "India", region: "Asia" },
  "gurugram": { lat: 28.4595, lon: 77.0266, country: "India", region: "Asia" },
  "faridabad": { lat: 28.4089, lon: 77.3178, country: "India", region: "Asia" },
  "ghaziabad": { lat: 28.6692, lon: 77.4538, country: "India", region: "Asia" },
  "meerut": { lat: 28.9845, lon: 77.7064, country: "India", region: "Asia" },
  "allahabad": { lat: 25.4358, lon: 81.8463, country: "India", region: "Asia" },
  "prayagraj": { lat: 25.4358, lon: 81.8463, country: "India", region: "Asia" },
  "ayodhya": { lat: 26.7922, lon: 82.1998, country: "India", region: "Asia" },
  "mathura": { lat: 27.4924, lon: 77.6737, country: "India", region: "Asia" },
  "rajkot": { lat: 22.3039, lon: 70.8022, country: "India", region: "Asia" },
  "jodhpur": { lat: 26.2389, lon: 73.0243, country: "India", region: "Asia" },
  "udaipur": { lat: 24.5854, lon: 73.7125, country: "India", region: "Asia" },
  "mysuru": { lat: 12.2958, lon: 76.6394, country: "India", region: "Asia" },
  "mangaluru": { lat: 12.9141, lon: 74.8560, country: "India", region: "Asia" },
  "manipal": { lat: 13.3475, lon: 74.7869, country: "India", region: "Asia" },
  "darjeeling": { lat: 27.0410, lon: 88.2663, country: "India", region: "Asia" },
  "siliguri": { lat: 26.7271, lon: 88.3953, country: "India", region: "Asia" },
  "pulwama": { lat: 33.8716, lon: 74.8946, country: "India", region: "Asia" },
  "anantnag": { lat: 33.7311, lon: 75.1487, country: "India", region: "Asia" },
  "baramulla": { lat: 34.2096, lon: 74.3436, country: "India", region: "Asia" },
  "uri": { lat: 34.0833, lon: 74.0500, country: "India", region: "Asia" },
  "kargil": { lat: 34.5539, lon: 76.1352, country: "India", region: "Asia" },
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "lahore": { lat: 31.5204, lon: 74.3587, country: "Pakistan", region: "Asia" },
  "peshawar": { lat: 34.0151, lon: 71.5249, country: "Pakistan", region: "Asia" },
  "quetta": { lat: 30.1798, lon: 66.9750, country: "Pakistan", region: "Asia" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Asia" },
  "kandahar": { lat: 31.6289, lon: 65.7372, country: "Afghanistan", region: "Asia" },
  "herat": { lat: 34.3529, lon: 62.2040, country: "Afghanistan", region: "Asia" },
  "mazar-i-sharif": { lat: 36.7069, lon: 67.1100, country: "Afghanistan", region: "Asia" },
  "jalalabad": { lat: 34.4415, lon: 70.4372, country: "Afghanistan", region: "Asia" },
  // ── Central Asia (NEW CITIES) ──
  "nur-sultan": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Central Asia" },
  "astana": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Central Asia" },
  "almaty": { lat: 43.2220, lon: 76.8512, country: "Kazakhstan", region: "Central Asia" },
  "shymkent": { lat: 42.3000, lon: 69.6000, country: "Kazakhstan", region: "Central Asia" },
  "tashkent": { lat: 41.2995, lon: 69.2401, country: "Uzbekistan", region: "Central Asia" },
  "samarkand": { lat: 39.6270, lon: 66.9750, country: "Uzbekistan", region: "Central Asia" },
  "bukhara": { lat: 39.7747, lon: 64.4286, country: "Uzbekistan", region: "Central Asia" },
  "fergana": { lat: 40.3864, lon: 71.7864, country: "Uzbekistan", region: "Central Asia" },
  "andijan": { lat: 40.7829, lon: 72.3442, country: "Uzbekistan", region: "Central Asia" },
  "bishkek": { lat: 42.8746, lon: 74.5698, country: "Kyrgyzstan", region: "Central Asia" },
  "osh": { lat: 40.5283, lon: 72.7985, country: "Kyrgyzstan", region: "Central Asia" },
  "dushanbe": { lat: 38.5598, lon: 68.7740, country: "Tajikistan", region: "Central Asia" },
  "khujand": { lat: 40.2864, lon: 69.6218, country: "Tajikistan", region: "Central Asia" },
  "gorno-badakhshan": { lat: 37.5000, lon: 73.0000, country: "Tajikistan", region: "Central Asia" },
  "ashgabat": { lat: 37.9601, lon: 58.3261, country: "Turkmenistan", region: "Central Asia" },
  "mary": { lat: 37.5932, lon: 61.8300, country: "Turkmenistan", region: "Central Asia" },
  "turkmenbashi": { lat: 40.0500, lon: 53.0000, country: "Turkmenistan", region: "Central Asia" },
  // ── Caucasus (NEW CITIES) ──
  "stepanakert": { lat: 39.8174, lon: 46.7514, country: "Nagorno-Karabakh", region: "Caucasus" },
  "nagorno-karabakh": { lat: 40.0000, lon: 46.5000, country: "Nagorno-Karabakh", region: "Caucasus" },
  "sumgait": { lat: 40.5897, lon: 49.6686, country: "Azerbaijan", region: "Caucasus" },
  "ganja": { lat: 40.6828, lon: 46.3606, country: "Azerbaijan", region: "Caucasus" },
  "kutaisi": { lat: 42.2679, lon: 42.6878, country: "Georgia", region: "Caucasus" },
  "batumi": { lat: 41.6168, lon: 41.6367, country: "Georgia", region: "Caucasus" },
  "sukhumi": { lat: 43.0015, lon: 41.0234, country: "Abkhazia", region: "Caucasus" },
  "tskhinvali": { lat: 42.2270, lon: 43.9718, country: "South Ossetia", region: "Caucasus" },
  "gyumri": { lat: 40.7942, lon: 43.8453, country: "Armenia", region: "Caucasus" },
  "vanadzor": { lat: 40.8128, lon: 44.4877, country: "Armenia", region: "Caucasus" },
  // ── ASEAN Cities ──
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Southeast Asia" },
  "chiang mai": { lat: 18.7883, lon: 98.9853, country: "Thailand", region: "Southeast Asia" },
  "phuket": { lat: 7.8804, lon: 98.3923, country: "Thailand", region: "Southeast Asia" },
  "pattaya": { lat: 12.9236, lon: 100.8825, country: "Thailand", region: "Southeast Asia" },
  "hat yai": { lat: 7.0036, lon: 100.4747, country: "Thailand", region: "Southeast Asia" },
  "chiang rai": { lat: 19.9105, lon: 99.8406, country: "Thailand", region: "Southeast Asia" },
  "nakhon ratchasima": { lat: 14.9799, lon: 102.0978, country: "Thailand", region: "Southeast Asia" },
  "udon thani": { lat: 17.4156, lon: 102.7872, country: "Thailand", region: "Southeast Asia" },
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Southeast Asia" },
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
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Southeast Asia" },
  "ho chi minh city": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Southeast Asia" },
  "saigon": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Southeast Asia" },
  "da nang": { lat: 16.0544, lon: 108.2022, country: "Vietnam", region: "Southeast Asia" },
  "hai phong": { lat: 20.8449, lon: 106.6881, country: "Vietnam", region: "Southeast Asia" },
  "hue": { lat: 16.4637, lon: 107.5909, country: "Vietnam", region: "Southeast Asia" },
  "cam ranh": { lat: 11.9214, lon: 109.1591, country: "Vietnam", region: "Southeast Asia" },
  "kuala lumpur": { lat: 3.1390, lon: 101.6869, country: "Malaysia", region: "Southeast Asia" },
  "johor bahru": { lat: 1.4927, lon: 103.7414, country: "Malaysia", region: "Southeast Asia" },
  "penang": { lat: 5.4141, lon: 100.3288, country: "Malaysia", region: "Southeast Asia" },
  "kota kinabalu": { lat: 5.9804, lon: 116.0735, country: "Malaysia", region: "Southeast Asia" },
  "kuching": { lat: 1.5497, lon: 110.3634, country: "Malaysia", region: "Southeast Asia" },
  "putrajaya": { lat: 2.9264, lon: 101.6964, country: "Malaysia", region: "Southeast Asia" },
  "sabah": { lat: 5.9788, lon: 116.0753, country: "Malaysia", region: "Southeast Asia" },
  "sarawak": { lat: 1.5533, lon: 110.3592, country: "Malaysia", region: "Southeast Asia" },
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Southeast Asia" },
  "naypyidaw": { lat: 19.7633, lon: 96.0785, country: "Myanmar", region: "Southeast Asia" },
  "mandalay": { lat: 21.9588, lon: 96.0891, country: "Myanmar", region: "Southeast Asia" },
  "myitkyina": { lat: 25.3830, lon: 97.3966, country: "Myanmar", region: "Southeast Asia" },
  "sittwe": { lat: 20.1461, lon: 92.8983, country: "Myanmar", region: "Southeast Asia" },
  "mawlamyine": { lat: 16.4910, lon: 97.6256, country: "Myanmar", region: "Southeast Asia" },
  "rakhine": { lat: 20.1467, lon: 92.8960, country: "Myanmar", region: "Southeast Asia" },
  "shan state": { lat: 21.5000, lon: 97.7500, country: "Myanmar", region: "Southeast Asia" },
  "phnom penh": { lat: 11.5564, lon: 104.9282, country: "Cambodia", region: "Southeast Asia" },
  "siem reap": { lat: 13.3633, lon: 103.8564, country: "Cambodia", region: "Southeast Asia" },
  "sihanoukville": { lat: 10.6093, lon: 103.5295, country: "Cambodia", region: "Southeast Asia" },
  "battambang": { lat: 13.1020, lon: 103.1986, country: "Cambodia", region: "Southeast Asia" },
  "vientiane": { lat: 17.9757, lon: 102.6331, country: "Laos", region: "Southeast Asia" },
  "luang prabang": { lat: 19.8833, lon: 102.1347, country: "Laos", region: "Southeast Asia" },
  "savannakhet": { lat: 16.5472, lon: 104.7525, country: "Laos", region: "Southeast Asia" },
  "bandar seri begawan": { lat: 4.9431, lon: 114.9425, country: "Brunei", region: "Southeast Asia" },
  "dili": { lat: -8.5594, lon: 125.5789, country: "Timor-Leste", region: "Southeast Asia" },
  // ── Pacific Islands (NEW) ──
  "port moresby": { lat: -9.4438, lon: 147.1803, country: "Papua New Guinea", region: "Pacific" },
  "lae": { lat: -6.7194, lon: 146.9975, country: "Papua New Guinea", region: "Pacific" },
  "madang": { lat: -5.2167, lon: 145.7833, country: "Papua New Guinea", region: "Pacific" },
  "mount hagen": { lat: -5.8558, lon: 144.2214, country: "Papua New Guinea", region: "Pacific" },
  "bougainville": { lat: -6.2000, lon: 155.1833, country: "Papua New Guinea", region: "Pacific" },
  "suva": { lat: -18.1416, lon: 178.4419, country: "Fiji", region: "Pacific" },
  "nadi": { lat: -17.7765, lon: 177.4356, country: "Fiji", region: "Pacific" },
  "honiara": { lat: -9.4319, lon: 160.0562, country: "Solomon Islands", region: "Pacific" },
  "guadalcanal": { lat: -9.6457, lon: 160.1562, country: "Solomon Islands", region: "Pacific" },
  "port vila": { lat: -17.7333, lon: 168.3167, country: "Vanuatu", region: "Pacific" },
  "noumea": { lat: -22.2758, lon: 166.4580, country: "New Caledonia", region: "Pacific" },
  "papeete": { lat: -17.5334, lon: -149.5667, country: "French Polynesia", region: "Pacific" },
  "apia": { lat: -13.8333, lon: -171.8333, country: "Samoa", region: "Pacific" },
  "nuku'alofa": { lat: -21.1333, lon: -175.2000, country: "Tonga", region: "Pacific" },
  "funafuti": { lat: -8.5211, lon: 179.1983, country: "Tuvalu", region: "Pacific" },
  "tarawa": { lat: 1.3282, lon: 172.9785, country: "Kiribati", region: "Pacific" },
  "majuro": { lat: 7.1167, lon: 171.3667, country: "Marshall Islands", region: "Pacific" },
  "koror": { lat: 7.3419, lon: 134.4792, country: "Palau", region: "Pacific" },
  "palikir": { lat: 6.9248, lon: 158.1610, country: "Micronesia", region: "Pacific" },
  "yaren": { lat: -0.5477, lon: 166.9209, country: "Nauru", region: "Pacific" },
  "hagåtña": { lat: 13.4745, lon: 144.7504, country: "Guam", region: "Pacific" },
  "pago pago": { lat: -14.2756, lon: -170.7020, country: "American Samoa", region: "Pacific" },
  "saipan": { lat: 15.1778, lon: 145.7504, country: "Northern Mariana Islands", region: "Pacific" },
  // ── Caribbean (NEW) ──
  "havana": { lat: 23.1136, lon: -82.3666, country: "Cuba", region: "Caribbean" },
  "santiago de cuba": { lat: 20.0247, lon: -75.8219, country: "Cuba", region: "Caribbean" },
  "port-au-prince": { lat: 18.5944, lon: -72.3074, country: "Haiti", region: "Caribbean" },
  "cap-haitien": { lat: 19.7600, lon: -72.2000, country: "Haiti", region: "Caribbean" },
  "santo domingo": { lat: 18.4861, lon: -69.9312, country: "Dominican Republic", region: "Caribbean" },
  "san juan": { lat: 18.4655, lon: -66.1057, country: "Puerto Rico", region: "Caribbean" },
  "kingston": { lat: 17.9714, lon: -76.7920, country: "Jamaica", region: "Caribbean" },
  "bridgetown": { lat: 13.1132, lon: -59.5988, country: "Barbados", region: "Caribbean" },
  "port of spain": { lat: 10.6549, lon: -61.5019, country: "Trinidad and Tobago", region: "Caribbean" },
  "nassau": { lat: 25.0480, lon: -77.3554, country: "Bahamas", region: "Caribbean" },
  "castries": { lat: 14.0101, lon: -60.9875, country: "Saint Lucia", region: "Caribbean" },
  "roseau": { lat: 15.3017, lon: -61.3881, country: "Dominica", region: "Caribbean" },
  "kingstown": { lat: 13.1600, lon: -61.2248, country: "Saint Vincent", region: "Caribbean" },
  "willemstad": { lat: 12.1091, lon: -68.9356, country: "Curaçao", region: "Caribbean" },
  "oranjestad": { lat: 12.5186, lon: -70.0358, country: "Aruba", region: "Caribbean" },
  "george town": { lat: 19.2869, lon: -81.3674, country: "Cayman Islands", region: "Caribbean" },
  "charlotte amalie": { lat: 18.3419, lon: -64.9307, country: "US Virgin Islands", region: "Caribbean" },
  // ── Central America (NEW) ──
  "guatemala city": { lat: 14.6349, lon: -90.5069, country: "Guatemala", region: "Central America" },
  "tegucigalpa": { lat: 14.0723, lon: -87.1921, country: "Honduras", region: "Central America" },
  "san pedro sula": { lat: 15.5000, lon: -88.0333, country: "Honduras", region: "Central America" },
  "san salvador": { lat: 13.6929, lon: -89.2182, country: "El Salvador", region: "Central America" },
  "managua": { lat: 12.1149, lon: -86.2362, country: "Nicaragua", region: "Central America" },
  "san jose": { lat: 9.9281, lon: -84.0907, country: "Costa Rica", region: "Central America" },
  "panama city": { lat: 8.9824, lon: -79.5199, country: "Panama", region: "Central America" },
  "belize city": { lat: 17.2514, lon: -88.7659, country: "Belize", region: "Central America" },
  // ── Africa (expanded) ──
  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Africa" },
  "alexandria": { lat: 31.2001, lon: 29.9187, country: "Egypt", region: "Africa" },
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "maiduguri": { lat: 11.8311, lon: 13.1510, country: "Nigeria", region: "Africa" },
  "kano": { lat: 11.9964, lon: 8.5167, country: "Nigeria", region: "Africa" },
  "kaduna": { lat: 10.5264, lon: 7.4420, country: "Nigeria", region: "Africa" },
  "port harcourt": { lat: 4.7748, lon: 7.0122, country: "Nigeria", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "mombasa": { lat: -4.0435, lon: 39.6682, country: "Kenya", region: "Africa" },
  "kisumu": { lat: -0.1022, lon: 34.7617, country: "Kenya", region: "Africa" },
  "pretoria": { lat: -25.7461, lon: 28.1881, country: "South Africa", region: "Africa" },
  "johannesburg": { lat: -26.2041, lon: 28.0473, country: "South Africa", region: "Africa" },
  "cape town": { lat: -33.9249, lon: 18.4241, country: "South Africa", region: "Africa" },
  "durban": { lat: -29.8587, lon: 31.0218, country: "South Africa", region: "Africa" },
  "addis ababa": { lat: 9.0250, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "mekelle": { lat: 13.4967, lon: 39.4753, country: "Ethiopia", region: "Africa" },
  "gondar": { lat: 12.6030, lon: 37.4521, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "omdurman": { lat: 15.6449, lon: 32.4777, country: "Sudan", region: "Africa" },
  "port sudan": { lat: 19.6158, lon: 37.2164, country: "Sudan", region: "Africa" },
  "el fasher": { lat: 13.6290, lon: 25.3490, country: "Sudan", region: "Africa" },
  "darfur": { lat: 13.5000, lon: 24.0000, country: "Sudan", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "benghazi": { lat: 32.1194, lon: 20.0868, country: "Libya", region: "Africa" },
  "sirte": { lat: 31.2089, lon: 16.5887, country: "Libya", region: "Africa" },
  "mogadishu": { lat: 2.0469, lon: 45.3182, country: "Somalia", region: "Africa" },
  "hargeisa": { lat: 9.5600, lon: 44.0650, country: "Somalia", region: "Africa" },
  "bosaso": { lat: 11.2867, lon: 49.1819, country: "Somalia", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "goma": { lat: -1.6771, lon: 29.2386, country: "DR Congo", region: "Africa" },
  "bukavu": { lat: -2.5083, lon: 28.8608, country: "DR Congo", region: "Africa" },
  "bunia": { lat: 1.5585, lon: 30.2483, country: "DR Congo", region: "Africa" },
  "beni": { lat: 0.4916, lon: 29.4728, country: "DR Congo", region: "Africa" },
  "dakar": { lat: 14.7167, lon: -17.4677, country: "Senegal", region: "Africa" },
  "accra": { lat: 5.6037, lon: -0.1870, country: "Ghana", region: "Africa" },
  "bamako": { lat: 12.6392, lon: -8.0029, country: "Mali", region: "Africa" },
  "timbuktu": { lat: 16.7666, lon: -3.0026, country: "Mali", region: "Africa" },
  "mopti": { lat: 14.4910, lon: -4.1977, country: "Mali", region: "Africa" },
  "gao": { lat: 16.2666, lon: -0.0500, country: "Mali", region: "Africa" },
  "kidal": { lat: 18.4441, lon: 1.4078, country: "Mali", region: "Africa" },
  "ouagadougou": { lat: 12.3714, lon: -1.5197, country: "Burkina Faso", region: "Africa" },
  "bobo-dioulasso": { lat: 11.1771, lon: -4.2979, country: "Burkina Faso", region: "Africa" },
  "sahel region": { lat: 15.0000, lon: 2.0000, country: "Sahel", region: "Africa" },
  "niamey": { lat: 13.5127, lon: 2.1128, country: "Niger", region: "Africa" },
  "agadez": { lat: 16.9742, lon: 7.9869, country: "Niger", region: "Africa" },
  "ndjamena": { lat: 12.1348, lon: 15.0557, country: "Chad", region: "Africa" },
  "abeche": { lat: 13.8281, lon: 20.8323, country: "Chad", region: "Africa" },
  "kampala": { lat: 0.3476, lon: 32.5825, country: "Uganda", region: "Africa" },
  "kigali": { lat: -1.9403, lon: 29.8739, country: "Rwanda", region: "Africa" },
  "bujumbura": { lat: -3.3869, lon: 29.3622, country: "Burundi", region: "Africa" },
  "juba": { lat: 4.8594, lon: 31.5713, country: "South Sudan", region: "Africa" },
  "wau": { lat: 7.7000, lon: 27.9833, country: "South Sudan", region: "Africa" },
  "malakal": { lat: 9.5334, lon: 31.6600, country: "South Sudan", region: "Africa" },
  "maputo": { lat: -25.9692, lon: 32.5732, country: "Mozambique", region: "Africa" },
  "pemba": { lat: -13.0000, lon: 40.5167, country: "Mozambique", region: "Africa" },
  "cabo delgado": { lat: -12.0000, lon: 39.5000, country: "Mozambique", region: "Africa" },
  "luanda": { lat: -8.8383, lon: 13.2344, country: "Angola", region: "Africa" },
  "harare": { lat: -17.8252, lon: 31.0335, country: "Zimbabwe", region: "Africa" },
  "antananarivo": { lat: -18.9137, lon: 47.5361, country: "Madagascar", region: "Africa" },
  "moroni": { lat: -11.7041, lon: 43.2551, country: "Comoros", region: "Africa" },
  "victoria": { lat: -4.6167, lon: 55.4500, country: "Seychelles", region: "Africa" },
  "port louis": { lat: -20.1609, lon: 57.4989, country: "Mauritius", region: "Africa" },
  "djibouti": { lat: 11.5720, lon: 43.1451, country: "Djibouti", region: "Africa" },
  "asmara": { lat: 15.3387, lon: 38.9310, country: "Eritrea", region: "Africa" },
  "conakry": { lat: 9.5370, lon: -13.6773, country: "Guinea", region: "Africa" },
  "abidjan": { lat: 5.3599, lon: -4.0083, country: "Ivory Coast", region: "Africa" },
  "lome": { lat: 6.1375, lon: 1.2123, country: "Togo", region: "Africa" },
  "cotonou": { lat: 6.3703, lon: 2.3912, country: "Benin", region: "Africa" },
  "freetown": { lat: 8.4843, lon: -13.2344, country: "Sierra Leone", region: "Africa" },
  "monrovia": { lat: 6.3106, lon: -10.8048, country: "Liberia", region: "Africa" },
  "bissau": { lat: 11.8636, lon: -15.5977, country: "Guinea-Bissau", region: "Africa" },
  "bangui": { lat: 4.3947, lon: 18.5582, country: "Central African Republic", region: "Africa" },
  "yaounde": { lat: 3.8480, lon: 11.5021, country: "Cameroon", region: "Africa" },
  "douala": { lat: 4.0500, lon: 9.7000, country: "Cameroon", region: "Africa" },
  "libreville": { lat: 0.3901, lon: 9.4544, country: "Gabon", region: "Africa" },
  "brazzaville": { lat: -4.2693, lon: 15.2714, country: "Republic of Congo", region: "Africa" },
  "malabo": { lat: 3.7523, lon: 8.7741, country: "Equatorial Guinea", region: "Africa" },
  "windhoek": { lat: -22.5597, lon: 17.0832, country: "Namibia", region: "Africa" },
  "gaborone": { lat: -24.6541, lon: 25.9087, country: "Botswana", region: "Africa" },
  "lusaka": { lat: -15.4167, lon: 28.2833, country: "Zambia", region: "Africa" },
  "lilongwe": { lat: -13.9626, lon: 33.7741, country: "Malawi", region: "Africa" },
  "dar es salaam": { lat: -6.7924, lon: 39.2083, country: "Tanzania", region: "Africa" },
  "dodoma": { lat: -6.1722, lon: 35.7395, country: "Tanzania", region: "Africa" },
  "zanzibar": { lat: -6.1659, lon: 39.2026, country: "Tanzania", region: "Africa" },
  "mogadishu airport": { lat: 2.0144, lon: 45.3047, country: "Somalia", region: "Africa" },
  "casablanca": { lat: 33.5731, lon: -7.5898, country: "Morocco", region: "Africa" },
  "rabat": { lat: 34.0209, lon: -6.8416, country: "Morocco", region: "Africa" },
  "tunis": { lat: 36.8190, lon: 10.1658, country: "Tunisia", region: "Africa" },
  "algiers": { lat: 36.7372, lon: 3.0865, country: "Algeria", region: "Africa" },
  // ── South America ──
  "brasilia": { lat: -15.7801, lon: -47.9292, country: "Brazil", region: "South America" },
  "sao paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", region: "South America" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, country: "Brazil", region: "South America" },
  "belem": { lat: -1.4558, lon: -48.5044, country: "Brazil", region: "South America" },
  "manaus": { lat: -3.1190, lon: -60.0217, country: "Brazil", region: "South America" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "South America" },
  "bogota": { lat: 4.7110, lon: -74.0721, country: "Colombia", region: "South America" },
  "medellin": { lat: 6.2442, lon: -75.5812, country: "Colombia", region: "South America" },
  "cali": { lat: 3.4516, lon: -76.5320, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "maracaibo": { lat: 10.6666, lon: -71.6124, country: "Venezuela", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "South America" },
  "quito": { lat: -0.1807, lon: -78.4678, country: "Ecuador", region: "South America" },
  "la paz": { lat: -16.5000, lon: -68.1500, country: "Bolivia", region: "South America" },
  "asuncion": { lat: -25.2867, lon: -57.6478, country: "Paraguay", region: "South America" },
  "montevideo": { lat: -34.9033, lon: -56.1882, country: "Uruguay", region: "South America" },
  "georgetown": { lat: 6.8013, lon: -58.1551, country: "Guyana", region: "South America" },
  "paramaribo": { lat: 5.8520, lon: -55.2038, country: "Suriname", region: "South America" },
  "cayenne": { lat: 4.9224, lon: -52.3135, country: "French Guiana", region: "South America" },
  // ── Mexico ──
  "mexico city": { lat: 19.4326, lon: -99.1332, country: "Mexico", region: "North America" },
  "guadalajara": { lat: 20.6597, lon: -103.3496, country: "Mexico", region: "North America" },
  "monterrey": { lat: 25.6866, lon: -100.3161, country: "Mexico", region: "North America" },
  "ciudad juarez": { lat: 31.6904, lon: -106.4245, country: "Mexico", region: "North America" },
  "tijuana": { lat: 32.5149, lon: -117.0382, country: "Mexico", region: "North America" },
  "culiacan": { lat: 24.7994, lon: -107.3940, country: "Mexico", region: "North America" },
  "acapulco": { lat: 16.8531, lon: -99.8237, country: "Mexico", region: "North America" },
  "cancun": { lat: 21.1619, lon: -86.8515, country: "Mexico", region: "North America" },
  // ── Oceania ──
  "canberra": { lat: -35.2809, lon: 149.1300, country: "Australia", region: "Oceania" },
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "melbourne": { lat: -37.8136, lon: 144.9631, country: "Australia", region: "Oceania" },
  "darwin": { lat: -12.4634, lon: 130.8456, country: "Australia", region: "Oceania" },
  "perth": { lat: -31.9505, lon: 115.8605, country: "Australia", region: "Oceania" },
  "brisbane": { lat: -27.4698, lon: 153.0251, country: "Australia", region: "Oceania" },
  "wellington": { lat: -41.2866, lon: 174.7756, country: "New Zealand", region: "Oceania" },
  "auckland": { lat: -36.8485, lon: 174.7633, country: "New Zealand", region: "Oceania" },
  "christchurch": { lat: -43.5321, lon: 172.6362, country: "New Zealand", region: "Oceania" },
  // ── Maritime zones ──
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
  "arctic ocean": { lat: 85.0, lon: 0.0, country: "Arctic Ocean", region: "Arctic" },
  "bering strait": { lat: 65.7, lon: -168.9, country: "Bering Strait", region: "Arctic" },
  "northwest passage": { lat: 74.0, lon: -100.0, country: "Northwest Passage", region: "Arctic" },
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
  "indian ocean": { lat: -20.0, lon: 80.0, country: "Indian Ocean", region: "Asia" },
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
  "ly": { patterns: ["libya","libyan","haftar","gna ","lna "], lat: 32.8872, lon: 13.1913, name: "Libya", region: "Africa", offset: 0.3 },
  "sd": { patterns: ["sudan","sudanese","rsf ","rapid support","janjaweed"], lat: 15.5007, lon: 32.5599, name: "Sudan", region: "Africa", offset: 0.3 },
  "ss": { patterns: ["south sudan","juba"], lat: 4.8594, lon: 31.5713, name: "South Sudan", region: "Africa", offset: 0.3 },
  "mm": { patterns: ["myanmar","burma","burmese","rohingya","junta","tatmadaw","nug ","pdf ","arakan"], lat: 16.8661, lon: 96.1951, name: "Myanmar", region: "Southeast Asia", offset: 0.3 },
  // ── ASEAN ──
  "th": { patterns: ["thailand","thai","prayuth","srettha"], lat: 13.7563, lon: 100.5018, name: "Thailand", region: "Southeast Asia", offset: 0.3 },
  "vn": { patterns: ["vietnam","vietnamese"], lat: 21.0278, lon: 105.8342, name: "Vietnam", region: "Southeast Asia", offset: 0.3 },
  "id": { patterns: ["indonesia","indonesian","jokowi","prabowo"], lat: -6.2088, lon: 106.8456, name: "Indonesia", region: "Southeast Asia", offset: 0.4 },
  "my": { patterns: ["malaysia","malaysian","anwar ibrahim"], lat: 3.1390, lon: 101.6869, name: "Malaysia", region: "Southeast Asia", offset: 0.2 },
  "kh": { patterns: ["cambodia","cambodian","hun manet","hun sen"], lat: 11.5564, lon: 104.9282, name: "Cambodia", region: "Southeast Asia", offset: 0.2 },
  "la": { patterns: ["laos","laotian","lao pdr"], lat: 17.9757, lon: 102.6331, name: "Laos", region: "Southeast Asia", offset: 0.2 },
  "bn": { patterns: ["brunei","bruneian"], lat: 4.9431, lon: 114.9425, name: "Brunei", region: "Southeast Asia", offset: 0.05 },
  "tl": { patterns: ["timor-leste","timor leste","east timor"], lat: -8.5569, lon: 125.5603, name: "Timor-Leste", region: "Southeast Asia", offset: 0.1 },
  "asean": { patterns: ["asean","southeast asia","south east asia","indopacific","indo-pacific"], lat: 4.0, lon: 108.0, name: "ASEAN Region", region: "Southeast Asia", offset: 2.0 },
  // ── Pacific Islands (NEW) ──
  "pg": { patterns: ["papua new guinea","png ","port moresby"], lat: -9.4438, lon: 147.1803, name: "Papua New Guinea", region: "Pacific", offset: 0.3 },
  "fj": { patterns: ["fiji","fijian"], lat: -18.1416, lon: 178.4419, name: "Fiji", region: "Pacific", offset: 0.1 },
  "sb": { patterns: ["solomon islands","honiara"], lat: -9.4319, lon: 160.0562, name: "Solomon Islands", region: "Pacific", offset: 0.1 },
  "vu": { patterns: ["vanuatu"], lat: -17.7333, lon: 168.3167, name: "Vanuatu", region: "Pacific", offset: 0.1 },
  "nc": { patterns: ["new caledonia","kanak"], lat: -22.2758, lon: 166.4580, name: "New Caledonia", region: "Pacific", offset: 0.2 },
  "pf": { patterns: ["french polynesia","tahiti"], lat: -17.5334, lon: -149.5667, name: "French Polynesia", region: "Pacific", offset: 0.2 },
  "ws": { patterns: ["samoa","samoan"], lat: -13.8333, lon: -171.8333, name: "Samoa", region: "Pacific", offset: 0.1 },
  "to": { patterns: ["tonga","tongan"], lat: -21.1333, lon: -175.2000, name: "Tonga", region: "Pacific", offset: 0.1 },
  "tv": { patterns: ["tuvalu","funafuti"], lat: -8.5211, lon: 179.1983, name: "Tuvalu", region: "Pacific", offset: 0.05 },
  "ki": { patterns: ["kiribati","tarawa"], lat: 1.3282, lon: 172.9785, name: "Kiribati", region: "Pacific", offset: 0.1 },
  "mh": { patterns: ["marshall islands","majuro","kwajalein"], lat: 7.1167, lon: 171.3667, name: "Marshall Islands", region: "Pacific", offset: 0.1 },
  "pw": { patterns: ["palau"], lat: 7.3419, lon: 134.4792, name: "Palau", region: "Pacific", offset: 0.05 },
  "fm": { patterns: ["micronesia","palikir"], lat: 6.9248, lon: 158.1610, name: "Micronesia", region: "Pacific", offset: 0.1 },
  "nr": { patterns: ["nauru"], lat: -0.5477, lon: 166.9209, name: "Nauru", region: "Pacific", offset: 0.02 },
  "pacificregion": { patterns: ["pacific islands","south pacific","pacific region"], lat: -15.0, lon: 170.0, name: "Pacific Islands", region: "Pacific", offset: 5.0 },
  // ── Caribbean (NEW) ──
  "cu": { patterns: ["cuba","cuban","havana","castro"], lat: 23.1136, lon: -82.3666, name: "Cuba", region: "Caribbean", offset: 0.2 },
  "ht": { patterns: ["haiti","haitian","port-au-prince"], lat: 18.5944, lon: -72.3074, name: "Haiti", region: "Caribbean", offset: 0.1 },
  "do": { patterns: ["dominican republic","santo domingo"], lat: 18.4861, lon: -69.9312, name: "Dominican Republic", region: "Caribbean", offset: 0.1 },
  "jm": { patterns: ["jamaica","kingston"], lat: 17.9714, lon: -76.7920, name: "Jamaica", region: "Caribbean", offset: 0.1 },
  "tt": { patterns: ["trinidad","tobago"], lat: 10.6549, lon: -61.5019, name: "Trinidad and Tobago", region: "Caribbean", offset: 0.05 },
  "bb": { patterns: ["barbados"], lat: 13.1132, lon: -59.5988, name: "Barbados", region: "Caribbean", offset: 0.03 },
  "bs": { patterns: ["bahamas"], lat: 25.0480, lon: -77.3554, name: "Bahamas", region: "Caribbean", offset: 0.1 },
  "caribregion": { patterns: ["caribbean","west indies","antilles"], lat: 17.0, lon: -68.0, name: "Caribbean", region: "Caribbean", offset: 2.0 },
  // ── Central America (NEW) ──
  "gt": { patterns: ["guatemala","guatemalan"], lat: 14.6349, lon: -90.5069, name: "Guatemala", region: "Central America", offset: 0.2 },
  "hn": { patterns: ["honduras","honduran"], lat: 14.0723, lon: -87.1921, name: "Honduras", region: "Central America", offset: 0.2 },
  "sv": { patterns: ["el salvador","salvadoran","bukele"], lat: 13.6929, lon: -89.2182, name: "El Salvador", region: "Central America", offset: 0.1 },
  "ni": { patterns: ["nicaragua","nicaraguan","ortega"], lat: 12.1149, lon: -86.2362, name: "Nicaragua", region: "Central America", offset: 0.2 },
  "cr": { patterns: ["costa rica","costa rican"], lat: 9.9281, lon: -84.0907, name: "Costa Rica", region: "Central America", offset: 0.1 },
  "pa": { patterns: ["panama","panamanian"], lat: 8.9824, lon: -79.5199, name: "Panama", region: "Central America", offset: 0.1 },
  "bz": { patterns: ["belize","belizean"], lat: 17.2514, lon: -88.7659, name: "Belize", region: "Central America", offset: 0.1 },
  // ── Central Asia (NEW) ──
  "kz": { patterns: ["kazakhstan","kazakhstani","tokaev","tokayev"], lat: 51.1694, lon: 71.4491, name: "Kazakhstan", region: "Central Asia", offset: 0.5 },
  "uz": { patterns: ["uzbekistan","uzbek","mirziyoyev"], lat: 41.2995, lon: 69.2401, name: "Uzbekistan", region: "Central Asia", offset: 0.3 },
  "kg": { patterns: ["kyrgyzstan","kyrgyz"], lat: 42.8746, lon: 74.5698, name: "Kyrgyzstan", region: "Central Asia", offset: 0.2 },
  "tj": { patterns: ["tajikistan","tajik","dushanbe"], lat: 38.5598, lon: 68.7740, name: "Tajikistan", region: "Central Asia", offset: 0.2 },
  "tm": { patterns: ["turkmenistan","turkmen"], lat: 37.9601, lon: 58.3261, name: "Turkmenistan", region: "Central Asia", offset: 0.3 },
  "centralasia": { patterns: ["central asia","post-soviet"], lat: 42.0, lon: 65.0, name: "Central Asia", region: "Central Asia", offset: 3.0 },
  // ── Caucasus (NEW) ──
  "ge": { patterns: ["georgia","georgian"], lat: 41.7151, lon: 44.8271, name: "Georgia", region: "Caucasus", offset: 0.1 },
  "am": { patterns: ["armenia","armenian"], lat: 40.1792, lon: 44.4991, name: "Armenia", region: "Caucasus", offset: 0.1 },
  "az": { patterns: ["azerbaijan","azeri","nagorno","karabakh"], lat: 40.4093, lon: 49.8671, name: "Azerbaijan", region: "Caucasus", offset: 0.15 },
  "ab": { patterns: ["abkhazia","abkhaz"], lat: 43.0015, lon: 41.0234, name: "Abkhazia", region: "Caucasus", offset: 0.05 },
  "so_osetia": { patterns: ["south ossetia","ossetian"], lat: 42.2270, lon: 43.9718, name: "South Ossetia", region: "Caucasus", offset: 0.05 },
  // ── Arctic (NEW) ──
  "arcticregion": { patterns: ["arctic","svalbard","spitsbergen","franz josef","novaya zemlya","high north","polar"], lat: 78.0, lon: 20.0, name: "Arctic", region: "Arctic", offset: 5.0 },
  "gl": { patterns: ["greenland","greenlandic","nuuk"], lat: 64.1836, lon: -51.7214, name: "Greenland", region: "Arctic", offset: 1.0 },
  "is": { patterns: ["iceland","icelandic","reykjavik"], lat: 64.1265, lon: -21.8174, name: "Iceland", region: "Arctic", offset: 0.2 },
  // ── Africa additions ──
  "et": { patterns: ["ethiopia","ethiopian","tigray","amhara"], lat: 9.0250, lon: 38.7469, name: "Ethiopia", region: "Africa", offset: 0.3 },
  "so": { patterns: ["somalia","somali","al shabaab","al-shabaab"], lat: 2.0469, lon: 45.3182, name: "Somalia", region: "Africa", offset: 0.3 },
  "cd": { patterns: ["congo","congolese","drc ","m23 ","adf "], lat: -4.4419, lon: 15.2663, name: "DR Congo", region: "Africa", offset: 0.4 },
  "ml": { patterns: ["mali","malian","jnim","aqim"], lat: 12.6392, lon: -8.0029, name: "Mali", region: "Africa", offset: 0.3 },
  "bf": { patterns: ["burkina faso","burkinabe"], lat: 12.3714, lon: -1.5197, name: "Burkina Faso", region: "Africa", offset: 0.2 },
  "ne": { patterns: ["niger","nigerien"], lat: 13.5127, lon: 2.1128, name: "Niger", region: "Africa", offset: 0.3 },
  "td": { patterns: ["chad","chadian"], lat: 12.1348, lon: 15.0557, name: "Chad", region: "Africa", offset: 0.3 },
  "ug": { patterns: ["uganda","ugandan","museveni"], lat: 0.3476, lon: 32.5825, name: "Uganda", region: "Africa", offset: 0.2 },
  "rw": { patterns: ["rwanda","rwandan","kagame"], lat: -1.9403, lon: 29.8739, name: "Rwanda", region: "Africa", offset: 0.1 },
  "bi": { patterns: ["burundi","burundian"], lat: -3.3869, lon: 29.3622, name: "Burundi", region: "Africa", offset: 0.1 },
  "mz": { patterns: ["mozambique","cabo delgado"], lat: -25.9692, lon: 32.5732, name: "Mozambique", region: "Africa", offset: 0.3 },
  "cf": { patterns: ["central african republic","car ","bangui"], lat: 4.3947, lon: 18.5582, name: "Central African Republic", region: "Africa", offset: 0.3 },
  "cm": { patterns: ["cameroon","cameroonian"], lat: 3.8480, lon: 11.5021, name: "Cameroon", region: "Africa", offset: 0.3 },
  "dj": { patterns: ["djibouti","djiboutian"], lat: 11.5720, lon: 43.1451, name: "Djibouti", region: "Africa", offset: 0.05 },
  "er": { patterns: ["eritrea","eritrean"], lat: 15.3387, lon: 38.9310, name: "Eritrea", region: "Africa", offset: 0.1 },
  "ma": { patterns: ["morocco","moroccan"], lat: 33.5731, lon: -7.5898, name: "Morocco", region: "Africa", offset: 0.2 },
  "tn": { patterns: ["tunisia","tunisian"], lat: 36.8190, lon: 10.1658, name: "Tunisia", region: "Africa", offset: 0.1 },
  "dz": { patterns: ["algeria","algerian"], lat: 36.7372, lon: 3.0865, name: "Algeria", region: "Africa", offset: 0.3 },
  "sl": { patterns: ["sierra leone"], lat: 8.4843, lon: -13.2344, name: "Sierra Leone", region: "Africa", offset: 0.1 },
  "lr": { patterns: ["liberia","liberian"], lat: 6.3106, lon: -10.8048, name: "Liberia", region: "Africa", offset: 0.1 },
  "sn": { patterns: ["senegal","senegalese"], lat: 14.7167, lon: -17.4677, name: "Senegal", region: "Africa", offset: 0.2 },
  "gn": { patterns: ["guinea","guinean"], lat: 9.5370, lon: -13.6773, name: "Guinea", region: "Africa", offset: 0.2 },
  "ci": { patterns: ["ivory coast","cote d'ivoire","ivorian"], lat: 5.3599, lon: -4.0083, name: "Ivory Coast", region: "Africa", offset: 0.2 },
  "gh": { patterns: ["ghana","ghanaian"], lat: 5.6037, lon: -0.1870, name: "Ghana", region: "Africa", offset: 0.2 },
  "tz": { patterns: ["tanzania","tanzanian"], lat: -6.7924, lon: 39.2083, name: "Tanzania", region: "Africa", offset: 0.3 },
  "zm": { patterns: ["zambia","zambian"], lat: -15.4167, lon: 28.2833, name: "Zambia", region: "Africa", offset: 0.2 },
  "zw": { patterns: ["zimbabwe","zimbabwean","mnangagwa"], lat: -17.8252, lon: 31.0335, name: "Zimbabwe", region: "Africa", offset: 0.2 },
  "ao": { patterns: ["angola","angolan"], lat: -8.8383, lon: 13.2344, name: "Angola", region: "Africa", offset: 0.3 },
  "mg": { patterns: ["madagascar","malagasy"], lat: -18.9137, lon: 47.5361, name: "Madagascar", region: "Africa", offset: 0.3 },
  "sahelregion": { patterns: ["sahel","g5 sahel"], lat: 15.0, lon: 2.0, name: "Sahel Region", region: "Africa", offset: 3.0 },
  // ── Americas ──
  "ve": { patterns: ["venezuela","venezuelan","maduro"], lat: 10.4806, lon: -66.9036, name: "Venezuela", region: "South America", offset: 0.3 },
  "co": { patterns: ["colombia","colombian","farc","eln "], lat: 4.7110, lon: -74.0721, name: "Colombia", region: "South America", offset: 0.3 },
  "pe": { patterns: ["peru","peruvian"], lat: -12.0464, lon: -77.0428, name: "Peru", region: "South America", offset: 0.3 },
  "ec": { patterns: ["ecuador","ecuadorian"], lat: -0.1807, lon: -78.4678, name: "Ecuador", region: "South America", offset: 0.2 },
  "bo": { patterns: ["bolivia","bolivian"], lat: -16.5000, lon: -68.1500, name: "Bolivia", region: "South America", offset: 0.2 },
  "ar": { patterns: ["argentina","argentine"], lat: -34.6037, lon: -58.3816, name: "Argentina", region: "South America", offset: 0.4 },
  "cl": { patterns: ["chile","chilean"], lat: -33.4489, lon: -70.6693, name: "Chile", region: "South America", offset: 0.3 },
  // ── Others ──
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
  "by": { patterns: ["belarus","belarusian","lukashenko"], lat: 53.9045, lon: 27.5615, name: "Belarus", region: "Europe", offset: 0.2 },
};

interface GeoResult { lat: number; lon: number; country: string; region: string; confidence: number; city: string | null; }

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
  
  const byCountry = getCitiesByCountry();
  for (const [, info] of Object.entries(COUNTRY_PATTERNS)) {
    if (info.patterns.some(p => text.includes(p))) {
      const cities = byCountry[info.name.toLowerCase()];
      if (cities && cities.length > 0) {
        const seed = hashStr(title + info.name);
        const picked = cities[seed % cities.length];
        const micro = 0.002;
        const dx = ((seed % 1000) / 1000 - 0.5) * micro;
        const dy = (((seed >> 10) % 1000) / 1000 - 0.5) * micro;
        return { lat: picked.lat + dy, lon: picked.lon + dx, country: info.name, region: info.region, confidence: 0.7, city: prettyCity(picked.name) };
      }
      return { lat: info.lat, lon: info.lon, country: info.name, region: info.region, confidence: 0.6, city: null };
    }
  }
  
  return { lat: 0, lon: 0, country: "", region: "", confidence: 0, city: null };
}

function prettyCity(key: string): string {
  return key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LAYER 3 — PARSERS (RSS, Telegram, GDELT, Paste)                 ║
// ╚══════════════════════════════════════════════════════════════════╝

function parseRss(xml: string, sourceName: string, credibility: "high" | "medium" | "low"): RawArticle[] {
  const items: RawArticle[] = [];
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
    let pubDate = (dateM?.[1] || new Date().toISOString()).replace(/<!\[CDATA\[|\]\]>/g, "").trim();
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

    console.log(`[OSINT] Starting multi-source global collection for user: ${userId}`);
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
        const q = "(military OR conflict OR attack OR terrorism OR sanctions OR diplomatic OR troops OR missile OR protest OR coup OR war OR ceasefire OR humanitarian OR kidnap OR evacuation OR curfew OR riot)";
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

    // ═══════════════ COLLECTOR 6: GOOGLE NEWS — CITY-LEVEL QUERIES ═══════════════
    const CITY_QUERY_TARGETS: string[] = [
      // ── India ──
      "Mumbai","Delhi","New Delhi","Bengaluru","Hyderabad","Chennai","Kolkata","Ahmedabad","Pune","Surat",
      "Jaipur","Lucknow","Kanpur","Nagpur","Indore","Bhopal","Patna","Vadodara","Ludhiana","Agra",
      "Varanasi","Amritsar","Chandigarh","Thiruvananthapuram","Kochi","Coimbatore","Madurai","Visakhapatnam",
      "Vijayawada","Guwahati","Shillong","Imphal","Agartala","Aizawl","Kohima","Itanagar","Gangtok",
      "Ranchi","Raipur","Bhubaneswar","Cuttack","Dehradun","Shimla","Jammu","Srinagar","Leh","Panaji",
      "Noida","Gurugram","Faridabad","Ghaziabad","Meerut","Prayagraj","Rajkot","Jodhpur","Udaipur",
      "Mysuru","Mangaluru","Siliguri","Pulwama","Anantnag","Baramulla","Kargil",
      // ── Middle East ──
      "Baghdad","Mosul","Basra","Tehran","Riyadh","Jeddah","Dubai","Doha","Sanaa","Aden","Beirut",
      "Damascus","Aleppo","Idlib","Gaza","Jerusalem","Tel Aviv","Ankara","Istanbul","Amman","Muscat",
      // ── Europe ──
      "Kyiv","Kharkiv","Odesa","Lviv","Zaporizhzhia","Kherson","Moscow","London","Paris","Berlin",
      "Warsaw","Budapest","Belgrade","Bucharest","Sofia","Tirana","Pristina","Sarajevo","Minsk",
      // ── Asia ──
      "Beijing","Shanghai","Hong Kong","Taipei","Tokyo","Seoul","Pyongyang","Urumqi",
      "Bangkok","Manila","Jakarta","Kuala Lumpur","Singapore","Ho Chi Minh City","Hanoi",
      "Yangon","Phnom Penh","Vientiane","Davao","Zamboanga","Marawi","Aceh","Papua","Sittwe",
      // ── Pakistan/Afghanistan/Bangladesh ──
      "Karachi","Lahore","Islamabad","Peshawar","Quetta","Kabul","Kandahar","Herat",
      "Mazar-i-Sharif","Jalalabad","Dhaka","Chittagong","Colombo","Kathmandu",
      // ── Central Asia (NEW) ──
      "Tashkent","Samarkand","Fergana","Andijan","Bishkek","Osh","Dushanbe","Khujand",
      "Almaty","Astana","Ashgabat","Mary","Gorno-Badakhshan",
      // ── Caucasus (NEW) ──
      "Tbilisi","Yerevan","Baku","Grozny","Sukhumi","Tskhinvali","Stepanakert","Batumi","Gyumri",
      // ── Africa — Sahel/Central (NEW) ──
      "Bamako","Timbuktu","Mopti","Gao","Kidal","Ouagadougou","Bobo-Dioulasso","Niamey","Agadez",
      "Ndjamena","Abeche","Bangui","Khartoum","El Fasher","Darfur","Omdurman","Port Sudan",
      "Juba","Wau","Malakal","Goma","Bukavu","Bunia","Beni","Kinshasa",
      "Nairobi","Mombasa","Kampala","Kigali","Bujumbura","Addis Ababa","Mekelle",
      "Mogadishu","Hargeisa","Bosaso","Djibouti","Asmara",
      "Lagos","Abuja","Maiduguri","Kano","Kaduna","Port Harcourt",
      "Tripoli","Benghazi","Cairo","Casablanca","Tunis","Algiers","Dakar","Abidjan","Conakry",
      "Freetown","Monrovia","Maputo","Pemba","Cabo Delgado","Luanda",
      // ── Pacific Islands (NEW) ──
      "Port Moresby","Lae","Bougainville","Honiara","Guadalcanal","Suva","Port Vila",
      "Noumea","Papeete","Apia","Nuku'alofa","Funafuti","Tarawa","Majuro","Koror",
      // ── Caribbean (NEW) ──
      "Havana","Port-au-Prince","Cap-Haitien","Santo Domingo","Kingston","Bridgetown",
      "Port of Spain","Nassau","San Juan",
      // ── Central America (NEW) ──
      "Guatemala City","Tegucigalpa","San Pedro Sula","San Salvador","Managua","San Jose","Panama City","Belize City",
      // ── Arctic (NEW) ──
      "Murmansk","Tromsø","Reykjavik","Nuuk","Longyearbyen","Yellowknife","Iqaluit",
      // ── South America ──
      "Bogota","Medellin","Cali","Caracas","Lima","Quito","La Paz","Brasilia","Sao Paulo",
      "Buenos Aires","Santiago","Manaus","Belem",
      // ── Global majors ──
      "Washington","New York","London","Paris","Berlin","Moscow","Beijing","Tokyo","Sydney",
    ];

    const CITY_SECURITY_CLAUSE = "(security OR attack OR protest OR riot OR bombing OR shooting OR terror OR hostage OR kidnap OR explosion OR curfew OR lockdown OR evacuation OR strike OR clash OR cyclone OR flood OR earthquake OR tsunami)";

    const googleNewsCityFetch = async (city: string): Promise<RawArticle[]> => {
      try {
        const q = encodeURIComponent(`"${city}" ${CITY_SECURITY_CLAUSE}`);
        const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; OsintBot/1.0)" },
          signal: AbortSignal.timeout(12000),
        });
        if (!resp.ok) return [];
        const xml = await resp.text();
        const items = parseRss(xml, `Google News: ${city}`, "medium");
        for (const it of items) it.sourceType = "googlenews-city";
        sourceStats[`GN:${city}`] = items.length;
        return items.slice(0, 5);
      } catch {
        return [];
      }
    };

    const gdeltCityFetch = async (city: string): Promise<RawArticle[]> => {
      try {
        const q = encodeURIComponent(`"${city}" (attack OR protest OR security OR bombing OR clash OR curfew OR cyclone OR flood)`);
        const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=10&format=json&sort=datedesc`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!resp.ok) return [];
        const data = await resp.json();
        const out: RawArticle[] = [];
        if (data.articles) {
          for (const a of data.articles) {
            if (a.title && a.url) {
              out.push({
                title: a.title,
                description: `${city} — ${a.seendate || ""}`,
                url: a.url,
                sourceName: a.domain || `GDELT: ${city}`,
                publishedAt: a.seendate ? new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6Z")).toISOString() : new Date().toISOString(),
                sourceCredibility: "medium",
                sourceType: "gdelt-city",
              });
            }
          }
        }
        sourceStats[`GDELT:${city}`] = out.length;
        return out;
      } catch {
        return [];
      }
    };

    // Rotate through ~200 cities, 20 per cycle → full coverage every ~10 cycles (~10 min)
    const cycleSlot = Math.floor(Date.now() / 60000) % Math.ceil(CITY_QUERY_TARGETS.length / 20);
    const cityBatch = CITY_QUERY_TARGETS.slice(cycleSlot * 20, cycleSlot * 20 + 20);
    const cityFetches = cityBatch.flatMap(c => [googleNewsCityFetch(c), gdeltCityFetch(c)]);
    console.log(`[CITY] Cycle slot ${cycleSlot}/${Math.ceil(CITY_QUERY_TARGETS.length / 20)}, querying ${cityBatch.length} cities: ${cityBatch.join(", ")}`);

    // ═══════════════ EXECUTE ALL COLLECTORS IN PARALLEL ═══════════════
    const allFetches = [
      ...rssFetches,
      ...telegramFetches,
      gdeltFetch(),
      newsApiFetch(),
      mediastackFetch(),
      ...cityFetches,
    ];

    const results = await Promise.allSettled(allFetches);
    for (const r of results) {
      if (r.status === "fulfilled") allArticles.push(...r.value);
    }

    console.log(`[OSINT] Total raw articles from all collectors: ${allArticles.length}`);

    // ═══════════════ FILTER — OSINT relevance ═══════════════
    const relevant = allArticles.filter(a => isOsintRelevant(a.title, a.description));
    console.log(`[FILTER] OSINT relevant: ${relevant.length}/${allArticles.length}`);

    // ═══════════════ FILTER — FRESHNESS (≤24h) ═══════════════
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const fresh = relevant.filter(a => {
      const t = Date.parse(a.publishedAt);
      if (!Number.isFinite(t)) return false;
      if (t > nowMs + 60 * 60 * 1000) return false;
      return nowMs - t <= MAX_AGE_MS;
    });
    console.log(`[FILTER] Freshness (≤24h): ${fresh.length}/${relevant.length}`);

    // ═══════════════ DEDUPE ═══════════════
    for (const a of fresh) {
      a.fingerprint = await makeFingerprint(a.title, a.url);
    }

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
    ).slice(0, 80);

    console.log(`[DEDUPE] New after DB check: ${newItems.length}`);

    // ═══════════════ PROCESS + INSERT ═══════════════
    let inserted = 0;

    if (newItems.length > 0) {
      const rows = newItems
        .map(a => {
          const geo = geolocate(a.title, a.description);
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

      console.log(`[GEO] Items kept after geolocation filter: ${rows.length}/${newItems.length}`);

      const { data: insertedData, error: insertError } = await adminClient
        .from("news_items")
        .insert(rows)
        .select("id");

      if (insertError) {
        console.error(`[INSERT] Batch error: ${insertError.message}`);
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
