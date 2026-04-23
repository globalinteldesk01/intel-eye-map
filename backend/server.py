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
from typing import List, Optional, Dict, Tuple, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ.get('DB_NAME', 'intel_database')]
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── VASTLY EXPANDED SOURCE NETWORK ──────────────────────────────────────────
# Includes local newspapers, police feeds, emergency services, local radio,
# community monitors, wire services, conflict-specific trackers

RSS_FEEDS = [
    # ── TIER 1: WIRE SERVICES (most raw, fastest) ──────────────────────────
    {"url":"https://apnews.com/hub/world-news/rss","source":"AP News","credibility":"high","region":"Global","tier":1},
    {"url":"https://feeds.reuters.com/reuters/worldNews","source":"Reuters World","credibility":"high","region":"Global","tier":1},
    {"url":"https://feeds.reuters.com/reuters/topNews","source":"Reuters Top","credibility":"high","region":"Global","tier":1},
    {"url":"https://www.afp.com/en/rss","source":"AFP","credibility":"high","region":"Global","tier":1},
    {"url":"https://feeds.bbci.co.uk/news/world/rss.xml","source":"BBC World","credibility":"high","region":"Global","tier":1},
    {"url":"https://feeds.bbci.co.uk/news/rss.xml","source":"BBC Breaking","credibility":"high","region":"Global","tier":1},
    {"url":"https://www.aljazeera.com/xml/rss/all.xml","source":"Al Jazeera","credibility":"high","region":"Global","tier":1},
    {"url":"https://rss.cnn.com/rss/edition_world.rss","source":"CNN World","credibility":"high","region":"Global","tier":1},
    {"url":"https://abcnews.go.com/abcnews/internationalheadlines","source":"ABC News","credibility":"high","region":"Global","tier":1},
    {"url":"https://news.un.org/feed/subscribe/en/news/all/rss.xml","source":"UN News","credibility":"high","region":"Global","tier":1},

    # ── TIER 2: REGIONAL DEEP SOURCES ──────────────────────────────────────
    # Middle East — Grassroots
    {"url":"https://www.timesofisrael.com/feed/","source":"Times of Israel","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.jpost.com/rss/rssfeedsfrontpage.aspx","source":"Jerusalem Post","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.haaretz.com/cmlink/1.628765","source":"Haaretz","credibility":"high","region":"Middle East","tier":2},
    {"url":"https://www.middleeasteye.net/rss","source":"Middle East Eye","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.iranintl.com/en/rss","source":"Iran International","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://english.alarabiya.net/rss.xml","source":"Al Arabiya","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.arabnews.com/rss.xml","source":"Arab News","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.rudaw.net/english/feed","source":"Rudaw (Kurdistan)","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.trtworld.com/rss","source":"TRT World","credibility":"medium","region":"Middle East","tier":2},
    {"url":"https://www.bbc.co.uk/news/world/middle_east/rss.xml","source":"BBC Middle East","credibility":"high","region":"Middle East","tier":2},
    {"url":"https://syrianobserver.com/feed","source":"Syrian Observer","credibility":"medium","region":"Middle East","tier":2},

    # Ukraine/Russia — Deep coverage
    {"url":"https://kyivindependent.com/feed/","source":"Kyiv Independent","credibility":"high","region":"Eastern Europe","tier":2},
    {"url":"https://www.ukrinform.net/rss/block-lastnews","source":"Ukrinform","credibility":"high","region":"Eastern Europe","tier":2},
    {"url":"https://euromaidan.press/feed/","source":"Euromaidan Press","credibility":"high","region":"Eastern Europe","tier":2},
    {"url":"https://www.themoscowtimes.com/rss/news","source":"Moscow Times","credibility":"high","region":"Eastern Europe","tier":2},
    {"url":"https://meduza.io/rss/en/all","source":"Meduza Russia","credibility":"high","region":"Eastern Europe","tier":2},
    {"url":"https://www.rferl.org/api/epiqzqirrukp","source":"Radio Free Europe","credibility":"high","region":"Global","tier":2},
    {"url":"https://warmonitor.com/feed/","source":"War Monitor","credibility":"medium","region":"Eastern Europe","tier":2},

    # Africa — Local & Grassroots
    {"url":"https://www.premiumtimesng.com/feed","source":"Premium Times Nigeria","credibility":"medium","region":"West Africa","tier":2},
    {"url":"https://www.dailymaverick.co.za/feed/","source":"Daily Maverick SA","credibility":"high","region":"Southern Africa","tier":2},
    {"url":"https://www.nation.co.ke/news/rss.xml","source":"Daily Nation Kenya","credibility":"high","region":"East Africa","tier":2},
    {"url":"https://www.addisstandard.com/feed/","source":"Addis Standard Ethiopia","credibility":"high","region":"Horn of Africa","tier":2},
    {"url":"https://sudantribune.com/spip.php?page=backend","source":"Sudan Tribune","credibility":"medium","region":"Horn of Africa","tier":2},
    {"url":"https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf","source":"AllAfrica","credibility":"medium","region":"Africa","tier":2},
    {"url":"https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf","source":"AllAfrica Latest","credibility":"medium","region":"Africa","tier":2},
    {"url":"https://www.theafricareport.com/feed/","source":"The Africa Report","credibility":"high","region":"Africa","tier":2},
    {"url":"https://rfi.fr/en/rss","source":"RFI Africa","credibility":"high","region":"Africa","tier":2},
    {"url":"https://www.bbc.co.uk/news/world/africa/rss.xml","source":"BBC Africa","credibility":"high","region":"Africa","tier":2},
    {"url":"https://www.voanews.com/rss/afri","source":"VOA Africa","credibility":"high","region":"Africa","tier":2},
    {"url":"https://www.acleddata.com/feed/","source":"ACLED Conflict Data","credibility":"high","region":"Global","tier":2},

    # South Asia — Local
    {"url":"https://www.dawn.com/feeds/home","source":"Dawn Pakistan","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://tribune.com.pk/rss","source":"Express Tribune PK","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://www.thehindu.com/news/international/?service=rss","source":"The Hindu Intl","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://www.thedailystar.net/frontpage/rss.xml","source":"Daily Star Bangladesh","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://kathmandupost.com/rss","source":"Kathmandu Post","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://www.bbc.co.uk/news/world/south_asia/rss.xml","source":"BBC South Asia","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://www.gandhara.com.pk/rss","source":"Gandhara (RFERL PK)","credibility":"high","region":"South Asia","tier":2},
    {"url":"https://www.pajhwok.com/en/rss.xml","source":"Pajhwok Afghan News","credibility":"medium","region":"South Asia","tier":2},

    # Southeast Asia — Local
    {"url":"https://www.bangkokpost.com/rss/data/topstories.xml","source":"Bangkok Post","credibility":"high","region":"Southeast Asia","tier":2},
    {"url":"https://www.rappler.com/rss/nation.xml","source":"Rappler Philippines","credibility":"high","region":"Southeast Asia","tier":2},
    {"url":"https://www.thejakartapost.com/news/rss","source":"Jakarta Post","credibility":"high","region":"Southeast Asia","tier":2},
    {"url":"https://www.irrawaddy.com/feed","source":"The Irrawaddy Myanmar","credibility":"high","region":"Southeast Asia","tier":2},
    {"url":"https://www.channelnewsasia.com/rssfeeds/8395984","source":"Channel NewsAsia","credibility":"high","region":"Southeast Asia","tier":2},
    {"url":"https://www.straitstimes.com/news/asia/rss.xml","source":"Straits Times","credibility":"high","region":"Southeast Asia","tier":2},
    {"url":"https://myanmar-now.org/en/feed/","source":"Myanmar Now","credibility":"high","region":"Southeast Asia","tier":2},

    # East Asia
    {"url":"https://www.japantimes.co.jp/feed/","source":"Japan Times","credibility":"high","region":"East Asia","tier":2},
    {"url":"https://www.scmp.com/rss/91/feed","source":"S China Morning Post","credibility":"high","region":"East Asia","tier":2},
    {"url":"https://www.rfa.org/english/rss2.0","source":"Radio Free Asia","credibility":"high","region":"East Asia","tier":2},
    {"url":"https://asia.nikkei.com/rss/feed/nar","source":"Nikkei Asia","credibility":"high","region":"East Asia","tier":2},

    # Latin America
    {"url":"https://insightcrime.org/feed/","source":"InSight Crime","credibility":"high","region":"Latin America","tier":2},
    {"url":"https://en.mercopress.com/rss","source":"MercoPress","credibility":"medium","region":"South America","tier":2},
    {"url":"https://www.bbc.co.uk/news/world/latin_america/rss.xml","source":"BBC Latin America","credibility":"high","region":"Latin America","tier":2},
    {"url":"https://www.voanews.com/rss/lame","source":"VOA Latin America","credibility":"high","region":"Latin America","tier":2},

    # Central Asia
    {"url":"https://akipress.com/rss/news_en.rss","source":"AKIpress","credibility":"medium","region":"Central Asia","tier":2},
    {"url":"https://eurasianet.org/feed","source":"Eurasianet","credibility":"high","region":"Central Asia","tier":2},
    {"url":"https://www.rferl.org/rss/","source":"RFE/RL Central Asia","credibility":"high","region":"Central Asia","tier":2},

    # Europe
    {"url":"https://www.politico.eu/feed/","source":"Politico Europe","credibility":"high","region":"Western Europe","tier":2},
    {"url":"https://www.euractiv.com/feed/","source":"EurActiv","credibility":"high","region":"Western Europe","tier":2},
    {"url":"https://balkaninsight.com/feed/","source":"Balkan Insight","credibility":"high","region":"Balkans","tier":2},

    # Pacific/Australia
    {"url":"https://www.abc.net.au/news/feed/51120/rss.xml","source":"ABC Australia","credibility":"high","region":"Pacific","tier":2},
    {"url":"https://www.rnz.co.nz/news/world.rss","source":"RNZ New Zealand","credibility":"high","region":"Pacific","tier":2},

    # ── TIER 3: SPECIALIST / CONFLICT MONITORS ──────────────────────────────
    {"url":"https://www.crisisgroup.org/rss.xml","source":"ICG Crisis Group","credibility":"high","region":"Global","tier":3},
    {"url":"https://www.icrc.org/en/rss/news","source":"ICRC Red Cross","credibility":"high","region":"Global","tier":3},
    {"url":"https://reliefweb.int/updates/rss.xml","source":"ReliefWeb","credibility":"high","region":"Global","tier":3},
    {"url":"https://reliefweb.int/disasters/rss.xml","source":"ReliefWeb Disasters","credibility":"high","region":"Global","tier":3},
    {"url":"https://thediplomat.com/feed/","source":"The Diplomat","credibility":"high","region":"Asia","tier":3},
    {"url":"https://warontherocks.com/feed/","source":"War on the Rocks","credibility":"high","region":"Global","tier":3},
    {"url":"https://www.bellingcat.com/feed/","source":"Bellingcat OSINT","credibility":"high","region":"Global","tier":3},
    {"url":"https://foreignpolicy.com/feed/","source":"Foreign Policy","credibility":"high","region":"Global","tier":3},
    {"url":"https://www.longwarjournal.org/feed","source":"Long War Journal","credibility":"high","region":"Global","tier":3},
    {"url":"https://www.smallwarsjournal.com/rss.xml","source":"Small Wars Journal","credibility":"high","region":"Global","tier":3},
    {"url":"https://ctc.westpoint.edu/feed/","source":"CTC West Point","credibility":"high","region":"Global","tier":3},
    {"url":"https://jihadology.net/feed/","source":"Jihadology","credibility":"high","region":"Global","tier":3},
    {"url":"https://www.jamestown.org/feed/","source":"Jamestown Foundation","credibility":"high","region":"Global","tier":3},
    {"url":"https://acleddata.com/conflict-watchlist/feed/","source":"ACLED Watchlist","credibility":"high","region":"Global","tier":3},
    {"url":"https://www.ibtimes.co.uk/rss","source":"IBT Security","credibility":"medium","region":"Global","tier":3},

    # ── TIER 4: EMERGENCY / OFFICIAL / DISASTER ──────────────────────────────
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom","source":"USGS Earthquakes","credibility":"high","region":"Global","tier":4},
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom","source":"USGS M4.5+","credibility":"high","region":"Global","tier":4},
    {"url":"https://www.gdacs.org/xml/rss_24h.xml","source":"GDACS Disasters","credibility":"high","region":"Global","tier":4},
    {"url":"https://www.who.int/feeds/entity/don/en/rss.xml","source":"WHO Disease Outbreaks","credibility":"high","region":"Global","tier":4},
    {"url":"https://wwwnc.cdc.gov/travel/notices/rss.xml","source":"CDC Travel Health","credibility":"high","region":"Global","tier":4},
    {"url":"https://travel.state.gov/content/travel/en/RSS.rss.html","source":"US State Dept Travel","credibility":"high","region":"Global","tier":4},
    {"url":"https://www.gov.uk/foreign-travel-advice.atom","source":"UK FCDO Travel","credibility":"high","region":"Global","tier":4},
    {"url":"https://aviation-safety.net/news/rss.php","source":"Aviation Safety Net","credibility":"high","region":"Global","tier":4},
    {"url":"https://www.faa.gov/rss_feeds/news.xml","source":"FAA Safety","credibility":"high","region":"Global","tier":4},
    {"url":"https://nuke.fas.org/feed/","source":"FAS Nuclear Monitor","credibility":"high","region":"Global","tier":4},

    # ── TIER 5: LOCAL / HYPERLOCAL ─────────────────────────────────────────
    # Local Pakistani newspapers
    {"url":"https://www.geo.tv/rss/1","source":"Geo TV Pakistan","credibility":"medium","region":"South Asia","tier":5},
    {"url":"https://arynews.tv/en/feed/","source":"ARY News Pakistan","credibility":"medium","region":"South Asia","tier":5},
    {"url":"https://www.thenews.com.pk/rss/1/8","source":"The News PK","credibility":"medium","region":"South Asia","tier":5},

    # Local Indian outlets (security/northeast focus)
    {"url":"https://www.sentinelassam.com/feed/","source":"Sentinel Assam","credibility":"medium","region":"South Asia","tier":5},
    {"url":"https://www.eastmojo.com/feed/","source":"East Mojo NE India","credibility":"medium","region":"South Asia","tier":5},
    {"url":"https://morungexpress.com/feed","source":"Morung Express Nagaland","credibility":"medium","region":"South Asia","tier":5},
    {"url":"https://nagalandpost.com/feed/","source":"Nagaland Post","credibility":"medium","region":"South Asia","tier":5},

    # Local Myanmar/SE Asia conflict-zone papers
    {"url":"https://www.bnionline.net/en/rss.xml","source":"BNI Myanmar","credibility":"medium","region":"Southeast Asia","tier":5},
    {"url":"https://www.dvb.no/feed","source":"DVB Myanmar","credibility":"high","region":"Southeast Asia","tier":5},

    # Local African outlets
    {"url":"https://www.sahara-reporters.com/rss.xml","source":"Sahara Reporters Nigeria","credibility":"medium","region":"West Africa","tier":5},
    {"url":"https://www.standardmedia.co.ke/rss/news","source":"Standard Kenya","credibility":"medium","region":"East Africa","tier":5},
    {"url":"https://www.theeastafrican.co.ke/rss/the-east-african","source":"The East African","credibility":"high","region":"East Africa","tier":5},
    {"url":"https://aawsat.com/english/rss.xml","source":"Asharq Al-Awsat","credibility":"medium","region":"Middle East","tier":5},

    # Local Latin American outlets
    {"url":"https://www.elnacional.com/feed/","source":"El Nacional Venezuela","credibility":"medium","region":"South America","tier":5},
    {"url":"https://www.infobae.com/rss/america/","source":"Infobae Latin America","credibility":"medium","region":"Latin America","tier":5},

    # Caucasus / Contested Regions
    {"url":"https://civil.ge/feed","source":"Civil Georgia","credibility":"high","region":"Caucasus","tier":5},
    {"url":"https://jam-news.net/feed/","source":"JAM News Caucasus","credibility":"medium","region":"Caucasus","tier":5},

    # Sahel & West Africa specifics
    {"url":"https://www.malijet.com/rss/actualite","source":"Malijet","credibility":"medium","region":"Sahel","tier":5},
    {"url":"https://lefaso.net/spip.php?page=backend","source":"LeFaso Burkina","credibility":"medium","region":"Sahel","tier":5},

    # Horn of Africa specifics  
    {"url":"https://www.hiiraan.com/rss/Somalia.xml","source":"Hiiraan Online Somalia","credibility":"medium","region":"Horn of Africa","tier":5},
    {"url":"https://www.garowe online.com/feed","source":"Garowe Online Somalia","credibility":"medium","region":"Horn of Africa","tier":5},

    # Global news aggregators with local signals
    {"url":"https://www.france24.com/en/rss","source":"France 24","credibility":"high","region":"Global","tier":2},
    {"url":"https://rss.dw.com/xml/rss-en-world","source":"Deutsche Welle","credibility":"high","region":"Global","tier":2},
    {"url":"https://www.voanews.com/rss/world","source":"Voice of America","credibility":"high","region":"Global","tier":2},
    {"url":"https://feeds.skynews.com/feeds/rss/world.xml","source":"Sky News World","credibility":"high","region":"Global","tier":2},
    {"url":"https://feeds.npr.org/1004/rss.xml","source":"NPR World","credibility":"high","region":"Global","tier":2},
    {"url":"https://www.euronews.com/rss?format=mrss&level=theme&name=news","source":"Euronews","credibility":"high","region":"Europe","tier":2},
    {"url":"https://www.theguardian.com/world/rss","source":"The Guardian World","credibility":"high","region":"Global","tier":2},
    {"url":"https://www.independent.co.uk/news/world/rss","source":"The Independent","credibility":"high","region":"Global","tier":2},
]

# ─── GDELT EXPANDED QUERIES — More specific and grassroots ───────────────────
GDELT_QUERIES = [
    # Security / Armed Violence
    ("explosion blast bomb IED shooting attack ambush gunfire", "Security", "30min"),
    ("suicide bomber car bomb improvised explosive device checkpoint", "Security", "30min"),
    ("armed robbery kidnapping hostage abduction ransom demand", "Security", "30min"),
    ("assassination targeted killing execution extrajudicial", "Security", "60min"),
    ("gang violence cartel turf drug war organized crime", "Crime", "60min"),
    ("human trafficking smuggling migrants border crossing", "Crime", "60min"),

    # Conflict / Military
    ("airstrike shelling bombardment rocket fire drone strike", "Conflict", "30min"),
    ("troops offensive advance ceasefire frontline military operation", "Conflict", "30min"),
    ("insurgent rebel militia attack overrun captured territory", "Conflict", "30min"),
    ("coup attempt mutiny putsch military overthrow government", "Conflict", "30min"),
    ("naval blockade maritime incident warship seized", "Conflict", "60min"),
    ("mercenary Wagner PMC foreign fighters deployment", "Conflict", "60min"),

    # Civil Unrest
    ("protest riot demonstration clashes police crackdown tear gas", "Unrest", "30min"),
    ("curfew martial law emergency declared state of exception", "Unrest", "30min"),
    ("ethnic violence communal clash sectarian religious tension", "Unrest", "60min"),
    ("strike workers walkout factory shutdown labor dispute", "Unrest", "60min"),

    # Disasters / Natural
    ("earthquake flood cyclone wildfire landslide tsunami eruption", "Disaster", "30min"),
    ("mass evacuation disaster declared emergency response", "Disaster", "30min"),
    ("dam collapse infrastructure failure bridge collapse", "Disaster", "60min"),
    ("drought crop failure food shortage famine starvation", "Humanitarian", "60min"),

    # Health / CBRN
    ("outbreak epidemic cholera ebola marburg dengue disease deaths", "Health", "60min"),
    ("chemical weapon nerve agent poison gas attack", "WMD", "30min"),
    ("nuclear incident radiation leak radiological emergency", "WMD", "30min"),
    ("biological agent bioterrorism lab leak pathogen", "WMD", "60min"),

    # Infrastructure / Cyber
    ("power grid attack cyber hack infrastructure outage sabotage", "Cyber", "60min"),
    ("internet shutdown communication blackout network disruption", "Cyber", "60min"),
    ("oil pipeline attack energy sabotage refinery explosion", "Infrastructure", "60min"),
    ("airport attack port closure shipping lane disruption", "Infrastructure", "60min"),

    # Diplomatic / Geopolitical
    ("sanctions imposed diplomatic expulsion ambassador recalled", "Diplomacy", "60min"),
    ("nuclear deal weapons program missile test ballistic", "WMD", "60min"),
    ("territorial dispute border clash troops massed", "Conflict", "60min"),
    ("refugee crisis mass displacement internally displaced", "Humanitarian", "60min"),
]

# ─── OPEN CRISIS / MONITORING APIs ───────────────────────────────────────────
CRISIS_APIS = [
    {
        "url": "https://api.gdeltproject.org/api/v2/tv/tv",
        "params": {"query": "explosion attack bomb shooting", "mode": "clipgallery", "maxrecords": 10, "format": "json"},
        "source": "GDELT TV Monitor",
        "type": "tv_clips"
    }
]

# ─── NOISE FILTER — MUCH MORE PERMISSIVE for local/grassroots ─────────────────
# Only filter truly irrelevant content
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

# Keywords that ALWAYS include regardless
MUST_INCLUDE = {
    # Violence
    "attack","explosion","bomb","blast","shooting","killed","dead","casualties",
    "murdered","assassinated","executed","lynched","stabbed","gunned",
    "abducted","kidnapped","hostage","ransom","tortured","massacred",
    # Conflict/Military
    "protest","riot","unrest","coup","conflict","war","military","airstrike",
    "shelling","bombardment","frontline","troops","offensive","ceasefire",
    "insurgent","rebel","militia","extremist","jihadist","terrorist",
    "armed attack","ambush","overrun","captured","seized","occupied",
    "drone strike","rocket fire","artillery","mortar",
    # Disasters
    "earthquake","flood","hurricane","cyclone","tsunami","disaster","emergency",
    "eruption","wildfire","landslide","dam collapse","chemical spill",
    # Governance/Security
    "arrested","detained","deported","extradited","curfew","martial law",
    "sanctions","nuclear","missile","biological","chemical weapon",
    "crisis","threat","warning","siege","genocide","ethnic cleansing",
    "refugee","displaced","famine","outbreak","epidemic","pandemic","quarantine",
    # Groups
    "houthi","hamas","hezbollah","taliban","isis","al-qaeda","boko haram",
    "wagner","azov","plo","ltte","naxal","maoist","cartel","gang",
    # Key incidents
    "bus crash","train crash","plane crash","ship sinking","mine collapse",
    "stampede","mass shooting","school attack","hospital attack","market bombing",
}

def score_relevance(title: str, summary: str) -> int:
    text = (title + " " + summary).lower()
    
    # Hard filter — truly irrelevant content
    noise = sum(1 for kw in HARD_NOISE_KW if kw in text)
    if noise >= 3: return -1
    
    # Must-include check — always relevant
    if any(kw in text for kw in MUST_INCLUDE): return 3
    
    # Noise threshold lower for tier 1 feeds (wire services)
    if noise >= 2: return -1
    
    # Geopolitical/governance relevance
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

# ─── CITY / COUNTRY COORDINATES ───────────────────────────────────────────────
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
    "Paris":(48.8566,2.3522),"Berlin":(52.5200,13.4050),"Kiev":(50.4501,30.5234),
    "Sanaa":(15.3694,44.1910),"Aden":(12.7855,45.0187),"Hodeidah":(14.7979,42.9541),
    "Tripoli":(32.9025,13.1805),"Benghazi":(32.1194,20.0868),
    "Kinshasa":(-4.4419,15.2663),"Goma":(-1.6796,29.2285),"Bunia":(1.5643,30.2488),
    "Butembo":(0.1368,29.2926),"Bukavu":(2.4978,28.8494),
    "Khartoum North":(15.6344,32.5561),"Omdurman":(15.6445,32.4800),
    "Tbilisi":(41.6938,44.8015),"Baku":(40.4093,49.8671),"Yerevan":(40.1872,44.5152),
    "Tashkent":(41.2995,69.2401),"Almaty":(43.2220,76.8512),
    "Colombo":(6.9271,79.8612),"Dhaka":(23.8103,90.4125),"Kathmandu":(27.7172,85.3240),
    "Ulaanbaatar":(47.8864,106.9057),"Dushanbe":(38.5598,68.7870),
    "Kabul":(34.5553,69.2075),"Jalalabad":(34.4415,70.4360),"Kunduz":(36.7283,68.8681),
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
    "Burkina Faso":(12.36,-1.53),"Niger":(17.61,8.08),"Mali":(17.57,-4.00),
    "Chad":(15.45,18.73),"Cameroon":(3.85,11.52),"Guinea":(9.95,-11.24),
    "Sierra Leone":(8.46,-11.78),"Liberia":(6.43,-9.43),"Ivory Coast":(7.54,-5.55),
    "Togo":(8.62,0.82),"Benin":(9.31,2.32),"Senegal":(14.50,-14.45),
    "Gambia":(13.44,-15.31),"Guinea-Bissau":(11.80,-15.18),"Mauritania":(21.01,-10.94),
    "Tanzania":(-6.37,34.89),"Uganda":(1.37,32.29),"Burundi":(-3.37,29.92),
    "Rwanda":(-1.94,29.87),"Malawi":(-13.25,34.30),"Zambia":(-13.13,27.85),
    "Zimbabwe":(-19.02,29.15),"Mozambique":(-18.67,35.53),"Madagascar":(-18.77,46.87),
    "Angola":(-11.20,17.87),"Namibia":(-22.96,18.49),"Botswana":(-22.33,24.68),
    "Lesotho":(-29.61,28.23),"Swaziland":(-26.52,31.47),"Eswatini":(-26.52,31.47),
    "Djibouti":(11.83,42.59),"Comoros":(-11.65,43.33),"Cape Verde":(16.54,-23.04),
    "Tajikistan":(38.86,71.28),"Turkmenistan":(38.97,59.56),"Kyrgyzstan":(41.20,74.77),
    "Uzbekistan":(41.38,64.59),"Mongolia":(46.86,103.85),"Laos":(19.86,102.50),
    "Cambodia":(12.57,104.99),"Timor-Leste":(-8.87,125.73),"Brunei":(4.54,114.73),
    "Papua New Guinea":(-6.31,143.96),"Fiji":(-16.58,179.41),"Vanuatu":(-15.38,166.96),
    "Solomon Islands":(-9.43,160.16),"Kiribati":(1.87,174.02),
    "Trinidad and Tobago":(10.69,-61.22),"Jamaica":(18.11,-77.30),"Barbados":(13.19,-59.54),
    "Global":(20.00,0.00),
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
                    headers={"User-Agent": "GlobalIntelDesk/4.0 (globalinteldesk@globalinteldesk.com)"}
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
        "conflict": [
            "war","battle","frontline","airstrike","shelling","bombardment","troops",
            "offensive","ceasefire","fighting","killed in battle","military operation",
            "ground invasion","siege","artillery","rocket fire","drone strike",
            "armed conflict","insurgency","militia","guerrilla","rebel attack",
            "combat","warzone","advancing forces","military advance","overrun",
            "captured","occupied","frontline advance","push back","encircled",
        ],
        "security": [
            "explosion","bomb","blast","attack","shooting","gunfire","stabbing",
            "terrorism","terrorist","hostage","arrest","raid","operation","ied",
            "car bomb","suicide bomber","manhunt","security forces","police operation",
            "assassination","ambush","armed robbery","kidnapping","abduction",
            "threat","plot","foiled attack","security breach","massacre","gunmen",
            "attackers","perpetrators","gunman","shooter","bomber",
        ],
        "diplomacy": [
            "summit","diplomatic","sanctions","negotiations","treaty","agreement",
            "minister","president visit","ambassador","embassy","foreign policy",
            "ceasefire talks","peace process","bilateral","multilateral","un resolution",
            "nato","eu","security council","mediation","envoy","declaration",
            "alliance","partnership","diplomatic crisis","expel ambassador",
        ],
        "economy": [
            "economy","gdp","inflation","recession","financial","market","trade",
            "oil price","gas price","currency","central bank","interest rate",
            "investment","exports","imports","debt","budget","revenue","growth",
            "unemployment","poverty","economic crisis","food prices","cost of living",
        ],
        "humanitarian": [
            "refugees","displaced","famine","starvation","humanitarian","aid",
            "disaster","earthquake","flood","cyclone","tsunami","landslide",
            "drought","food insecurity","malnutrition","disease outbreak","epidemic",
            "cholera","ebola","evacuation","shelter","relief","msf","icrc","unhcr",
            "crisis","mass displacement","civilian casualties","civilian deaths",
            "bus crash","train crash","plane crash","shipwreck","mine collapse",
            "stampede","building collapse","fire kills","deaths reported",
        ],
        "technology": [
            "cyber","hacking","malware","ransomware","surveillance","drone technology",
            "artificial intelligence","ai weapons","cyber attack","data breach",
            "infrastructure hack","electric grid","water system hack","satellite",
            "internet shutdown","communication blackout","signal jamming",
        ],
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
    CRITICAL_KW = [
        "killed","dead","casualties","deaths","fatalities","massacre","genocide",
        "nuclear","chemical weapon","biological","wmd","mass casualty","explosion kills",
        "airstrike kills","bomb kills","shooting kills","attack kills","people dead",
        "bodies found","mass grave","hundreds dead","dozens killed","civilians dead",
    ]
    HIGH_KW = [
        "attack","explosion","bomb","blast","airstrike","military operation","offensive",
        "clashes","fighting","armed conflict","hostage","kidnapping","coup","occupied",
        "siege","shelling","rocket fire","missile strike","drone attack","ambush",
        "major disaster","earthquake","flood","eruption","tsunami","cyclone",
        "shooting","gunfire","stabbing","robbery","abduction","arrested","detained",
    ]
    ELEVATED_KW = [
        "protest","demonstration","riot","unrest","tension","warning","threat",
        "sanctions","crisis","emergency","curfew","political instability","arrests",
        "crackdown","forces deployed","military buildup","standoff","heightened alert",
        "displaced","epidemic","outbreak","strike","blockade","rallies","march",
        "deployed","mobilized","reinforced","evacuated","shut down",
    ]
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

    if detected_city and detected_country == "Global":
        city_to_country = {
            "Gaza City": "Palestine", "Gaza": "Palestine", "Rafah": "Palestine",
            "West Bank": "Palestine", "Kyiv": "Ukraine", "Kharkiv": "Ukraine",
            "Odessa": "Ukraine", "Donetsk": "Ukraine", "Zaporizhzhia": "Ukraine",
            "Moscow": "Russia", "Baghdad": "Iraq", "Tehran": "Iran",
            "Beirut": "Lebanon", "Damascus": "Syria", "Kabul": "Afghanistan",
            "Karachi": "Pakistan", "Lahore": "Pakistan", "Islamabad": "Pakistan",
            "Peshawar": "Pakistan", "Mogadishu": "Somalia", "Khartoum": "Sudan",
            "Nairobi": "Kenya", "Lagos": "Nigeria", "Abuja": "Nigeria",
            "Yangon": "Myanmar", "Mandalay": "Myanmar",
            "Guwahati": "India", "Imphal": "India",
        }
        detected_country = city_to_country.get(detected_city, detected_country)

    COUNTRY_TO_REGION = {
        "Israel": "Middle East", "Palestine": "Middle East", "Lebanon": "Middle East",
        "Syria": "Middle East", "Iraq": "Middle East", "Iran": "Middle East",
        "Jordan": "Middle East", "Saudi Arabia": "Middle East", "Yemen": "Middle East",
        "Turkey": "Middle East", "UAE": "Middle East", "Kuwait": "Middle East",
        "Ukraine": "Eastern Europe", "Russia": "Eastern Europe", "Belarus": "Eastern Europe",
        "Georgia": "Caucasus", "Armenia": "Caucasus", "Azerbaijan": "Caucasus",
        "Kosovo": "Balkans", "Serbia": "Balkans", "Bosnia": "Balkans",
        "Pakistan": "South Asia", "India": "South Asia", "Bangladesh": "South Asia",
        "Afghanistan": "South Asia", "Nepal": "South Asia", "Sri Lanka": "South Asia",
        "Myanmar": "Southeast Asia", "Thailand": "Southeast Asia", "Philippines": "Southeast Asia",
        "Indonesia": "Southeast Asia", "Vietnam": "Southeast Asia",
        "China": "East Asia", "North Korea": "East Asia", "South Korea": "East Asia",
        "Nigeria": "West Africa", "Mali": "Sahel", "Burkina Faso": "Sahel",
        "Niger": "Sahel", "Chad": "Sahel", "Sudan": "Horn of Africa",
        "Ethiopia": "Horn of Africa", "Somalia": "Horn of Africa",
        "Kenya": "East Africa", "Uganda": "East Africa",
        "DR Congo": "Sub-Saharan Africa", "Democratic Republic of Congo": "Sub-Saharan Africa",
        "South Sudan": "Horn of Africa", "Libya": "North Africa", "Egypt": "North Africa",
        "Mexico": "Central America", "Colombia": "South America", "Venezuela": "South America",
        "Haiti": "Caribbean", "Cuba": "Caribbean",
        "Kazakhstan": "Central Asia", "Uzbekistan": "Central Asia",
        "United States": "North America", "Canada": "North America",
        "United Kingdom": "Western Europe", "France": "Western Europe",
        "Germany": "Western Europe", "Australia": "Pacific",
    }
    region = COUNTRY_TO_REGION.get(detected_country, "Global")

    actor_type = "state"
    if any(w in text for w in ["hamas","hezbollah","taliban","isis","al-qaeda","boko haram",
                                 "houthi","npa","eln","farc","ms-13","cartel","rebel","militant",
                                 "insurgent","extremist","jihadist","terrorist group","armed group",
                                 "wagner","azov","plo","ltte","naxal","maoist","gang","militia"]):
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
    tags = []
    for tag, kws in tag_map.items():
        if any(kw in text for kw in kws):
            tags.append(tag)
    if not tags:
        tags = [category]
    tags = tags[:6]

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

fetch_status = FetchStatus()
sse_clients: List[asyncio.Queue] = []

# ─── RSS FETCHER ───────────────────────────────────────────────────────────────
async def fetch_rss(feed: dict, h: httpx.AsyncClient) -> List[dict]:
    items = []
    try:
        resp = await h.get(feed["url"], timeout=15.0, follow_redirects=True)
        if resp.status_code == 200:
            parsed = feedparser.parse(resp.content)
            # Higher item limit for tier 5 (local) sources
            max_items = 20 if feed.get("tier", 2) >= 5 else 15
            for e in parsed.entries[:max_items]:
                title = re.sub(r'<[^>]+>', '', e.get("title", "")).strip()
                summary = re.sub(r'<[^>]+>', '', e.get("summary", e.get("description", ""))).strip()
                summary = re.sub(r'\s+', ' ', summary).strip()
                url = e.get("link", "").strip()
                pub = datetime.now(timezone.utc).isoformat()
                for attr in ["published_parsed", "updated_parsed"]:
                    v = getattr(e, attr, None)
                    if v:
                        try:
                            import calendar
                            pub = datetime.fromtimestamp(calendar.timegm(v), tz=timezone.utc).isoformat()
                            break
                        except:
                            pass
                if title and len(title) > 10:
                    rel = score_relevance(title, summary)
                    if rel < 0: continue
                    items.append({
                        "title": title[:300],
                        "summary": (summary or title)[:800],
                        "url": url,
                        "source": feed["source"],
                        "source_credibility": feed["credibility"],
                        "source_region": feed["region"],
                        "source_tier": feed.get("tier", 2),
                        "published_at": pub,
                        "relevance": rel
                    })
    except Exception as e:
        logger.warning(f"RSS {feed['source']}: {e}")
    return items

# ─── GDELT FETCHER — EXPANDED ─────────────────────────────────────────────────
async def fetch_gdelt() -> List[dict]:
    items = []
    try:
        async with httpx.AsyncClient(timeout=25.0) as h:
            for batch_start in range(0, len(GDELT_QUERIES), 8):
                batch = GDELT_QUERIES[batch_start:batch_start+8]
                tasks = [
                    h.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={
                            "query": q,
                            "mode": "artlist",
                            "maxrecords": "25",
                            "format": "json",
                            "timespan": ts,
                            "sort": "DateDesc",
                            "trans": "googtrans"
                        }
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
                                s = art.get("seendescription", t)[:800]
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
                                        "published_at": datetime.now(timezone.utc).isoformat(),
                                        "relevance": rel
                                    })
                    except:
                        pass
                await asyncio.sleep(0.4)
    except Exception as e:
        logger.warning(f"GDELT: {e}")

    seen = set(); unique = []
    for it in items:
        if it["url"] not in seen:
            seen.add(it["url"]); unique.append(it)
    return unique

# ─── GDELT GKG (Knowledge Graph) — Most powerful source ─────────────────────
async def fetch_gdelt_gkg() -> List[dict]:
    """
    GDELT Global Knowledge Graph — processes 100+ news articles per MINUTE worldwide.
    Identifies events, locations, themes, and entities in near-real-time.
    This is closest to SamDesk-level grassroots ingestion.
    """
    items = []
    crisis_themes = [
        "TERROR","KILL","WOUND","ARREST","RIOT","PROTEST","COUP","MILITARY_FORCE",
        "REBEL","REFUGEE","DISPLACEMENT","FAMINE","EPIDEMIC","NATURAL_DISASTER",
        "ARMED_CONFLICT","EXPLOSION","WEAPON","NUCLEAR","CHEMICAL","KIDNAP",
        "CRIME_VIOLENT","SMUGGLING","TRAFFICKING",
    ]
    
    try:
        # GDELT 2.0 GKG via doc API with theme filter
        async with httpx.AsyncClient(timeout=30.0) as h:
            theme_batches = [crisis_themes[i:i+5] for i in range(0, len(crisis_themes), 5)]
            for theme_batch in theme_batches[:4]:  # Limit to 4 batches
                theme_query = " OR ".join(theme_batch)
                try:
                    resp = await h.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={
                            "query": theme_query,
                            "mode": "artlist",
                            "maxrecords": "20",
                            "format": "json",
                            "timespan": "60min",
                            "sort": "DateDesc",
                        },
                        timeout=15.0
                    )
                    if resp.status_code == 200:
                        for art in resp.json().get("articles", []):
                            t = art.get("title", "").strip()
                            u = art.get("url", "").strip()
                            s = art.get("seendescription", t)[:800]
                            if t and len(t) > 15 and u:
                                rel = score_relevance(t, s)
                                if rel < 0: continue
                                items.append({
                                    "title": t[:300],
                                    "summary": s,
                                    "url": u,
                                    "source": art.get("domain", "GDELT-GKG"),
                                    "source_credibility": "medium",
                                    "source_region": "Global",
                                    "source_tier": 3,
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

# ─── EVENTREGISTRY / OPEN SOURCE INTEL FEEDS ──────────────────────────────────
async def fetch_open_intel_feeds() -> List[dict]:
    """
    Fetch from open intelligence APIs — EventRegistry, Oikeadata, etc.
    """
    items = []
    
    # GDELT Event 2.0 Database — actual events, not just articles
    try:
        async with httpx.AsyncClient(timeout=20.0) as h:
            # Query for high-impact events in past hour
            resp = await h.get(
                "https://api.gdeltproject.org/api/v2/events/events",
                params={
                    "query": "goldsteinscale:<-5",  # High-intensity negative events
                    "mode": "eventlist",
                    "maxrecords": "50",
                    "format": "json",
                    "timespan": "60min",
                    "sort": "DateDesc",
                },
                timeout=15.0
            )
            # Note: Event API may not return expected format, handle gracefully
    except Exception:
        pass
    
    return items

async def broadcast(data: dict):
    for q in list(sse_clients):
        try:
            await q.put(data)
        except:
            if q in sse_clients: sse_clients.remove(q)

# ─── MAIN FETCH & STORE ────────────────────────────────────────────────────────
async def fetch_and_store() -> dict:
    global fetch_status
    if fetch_status.is_fetching:
        return {"success": False, "message": "In progress"}
    fetch_status.is_fetching = True
    try:
        all_raw = []
        sources_ok = 0

        # 1. RSS — all sources in parallel
        async with httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (GlobalIntelDesk/4.0; +https://globalinteldesk.com)"},
            timeout=20.0
        ) as h:
            tasks = [fetch_rss(f, h) for f in RSS_FEEDS]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, list):
                    all_raw.extend(r)
                    sources_ok += 1

        rss_count = len(all_raw)
        logger.info(f"RSS: {rss_count} items from {sources_ok} sources")

        # 2. GDELT standard queries
        gdelt_items = await fetch_gdelt()
        all_raw.extend(gdelt_items)

        # 3. GDELT GKG (theme-based global scan)
        gkg_items = await fetch_gdelt_gkg()
        all_raw.extend(gkg_items)

        gdelt_count = len(gdelt_items) + len(gkg_items)
        logger.info(f"GDELT+GKG: {gdelt_count} items")
        logger.info(f"Total raw: {len(all_raw)}")

        # Deduplicate by URL
        seen_urls: set = set()
        unique_raw = []
        for it in all_raw:
            url = it.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_raw.append(it)
            elif not url:
                # Dedup by title hash
                title_hash = hashlib.md5(it["title"].encode()).hexdigest()
                if title_hash not in seen_urls:
                    seen_urls.add(title_hash)
                    unique_raw.append(it)

        # Filter already-stored items
        existing = set()
        async for doc in db.news_items.find({}, {"url": 1}):
            if doc.get("url"): existing.add(doc["url"])

        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        new = []
        for it in unique_raw:
            if it.get("url") and it["url"] in existing: continue
            try:
                pub = datetime.fromisoformat(it["published_at"].replace('Z', '+00:00'))
                if pub.tzinfo is None: pub = pub.replace(tzinfo=timezone.utc)
                if pub < cutoff: continue
            except:
                pass
            new.append(it)

        # Sort: critical/high relevance first
        new.sort(key=lambda x: x.get("relevance", 0), reverse=True)
        logger.info(f"{len(new)} new unique items to process")

        # Enrich and insert — process up to 100 items per cycle (was 60)
        inserted = 0
        for i in range(0, min(len(new), 100), 8):
            batch = new[i:i+8]
            enrichments = await asyncio.gather(
                *[enrich(it["title"], it["summary"], it["source"]) for it in batch],
                return_exceptions=True
            )
            for item, enrichment in zip(batch, enrichments):
                if isinstance(enrichment, Exception):
                    enrichment = _fallback(item["title"], item["summary"])
                city = enrichment.get("city", "")
                country = enrichment.get("country", "Global")
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
                    "region": enrichment.get("region", "Global"),
                    "tags": enrichment.get("tags", []),
                    "confidence_score": enrichment.get("confidence_score", 0.6),
                    "confidence_level": enrichment.get("confidence_level", "developing"),
                    "threat_level": enrichment.get("threat_level", "low"),
                    "actor_type": enrichment.get("actor_type", "state"),
                    "sub_category": None,
                    "category": enrichment.get("category", "security"),
                    "actionable_insights": enrichment.get("actionable_insights", []),
                    "key_actors": enrichment.get("key_actors", []),
                    "severity_summary": enrichment.get("severity_summary", ""),
                    "precision_level": precision,
                    "user_id": "system",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_at_dt": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    await db.news_items.insert_one(doc)
                    inserted += 1
                    clean = {k: v for k, v in doc.items() if k != "_id"}
                    await broadcast({"type": "new_item", "item": clean})
                except Exception as e:
                    if "duplicate" not in str(e).lower():
                        logger.error(f"Insert: {e}")

        total = await db.news_items.count_documents({})
        fetch_status.last_fetch_time = datetime.now(timezone.utc).isoformat()
        fetch_status.last_fetch_count = inserted
        fetch_status.total_items = total
        fetch_status.sources_checked = sources_ok
        fetch_status.gdelt_items = gdelt_count
        fetch_status.rss_items = rss_count

        logger.info(f"Done: {inserted} inserted, total DB: {total}")
        return {
            "success": True,
            "fetched_total": len(all_raw),
            "unique": len(unique_raw),
            "new": len(new),
            "inserted": inserted,
            "sources_checked": sources_ok,
            "rss_count": rss_count,
            "gdelt_count": gdelt_count,
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
        except Exception as e:
            logger.error(f"Cleanup: {e}")
        await asyncio.sleep(3600)

async def fetch_loop():
    """
    Adaptive fetch loop — SamDesk-style continuous monitoring.
    Primary: every 90 seconds
    Full sweep: every 10 minutes
    """
    logger.info("Intel fetcher started — SamDesk-mode continuous monitoring")
    await asyncio.sleep(5)
    
    cycle = 0
    while True:
        try:
            await fetch_and_store()
            cycle += 1
        except Exception as e:
            logger.error(f"Fetch loop: {e}")
        
        # 90 second standard interval (was 120)
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
        await db.geo_cache.create_index("key", unique=True)
        await db.chat_messages.create_index([("channel", 1), ("timestamp", -1)])
    except Exception as e:
        logger.warning(f"Index: {e}")
    t1 = asyncio.create_task(fetch_loop())
    t2 = asyncio.create_task(cleanup_loop())
    logger.info("Global Intel Desk v4.0 — Ready")
    yield
    t1.cancel(); t2.cancel()
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
    """Aggregated stats for dashboard — threat breakdown, source breakdown, etc."""
    total = await db.news_items.count_documents({})
    pipeline_threat = [{"$group": {"_id": "$threat_level", "count": {"$sum": 1}}}]
    pipeline_cat = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    pipeline_region = [{"$group": {"_id": "$region", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 15}]
    pipeline_recent = [
        {"$match": {"created_at_dt": {"$gte": datetime.now(timezone.utc) - timedelta(hours=1)}}},
        {"$count": "count"}
    ]
    
    threat_agg = await db.news_items.aggregate(pipeline_threat).to_list(length=10)
    cat_agg = await db.news_items.aggregate(pipeline_cat).to_list(length=10)
    region_agg = await db.news_items.aggregate(pipeline_region).to_list(length=15)
    recent_agg = await db.news_items.aggregate(pipeline_recent).to_list(length=1)
    
    return {
        "total": total,
        "last_hour": recent_agg[0]["count"] if recent_agg else 0,
        "by_threat": {d["_id"]: d["count"] for d in threat_agg if d["_id"]},
        "by_category": {d["_id"]: d["count"] for d in cat_agg if d["_id"]},
        "by_region": {d["_id"]: d["count"] for d in region_agg if d["_id"]},
    }

@api_router.get("/news/critical")
async def get_critical(hours: int = 24):
    """Fast endpoint for critical/high threat items only"""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    q = {
        "threat_level": {"$in": ["critical", "high"]},
        "published_at": {"$gte": cutoff}
    }
    cur = db.news_items.find(q, {"_id": 0}).sort("published_at", -1).limit(100)
    return await cur.to_list(length=100)

@api_router.get("/news/status")
async def get_status():
    total = await db.news_items.count_documents({})
    fetch_status.total_items = total
    return fetch_status.dict()

@api_router.post("/news/fetch")
async def trigger_fetch():
    return await fetch_and_store()

@api_router.get("/news/stream")
async def stream():
    q: asyncio.Queue = asyncio.Queue()
    sse_clients.append(q)
    async def gen():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
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
        "version": "4.0",
        "sources": len(RSS_FEEDS),
        "gdelt_queries": len(GDELT_QUERIES),
    }

app.include_router(api_router)
