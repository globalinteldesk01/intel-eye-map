from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, asyncio, json, uuid, feedparser, httpx, re, random, time, hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple, Any, Set
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ.get('DB_NAME', 'intel_database')]
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── IMPORT THE FULL 3000+ SOURCE REGISTRY ───────────────────────────────────
try:
    from feeds import get_all_feeds as _get_registry_feeds
    REGISTRY_FEEDS = _get_registry_feeds()
    logger.info(f"Loaded {len(REGISTRY_FEEDS)} feeds from registry")
except ImportError:
    REGISTRY_FEEDS = []
    logger.warning("feeds.py not found — using built-in feed list only")

# ─── BUILT-IN SEED FEEDS ──────────────────────────────────────────────────────
SEED_FEEDS = [
    # TIER 1 — WIRE SERVICES
    {"url":"https://apnews.com/hub/world-news/rss","source":"AP News","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://feeds.reuters.com/reuters/worldNews","source":"Reuters World","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://feeds.reuters.com/reuters/topNews","source":"Reuters Top","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://feeds.bbci.co.uk/news/world/rss.xml","source":"BBC World","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://feeds.bbci.co.uk/news/rss.xml","source":"BBC Breaking","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://www.aljazeera.com/xml/rss/all.xml","source":"Al Jazeera","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://rss.cnn.com/rss/edition_world.rss","source":"CNN World","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://news.un.org/feed/subscribe/en/news/all/rss.xml","source":"UN News","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://www.france24.com/en/rss","source":"France 24","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://rss.dw.com/xml/rss-en-world","source":"Deutsche Welle","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://www.voanews.com/rss/world","source":"VOA World","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://feeds.skynews.com/feeds/rss/world.xml","source":"Sky News World","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://www.theguardian.com/world/rss","source":"Guardian World","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://www.rferl.org/api/epiqzqirrukp","source":"Radio Free Europe","credibility":"high","region":"Global","tier":1,"category":"news"},
    {"url":"https://rfi.fr/en/rss","source":"RFI World","credibility":"high","region":"Africa","tier":1,"category":"news"},
    {"url":"https://apnews.com/hub/wars-and-conflicts/rss","source":"AP Conflicts","credibility":"high","region":"Global","tier":1,"category":"conflict"},
    {"url":"https://apnews.com/hub/disasters/rss","source":"AP Disasters","credibility":"high","region":"Global","tier":1,"category":"disaster"},
    # TIER 2 — REGIONAL
    {"url":"https://kyivindependent.com/feed/","source":"Kyiv Independent","credibility":"high","region":"Eastern Europe","tier":2,"category":"conflict"},
    {"url":"https://www.ukrinform.net/rss/block-lastnews","source":"Ukrinform","credibility":"high","region":"Eastern Europe","tier":2,"category":"news"},
    {"url":"https://euromaidan.press/feed/","source":"Euromaidan Press","credibility":"high","region":"Eastern Europe","tier":2,"category":"conflict"},
    {"url":"https://meduza.io/rss/en/all","source":"Meduza Russia","credibility":"high","region":"Eastern Europe","tier":2,"category":"news"},
    {"url":"https://www.themoscowtimes.com/rss/news","source":"Moscow Times","credibility":"high","region":"Eastern Europe","tier":2,"category":"news"},
    {"url":"https://www.timesofisrael.com/feed/","source":"Times of Israel","credibility":"medium","region":"Middle East","tier":2,"category":"news"},
    {"url":"https://www.haaretz.com/cmlink/1.628765","source":"Haaretz","credibility":"high","region":"Middle East","tier":2,"category":"news"},
    {"url":"https://www.middleeasteye.net/rss","source":"Middle East Eye","credibility":"medium","region":"Middle East","tier":2,"category":"news"},
    {"url":"https://www.iranintl.com/en/rss","source":"Iran International","credibility":"medium","region":"Middle East","tier":2,"category":"news"},
    {"url":"https://www.rudaw.net/english/feed","source":"Rudaw Kurdistan","credibility":"medium","region":"Middle East","tier":2,"category":"news"},
    {"url":"https://www.dawn.com/feeds/home","source":"Dawn Pakistan","credibility":"high","region":"South Asia","tier":2,"category":"news"},
    {"url":"https://www.thehindu.com/news/international/?service=rss","source":"The Hindu","credibility":"high","region":"South Asia","tier":2,"category":"news"},
    {"url":"https://www.irrawaddy.com/feed","source":"The Irrawaddy","credibility":"high","region":"Southeast Asia","tier":2,"category":"conflict"},
    {"url":"https://myanmar-now.org/en/feed/","source":"Myanmar Now","credibility":"high","region":"Southeast Asia","tier":2,"category":"conflict"},
    {"url":"https://www.addisstandard.com/feed/","source":"Addis Standard","credibility":"high","region":"Horn of Africa","tier":2,"category":"news"},
    {"url":"https://sudantribune.com/spip.php?page=backend","source":"Sudan Tribune","credibility":"medium","region":"Horn of Africa","tier":2,"category":"news"},
    {"url":"https://www.dailymaverick.co.za/feed/","source":"Daily Maverick SA","credibility":"high","region":"Southern Africa","tier":2,"category":"news"},
    {"url":"https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf","source":"AllAfrica Latest","credibility":"medium","region":"Africa","tier":2,"category":"news"},
    {"url":"https://insightcrime.org/feed/","source":"InSight Crime","credibility":"high","region":"Latin America","tier":2,"category":"security"},
    {"url":"https://www.rappler.com/rss/nation.xml","source":"Rappler Philippines","credibility":"high","region":"Southeast Asia","tier":2,"category":"news"},
    {"url":"https://www.scmp.com/rss/91/feed","source":"SCMP","credibility":"high","region":"East Asia","tier":2,"category":"news"},
    {"url":"https://thediplomat.com/feed/","source":"The Diplomat","credibility":"high","region":"Asia","tier":2,"category":"analysis"},
    {"url":"https://balkaninsight.com/feed/","source":"Balkan Insight","credibility":"high","region":"Balkans","tier":2,"category":"news"},
    {"url":"https://eurasianet.org/feed","source":"Eurasianet","credibility":"high","region":"Central Asia","tier":2,"category":"analysis"},
    # TIER 3 — SPECIALIST
    {"url":"https://www.crisisgroup.org/rss.xml","source":"ICG Crisis Group","credibility":"high","region":"Global","tier":3,"category":"analysis"},
    {"url":"https://warontherocks.com/feed/","source":"War on the Rocks","credibility":"high","region":"Global","tier":3,"category":"analysis"},
    {"url":"https://www.bellingcat.com/feed/","source":"Bellingcat OSINT","credibility":"high","region":"Global","tier":3,"category":"osint"},
    {"url":"https://www.longwarjournal.org/feed","source":"Long War Journal","credibility":"high","region":"Global","tier":3,"category":"security"},
    {"url":"https://www.understandingwar.org/rss.xml","source":"ISW Ukraine","credibility":"high","region":"Eastern Europe","tier":3,"category":"analysis"},
    {"url":"https://www.acleddata.com/feed/","source":"ACLED Conflict Data","credibility":"high","region":"Global","tier":3,"category":"conflict"},
    {"url":"https://reliefweb.int/updates/rss.xml","source":"ReliefWeb","credibility":"high","region":"Global","tier":3,"category":"humanitarian"},
    {"url":"https://reliefweb.int/disasters/rss.xml","source":"ReliefWeb Disasters","credibility":"high","region":"Global","tier":3,"category":"disaster"},
    {"url":"https://www.icrc.org/en/rss/news","source":"ICRC Red Cross","credibility":"high","region":"Global","tier":3,"category":"humanitarian"},
    {"url":"https://krebsonsecurity.com/feed/","source":"Krebs Security","credibility":"high","region":"Global","tier":3,"category":"cyber"},
    {"url":"https://cyberscoop.com/feed/","source":"CyberScoop","credibility":"high","region":"Global","tier":3,"category":"cyber"},
    {"url":"https://www.cisa.gov/uscert/ncas/alerts.xml","source":"CISA Alerts","credibility":"high","region":"Global","tier":3,"category":"cyber"},
    {"url":"https://www.thedrive.com/the-war-zone/rss","source":"The War Zone","credibility":"high","region":"Global","tier":3,"category":"defense"},
    {"url":"https://breakingdefense.com/feed/","source":"Breaking Defense","credibility":"high","region":"Global","tier":3,"category":"defense"},
    # TIER 4 — OFFICIAL/EMERGENCY
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom","source":"USGS Earthquakes","credibility":"high","region":"Global","tier":4,"category":"disaster"},
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom","source":"USGS M4.5+","credibility":"high","region":"Global","tier":4,"category":"disaster"},
    {"url":"https://www.gdacs.org/xml/rss_24h.xml","source":"GDACS Disasters 24h","credibility":"high","region":"Global","tier":4,"category":"disaster"},
    {"url":"https://www.gdacs.org/Cyclones/xml/rss.xml","source":"GDACS Cyclones","credibility":"high","region":"Global","tier":4,"category":"disaster"},
    {"url":"https://www.who.int/feeds/entity/don/en/rss.xml","source":"WHO Disease Outbreaks","credibility":"high","region":"Global","tier":4,"category":"health"},
    {"url":"https://wwwnc.cdc.gov/travel/notices/rss.xml","source":"CDC Travel Health","credibility":"high","region":"Global","tier":4,"category":"health"},
    {"url":"https://promedmail.org/feed/","source":"ProMED Infectious Disease","credibility":"high","region":"Global","tier":4,"category":"health"},
    {"url":"https://travel.state.gov/content/travel/en/RSS.rss.html","source":"US State Dept Travel","credibility":"high","region":"Global","tier":4,"category":"travel"},
    {"url":"https://www.gov.uk/foreign-travel-advice.atom","source":"UK FCDO Travel","credibility":"high","region":"Global","tier":4,"category":"travel"},
    {"url":"https://aviation-safety.net/news/rss.php","source":"Aviation Safety Net","credibility":"high","region":"Global","tier":4,"category":"aviation"},
    {"url":"https://www.icc-ccs.org/rss/piracy-report.xml","source":"ICC Maritime Piracy","credibility":"high","region":"Global","tier":4,"category":"maritime"},
    {"url":"https://www.amnesty.org/en/rss/","source":"Amnesty International","credibility":"high","region":"Global","tier":4,"category":"human rights"},
    {"url":"https://www.hrw.org/rss","source":"Human Rights Watch","credibility":"high","region":"Global","tier":4,"category":"human rights"},
    # TIER 5 — LOCAL/HYPERLOCAL
    {"url":"https://www.sentinelassam.com/feed/","source":"Sentinel Assam","credibility":"medium","region":"South Asia","tier":5,"category":"news"},
    {"url":"https://www.eastmojo.com/feed/","source":"East Mojo NE India","credibility":"medium","region":"South Asia","tier":5,"category":"news"},
    {"url":"https://morungexpress.com/feed","source":"Morung Express Nagaland","credibility":"medium","region":"South Asia","tier":5,"category":"news"},
    {"url":"https://www.humangle.ng/feed/","source":"HumAngle Nigeria","credibility":"high","region":"West Africa","tier":5,"category":"conflict"},
    {"url":"https://www.dvb.no/feed","source":"DVB Myanmar","credibility":"high","region":"Southeast Asia","tier":5,"category":"conflict"},
    {"url":"https://www.bnionline.net/en/rss.xml","source":"BNI Myanmar","credibility":"medium","region":"Southeast Asia","tier":5,"category":"conflict"},
    {"url":"https://www.narinjara.com/feed","source":"Narinjara Arakan","credibility":"medium","region":"Southeast Asia","tier":5,"category":"conflict"},
    {"url":"https://kivusecurity.org/feed/","source":"Kivu Security Tracker","credibility":"high","region":"Sub-Saharan Africa","tier":5,"category":"conflict"},
    {"url":"https://www.radiookapi.net/rss","source":"Radio Okapi DRC","credibility":"high","region":"Sub-Saharan Africa","tier":5,"category":"conflict"},
    {"url":"https://www.dabangasudan.org/en/all-news/feed","source":"Dabanga Sudan","credibility":"high","region":"Horn of Africa","tier":5,"category":"conflict"},
    {"url":"https://radiotamazuj.org/en/rss.xml","source":"Radio Tamazuj S.Sudan","credibility":"high","region":"Horn of Africa","tier":5,"category":"conflict"},
    {"url":"https://liveuamap.com/rss","source":"LiveUA Map Ukraine","credibility":"high","region":"Eastern Europe","tier":5,"category":"conflict"},
    {"url":"https://blog.borderlandbeat.com/feeds/posts/default","source":"Borderland Beat Cartel","credibility":"medium","region":"Latin America","tier":5,"category":"security"},
    {"url":"https://civil.ge/feed","source":"Civil Georgia","credibility":"high","region":"Caucasus","tier":5,"category":"news"},
    {"url":"https://www.oc-media.org/feed/","source":"OC Media Caucasus","credibility":"high","region":"Caucasus","tier":5,"category":"conflict"},
    {"url":"https://hetq.am/en/rss","source":"Hetq Investigative Armenia","credibility":"high","region":"Caucasus","tier":5,"category":"news"},
    {"url":"https://www.occrp.org/en/rss","source":"OCCRP Investigative","credibility":"high","region":"Global","tier":5,"category":"security"},
]

def _build_rss_feeds() -> List[dict]:
    seen_urls = set()
    merged = []
    for feed in SEED_FEEDS:
        if feed["url"] not in seen_urls:
            seen_urls.add(feed["url"])
            merged.append(feed)
    for feed in REGISTRY_FEEDS:
        if feed["url"] not in seen_urls:
            seen_urls.add(feed["url"])
            merged.append(feed)
    logger.info(f"Total unique RSS feeds: {len(merged)}")
    return merged

RSS_FEEDS = _build_rss_feeds()

# ─── GDELT QUERIES ────────────────────────────────────────────────────────────
GDELT_QUERIES = [
    ("explosion blast bomb IED shooting attack ambush gunfire", "Security", "30min"),
    ("suicide bomber car bomb improvised explosive device checkpoint", "Security", "30min"),
    ("armed robbery kidnapping hostage abduction ransom demand", "Security", "30min"),
    ("assassination targeted killing execution extrajudicial", "Security", "60min"),
    ("gang violence cartel turf drug war organized crime", "Crime", "60min"),
    ("human trafficking smuggling migrants border crossing", "Crime", "60min"),
    ("airstrike shelling bombardment rocket fire drone strike", "Conflict", "30min"),
    ("troops offensive advance ceasefire frontline military operation", "Conflict", "30min"),
    ("insurgent rebel militia attack overrun captured territory", "Conflict", "30min"),
    ("coup attempt mutiny putsch military overthrow government", "Conflict", "30min"),
    ("naval blockade maritime incident warship seized", "Conflict", "60min"),
    ("mercenary Wagner PMC foreign fighters deployment", "Conflict", "60min"),
    ("protest riot demonstration clashes police crackdown tear gas", "Unrest", "30min"),
    ("curfew martial law emergency declared state of exception", "Unrest", "30min"),
    ("ethnic violence communal clash sectarian religious tension", "Unrest", "60min"),
    ("strike workers walkout factory shutdown labor dispute", "Unrest", "60min"),
    ("earthquake flood cyclone wildfire landslide tsunami eruption", "Disaster", "30min"),
    ("mass evacuation disaster declared emergency response", "Disaster", "30min"),
    ("dam collapse infrastructure failure bridge collapse", "Disaster", "60min"),
    ("drought crop failure food shortage famine starvation", "Humanitarian", "60min"),
    ("outbreak epidemic cholera ebola marburg dengue disease deaths", "Health", "60min"),
    ("chemical weapon nerve agent poison gas attack", "WMD", "30min"),
    ("nuclear incident radiation leak radiological emergency", "WMD", "30min"),
    ("biological agent bioterrorism lab leak pathogen", "WMD", "60min"),
    ("power grid attack cyber hack infrastructure outage sabotage", "Cyber", "60min"),
    ("internet shutdown communication blackout network disruption", "Cyber", "60min"),
    ("oil pipeline attack energy sabotage refinery explosion", "Infrastructure", "60min"),
    ("sanctions imposed diplomatic expulsion ambassador recalled", "Diplomacy", "60min"),
    ("nuclear deal weapons program missile test ballistic", "WMD", "60min"),
    ("territorial dispute border clash troops massed", "Conflict", "60min"),
    ("refugee crisis mass displacement internally displaced", "Humanitarian", "60min"),
]

# ─── SCRAPER CONFIG ───────────────────────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Feedly/1.0 (+http://www.feedly.com/fetcher.html; like FeedFetcher-Google)",
    "FeedBurner/1.0 (http://www.FeedBurner.com)",
]
RSS_ACCEPT_HEADERS = [
    "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
    "application/atom+xml,application/rss+xml;q=0.9,application/xml;q=0.8,text/html;q=0.7,*/*;q=0.5",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
]
DOMAIN_OVERRIDES: Dict[str, dict] = {
    "nytimes.com": {"timeout": 20.0, "retry_delay": 3.0},
    "washingtonpost.com": {"timeout": 20.0, "retry_delay": 3.0},
    "ft.com": {"timeout": 20.0, "retry_delay": 3.0},
    "bloomberg.com": {"timeout": 20.0, "retry_delay": 5.0},
    "reuters.com": {"timeout": 15.0, "retry_delay": 1.0},
    "bbc.co.uk": {"timeout": 12.0, "retry_delay": 0.5},
    "bbc.com": {"timeout": 12.0, "retry_delay": 0.5},
    "aljazeera.com": {"timeout": 15.0, "retry_delay": 1.0},
    "gdacs.org": {"timeout": 25.0, "retry_delay": 2.0},
    "gdeltproject.org": {"timeout": 30.0, "retry_delay": 1.0},
}
ENCODING_QUIRK_DOMAINS = {"presstv.ir", "mehrnews.com", "xinhuanet.com"}
TIER_CONCURRENCY = {1: 20, 2: 12, 3: 8, 4: 6, 5: 6}
TIER_MAX_ITEMS = {1: 25, 2: 20, 3: 15, 4: 20, 5: 20}

# ─── NOISE FILTER ────────────────────────────────────────────────────────────
HARD_NOISE_KW = {
    "bollywood","box office","music album","reality show","tv serial",
    "recipe","food review","restaurant review","fashion","beauty tips",
    "makeup tutorial","horoscope","astrology","zodiac","diet plan",
    "weight loss","skin care","hair care","admit card","result declared",
    "smartphone review","gadget review","app update","gaming news","esports",
    "travel tips","holiday package","tourist spot","hotel booking",
    "quarterly earnings","ipo launch","stock listing","brand ambassador",
    "celebrity wedding","birthday party","awards ceremony","reality tv",
}
MUST_INCLUDE = {
    "attack","explosion","bomb","blast","shooting","killed","dead","casualties",
    "murdered","assassinated","executed","lynched","stabbed","gunned",
    "abducted","kidnapped","hostage","ransom","tortured","massacred",
    "protest","riot","unrest","coup","conflict","war","military","airstrike",
    "shelling","bombardment","frontline","troops","offensive","ceasefire",
    "insurgent","rebel","militia","extremist","jihadist","terrorist",
    "drone strike","rocket fire","artillery","mortar",
    "earthquake","flood","hurricane","cyclone","tsunami","disaster","emergency",
    "eruption","wildfire","landslide","dam collapse","chemical spill",
    "arrested","detained","deported","extradited","curfew","martial law",
    "sanctions","nuclear","missile","biological","chemical weapon",
    "crisis","threat","warning","siege","genocide","ethnic cleansing",
    "refugee","displaced","famine","outbreak","epidemic","pandemic","quarantine",
    "houthi","hamas","hezbollah","taliban","isis","al-qaeda","boko haram",
    "wagner","azov","plo","ltte","naxal","maoist","cartel","gang",
    "bus crash","train crash","plane crash","ship sinking","mine collapse",
    "stampede","mass shooting","school attack","hospital attack","market bombing",
}

def score_relevance(title: str, summary: str) -> int:
    text = (title + " " + summary).lower()
    noise = sum(1 for kw in HARD_NOISE_KW if kw in text)
    if noise >= 3: return -1
    if any(kw in text for kw in MUST_INCLUDE): return 3
    if noise >= 2: return -1
    geo_signals = [
        "minister","president","military","armed forces","police operation",
        "opposition","election","border","troops","forces","casualties","victims",
        "emergency declared","martial law","insurgent","rebel","militia",
        "natural disaster","humanitarian","refugees","famine","nuclear","weapons",
        "arrested","detained","expelled","crackdown","deployment","mobilization",
        "security forces","intelligence","counterterrorism","counter-insurgency",
        "naval","aviation","satellite","surveillance","intercepted","interception",
        "power outage","infrastructure","sabotage","hack","breach","leak",
        "displaced","epidemic","outbreak","quarantine","blockade","embargo",
    ]
    geo_count = sum(1 for g in geo_signals if g in text)
    if geo_count >= 2: return 2
    if geo_count == 1 and noise == 0: return 1
    return 0

# ─── GEOGRAPHIC DATA ─────────────────────────────────────────────────────────
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    "Gaza City":(31.5017,34.4674),"Gaza":(31.5017,34.4674),"Rafah":(31.2961,34.2536),
    "West Bank":(31.9500,35.3000),"Tel Aviv":(32.0853,34.7818),"Jerusalem":(31.7683,35.2137),
    "Beirut":(33.8938,35.5018),"Damascus":(33.5138,36.2765),"Aleppo":(36.2021,37.1343),
    "Baghdad":(33.3152,44.3661),"Mosul":(36.3566,43.1580),"Basra":(30.5085,47.7804),
    "Tehran":(35.6892,51.3890),"Kabul":(34.5553,69.2075),"Kandahar":(31.6110,65.6986),
    "Kyiv":(50.4501,30.5234),"Kharkiv":(49.9935,36.2304),"Mariupol":(47.0971,37.5420),
    "Odessa":(46.4825,30.7233),"Donetsk":(48.0159,37.8028),"Zaporizhzhia":(47.8388,35.1396),
    "Kherson":(46.6354,32.6169),"Bakhmut":(48.5954,38.0024),"Avdiivka":(48.1381,37.7558),
    "Moscow":(55.7558,37.6176),"St Petersburg":(59.9343,30.3351),
    "Mogadishu":(2.0469,45.3182),"Khartoum":(15.5007,32.5599),
    "Nairobi":(-1.2921,36.8219),"Lagos":(6.5244,3.3792),"Abuja":(9.0765,7.3986),
    "Addis Ababa":(9.0320,38.7423),"Bamako":(12.6392,-8.0029),"Ouagadougou":(12.3714,-1.5197),
    "Karachi":(24.8607,67.0104),"Lahore":(31.5204,74.3587),"Islamabad":(33.7294,73.0931),
    "Peshawar":(34.0151,71.5249),"Quetta":(30.1798,66.9750),"Swat":(35.2227,72.4258),
    "New Delhi":(28.6139,77.2090),"Mumbai":(19.0760,72.8777),"Imphal":(24.8170,93.9368),
    "Guwahati":(26.1445,91.7362),"Manipur":(24.6637,93.9063),"Nagaland":(25.6751,94.1086),
    "Bangkok":(13.7563,100.5018),"Manila":(14.5995,120.9842),"Jakarta":(-6.2088,106.8456),
    "Yangon":(16.8661,96.1951),"Mandalay":(21.9588,96.0891),"Naypyidaw":(19.7450,96.1297),
    "Beijing":(39.9042,116.4074),"Hong Kong":(22.3193,114.1694),"Taipei":(25.0330,121.5654),
    "Seoul":(37.5665,126.9780),"Pyongyang":(39.0392,125.7625),"Tokyo":(35.6762,139.6503),
    "Mexico City":(19.4326,-99.1332),"Bogota":(4.7110,-74.0721),"Caracas":(10.4806,-66.9036),
    "Port-au-Prince":(18.5944,-72.3074),"Washington":(38.9072,-77.0369),"London":(51.5074,-0.1278),
    "Paris":(48.8566,2.3522),"Berlin":(52.5200,13.4050),
    "Sanaa":(15.3694,44.1910),"Aden":(12.7855,45.0187),"Hodeidah":(14.7979,42.9541),
    "Tripoli":(32.9025,13.1805),"Benghazi":(32.1194,20.0868),
    "Kinshasa":(-4.4419,15.2663),"Goma":(-1.6796,29.2285),"Bunia":(1.5643,30.2488),
    "Butembo":(0.1368,29.2926),"Bukavu":(2.4978,28.8494),
    "Khartoum North":(15.6344,32.5561),"Omdurman":(15.6445,32.4800),
    "Tbilisi":(41.6938,44.8015),"Baku":(40.4093,49.8671),"Yerevan":(40.1872,44.5152),
    "Tashkent":(41.2995,69.2401),"Almaty":(43.2220,76.8512),
    "Colombo":(6.9271,79.8612),"Dhaka":(23.8103,90.4125),"Kathmandu":(27.7172,85.3240),
    "Ulaanbaatar":(47.8864,106.9057),"Dushanbe":(38.5598,68.7870),
    "Jalalabad":(34.4415,70.4360),"Kunduz":(36.7283,68.8681),
    "Herat":(34.3482,62.2040),"Mazar-i-Sharif":(36.7069,67.1100),
    "Kigali":(-1.9441,30.0619),"Bujumbura":(-3.3822,29.3644),"Bangui":(4.3947,18.5582),
    "Ndjamena":(12.1348,15.0557),"Niamey":(13.5137,2.1098),"Dakar":(14.7167,-17.4677),
    "Freetown":(8.4657,-13.2317),"Monrovia":(6.3005,-10.7969),"Abidjan":(5.3600,-4.0083),
    "Accra":(5.6037,-0.1870),"Kampala":(0.3476,32.5825),"Dar es Salaam":(-6.7924,39.2083),
    "Harare":(-17.8252,31.0335),"Lusaka":(-15.4167,28.2833),"Maputo":(-25.9553,32.5892),
    "Antananarivo":(-18.9137,47.5361),"Luanda":(-8.8368,13.2343),
    "Conakry":(9.5370,-13.6773),"Bissau":(11.8636,-15.5977),"Banjul":(13.4531,-16.5775),
}
COUNTRY_COORDS: Dict[str, Tuple[float, float]] = {
    "Afghanistan":(33.93,67.71),"Albania":(41.15,20.17),"Algeria":(28.03,1.66),
    "Angola":(-11.20,17.87),"Argentina":(-38.42,-63.62),"Armenia":(40.07,45.04),
    "Australia":(-25.27,133.78),"Azerbaijan":(40.14,47.58),"Bahrain":(26.04,50.53),
    "Bangladesh":(23.68,90.35),"Belarus":(53.71,27.95),"Bolivia":(-16.29,-63.59),
    "Brazil":(-14.24,-51.93),"Burkina Faso":(12.36,-1.53),"Cambodia":(12.57,104.99),
    "Cameroon":(3.85,11.52),"Canada":(56.13,-106.35),"Central African Republic":(6.61,20.94),
    "Chad":(15.45,18.73),"Chile":(-35.68,-71.54),"China":(35.86,104.20),
    "Colombia":(4.57,-74.30),"Congo":(-0.23,15.83),"Democratic Republic of Congo":(-4.04,21.76),
    "DR Congo":(-4.04,21.76),"Cuba":(21.52,-79.37),"Egypt":(26.82,30.80),
    "El Salvador":(13.79,-88.90),"Eritrea":(15.18,39.78),"Ethiopia":(9.15,40.49),
    "France":(46.23,2.21),"Georgia":(41.69,44.03),"Germany":(51.17,10.45),
    "Ghana":(7.95,-1.02),"Greece":(39.07,21.82),"Guatemala":(15.78,-90.23),
    "Guinea":(9.95,-11.24),"Haiti":(18.97,-72.29),"Honduras":(15.20,-86.24),
    "India":(20.59,78.96),"Indonesia":(-0.79,113.92),"Iran":(32.43,53.69),
    "Iraq":(33.22,43.68),"Israel":(31.05,34.85),"Italy":(41.87,12.57),
    "Japan":(36.20,138.25),"Jordan":(30.59,36.24),"Kazakhstan":(48.02,66.92),
    "Kenya":(-0.02,37.91),"Kosovo":(42.60,20.90),"Kuwait":(29.31,47.48),
    "Lebanon":(33.85,35.86),"Libya":(26.34,17.23),"Mali":(17.57,-4.00),
    "Mexico":(23.63,-102.55),"Morocco":(31.79,-7.09),"Mozambique":(-18.67,35.53),
    "Myanmar":(21.92,95.96),"Nepal":(28.39,84.12),"Nicaragua":(12.87,-85.21),
    "Niger":(17.61,8.08),"Nigeria":(9.08,8.68),"North Korea":(40.34,127.51),
    "Pakistan":(30.38,69.35),"Palestine":(31.95,35.23),"Peru":(-9.19,-75.02),
    "Philippines":(12.88,121.77),"Russia":(61.52,105.32),"Rwanda":(-1.94,29.87),
    "Saudi Arabia":(23.89,45.08),"Somalia":(5.15,46.20),"South Africa":(-30.56,22.94),
    "South Korea":(35.91,127.77),"South Sudan":(7.87,29.87),"Spain":(40.46,-3.75),
    "Sudan":(12.86,30.22),"Syria":(34.80,38.10),"Taiwan":(23.70,121.00),
    "Turkey":(38.96,35.24),"Ukraine":(48.38,31.17),"United Arab Emirates":(23.42,53.85),
    "UAE":(23.42,53.85),"United Kingdom":(55.38,-3.44),"UK":(55.38,-3.44),
    "United States":(37.09,-95.71),"USA":(37.09,-95.71),"Venezuela":(6.42,-66.59),
    "Vietnam":(14.06,108.28),"Yemen":(15.55,48.52),"Zimbabwe":(-19.02,29.15),
    "Sierra Leone":(8.46,-11.78),"Liberia":(6.43,-9.43),"Ivory Coast":(7.54,-5.55),
    "Togo":(8.62,0.82),"Benin":(9.31,2.32),"Senegal":(14.50,-14.45),
    "Gambia":(13.44,-15.31),"Guinea-Bissau":(11.80,-15.18),"Mauritania":(21.01,-10.94),
    "Tanzania":(-6.37,34.89),"Uganda":(1.37,32.29),"Burundi":(-3.37,29.92),
    "Malawi":(-13.25,34.30),"Zambia":(-13.13,27.85),"Madagascar":(-18.77,46.87),
    "Namibia":(-22.96,18.49),"Botswana":(-22.33,24.68),"Lesotho":(-29.61,28.23),
    "Eswatini":(-26.52,31.47),"Djibouti":(11.83,42.59),"Comoros":(-11.65,43.33),
    "Cape Verde":(16.54,-23.04),"Tajikistan":(38.86,71.28),"Turkmenistan":(38.97,59.56),
    "Kyrgyzstan":(41.20,74.77),"Uzbekistan":(41.38,64.59),"Mongolia":(46.86,103.85),
    "Laos":(19.86,102.50),"Timor-Leste":(-8.87,125.73),"Brunei":(4.54,114.73),
    "Papua New Guinea":(-6.31,143.96),"Fiji":(-16.58,179.41),"Vanuatu":(-15.38,166.96),
    "Solomon Islands":(-9.43,160.16),"Trinidad and Tobago":(10.69,-61.22),
    "Jamaica":(18.11,-77.30),"Barbados":(13.19,-59.54),"Global":(20.00,0.00),
}

geo_cache: Dict[str, Tuple[float, float]] = {}
nominatim_lock = asyncio.Semaphore(1)
nom_last = 0.0

async def geocode(city: str, country: str) -> Tuple[float, float, str]:
    global nom_last
    city = (city or "").strip()
    country = (country or "Global").strip()
    if not city or city.lower() in ("unknown", "global", "", "n/a"):
        lat, lon = COUNTRY_COORDS.get(country, COUNTRY_COORDS.get("Global", (20.0, 0.0)))
        return round(lat + random.uniform(-0.3, 0.3), 4), round(lon + random.uniform(-0.3, 0.3), 4), "country"
    if city in CITY_COORDS:
        lat, lon = CITY_COORDS[city]
        return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"
    city_lower = city.lower()
    for known_city, coords in CITY_COORDS.items():
        if known_city.lower() in city_lower or city_lower in known_city.lower():
            lat, lon = coords
            return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"
    cache_key = f"{city},{country}".lower()
    if cache_key in geo_cache:
        lat, lon = geo_cache[cache_key]
        return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"
    cached = await db.geo_cache.find_one({"key": cache_key})
    if cached:
        geo_cache[cache_key] = (cached["lat"], cached["lon"])
        return round(cached["lat"] + random.uniform(-0.01, 0.01), 5), round(cached["lon"] + random.uniform(-0.01, 0.01), 5), "city"
    async with nominatim_lock:
        now = time.time()
        if (now - nom_last) < 1.1:
            await asyncio.sleep(1.1 - (now - nom_last))
        nom_last = time.time()
        try:
            query = f"{city}, {country}" if country and country.lower() not in city.lower() else city
            async with httpx.AsyncClient(timeout=8.0) as h:
                resp = await h.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": query, "format": "json", "limit": 1, "addressdetails": "0"},
                    headers={"User-Agent": "GlobalIntelDesk/6.0 (globalinteldesk@globalinteldesk.com)"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                        geo_cache[cache_key] = (lat, lon)
                        try:
                            await db.geo_cache.insert_one({"key": cache_key, "lat": lat, "lon": lon})
                        except Exception:
                            pass
                        return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"
        except Exception as e:
            logger.warning(f"Nominatim failed for '{city},{country}': {e}")
    lat, lon = COUNTRY_COORDS.get(country, (20.0, 0.0))
    return round(lat + random.uniform(-0.3, 0.3), 4), round(lon + random.uniform(-0.3, 0.3), 4), "country"

# ─── EVENT CLUSTERING ─────────────────────────────────────────────────────────
# Groups articles about the same real-world event to avoid flooding the feed
# with 12 nearly-identical headlines about one airstrike.

def _extract_key_terms(title: str) -> Set[str]:
    """Extract meaningful terms from a title for similarity comparison."""
    stopwords = {
        "the","a","an","in","of","to","is","are","was","were","has","have","had",
        "at","on","for","with","by","and","or","but","as","that","this","it","its",
        "after","before","over","under","from","into","out","up","down","not",
        "says","said","report","reports","sources","officials","officials",
        "amid","as","be","been","being","do","did","does","may","might","will",
        "would","could","should","than","then","when","where","who","which",
        "killed","dead","attack","attacks","kills","killing",
    }
    words = re.findall(r'\b[a-zA-Z]{3,}\b', title.lower())
    return {w for w in words if w not in stopwords}

def _title_similarity(a: str, b: str) -> float:
    """Jaccard similarity between two title term sets."""
    terms_a = _extract_key_terms(a)
    terms_b = _extract_key_terms(b)
    if not terms_a or not terms_b:
        return 0.0
    intersection = terms_a & terms_b
    union = terms_a | terms_b
    return len(intersection) / len(union)

def cluster_events(items: List[dict], threshold: float = 0.45) -> List[dict]:
    """
    Cluster articles about the same event. Returns one representative item per
    cluster (the highest-relevance / highest-credibility source), with a
    source_count and corroborating_sources list attached.
    
    This is O(n²) but n is bounded to ~120 items per cycle so it's fast enough.
    """
    if not items:
        return items

    # Sort: tier-1 and high-credibility first so they become cluster leaders
    CRED_RANK = {"high": 0, "medium": 1, "low": 2}
    items_sorted = sorted(
        items,
        key=lambda x: (x.get("source_tier", 3), CRED_RANK.get(x.get("source_credibility", "medium"), 1))
    )

    assigned = [False] * len(items_sorted)
    clusters: List[dict] = []

    for i, item in enumerate(items_sorted):
        if assigned[i]:
            continue
        cluster_members = [item]
        assigned[i] = True
        for j in range(i + 1, len(items_sorted)):
            if assigned[j]:
                continue
            sim = _title_similarity(item["title"], items_sorted[j]["title"])
            if sim >= threshold:
                cluster_members.append(items_sorted[j])
                assigned[j] = True

        # The first member is already the best source (sorted above)
        leader = cluster_members[0].copy()
        leader["source_count"] = len(cluster_members)
        leader["corroborating_sources"] = [
            m["source"] for m in cluster_members[1:8]  # cap at 7 extra
        ]
        # Boost confidence if multiple credible sources agree
        if len(cluster_members) >= 3:
            leader["confidence_score"] = min(0.95, leader.get("confidence_score", 0.6) + 0.15)
        elif len(cluster_members) == 2:
            leader["confidence_score"] = min(0.92, leader.get("confidence_score", 0.6) + 0.08)
        clusters.append(leader)

    logger.info(f"Clustering: {len(items)} articles → {len(clusters)} unique events")
    return clusters

# ─── CONFIDENCE TRIANGULATION ─────────────────────────────────────────────────
# Raises or lowers threat_level based on cross-source agreement.

CREDIBILITY_WEIGHT = {"high": 1.0, "medium": 0.6, "low": 0.3}

def triangulate_confidence(item: dict) -> dict:
    """
    Adjust threat level and confidence based on corroboration count and
    source credibility. Prevents a single low-credibility source from
    triggering a 'critical' alert.
    """
    source_count = item.get("source_count", 1)
    corroborating = item.get("corroborating_sources", [])
    cred = item.get("source_credibility", "medium")
    base_weight = CREDIBILITY_WEIGHT.get(cred, 0.6)
    threat = item.get("threat_level", "low")
    conf = item.get("confidence_score", 0.6)

    # Single low-credibility source claiming 'critical' → downgrade to 'high'
    if source_count == 1 and cred == "low" and threat == "critical":
        item["threat_level"] = "high"
        item["confidence_level"] = "breaking"
        item["confidence_score"] = min(conf, 0.55)

    # Multiple high-credibility sources → upgrade confidence
    if source_count >= 3 and base_weight >= 0.6:
        if threat == "elevated":
            item["threat_level"] = "high"
        item["confidence_level"] = "verified"
        item["confidence_score"] = min(0.95, conf + 0.1)

    # Add a corroboration note to severity_summary
    if corroborating:
        note = f" [Corroborated by: {', '.join(corroborating[:3])}]"
        item["severity_summary"] = (item.get("severity_summary", "") + note)[:300]

    return item

# ─── PRIORITY ALERT QUEUE ─────────────────────────────────────────────────────
# Critical items bypass the 90-second cycle and are immediately broadcast.

priority_queue: asyncio.Queue = asyncio.Queue()

async def priority_alert_worker():
    """
    Watches the priority queue and immediately stores + broadcasts critical items.
    Runs as a background task — never waits for the main fetch cycle.
    """
    logger.info("Priority alert worker started")
    while True:
        try:
            item = await asyncio.wait_for(priority_queue.get(), timeout=5.0)
            try:
                await db.news_items.insert_one({k: v for k, v in item.items() if k != "_id"})
            except Exception as e:
                if "duplicate" not in str(e).lower():
                    logger.error(f"Priority insert: {e}")
            clean = {k: v for k, v in item.items() if k != "_id"}
            await broadcast({"type": "priority_alert", "item": clean})
            logger.info(f"PRIORITY ALERT dispatched: {item.get('title', '')[:80]}")
        except asyncio.TimeoutError:
            continue
        except Exception as e:
            logger.error(f"Priority alert worker: {e}")

def is_priority(item: dict) -> bool:
    """True if this item should skip the queue and be broadcast immediately."""
    if item.get("threat_level") != "critical":
        return False
    title_lower = item.get("title", "").lower()
    summary_lower = item.get("summary", "").lower()
    text = title_lower + " " + summary_lower
    IMMEDIATE_TRIGGERS = [
        "nuclear", "radiological", "chemical weapon", "nerve agent", "sarin",
        "biological weapon", "bioterrorism", "dirty bomb", "mass casualty",
        "coup", "president assassinated", "prime minister killed",
        "tsunami warning", "major earthquake", "magnitude 7", "magnitude 8", "magnitude 9",
        "pandemic declared", "who declares", "global health emergency",
        "nuclear plant", "reactor meltdown", "radiation leak",
        "hundreds killed", "thousands killed", "mass grave",
    ]
    return any(t in text for t in IMMEDIATE_TRIGGERS)

# ─── AUTONOMOUS AI ORCHESTRATOR ───────────────────────────────────────────────
# The brain of the system. Runs in its own loop, analyzes what's trending,
# decides what needs deeper investigation, and spawns targeted sub-crawls.

class OrchestratorState:
    def __init__(self):
        self.active_topics: Dict[str, dict] = {}      # topic → {count, last_seen, query}
        self.hot_regions: Dict[str, int] = {}          # region → article_count_last_hour
        self.discovered_feeds: List[dict] = []         # auto-discovered feed URLs
        self.feed_health: Dict[str, dict] = {}         # url → {ok, fails, last_ok}
        self.topic_queries: List[str] = []             # dynamic GDELT queries
        self.last_analysis: float = 0.0
        self.cycle_count: int = 0

orchestrator = OrchestratorState()

async def orchestrator_analyze() -> dict:
    """
    AI-powered analysis of current intelligence landscape.
    Returns decisions: which topics to investigate deeper, which regions
    to boost, and new GDELT queries to spawn.
    """
    if not EMERGENT_LLM_KEY:
        return {}

    try:
        # Pull last 2 hours of data for analysis
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        recent = await db.news_items.find(
            {"published_at": {"$gte": cutoff}},
            {"title": 1, "category": 1, "threat_level": 1, "region": 1, "country": 1, "tags": 1}
        ).sort("published_at", -1).limit(80).to_list(length=80)

        if not recent:
            return {}

        # Build a compact summary for the AI
        critical_items = [r for r in recent if r.get("threat_level") in ("critical", "high")]
        region_counts: Dict[str, int] = {}
        for r in recent:
            reg = r.get("region", "Global")
            region_counts[reg] = region_counts.get(reg, 0) + 1

        top_regions = sorted(region_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        critical_titles = [r["title"][:100] for r in critical_items[:10]]

        summary = {
            "total_items_2h": len(recent),
            "critical_count": len(critical_items),
            "top_regions": top_regions,
            "critical_headlines": critical_titles,
        }

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"orchestrator-{uuid.uuid4()}",
            system_message=(
                "You are an autonomous intelligence collection orchestrator. "
                "Analyze the current news landscape and decide what needs deeper investigation. "
                "Return ONLY valid JSON, no markdown, no preamble."
            )
        ).with_model("openai", "gpt-4.1-nano")

        prompt = f"""Current intelligence landscape (last 2 hours):
{json.dumps(summary, indent=2)}

Decide the next collection priorities. Return JSON with this exact structure:
{{
  "hot_topics": ["topic1", "topic2", "topic3"],
  "new_gdelt_queries": ["query phrase 1", "query phrase 2"],
  "boost_regions": ["Region1", "Region2"],
  "alert_message": "one sentence situational awareness summary",
  "severity_trend": "escalating|stable|de-escalating"
}}

Keep queries short (4-8 words), focused on crisis signals. Max 3 topics, 2 queries, 2 regions."""

        resp = await chat.send_message(UserMessage(text=prompt))
        clean = re.sub(r'```(?:json)?\n?', '', resp.strip()).rstrip('`').strip()
        decisions = json.loads(clean)

        # Update orchestrator state
        for topic in decisions.get("hot_topics", []):
            orchestrator.active_topics[topic] = {
                "count": orchestrator.active_topics.get(topic, {}).get("count", 0) + 1,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }

        for region in decisions.get("boost_regions", []):
            orchestrator.hot_regions[region] = orchestrator.hot_regions.get(region, 0) + 1

        new_queries = decisions.get("new_gdelt_queries", [])
        orchestrator.topic_queries = new_queries[:3]  # keep it bounded

        logger.info(f"Orchestrator: {decisions.get('severity_trend','?')} | topics={decisions.get('hot_topics',[])} | alert={decisions.get('alert_message','')[:80]}")

        # Store orchestrator decision in DB for frontend
        await db.orchestrator_log.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "decisions": decisions,
            "landscape": summary,
        })

        return decisions

    except Exception as e:
        logger.warning(f"Orchestrator analysis failed: {e}")
        return {}

async def orchestrator_targeted_crawl(topics: List[str]) -> List[dict]:
    """
    Spawn targeted GDELT queries for topics the orchestrator identified.
    Returns new items found.
    """
    if not topics:
        return []
    items = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as h:
            for topic in topics[:3]:  # max 3 targeted queries
                try:
                    resp = await h.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={
                            "query": topic,
                            "mode": "artlist",
                            "maxrecords": "15",
                            "format": "json",
                            "timespan": "30min",
                            "sort": "DateDesc",
                        },
                        timeout=15.0
                    )
                    if resp.status_code == 200:
                        for art in resp.json().get("articles", []):
                            t = art.get("title", "").strip()
                            u = art.get("url", "").strip()
                            s = art.get("seendescription", t)[:1000]
                            if t and len(t) > 15 and u:
                                rel = score_relevance(t, s)
                                if rel < 0:
                                    continue
                                items.append({
                                    "title": t[:300],
                                    "summary": s,
                                    "url": u,
                                    "source": f"AI-Targeted/{art.get('domain', topic)}",
                                    "source_credibility": "medium",
                                    "source_region": "Global",
                                    "source_tier": 3,
                                    "category_hint": "conflict",
                                    "published_at": datetime.now(timezone.utc).isoformat(),
                                    "relevance": rel,
                                    "orchestrator_topic": topic,
                                })
                    await asyncio.sleep(0.3)
                except Exception as e:
                    logger.debug(f"Targeted crawl '{topic}': {e}")
    except Exception as e:
        logger.warning(f"Orchestrator targeted crawl: {e}")
    return items

async def orchestrator_discover_feeds(hot_regions: List[str]) -> List[dict]:
    """
    Auto-discover new RSS feeds for hot regions using GDELT's domain data.
    Adds discovered feeds to the dynamic feed pool.
    """
    if not hot_regions or not EMERGENT_LLM_KEY:
        return []
    discovered = []
    existing_urls = {f["url"] for f in RSS_FEEDS}
    existing_urls.update(f["url"] for f in orchestrator.discovered_feeds)
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"feed-discovery-{uuid.uuid4()}",
            system_message="You are a news feed discovery specialist. Return ONLY valid JSON."
        ).with_model("openai", "gpt-4.1-nano")

        prompt = f"""Hot crisis regions right now: {hot_regions}

Suggest up to 3 RSS feed URLs from reliable local/regional news sources covering these regions.
Return JSON only:
{{
  "feeds": [
    {{"url": "https://...", "source": "Source Name", "region": "Region", "credibility": "high|medium", "tier": 4}}
  ]
}}
Only suggest feeds you are confident exist and are active RSS/Atom feeds."""

        resp = await chat.send_message(UserMessage(text=prompt))
        clean = re.sub(r'```(?:json)?\n?', '', resp.strip()).rstrip('`').strip()
        data = json.loads(clean)
        for feed in data.get("feeds", []):
            url = feed.get("url", "")
            if url and url not in existing_urls and url.startswith("http"):
                feed["category"] = "news"
                orchestrator.discovered_feeds.append(feed)
                discovered.append(feed)
                existing_urls.add(url)
                logger.info(f"Auto-discovered feed: {feed.get('source')} → {url}")
    except Exception as e:
        logger.debug(f"Feed discovery: {e}")
    return discovered

async def orchestrator_self_heal():
    """
    Check feed health and remove consistently failing feeds from the active pool.
    Periodically re-tests them to see if they've recovered.
    """
    global RSS_FEEDS
    newly_dead = []
    recovered = []

    for feed in list(RSS_FEEDS):
        url = feed["url"]
        health = orchestrator.feed_health.get(url, {"ok": 0, "fails": 0, "last_ok": 0})

        # If failing 10+ consecutive times and it's not a tier-1 feed, suspend it
        if health.get("fails", 0) >= 10 and feed.get("tier", 2) > 1:
            newly_dead.append(feed)
        elif health.get("fails", 0) == 0 and url in {f["url"] for f in newly_dead}:
            recovered.append(feed)

    for feed in newly_dead:
        if feed in RSS_FEEDS:
            RSS_FEEDS.remove(feed)
            logger.warning(f"Suspended failing feed: {feed['source']} ({feed['url'][:60]})")

    if newly_dead or recovered:
        logger.info(f"Self-heal: suspended={len(newly_dead)}, recovered={len(recovered)}, active={len(RSS_FEEDS)}")

def update_feed_health(url: str, success: bool):
    """Called by the scraper to track per-feed health."""
    health = orchestrator.feed_health.get(url, {"ok": 0, "fails": 0, "last_ok": 0.0})
    if success:
        health["ok"] = health.get("ok", 0) + 1
        health["fails"] = 0
        health["last_ok"] = time.time()
    else:
        health["fails"] = health.get("fails", 0) + 1
    orchestrator.feed_health[url] = health

async def orchestrator_loop():
    """
    Main orchestrator loop. Runs every 5 minutes (3 fetch cycles).
    Analyzes, decides, and dispatches targeted crawls.
    """
    logger.info("Autonomous AI orchestrator started")
    await asyncio.sleep(30)  # Let first fetch complete first
    while True:
        try:
            orchestrator.cycle_count += 1
            # Full AI analysis every 5 minutes
            decisions = await orchestrator_analyze()
            if decisions:
                # Targeted sub-crawl for hot topics
                hot_topics = decisions.get("hot_topics", [])
                new_items = await orchestrator_targeted_crawl(hot_topics)
                if new_items:
                    logger.info(f"Orchestrator targeted crawl: {len(new_items)} new items")
                    # Queue these for normal processing
                    await _process_and_store(new_items, source="orchestrator")

                # Auto-discover feeds for hot regions
                hot_regions = list(orchestrator.hot_regions.keys())[:3]
                if hot_regions and orchestrator.cycle_count % 6 == 0:
                    await orchestrator_discover_feeds(hot_regions)

                # Broadcast situational awareness update
                alert_msg = decisions.get("alert_message", "")
                if alert_msg:
                    await broadcast({
                        "type": "situational_awareness",
                        "message": alert_msg,
                        "trend": decisions.get("severity_trend", "stable"),
                        "hot_regions": list(orchestrator.hot_regions.keys())[:5],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

            # Self-heal dead feeds
            await orchestrator_self_heal()

        except Exception as e:
            logger.error(f"Orchestrator loop: {e}")

        await asyncio.sleep(300)  # 5 minutes

# ─── ENRICHMENT ───────────────────────────────────────────────────────────────
async def enrich(title: str, summary: str, source: str) -> dict:
    result = rule_enrich(title, summary, source)
    if result["_confidence"] < 0.65 and result.get("_threat_score", 0) >= 2:
        try:
            ai_result = await _ai_enrich_single(title, summary, source)
            if ai_result:
                result.update(ai_result)
        except Exception as e:
            logger.warning(f"AI enrichment skipped: {e}")
    result.pop("_confidence", None)
    result.pop("_threat_score", None)
    return result

def rule_enrich(title: str, summary: str, source: str = "") -> dict:
    text = (title + " " + (summary or "")).lower()
    cat_scores: Dict[str, int] = {
        "conflict": 0, "security": 0, "diplomacy": 0,
        "economy": 0, "humanitarian": 0, "technology": 0,
    }
    CAT_KEYWORDS = {
        "conflict": ["war","battle","frontline","airstrike","shelling","bombardment","troops","offensive","ceasefire","fighting","killed in battle","military operation","ground invasion","siege","artillery","rocket fire","drone strike","armed conflict","insurgency","militia","guerrilla","rebel attack","combat","warzone","advancing forces","military advance","overrun","captured","occupied","frontline advance","push back","encircled"],
        "security": ["explosion","bomb","blast","attack","shooting","gunfire","stabbing","terrorism","terrorist","hostage","arrest","raid","operation","ied","car bomb","suicide bomber","manhunt","security forces","police operation","assassination","ambush","armed robbery","kidnapping","abduction","threat","plot","foiled attack","security breach","massacre","gunmen","attackers","perpetrators","gunman","shooter","bomber"],
        "diplomacy": ["summit","diplomatic","sanctions","negotiations","treaty","agreement","minister","president visit","ambassador","embassy","foreign policy","ceasefire talks","peace process","bilateral","multilateral","un resolution","nato","eu","security council","mediation","envoy","declaration","alliance","partnership","diplomatic crisis","expel ambassador"],
        "economy": ["economy","gdp","inflation","recession","financial","market","trade","oil price","gas price","currency","central bank","interest rate","investment","exports","imports","debt","budget","revenue","growth","unemployment","poverty","economic crisis","food prices","cost of living"],
        "humanitarian": ["refugees","displaced","famine","starvation","humanitarian","aid","disaster","earthquake","flood","cyclone","tsunami","landslide","drought","food insecurity","malnutrition","disease outbreak","epidemic","cholera","ebola","evacuation","shelter","relief","msf","icrc","unhcr","crisis","mass displacement","civilian casualties","civilian deaths","bus crash","train crash","plane crash","shipwreck","mine collapse","stampede","building collapse","fire kills","deaths reported"],
        "technology": ["cyber","hacking","malware","ransomware","surveillance","drone technology","artificial intelligence","ai weapons","cyber attack","data breach","infrastructure hack","electric grid","water system hack","satellite","internet shutdown","communication blackout","signal jamming"],
    }
    for cat, kws in CAT_KEYWORDS.items():
        score = sum(2 if kw in text else 0 for kw in kws)
        if cat == "conflict" and source.lower() in ["kyiv independent","ukrinform","rudaw","al jazeera","myanmar now"]:
            score += 1
        if cat == "humanitarian" and source.lower() in ["reliefweb","icrc red cross","un news","gdacs disasters"]:
            score += 3
        if cat == "security" and source.lower() in ["bellingcat osint","acled conflict data","long war journal"]:
            score += 2
        cat_scores[cat] = score
    category = max(cat_scores, key=lambda k: cat_scores[k])
    cat_confidence = cat_scores[category] / (sum(cat_scores.values()) + 1)
    if sum(cat_scores.values()) == 0: category = "security"; cat_confidence = 0.3
    threat_score = 0
    CRITICAL_KW = ["killed","dead","casualties","deaths","fatalities","massacre","genocide","nuclear","chemical weapon","biological","wmd","mass casualty","explosion kills","airstrike kills","bomb kills","shooting kills","attack kills","people dead","bodies found","mass grave","hundreds dead","dozens killed","civilians dead"]
    HIGH_KW = ["attack","explosion","bomb","blast","airstrike","military operation","offensive","clashes","fighting","armed conflict","hostage","kidnapping","coup","occupied","siege","shelling","rocket fire","missile strike","drone attack","ambush","major disaster","earthquake","flood","eruption","tsunami","cyclone","shooting","gunfire","stabbing","robbery","abduction","arrested","detained"]
    ELEVATED_KW = ["protest","demonstration","riot","unrest","tension","warning","threat","sanctions","crisis","emergency","curfew","political instability","arrests","crackdown","forces deployed","military buildup","standoff","heightened alert","displaced","epidemic","outbreak","strike","blockade","rallies","march","deployed","mobilized","reinforced","evacuated","shut down"]
    if any(kw in text for kw in CRITICAL_KW):
        critical_boosters = ["mass","dozens","hundreds","thousands","multiple","several","many","scores"]
        if any(b in text for b in critical_boosters) or any(kw in text for kw in ["nuclear","chemical","genocide","massacre"]):
            threat_level = "critical"; threat_score = 4
        else:
            threat_level = "high"; threat_score = 3
    elif any(kw in text for kw in HIGH_KW):
        threat_level = "high"; threat_score = 3
    elif any(kw in text for kw in ELEVATED_KW):
        threat_level = "elevated"; threat_score = 2
    else:
        threat_level = "low"; threat_score = 1
    detected_city = ""
    detected_country = "Global"
    title_lower = title.lower()
    for city in sorted(CITY_COORDS.keys(), key=len, reverse=True):
        if city.lower() in title_lower:
            detected_city = city
            break
    if not detected_city:
        for city in sorted(CITY_COORDS.keys(), key=len, reverse=True):
            if city.lower() in text:
                detected_city = city
                break
    for country in sorted(COUNTRY_COORDS.keys(), key=len, reverse=True):
        if len(country) < 4: continue
        if country.lower() in text and country not in ["Global","International","Europe","Africa","Asia"]:
            detected_country = country
            break
    city_to_country = {
        "Gaza City": "Palestine","Gaza": "Palestine","Rafah": "Palestine",
        "West Bank": "Palestine","Kyiv": "Ukraine","Kharkiv": "Ukraine",
        "Odessa": "Ukraine","Donetsk": "Ukraine","Zaporizhzhia": "Ukraine",
        "Moscow": "Russia","Baghdad": "Iraq","Tehran": "Iran",
        "Beirut": "Lebanon","Damascus": "Syria","Kabul": "Afghanistan",
        "Karachi": "Pakistan","Lahore": "Pakistan","Islamabad": "Pakistan",
        "Peshawar": "Pakistan","Mogadishu": "Somalia","Khartoum": "Sudan",
        "Nairobi": "Kenya","Lagos": "Nigeria","Abuja": "Nigeria",
        "Yangon": "Myanmar","Mandalay": "Myanmar",
        "Guwahati": "India","Imphal": "India",
    }
    if detected_city and detected_country == "Global":
        detected_country = city_to_country.get(detected_city, detected_country)
    COUNTRY_TO_REGION = {
        "Israel": "Middle East","Palestine": "Middle East","Lebanon": "Middle East",
        "Syria": "Middle East","Iraq": "Middle East","Iran": "Middle East",
        "Jordan": "Middle East","Saudi Arabia": "Middle East","Yemen": "Middle East",
        "Turkey": "Middle East","UAE": "Middle East","Kuwait": "Middle East",
        "Ukraine": "Eastern Europe","Russia": "Eastern Europe","Belarus": "Eastern Europe",
        "Georgia": "Caucasus","Armenia": "Caucasus","Azerbaijan": "Caucasus",
        "Kosovo": "Balkans","Serbia": "Balkans","Bosnia": "Balkans",
        "Pakistan": "South Asia","India": "South Asia","Bangladesh": "South Asia",
        "Afghanistan": "South Asia","Nepal": "South Asia","Sri Lanka": "South Asia",
        "Myanmar": "Southeast Asia","Thailand": "Southeast Asia","Philippines": "Southeast Asia",
        "Indonesia": "Southeast Asia","Vietnam": "Southeast Asia",
        "China": "East Asia","North Korea": "East Asia","South Korea": "East Asia",
        "Nigeria": "West Africa","Mali": "Sahel","Burkina Faso": "Sahel",
        "Niger": "Sahel","Chad": "Sahel","Sudan": "Horn of Africa",
        "Ethiopia": "Horn of Africa","Somalia": "Horn of Africa",
        "Kenya": "East Africa","Uganda": "East Africa",
        "DR Congo": "Sub-Saharan Africa","Democratic Republic of Congo": "Sub-Saharan Africa",
        "South Sudan": "Horn of Africa","Libya": "North Africa","Egypt": "North Africa",
        "Mexico": "Central America","Colombia": "South America","Venezuela": "South America",
        "Haiti": "Caribbean","Cuba": "Caribbean",
        "Kazakhstan": "Central Asia","Uzbekistan": "Central Asia",
        "United States": "North America","Canada": "North America",
        "United Kingdom": "Western Europe","France": "Western Europe",
        "Germany": "Western Europe","Australia": "Pacific",
    }
    region = COUNTRY_TO_REGION.get(detected_country, "Global")
    actor_type = "state"
    if any(w in text for w in ["hamas","hezbollah","taliban","isis","al-qaeda","boko haram","houthi","npa","eln","farc","ms-13","cartel","rebel","militant","insurgent","extremist","jihadist","terrorist group","armed group","wagner","azov","plo","ltte","naxal","maoist","gang","militia"]):
        actor_type = "non-state"
    elif any(w in text for w in ["un ","nato","eu ","african union","osce","icrc","unhcr","wfp","who "]):
        actor_type = "organization"
    confidence_level = "developing"
    if any(w in text for w in ["confirmed","official","spokesman","statement","ministry","government says","authorities confirm"]):
        confidence_level = "verified"
    elif any(w in text for w in ["breaking","just in","developing","reports","alleged","claimed","unconfirmed","sources say"]):
        confidence_level = "breaking"
    tag_map = {
        "terrorism": ["terror","terrorist","extremist","jihadist","suicide bomber"],
        "conflict": ["battle","frontline","airstrike","shelling","offensive"],
        "security": ["attack","explosion","shooting","bomb","gunfire"],
        "displacement": ["refugees","displaced","flee","evacuation","exodus"],
        "diplomacy": ["summit","sanctions","treaty","agreement","diplomatic"],
        "natural disaster": ["earthquake","flood","cyclone","tsunami","eruption"],
        "health": ["epidemic","outbreak","disease","virus","cholera"],
        "kidnapping": ["kidnap","hostage","abduct","ransom","abduction"],
        "nuclear": ["nuclear","radioactive","uranium","plutonium","warhead"],
        "protest": ["protest","riot","demonstration","unrest","march"],
        "crime": ["cartel","gang","robbery","trafficking","drug"],
        "cyber": ["cyber","hack","ransomware","breach","infrastructure attack"],
        "transport": ["crash","collision","accident","shipwreck","derailment"],
    }
    tags = [tag for tag, kws in tag_map.items() if any(kw in text for kw in kws)][:6]
    if not tags:
        tags = [category]
    total_hits = sum(cat_scores.values())
    confidence_score = min(0.9, 0.4 + (total_hits * 0.05) + (cat_confidence * 0.3))
    if threat_score >= 3: confidence_score = min(0.9, confidence_score + 0.1)
    return {
        "category": category,
        "threat_level": threat_level,
        "country": detected_country,
        "city": detected_city,
        "region": region,
        "actor_type": actor_type,
        "tags": tags,
        "confidence_level": confidence_level,
        "confidence_score": round(confidence_score, 2),
        "actionable_insights": [],
        "key_actors": [],
        "severity_summary": title[:120],
        "_confidence": confidence_score,
        "_threat_score": threat_score,
    }

async def _ai_enrich_single(title: str, summary: str, source: str) -> Optional[dict]:
    if not EMERGENT_LLM_KEY:
        return None
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"nano-{uuid.uuid4()}",
            system_message="You are a security analyst. Return ONLY valid JSON, no markdown."
        ).with_model("openai", "gpt-4.1-nano")
        prompt = f'Title: {title[:200]}\nSource: {source}\n\nReturn JSON: {{"category":"security|conflict|diplomacy|economy|humanitarian|technology","threat_level":"critical|high|elevated|low","country":"name","city":"city or blank","region":"region name"}}'
        resp = await chat.send_message(UserMessage(text=prompt))
        clean = re.sub(r'```(?:json)?\n?', '', resp.strip()).rstrip('`').strip()
        d = json.loads(clean)
        cat = d.get("category", "security")
        if cat not in ["security","conflict","diplomacy","economy","humanitarian","technology"]:
            cat = "security"
        tl = d.get("threat_level", "low")
        if tl not in ["critical","high","elevated","low"]:
            tl = "low"
        return {
            "category": cat,
            "threat_level": tl,
            "country": d.get("country", "Global") or "Global",
            "city": d.get("city", "") or "",
            "region": d.get("region", "Global") or "Global",
        }
    except Exception as e:
        logger.debug(f"AI nano enrichment failed: {e}")
        return None

def _fallback(title: str, summary: str) -> dict:
    return rule_enrich(title, summary, "")

# ─── STREAMING STATUS ─────────────────────────────────────────────────────────
class FetchStatus(BaseModel):
    is_fetching: bool = False
    last_fetch_time: Optional[str] = None
    last_fetch_count: int = 0
    total_items: int = 0
    sources_checked: int = 0
    gdelt_items: int = 0
    rss_items: int = 0
    total_feeds: int = 0
    orchestrator_active: bool = True
    discovered_feeds: int = 0

fetch_status = FetchStatus(total_feeds=len(RSS_FEEDS))
sse_clients: List[asyncio.Queue] = []

# ─── ELITE RSS SCRAPER ─────────────────────────────────────────────────────────
_domain_failures: Dict[str, int] = {}
_domain_success_time: Dict[str, float] = {}

def _get_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.replace("www.", "")
    except:
        return url[:50]

def _get_scraper_headers(url: str) -> dict:
    domain = _get_domain(url)
    ua = random.choice(USER_AGENTS)
    accept = random.choice(RSS_ACCEPT_HEADERS)
    headers = {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Connection": "keep-alive",
        "DNT": "1",
    }
    if any(d in domain for d in ["reuters", "ft.com", "wsj.com", "bloomberg"]):
        headers["Referer"] = "https://www.google.com/"
        headers["Sec-Fetch-Dest"] = "document"
        headers["Sec-Fetch-Mode"] = "navigate"
    return headers

async def _fetch_with_retry(url: str, h: httpx.AsyncClient, max_retries: int = 3, base_timeout: float = 15.0) -> Optional[bytes]:
    domain = _get_domain(url)
    override = DOMAIN_OVERRIDES.get(domain, {})
    timeout = override.get("timeout", base_timeout)
    retry_delay = override.get("retry_delay", 1.0)
    if _domain_failures.get(domain, 0) >= 5:
        last_success = _domain_success_time.get(domain, 0)
        if time.time() - last_success < 300:
            return None
    last_exc = None
    for attempt in range(max_retries):
        try:
            headers = _get_scraper_headers(url)
            resp = await h.get(url, headers=headers, timeout=timeout, follow_redirects=True)
            if resp.status_code == 200:
                _domain_failures[domain] = 0
                _domain_success_time[domain] = time.time()
                update_feed_health(url, True)
                return resp.content
            elif resp.status_code == 429:
                wait = retry_delay * (2 ** attempt) + random.uniform(1, 3)
                await asyncio.sleep(wait)
            elif resp.status_code in (301, 302, 307, 308):
                break
            elif resp.status_code in (403, 401):
                if attempt == 0:
                    await asyncio.sleep(retry_delay)
                    continue
                break
            elif resp.status_code in (500, 502, 503, 504):
                await asyncio.sleep(retry_delay * (2 ** attempt))
            else:
                break
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            last_exc = e
            wait = retry_delay * (1.5 ** attempt) + random.uniform(0.5, 1.5)
            if attempt < max_retries - 1:
                await asyncio.sleep(wait)
        except httpx.TooManyRedirects:
            break
        except Exception as e:
            last_exc = e
            break
    _domain_failures[domain] = _domain_failures.get(domain, 0) + 1
    update_feed_health(url, False)
    if last_exc is not None or _domain_failures[domain] <= 2:
        try:
            import urllib.request
            req = urllib.request.Request(url, headers={"User-Agent": "FeedBurner/1.0 (http://www.FeedBurner.com)"})
            with urllib.request.urlopen(req, timeout=10) as r:
                content = r.read()
                _domain_failures[domain] = 0
                _domain_success_time[domain] = time.time()
                update_feed_health(url, True)
                return content
        except Exception:
            pass
    return None

def _parse_feed_content(content: bytes, feed_url: str) -> Optional[Any]:
    domain = _get_domain(feed_url)
    try:
        if domain in ENCODING_QUIRK_DOMAINS:
            text = content.decode("utf-8", errors="replace")
            return feedparser.parse(text)
        return feedparser.parse(content)
    except Exception as e:
        logger.debug(f"Parse error for {feed_url}: {e}")
        return None

def _extract_pub_date(entry: Any) -> str:
    import calendar
    for attr in ["published_parsed", "updated_parsed", "created_parsed"]:
        v = getattr(entry, attr, None)
        if v:
            try:
                return datetime.fromtimestamp(calendar.timegm(v), tz=timezone.utc).isoformat()
            except:
                pass
    for attr in ["published", "updated", "created"]:
        v = getattr(entry, attr, None)
        if v and isinstance(v, str):
            for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ"]:
                try:
                    return datetime.strptime(v.strip(), fmt).replace(tzinfo=timezone.utc).isoformat()
                except:
                    pass
    return datetime.now(timezone.utc).isoformat()

def _clean_html(text: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&#\d+;', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def _extract_best_summary(entry: Any, title: str) -> str:
    for content in getattr(entry, "content", []):
        val = content.get("value", "")
        if val and len(val) > 50:
            return _clean_html(val)[:1000]
    for attr in ["summary", "description", "subtitle"]:
        val = getattr(entry, attr, None)
        if val and isinstance(val, str) and len(val) > 20:
            return _clean_html(val)[:1000]
    return title

async def fetch_rss(feed: dict, h: httpx.AsyncClient) -> List[dict]:
    items = []
    try:
        content = await _fetch_with_retry(feed["url"], h)
        if not content:
            return items
        parsed = _parse_feed_content(content, feed["url"])
        if not parsed or not hasattr(parsed, "entries"):
            return items
        tier = feed.get("tier", 2)
        max_items = TIER_MAX_ITEMS.get(tier, 15)
        for e in parsed.entries[:max_items]:
            title = _clean_html(e.get("title", "")).strip()
            if not title or len(title) < 10:
                continue
            summary = _extract_best_summary(e, title)
            url = e.get("link", "").strip()
            pub = _extract_pub_date(e)
            rel = score_relevance(title, summary)
            if rel < 0:
                continue
            items.append({
                "title": title[:300],
                "summary": summary[:1000],
                "url": url,
                "source": feed["source"],
                "source_credibility": feed.get("credibility", "medium"),
                "source_region": feed.get("region", "Global"),
                "source_tier": tier,
                "category_hint": feed.get("category", "news"),
                "published_at": pub,
                "relevance": rel,
            })
    except Exception as e:
        logger.warning(f"RSS {feed['source']}: {e}")
    return items

# ─── TIER-BATCHED PARALLEL FETCHER ────────────────────────────────────────────
async def fetch_all_rss() -> Tuple[List[dict], int]:
    all_items: List[dict] = []
    sources_ok = 0
    # Include dynamically discovered feeds
    all_feeds = RSS_FEEDS + orchestrator.discovered_feeds
    by_tier: Dict[int, List[dict]] = {}
    for feed in all_feeds:
        t = feed.get("tier", 2)
        by_tier.setdefault(t, []).append(feed)
    for tier in sorted(by_tier.keys()):
        feeds = by_tier[tier]
        concurrency = TIER_CONCURRENCY.get(tier, 8)
        sem = asyncio.Semaphore(concurrency)
        async with httpx.AsyncClient(
            limits=httpx.Limits(max_connections=concurrency * 2, max_keepalive_connections=concurrency),
            timeout=httpx.Timeout(connect=8.0, read=20.0, write=5.0, pool=2.0),
            follow_redirects=True,
        ) as h:
            async def _bounded_fetch(feed: dict) -> List[dict]:
                async with sem:
                    result = await fetch_rss(feed, h)
                    if result:
                        return result
                    return []
            tasks = [_bounded_fetch(f) for f in feeds]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, list) and r:
                all_items.extend(r)
                sources_ok += 1
        tier_count = sum(len(r) for r in results if isinstance(r, list))
        logger.info(f"Tier {tier}: {len(feeds)} feeds → {tier_count} items")
        if tier < 5:
            await asyncio.sleep(0.5)
    return all_items, sources_ok

# ─── GDELT FETCHER ────────────────────────────────────────────────────────────
async def fetch_gdelt() -> List[dict]:
    # Merge static GDELT queries with orchestrator-generated dynamic ones
    all_queries = GDELT_QUERIES.copy()
    for dq in orchestrator.topic_queries:
        all_queries.append((dq, "AI-Targeted", "30min"))

    items = []
    try:
        async with httpx.AsyncClient(timeout=25.0) as h:
            for batch_start in range(0, len(all_queries), 8):
                batch = all_queries[batch_start:batch_start+8]
                tasks = [
                    h.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={"query": q, "mode": "artlist", "maxrecords": "25", "format": "json", "timespan": ts, "sort": "DateDesc", "trans": "googtrans"}
                    )
                    for q, _, ts in batch
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, resp in enumerate(results):
                    if isinstance(resp, Exception): continue
                    try:
                        if resp.status_code == 200:
                            for art in resp.json().get("articles", []):
                                t = art.get("title", "").strip()
                                u = art.get("url", "").strip()
                                s = art.get("seendescription", t)[:1000]
                                if t and len(t) > 15 and u:
                                    rel = score_relevance(t, s)
                                    if rel < 0: continue
                                    items.append({
                                        "title": t[:300],
                                        "summary": s,
                                        "url": u,
                                        "source": art.get("domain", f"GDELT/{batch[i][1]}"),
                                        "source_credibility": "medium",
                                        "source_region": batch[i][1],
                                        "source_tier": 3,
                                        "category_hint": batch[i][1].lower(),
                                        "published_at": datetime.now(timezone.utc).isoformat(),
                                        "relevance": rel
                                    })
                    except: pass
                await asyncio.sleep(0.4)
    except Exception as e:
        logger.warning(f"GDELT: {e}")
    seen = set(); unique = []
    for it in items:
        if it["url"] not in seen:
            seen.add(it["url"]); unique.append(it)
    return unique

async def fetch_gdelt_gkg() -> List[dict]:
    items = []
    crisis_themes = [
        "TERROR","KILL","WOUND","ARREST","RIOT","PROTEST","COUP","MILITARY_FORCE",
        "REBEL","REFUGEE","DISPLACEMENT","FAMINE","EPIDEMIC","NATURAL_DISASTER",
        "ARMED_CONFLICT","EXPLOSION","WEAPON","NUCLEAR","CHEMICAL","KIDNAP",
        "CRIME_VIOLENT","SMUGGLING","TRAFFICKING",
    ]
    try:
        async with httpx.AsyncClient(timeout=30.0) as h:
            theme_batches = [crisis_themes[i:i+5] for i in range(0, len(crisis_themes), 5)]
            for theme_batch in theme_batches[:4]:
                theme_query = " OR ".join(theme_batch)
                try:
                    resp = await h.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={"query": theme_query, "mode": "artlist", "maxrecords": "20", "format": "json", "timespan": "60min", "sort": "DateDesc"},
                        timeout=15.0
                    )
                    if resp.status_code == 200:
                        for art in resp.json().get("articles", []):
                            t = art.get("title", "").strip()
                            u = art.get("url", "").strip()
                            s = art.get("seendescription", t)[:1000]
                            if t and len(t) > 15 and u:
                                rel = score_relevance(t, s)
                                if rel < 0: continue
                                items.append({
                                    "title": t[:300], "summary": s, "url": u,
                                    "source": art.get("domain", "GDELT-GKG"),
                                    "source_credibility": "medium", "source_region": "Global",
                                    "source_tier": 3, "category_hint": "conflict",
                                    "published_at": datetime.now(timezone.utc).isoformat(),
                                    "relevance": rel
                                })
                except Exception as e:
                    logger.debug(f"GKG batch failed: {e}")
                await asyncio.sleep(0.3)
    except Exception as e:
        logger.warning(f"GDELT GKG: {e}")
    seen = set(); unique = []
    for it in items:
        if it["url"] not in seen:
            seen.add(it["url"]); unique.append(it)
    return unique

async def broadcast(data: dict):
    for q in list(sse_clients):
        try:
            await q.put(data)
        except:
            if q in sse_clients: sse_clients.remove(q)

# ─── SHARED PROCESS & STORE ───────────────────────────────────────────────────
async def _process_and_store(raw_items: List[dict], source: str = "main") -> int:
    """
    Shared pipeline: cluster → triangulate → enrich → geocode → store.
    Used by both the main fetch loop and the orchestrator targeted crawl.
    """
    if not raw_items:
        return 0

    # Deduplicate against DB
    existing = set()
    async for doc in db.news_items.find({}, {"url": 1}):
        if doc.get("url"):
            existing.add(doc["url"])

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    new = []
    for it in raw_items:
        if it.get("url") and it["url"] in existing:
            continue
        try:
            pub = datetime.fromisoformat(it["published_at"].replace('Z', '+00:00'))
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
            if pub < cutoff:
                continue
        except:
            pass
        new.append(it)

    if not new:
        return 0

    # Sort: critical relevance first
    new.sort(key=lambda x: x.get("relevance", 0), reverse=True)

    # 1. Event clustering — merge same-incident articles
    clustered = cluster_events(new)

    # 2. Enrich + store
    inserted = 0
    for i in range(0, min(len(clustered), 120), 8):
        batch = clustered[i:i+8]
        enrichments = await asyncio.gather(
            *[enrich(it["title"], it["summary"], it["source"]) for it in batch],
            return_exceptions=True
        )
        for item, enrichment in zip(batch, enrichments):
            if isinstance(enrichment, Exception):
                enrichment = _fallback(item["title"], item["summary"])

            # 3. Confidence triangulation
            item_merged = {**item, **enrichment}
            item_merged = triangulate_confidence(item_merged)

            city = item_merged.get("city", "")
            country = item_merged.get("country", "Global")
            lat, lon, precision = await geocode(city, country)

            doc = {
                "id": str(uuid.uuid4()),
                "token": str(uuid.uuid4())[:8].upper(),
                "title": item["title"],
                "summary": item["summary"],
                "url": item.get("url", ""),
                "source": item["source"],
                "source_credibility": item.get("source_credibility", "medium"),
                "source_tier": item.get("source_tier", 2),
                "published_at": item["published_at"],
                "lat": lat, "lon": lon,
                "country": country,
                "city": city,
                "region": item_merged.get("region", "Global"),
                "tags": item_merged.get("tags", []),
                "confidence_score": item_merged.get("confidence_score", 0.6),
                "confidence_level": item_merged.get("confidence_level", "developing"),
                "threat_level": item_merged.get("threat_level", "low"),
                "actor_type": item_merged.get("actor_type", "state"),
                "sub_category": None,
                "category": item_merged.get("category", "security"),
                "actionable_insights": item_merged.get("actionable_insights", []),
                "key_actors": item_merged.get("key_actors", []),
                "severity_summary": item_merged.get("severity_summary", "")[:300],
                "precision_level": precision,
                # Clustering metadata
                "source_count": item.get("source_count", 1),
                "corroborating_sources": item.get("corroborating_sources", []),
                # Orchestrator metadata
                "orchestrator_topic": item.get("orchestrator_topic"),
                "collection_source": source,
                "user_id": "system",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_at_dt": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            try:
                await db.news_items.insert_one(doc)
                inserted += 1
                clean = {k: v for k, v in doc.items() if k != "_id"}

                # Priority alert: bypass SSE queue for immediate dispatch
                if is_priority(doc):
                    await priority_queue.put(clean)
                else:
                    await broadcast({"type": "new_item", "item": clean})

            except Exception as e:
                if "duplicate" not in str(e).lower():
                    logger.error(f"Insert: {e}")

    return inserted

# ─── MAIN FETCH & STORE ───────────────────────────────────────────────────────
async def fetch_and_store() -> dict:
    global fetch_status
    if fetch_status.is_fetching:
        return {"success": False, "message": "In progress"}
    fetch_status.is_fetching = True
    try:
        all_raw, sources_ok = await fetch_all_rss()
        rss_count = len(all_raw)
        logger.info(f"RSS total: {rss_count} items from {sources_ok} sources")

        gdelt_items = await fetch_gdelt()
        all_raw.extend(gdelt_items)

        gkg_items = await fetch_gdelt_gkg()
        all_raw.extend(gkg_items)

        gdelt_count = len(gdelt_items) + len(gkg_items)
        logger.info(f"GDELT+GKG: {gdelt_count} items")

        # Global dedup by URL
        seen_urls: set = set()
        unique_raw = []
        for it in all_raw:
            url = it.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_raw.append(it)
            elif not url:
                title_hash = hashlib.md5(it["title"].encode()).hexdigest()
                if title_hash not in seen_urls:
                    seen_urls.add(title_hash)
                    unique_raw.append(it)

        inserted = await _process_and_store(unique_raw, source="main")

        total = await db.news_items.count_documents({})
        fetch_status.last_fetch_time = datetime.now(timezone.utc).isoformat()
        fetch_status.last_fetch_count = inserted
        fetch_status.total_items = total
        fetch_status.sources_checked = sources_ok
        fetch_status.gdelt_items = gdelt_count
        fetch_status.rss_items = rss_count
        fetch_status.total_feeds = len(RSS_FEEDS) + len(orchestrator.discovered_feeds)
        fetch_status.orchestrator_active = True
        fetch_status.discovered_feeds = len(orchestrator.discovered_feeds)

        logger.info(f"Done: {inserted} inserted, total DB: {total}")
        return {
            "success": True,
            "fetched_total": len(all_raw),
            "unique": len(unique_raw),
            "inserted": inserted,
            "sources_checked": sources_ok,
            "rss_count": rss_count,
            "gdelt_count": gdelt_count,
            "total_feeds": len(RSS_FEEDS) + len(orchestrator.discovered_feeds),
            "discovered_feeds": len(orchestrator.discovered_feeds),
        }
    except Exception as e:
        logger.error(f"Fetch error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        fetch_status.is_fetching = False

async def cleanup_loop():
    while True:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            r = await db.news_items.delete_many({"published_at": {"$lt": cutoff}})
            if r.deleted_count > 0:
                logger.info(f"Cleanup: removed {r.deleted_count} old items")
            # Also clean old orchestrator logs
            await db.orchestrator_log.delete_many({"timestamp": {"$lt": cutoff}})
        except Exception as e:
            logger.error(f"Cleanup: {e}")
        await asyncio.sleep(3600)

async def fetch_loop():
    logger.info(f"Intel fetcher started — {len(RSS_FEEDS)} feeds across all tiers")
    await asyncio.sleep(5)
    cycle = 0
    while True:
        try:
            await fetch_and_store()
            cycle += 1
            if cycle % 10 == 0:
                top_fail = sorted(_domain_failures.items(), key=lambda x: x[1], reverse=True)[:5]
                if top_fail:
                    logger.info(f"Domain health (top failures): {top_fail}")
        except Exception as e:
            logger.error(f"Fetch loop: {e}")
        await asyncio.sleep(90)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.news_items.create_index("url", unique=True, sparse=True)
        await db.news_items.create_index([("published_at", -1)])
        await db.news_items.create_index("threat_level")
        await db.news_items.create_index("category")
        await db.news_items.create_index("country")
        await db.news_items.create_index("region")
        await db.news_items.create_index("source_tier")
        await db.news_items.create_index([("threat_level", 1), ("published_at", -1)])
        await db.news_items.create_index("source_count")
        await db.geo_cache.create_index("key", unique=True)
        await db.chat_messages.create_index([("channel", 1), ("timestamp", -1)])
        await db.orchestrator_log.create_index([("timestamp", -1)])
    except Exception as e:
        logger.warning(f"Index: {e}")

    t1 = asyncio.create_task(fetch_loop())
    t2 = asyncio.create_task(cleanup_loop())
    t3 = asyncio.create_task(orchestrator_loop())
    t4 = asyncio.create_task(priority_alert_worker())

    logger.info(f"Global Intel Desk v6.0 — {len(RSS_FEEDS)} feeds | Orchestrator: active | Priority queue: active")
    yield
    t1.cancel(); t2.cancel(); t3.cancel(); t4.cancel()
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"])

# ─── NEWS ENDPOINTS ───────────────────────────────────────────────────────────
@api_router.get("/news")
async def get_news(
    limit: int = Query(300, le=500),
    offset: int = 0,
    category: Optional[str] = None,
    threat_level: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    hours: Optional[int] = None,
    source_tier: Optional[int] = None,
    tags: Optional[str] = None,
    corroborated: Optional[bool] = None,   # NEW: filter to multi-source events
):
    q: Dict[str, Any] = {}
    if category: q["category"] = category
    if threat_level: q["threat_level"] = threat_level
    if country: q["country"] = {"$regex": country, "$options": "i"}
    if region: q["region"] = {"$regex": region, "$options": "i"}
    if source_tier: q["source_tier"] = {"$lte": source_tier}
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        q["tags"] = {"$in": tag_list}
    if corroborated:
        q["source_count"] = {"$gte": 2}
    if search:
        q["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"summary": {"$regex": search, "$options": "i"}},
            {"country": {"$regex": search, "$options": "i"}},
            {"source": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]
    if hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        q["published_at"] = {"$gte": cutoff}
    cur = db.news_items.find(q, {"_id": 0}).sort("published_at", -1).skip(offset).limit(limit)
    return await cur.to_list(length=limit)

@api_router.get("/news/stats")
async def get_stats():
    total = await db.news_items.count_documents({})
    pipeline_threat = [{"$group": {"_id": "$threat_level", "count": {"$sum": 1}}}]
    pipeline_cat = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    pipeline_region = [{"$group": {"_id": "$region", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 15}]
    pipeline_recent = [
        {"$match": {"created_at_dt": {"$gte": datetime.now(timezone.utc) - timedelta(hours=1)}}},
        {"$count": "count"}
    ]
    pipeline_corroborated = [
        {"$match": {"source_count": {"$gte": 2}}},
        {"$count": "count"}
    ]
    threat_agg = await db.news_items.aggregate(pipeline_threat).to_list(length=10)
    cat_agg = await db.news_items.aggregate(pipeline_cat).to_list(length=10)
    region_agg = await db.news_items.aggregate(pipeline_region).to_list(length=15)
    recent_agg = await db.news_items.aggregate(pipeline_recent).to_list(length=1)
    corroborated_agg = await db.news_items.aggregate(pipeline_corroborated).to_list(length=1)
    return {
        "total": total,
        "last_hour": recent_agg[0]["count"] if recent_agg else 0,
        "corroborated_events": corroborated_agg[0]["count"] if corroborated_agg else 0,
        "by_threat": {d["_id"]: d["count"] for d in threat_agg if d["_id"]},
        "by_category": {d["_id"]: d["count"] for d in cat_agg if d["_id"]},
        "by_region": {d["_id"]: d["count"] for d in region_agg if d["_id"]},
    }

@api_router.get("/news/critical")
async def get_critical(hours: int = 24):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    q = {"threat_level": {"$in": ["critical", "high"]}, "published_at": {"$gte": cutoff}}
    cur = db.news_items.find(q, {"_id": 0}).sort("published_at", -1).limit(100)
    return await cur.to_list(length=100)

@api_router.get("/news/status")
async def get_status():
    total = await db.news_items.count_documents({})
    fetch_status.total_items = total
    fetch_status.total_feeds = len(RSS_FEEDS) + len(orchestrator.discovered_feeds)
    fetch_status.discovered_feeds = len(orchestrator.discovered_feeds)
    d = fetch_status.dict()
    d["domain_health"] = {
        "failing": [k for k, v in _domain_failures.items() if v >= 3],
        "total_tracked": len(_domain_failures),
    }
    d["orchestrator"] = {
        "active_topics": list(orchestrator.active_topics.keys())[:10],
        "hot_regions": list(orchestrator.hot_regions.keys())[:5],
        "dynamic_queries": orchestrator.topic_queries,
        "discovered_feeds": len(orchestrator.discovered_feeds),
        "cycle_count": orchestrator.cycle_count,
    }
    return d

@api_router.get("/news/feeds")
async def get_feeds(tier: Optional[int] = None, region: Optional[str] = None, discovered: bool = False):
    feeds = (orchestrator.discovered_feeds if discovered else RSS_FEEDS + orchestrator.discovered_feeds)
    if tier is not None:
        feeds = [f for f in feeds if f.get("tier") == tier]
    if region:
        feeds = [f for f in feeds if region.lower() in f.get("region", "").lower()]
    return {
        "total": len(feeds),
        "discovered": len(orchestrator.discovered_feeds),
        "feeds": [{"source": f["source"], "url": f["url"], "tier": f.get("tier"), "region": f.get("region"), "credibility": f.get("credibility")} for f in feeds]
    }

@api_router.get("/news/orchestrator")
async def get_orchestrator_log(limit: int = 20):
    """Expose the AI orchestrator's decision log for transparency."""
    cur = db.orchestrator_log.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return await cur.to_list(length=limit)

@api_router.post("/news/fetch")
async def trigger_fetch():
    return await fetch_and_store()

@api_router.get("/news/stream")
async def stream():
    q: asyncio.Queue = asyncio.Queue()
    sse_clients.append(q)
    async def gen():
        try:
            yield f"data: {json.dumps({'type': 'connected', 'total_feeds': len(RSS_FEEDS) + len(orchestrator.discovered_feeds), 'orchestrator': True})}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat', 'orchestrator_topics': list(orchestrator.active_topics.keys())[:3]})}\n\n"
        except:
            pass
        finally:
            if q in sse_clients: sse_clients.remove(q)
    return StreamingResponse(gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})

@api_router.get("/news/{item_id}")
async def get_item(item_id: str):
    item = await db.news_items.find_one({"id": item_id}, {"_id": 0})
    if not item: raise HTTPException(404, "Not found")
    return item

@api_router.delete("/news/{item_id}")
async def delete_item(item_id: str):
    r = await db.news_items.delete_one({"id": item_id})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    await broadcast({"type": "deleted_item", "id": item_id})
    return {"success": True}

# ─── CHAT ─────────────────────────────────────────────────────────────────────
CHAT_CHANNELS = {
    "general": {"name": "#general", "desc": "General intel discussion"},
    "middle-east": {"name": "#middle-east", "desc": "Middle East & North Africa"},
    "conflict": {"name": "#conflict", "desc": "Active conflict zones"},
    "security": {"name": "#security", "desc": "Security & threats"},
    "geopolitics": {"name": "#geopolitics", "desc": "Geopolitical analysis"},
    "humanitarian": {"name": "#humanitarian", "desc": "Humanitarian situations"},
    "sahel": {"name": "#sahel", "desc": "Sahel & West Africa"},
    "asia-pacific": {"name": "#asia-pacific", "desc": "Asia Pacific region"},
}

class ChatMgr:
    def __init__(self): self.conns: Dict[str, List[Dict]] = {ch: [] for ch in CHAT_CHANNELS}
    async def connect(self, ws, ch, username, uid):
        await ws.accept()
        self.conns.setdefault(ch, []).append({"ws": ws, "username": username, "uid": uid})
        await self.sys(ch, f"{username} joined")
    def disconnect(self, ws, ch, username):
        self.conns[ch] = [c for c in self.conns.get(ch, []) if c["ws"] != ws]
    async def broadcast(self, ch, msg):
        dead = []
        for c in self.conns.get(ch, []):
            try: await c["ws"].send_json(msg)
            except: dead.append(c)
        for d in dead:
            if d in self.conns.get(ch, []): self.conns[ch].remove(d)
    async def sys(self, ch, text):
        await self.broadcast(ch, {"type": "system", "id": str(uuid.uuid4()), "channel": ch,
            "username": "SYSTEM", "text": text, "timestamp": datetime.now(timezone.utc).isoformat()})
    def online(self, ch): return len(self.conns.get(ch, []))

chat = ChatMgr()

@api_router.get("/chat/channels")
async def chat_channels():
    return {"channels": [{"key": k, "name": v["name"], "description": v["desc"], "online": chat.online(k)} for k, v in CHAT_CHANNELS.items()]}

@api_router.get("/chat/messages/{channel}")
async def chat_messages(channel: str, limit: int = 50):
    if channel not in CHAT_CHANNELS: raise HTTPException(400, "Invalid")
    cur = db.chat_messages.find({"channel": channel}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    msgs = await cur.to_list(length=limit)
    return list(reversed(msgs))

@api_router.websocket("/chat/ws/{channel}")
async def chat_ws(ws: WebSocket, channel: str, username: str = "Analyst", user_id: str = "anon"):
    if channel not in CHAT_CHANNELS: await ws.close(4000); return
    await chat.connect(ws, channel, username[:30], user_id)
    await ws.send_json({"type": "online_count", "channel": channel, "count": chat.online(channel)})
    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "message" and data.get("text", "").strip():
                doc = {"id": str(uuid.uuid4()), "channel": channel, "username": username[:30],
                       "text": data["text"].strip()[:500], "user_id": user_id,
                       "timestamp": datetime.now(timezone.utc).isoformat(), "type": "message"}
                await db.chat_messages.insert_one(doc)
                clean = {k: v for k, v in doc.items() if k != "_id"}
                await chat.broadcast(channel, clean)
    except WebSocketDisconnect:
        chat.disconnect(ws, channel, username)
        await chat.sys(channel, f"{username} left")

@api_router.get("/")
async def root():
    return {
        "message": "Global Intel Desk API",
        "status": "operational",
        "version": "6.0",
        "total_feeds": len(RSS_FEEDS) + len(orchestrator.discovered_feeds),
        "discovered_feeds": len(orchestrator.discovered_feeds),
        "feed_breakdown": {
            f"tier_{t}": sum(1 for f in RSS_FEEDS if f.get("tier") == t)
            for t in range(1, 6)
        },
        "gdelt_queries": len(GDELT_QUERIES) + len(orchestrator.topic_queries),
        "features": {
            "autonomous_orchestrator": True,
            "event_clustering": True,
            "confidence_triangulation": True,
            "priority_alerts": True,
            "auto_feed_discovery": True,
            "self_healing_feeds": True,
        },
    }

app.include_router(api_router)
