from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, asyncio, json, uuid, feedparser, httpx, re, random, time
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

# ─── NOISE FILTER ─────────────────────────────────────────────────────────────
NOISE_KW = {
    "cricket","ipl","t20","bollywood","film","movie","actor","actress","celebrity",
    "viral video","trending","box office","music album","reality show","tv serial",
    "sports result","football score","basketball result","tennis tournament",
    "heavy rainfall forecast","weather forecast","monsoon forecast","rain forecast",
    "temperature forecast","fog advisory","weather update today","partly cloudy",
    "traffic jam","metro disruption","bus route","pothole","water supply interruption",
    "stock tips","sensex","nifty","mutual fund","fixed deposit","home loan rate",
    "property price","apartment sale","petrol price today","recipe","food review",
    "restaurant review","fashion","beauty tips","makeup tutorial","horoscope",
    "astrology","zodiac","diet plan","weight loss","skin care","hair care",
    "exam schedule","admit card","result declared","university admission",
    "smartphone review","gadget review","app update","gaming news","esports",
    "travel tips","holiday package","tourist spot","hotel booking","pilgrimage",
    "quarterly earnings","ipo launch","stock listing","product launch","brand ambassador",
}

MUST_INCLUDE = {
    "attack","explosion","bomb","blast","shooting","killed","dead","casualties",
    "protest","riot","unrest","coup","conflict","war","military","airstrike","shelling",
    "terrorism","terrorist","militant","insurgent","rebel","extremist","jihadist",
    "earthquake","flood","hurricane","cyclone","tsunami","disaster","emergency",
    "arrested","detained","hostage","kidnap","abduct",
    "sanction","diplomat","summit","nuclear","missile","drone","weapons",
    "crisis","threat","warning","curfew","siege","massacre","genocide",
    "refugee","displaced","famine","outbreak","epidemic","pandemic","quarantine",
    "assassination","execution","ethnic cleansing","houthi","hamas","hezbollah",
    "taliban","isis","al-qaeda","boko haram","frontline","offensive","ceasefire",
}

def score_relevance(title: str, summary: str) -> int:
    text = (title + " " + summary).lower()
    noise = sum(1 for kw in NOISE_KW if kw in text)
    if noise >= 2: return -1
    if any(kw in text for kw in MUST_INCLUDE): return 2
    if noise >= 1: return -1
    geo = ["minister","president","military","armed forces","police operation",
           "opposition","election","border","troops","forces","casualties","victims",
           "emergency declared","martial law","insurgent","rebel","militia",
           "natural disaster","humanitarian","refugees","famine","nuclear","weapons"]
    if any(g in text for g in geo): return 1
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
    "Moscow":(55.7558,37.6176),"Mogadishu":(2.0469,45.3182),"Khartoum":(15.5007,32.5599),
    "Nairobi":(-1.2921,36.8219),"Lagos":(6.5244,3.3792),"Abuja":(9.0765,7.3986),
    "Addis Ababa":(9.0320,38.7423),"Bamako":(12.6392,-8.0029),"Ouagadougou":(12.3714,-1.5197),
    "Karachi":(24.8607,67.0104),"Lahore":(31.5204,74.3587),"Islamabad":(33.7294,73.0931),
    "Peshawar":(34.0151,71.5249),"New Delhi":(28.6139,77.2090),"Mumbai":(19.0760,72.8777),
    "Bangkok":(13.7563,100.5018),"Manila":(14.5995,120.9842),"Jakarta":(-6.2088,106.8456),
    "Yangon":(16.8661,96.1951),"Beijing":(39.9042,116.4074),"Hong Kong":(22.3193,114.1694),
    "Seoul":(37.5665,126.9780),"Pyongyang":(39.0392,125.7625),"Tokyo":(35.6762,139.6503),
    "Mexico City":(19.4326,-99.1332),"Bogota":(4.7110,-74.0721),"Caracas":(10.4806,-66.9036),
    "Port-au-Prince":(18.5944,-72.3074),"Washington":(38.9072,-77.0369),"London":(51.5074,-0.1278),
    "Paris":(48.8566,2.3522),"Berlin":(52.5200,13.4050),"Kiev":(50.4501,30.5234),
    "Sanaa":(15.3694,44.1910),"Aden":(12.7855,45.0187),"Tripoli":(32.9025,13.1805),
    "Kinshasa":(-4.4419,15.2663),"Goma":(-1.6796,29.2285),"Bunia":(1.5643,30.2488),
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
    "Global":(20.00,0.00),
}

# ─── RSS FEEDS (120+ global sources) ─────────────────────────────────────────
RSS_FEEDS = [
    {"url":"https://feeds.bbci.co.uk/news/world/rss.xml","source":"BBC World","credibility":"high","region":"Global"},
    {"url":"https://feeds.bbci.co.uk/news/rss.xml","source":"BBC Top Stories","credibility":"high","region":"Global"},
    {"url":"https://www.aljazeera.com/xml/rss/all.xml","source":"Al Jazeera","credibility":"high","region":"Global"},
    {"url":"https://www.france24.com/en/rss","source":"France 24","credibility":"high","region":"Global"},
    {"url":"https://rss.dw.com/xml/rss-en-world","source":"Deutsche Welle","credibility":"high","region":"Global"},
    {"url":"https://www.voanews.com/rss/world","source":"Voice of America","credibility":"high","region":"Global"},
    {"url":"https://news.un.org/feed/subscribe/en/news/all/rss.xml","source":"UN News","credibility":"high","region":"Global"},
    {"url":"https://www.theguardian.com/world/rss","source":"The Guardian","credibility":"high","region":"Global"},
    {"url":"https://feeds.skynews.com/feeds/rss/world.xml","source":"Sky News","credibility":"high","region":"Global"},
    {"url":"https://feeds.npr.org/1004/rss.xml","source":"NPR World","credibility":"high","region":"Global"},
    {"url":"https://www.euronews.com/rss?format=mrss&level=theme&name=news","source":"Euronews","credibility":"high","region":"Europe"},
    {"url":"https://www.rferl.org/api/epiqzqirrukp","source":"Radio Free Europe","credibility":"high","region":"Global"},
    {"url":"https://abcnews.go.com/abcnews/internationalheadlines","source":"ABC News","credibility":"high","region":"Global"},
    {"url":"https://rss.cnn.com/rss/edition_world.rss","source":"CNN World","credibility":"high","region":"Global"},
    {"url":"https://apnews.com/hub/world-news/rss","source":"AP News","credibility":"high","region":"Global"},
    {"url":"https://www.independent.co.uk/news/world/rss","source":"The Independent","credibility":"high","region":"Global"},
    {"url":"https://travel.state.gov/content/travel/en/RSS.rss.html","source":"US State Dept","credibility":"high","region":"Global"},
    {"url":"https://www.gov.uk/foreign-travel-advice.atom","source":"UK FCDO","credibility":"high","region":"Global"},
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom","source":"USGS Earthquakes","credibility":"high","region":"Global"},
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom","source":"USGS M4.5+","credibility":"high","region":"Global"},
    {"url":"https://www.gdacs.org/xml/rss_24h.xml","source":"GDACS Disasters","credibility":"high","region":"Global"},
    {"url":"https://reliefweb.int/updates/rss.xml","source":"ReliefWeb","credibility":"high","region":"Global"},
    {"url":"https://reliefweb.int/disasters/rss.xml","source":"ReliefWeb Disasters","credibility":"high","region":"Global"},
    {"url":"https://www.who.int/feeds/entity/don/en/rss.xml","source":"WHO Outbreaks","credibility":"high","region":"Global"},
    {"url":"https://wwwnc.cdc.gov/travel/notices/rss.xml","source":"CDC Travel Health","credibility":"high","region":"Global"},
    {"url":"https://aviation-safety.net/news/rss.php","source":"Aviation Safety","credibility":"high","region":"Global"},
    {"url":"https://www.arabnews.com/rss.xml","source":"Arab News","credibility":"medium","region":"Middle East"},
    {"url":"https://www.jpost.com/rss/rssfeedsfrontpage.aspx","source":"Jerusalem Post","credibility":"medium","region":"Middle East"},
    {"url":"https://www.middleeasteye.net/rss","source":"Middle East Eye","credibility":"medium","region":"Middle East"},
    {"url":"https://www.iranintl.com/en/rss","source":"Iran International","credibility":"medium","region":"Middle East"},
    {"url":"https://www.haaretz.com/cmlink/1.628765","source":"Haaretz","credibility":"high","region":"Middle East"},
    {"url":"https://english.alarabiya.net/rss.xml","source":"Al Arabiya","credibility":"medium","region":"Middle East"},
    {"url":"https://www.timesofisrael.com/feed/","source":"Times of Israel","credibility":"medium","region":"Middle East"},
    {"url":"https://www.rudaw.net/english/feed","source":"Rudaw Kurdistan","credibility":"medium","region":"Middle East"},
    {"url":"https://www.trtworld.com/rss","source":"TRT World","credibility":"medium","region":"Middle East"},
    {"url":"https://www.bbc.co.uk/news/world/middle_east/rss.xml","source":"BBC Middle East","credibility":"high","region":"Middle East"},
    {"url":"https://kyivindependent.com/feed/","source":"Kyiv Independent","credibility":"high","region":"Eastern Europe"},
    {"url":"https://www.ukrinform.net/rss/block-lastnews","source":"Ukrinform","credibility":"high","region":"Eastern Europe"},
    {"url":"https://euromaidan.press/feed/","source":"Euromaidan Press","credibility":"high","region":"Eastern Europe"},
    {"url":"https://www.themoscowtimes.com/rss/news","source":"The Moscow Times","credibility":"high","region":"Eastern Europe"},
    {"url":"https://balkaninsight.com/feed/","source":"Balkan Insight","credibility":"high","region":"Balkans"},
    {"url":"https://www.dawn.com/feeds/home","source":"Dawn Pakistan","credibility":"high","region":"South Asia"},
    {"url":"https://tribune.com.pk/rss","source":"Express Tribune PK","credibility":"high","region":"South Asia"},
    {"url":"https://www.thehindu.com/news/international/?service=rss","source":"The Hindu Intl","credibility":"high","region":"South Asia"},
    {"url":"https://www.thedailystar.net/frontpage/rss.xml","source":"Daily Star Bangladesh","credibility":"high","region":"South Asia"},
    {"url":"https://kathmandupost.com/rss","source":"Kathmandu Post","credibility":"high","region":"South Asia"},
    {"url":"https://www.bbc.co.uk/news/world/south_asia/rss.xml","source":"BBC South Asia","credibility":"high","region":"South Asia"},
    {"url":"https://www.bangkokpost.com/rss/data/topstories.xml","source":"Bangkok Post","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.straitstimes.com/news/asia/rss.xml","source":"Straits Times","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.rappler.com/rss/nation.xml","source":"Rappler Philippines","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.thejakartapost.com/news/rss","source":"Jakarta Post","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.irrawaddy.com/feed","source":"The Irrawaddy","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.channelnewsasia.com/rssfeeds/8395984","source":"Channel NewsAsia","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.bbc.co.uk/news/world/asia_pacific/rss.xml","source":"BBC Asia Pacific","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.japantimes.co.jp/feed/","source":"Japan Times","credibility":"high","region":"East Asia"},
    {"url":"https://www.scmp.com/rss/91/feed","source":"S China Morning Post","credibility":"high","region":"East Asia"},
    {"url":"https://www.rfa.org/english/rss2.0","source":"Radio Free Asia","credibility":"high","region":"East Asia"},
    {"url":"https://asia.nikkei.com/rss/feed/nar","source":"Nikkei Asia","credibility":"high","region":"East Asia"},
    {"url":"https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf","source":"AllAfrica","credibility":"medium","region":"Africa"},
    {"url":"https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf","source":"AllAfrica Latest","credibility":"medium","region":"Africa"},
    {"url":"https://www.premiumtimesng.com/feed","source":"Premium Times Nigeria","credibility":"medium","region":"West Africa"},
    {"url":"https://www.dailymaverick.co.za/feed/","source":"Daily Maverick SA","credibility":"high","region":"Southern Africa"},
    {"url":"https://www.nation.co.ke/news/rss.xml","source":"Daily Nation Kenya","credibility":"high","region":"East Africa"},
    {"url":"https://www.addisstandard.com/feed/","source":"Addis Standard","credibility":"high","region":"Horn of Africa"},
    {"url":"https://sudantribune.com/spip.php?page=backend","source":"Sudan Tribune","credibility":"medium","region":"Horn of Africa"},
    {"url":"https://www.theafricareport.com/feed/","source":"The Africa Report","credibility":"high","region":"Africa"},
    {"url":"https://rfi.fr/en/rss","source":"RFI Africa/World","credibility":"high","region":"Africa"},
    {"url":"https://www.bbc.co.uk/news/world/africa/rss.xml","source":"BBC Africa","credibility":"high","region":"Africa"},
    {"url":"https://insightcrime.org/feed/","source":"InSight Crime","credibility":"high","region":"Latin America"},
    {"url":"https://en.mercopress.com/rss","source":"MercoPress","credibility":"medium","region":"South America"},
    {"url":"https://www.bbc.co.uk/news/world/latin_america/rss.xml","source":"BBC Latin America","credibility":"high","region":"Latin America"},
    {"url":"https://akipress.com/rss/news_en.rss","source":"AKIpress","credibility":"medium","region":"Central Asia"},
    {"url":"https://eurasianet.org/feed","source":"Eurasianet","credibility":"high","region":"Central Asia"},
    {"url":"https://www.politico.eu/feed/","source":"Politico Europe","credibility":"high","region":"Western Europe"},
    {"url":"https://www.euractiv.com/feed/","source":"EurActiv","credibility":"high","region":"Western Europe"},
    {"url":"https://www.abc.net.au/news/feed/51120/rss.xml","source":"ABC Australia","credibility":"high","region":"Pacific"},
    {"url":"https://www.rnz.co.nz/news/world.rss","source":"RNZ New Zealand","credibility":"high","region":"Pacific"},
    {"url":"https://www.crisisgroup.org/rss.xml","source":"ICG Crisis Group","credibility":"high","region":"Global"},
    {"url":"https://www.icrc.org/en/rss/news","source":"ICRC Red Cross","credibility":"high","region":"Global"},
    {"url":"https://thediplomat.com/feed/","source":"The Diplomat","credibility":"high","region":"Asia"},
    {"url":"https://warontherocks.com/feed/","source":"War on the Rocks","credibility":"high","region":"Global"},
    {"url":"https://www.bellingcat.com/feed/","source":"Bellingcat OSINT","credibility":"high","region":"Global"},
    {"url":"https://foreignpolicy.com/feed/","source":"Foreign Policy","credibility":"high","region":"Global"},
]

LAYER1_QUERIES = [
    ("explosion blast bomb IED shooting attack terrorism hostage", "Security"),
    ("suicide bomber ambush militant armed group checkpoint attack", "Security"),
    ("protest riot clash demonstration curfew unrest strike coup", "Unrest"),
    ("kidnapping robbery carjacking gang murder assault organized crime", "Crime"),
    ("earthquake flood cyclone wildfire landslide storm tsunami eruption", "Disaster"),
    ("airport closed flight cancelled power outage internet shutdown", "Infrastructure"),
    ("nuclear biological chemical weapon WMD radiological", "WMD"),
    ("famine starvation displacement refugee crisis humanitarian", "Humanitarian"),
]

# AI ENRICHMENT PROMPT
ENRICH_PROMPT = """You are a senior intelligence analyst. Analyze this news article and return ONLY valid JSON (no markdown):
{
  "category": "security|conflict|diplomacy|economy|humanitarian|technology",
  "threat_level": "critical|high|elevated|low",
  "country": "full English country name",
  "city": "most specific location - city/district/airport. Never Unknown.",
  "region": "Middle East|Eastern Europe|South Asia|East Asia|Southeast Asia|Central Asia|North Africa|Sub-Saharan Africa|West Africa|East Africa|Horn of Africa|Sahel|Balkans|Caucasus|Caribbean|South America|Central America|North America|Western Europe|Pacific|Global",
  "actor_type": "state|non-state|organization",
  "tags": ["3-5 keyword tags"],
  "confidence_level": "verified|developing|breaking",
  "confidence_score": 0.8,
  "actionable_insights": ["2-3 immediate security actions"],
  "key_actors": ["main actors"],
  "severity_summary": "one crisp sentence"
}
Threat levels: critical=mass casualties/WMD, high=significant violence/major crisis, elevated=tensions/protests, low=routine diplomacy"""

geo_cache: Dict[str, Tuple[float, float]] = {}
nominatim_lock = asyncio.Semaphore(1)
nom_last = 0.0

async def geocode(city: str, country: str) -> Tuple[float, float, str]:
    """Precise city-level geocoding with minimal jitter to avoid wrong positions."""
    global nom_last
    city = (city or "").strip()
    country = (country or "Global").strip()

    # No city — use accurate country centroid with tiny jitter
    if not city or city.lower() in ("unknown", "global", "", "n/a"):
        lat, lon = COUNTRY_COORDS.get(country, COUNTRY_COORDS.get("Global", (20.0, 0.0)))
        # Small jitter (±0.3°) to avoid exact overlap of country markers
        return round(lat + random.uniform(-0.3, 0.3), 4), round(lon + random.uniform(-0.3, 0.3), 4), "country"

    # Exact city match in our database
    if city in CITY_COORDS:
        lat, lon = CITY_COORDS[city]
        # Tiny jitter (±0.01°) to separate multiple events in same city
        return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"

    # Try partial city match
    city_lower = city.lower()
    for known_city, coords in CITY_COORDS.items():
        if known_city.lower() in city_lower or city_lower in known_city.lower():
            lat, lon = coords
            return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"

    # Check cache
    cache_key = f"{city},{country}".lower()
    if cache_key in geo_cache:
        lat, lon = geo_cache[cache_key]
        return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"
    cached = await db.geo_cache.find_one({"key": cache_key})
    if cached:
        geo_cache[cache_key] = (cached["lat"], cached["lon"])
        return round(cached["lat"] + random.uniform(-0.01, 0.01), 5), round(cached["lon"] + random.uniform(-0.01, 0.01), 5), "city"

    # Nominatim API — city-level precision
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
                    headers={"User-Agent": "GlobalIntelDesk/3.0 (globalinteldesk@globalinteldesk.com)"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                        # Store exact coordinates, tiny jitter only on display
                        geo_cache[cache_key] = (lat, lon)
                        try:
                            await db.geo_cache.insert_one({"key": cache_key, "lat": lat, "lon": lon})
                        except Exception:
                            pass
                        return round(lat + random.uniform(-0.01, 0.01), 5), round(lon + random.uniform(-0.01, 0.01), 5), "city"
        except Exception as e:
            logger.warning(f"Nominatim failed for '{city},{country}': {e}")

    # Final fallback: accurate country centroid
    lat, lon = COUNTRY_COORDS.get(country, (20.0, 0.0))
    return round(lat + random.uniform(-0.3, 0.3), 4), round(lon + random.uniform(-0.3, 0.3), 4), "country"

async def enrich(title: str, summary: str, source: str) -> dict:
    try:
        if not EMERGENT_LLM_KEY: return _fallback(title, summary)
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"e-{uuid.uuid4()}", system_message=ENRICH_PROMPT).with_model("openai","gpt-4.1-mini")
        resp = await chat.send_message(UserMessage(text=f"Title: {title[:300]}\nContent: {summary[:600]}\nSource: {source}\n\nJSON only."))
        clean = re.sub(r'```(?:json)?\n?','',resp.strip()).rstrip('`').strip()
        d = json.loads(clean)
        cat = d.get("category","security")
        if cat not in ["security","conflict","diplomacy","economy","humanitarian","technology"]: cat="security"
        tl = d.get("threat_level","low")
        if tl not in ["critical","high","elevated","low"]: tl="low"
        at = d.get("actor_type","state")
        if at not in ["state","non-state","organization"]: at="state"
        cl = d.get("confidence_level","developing")
        if cl not in ["verified","developing","breaking"]: cl="developing"
        return {"category":cat,"threat_level":tl,"country":d.get("country","Global"),
                "city":d.get("city",""),"region":d.get("region","Global"),"actor_type":at,
                "tags":[str(t) for t in d.get("tags",[])[:5]],"confidence_level":cl,
                "confidence_score":round(min(max(float(d.get("confidence_score",0.6)),0.0),1.0),2),
                "actionable_insights":d.get("actionable_insights",[])[:3],
                "key_actors":d.get("key_actors",[])[:4],"severity_summary":d.get("severity_summary","")}
    except Exception as e:
        logger.warning(f"Enrichment failed: {e}")
        return _fallback(title, summary)

def _fallback(title: str, summary: str) -> dict:
    text = (title+" "+summary).lower()
    cat = "security"
    if any(w in text for w in ["war","battle","troops","airstrike","fighting","offensive"]): cat="conflict"
    elif any(w in text for w in ["diplomatic","summit","sanctions","treaty","negotiate"]): cat="diplomacy"
    elif any(w in text for w in ["economy","gdp","trade","inflation","financial"]): cat="economy"
    elif any(w in text for w in ["refugee","humanitarian","disaster","flood","earthquake","famine"]): cat="humanitarian"
    tl = "low"
    if any(w in text for w in ["killed","dead","casualties","explosion","massacre","nuclear"]): tl="critical"
    elif any(w in text for w in ["attack","conflict","military","airstrike","offensive"]): tl="high"
    elif any(w in text for w in ["tension","protest","unrest","warning","crisis"]): tl="elevated"
    city = ""
    for c in CITY_COORDS:
        if c.lower() in text: city=c; break
    country = "Global"
    for c in COUNTRY_COORDS:
        if c.lower() in text: country=c; break
    return {"category":cat,"threat_level":tl,"country":country,"city":city,"region":"Global","actor_type":"state",
            "tags":[cat,tl],"confidence_level":"developing","confidence_score":0.55,
            "actionable_insights":[],"key_actors":[],"severity_summary":title[:100]}

class FetchStatus(BaseModel):
    is_fetching: bool = False; last_fetch_time: Optional[str] = None
    last_fetch_count: int = 0; total_items: int = 0; sources_checked: int = 0

fetch_status = FetchStatus()
sse_clients: List[asyncio.Queue] = []

async def fetch_rss(feed: dict, h: httpx.AsyncClient) -> List[dict]:
    items = []
    try:
        resp = await h.get(feed["url"], timeout=15.0, follow_redirects=True)
        if resp.status_code == 200:
            parsed = feedparser.parse(resp.content)
            for e in parsed.entries[:12]:
                title = re.sub(r'<[^>]+>','',e.get("title","")).strip()
                summary = re.sub(r'<[^>]+>','',e.get("summary",e.get("description",""))).strip()
                summary = re.sub(r'\s+',' ',summary).strip()
                url = e.get("link","").strip()
                pub = datetime.now(timezone.utc).isoformat()
                for attr in ["published_parsed","updated_parsed"]:
                    v = getattr(e,attr,None)
                    if v:
                        try:
                            import calendar
                            pub = datetime.fromtimestamp(calendar.timegm(v),tz=timezone.utc).isoformat()
                            break
                        except: pass
                if title and len(title)>10:
                    rel = score_relevance(title, summary)
                    if rel < 0: continue
                    items.append({"title":title[:300],"summary":(summary or title)[:800],
                                  "url":url,"source":feed["source"],"source_credibility":feed["credibility"],
                                  "source_region":feed["region"],"published_at":pub,"relevance":rel})
    except Exception as e:
        logger.warning(f"RSS {feed['source']}: {e}")
    return items

async def fetch_gdelt() -> List[dict]:
    items = []
    queries = [(q,c,"15min") for q,c in LAYER1_QUERIES]
    try:
        async with httpx.AsyncClient(timeout=20.0) as h:
            for batch_start in range(0, len(queries), 8):
                batch = queries[batch_start:batch_start+8]
                tasks = [h.get("https://api.gdeltproject.org/api/v2/doc/doc",
                    params={"query":q,"mode":"artlist","maxrecords":"20","format":"json","timespan":ts,"sort":"DateDesc"})
                    for q,_,ts in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, resp in enumerate(results):
                    if isinstance(resp, Exception): continue
                    try:
                        if resp.status_code == 200:
                            for art in resp.json().get("articles",[]):
                                t = art.get("title","").strip(); u = art.get("url","").strip()
                                s = art.get("seendescription",t)[:800]
                                if t and len(t)>15 and u:
                                    rel = score_relevance(t,s)
                                    if rel < 0: continue
                                    items.append({"title":t[:300],"summary":s,"url":u,
                                                  "source":art.get("domain",f"GDELT/{batch[i][1]}"),
                                                  "source_credibility":"medium","source_region":batch[i][1],
                                                  "published_at":datetime.now(timezone.utc).isoformat(),"relevance":rel})
                    except: pass
                await asyncio.sleep(0.3)
    except Exception as e:
        logger.warning(f"GDELT: {e}")
    seen = set(); unique = []
    for it in items:
        if it["url"] not in seen: seen.add(it["url"]); unique.append(it)
    return unique

async def broadcast(data: dict):
    for q in list(sse_clients):
        try: await q.put(data)
        except: sse_clients.remove(q) if q in sse_clients else None

async def fetch_and_store() -> dict:
    global fetch_status
    if fetch_status.is_fetching: return {"success":False,"message":"In progress"}
    fetch_status.is_fetching = True
    try:
        all_raw = []; sources_ok = 0
        async with httpx.AsyncClient(headers={"User-Agent":"Mozilla/5.0 (GlobalIntelDesk/2.0)"},timeout=20.0) as h:
            tasks = [fetch_rss(f,h) for f in RSS_FEEDS]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, list): all_raw.extend(r); sources_ok+=1
        gdelt = await fetch_gdelt()
        all_raw.extend(gdelt)
        logger.info(f"Fetched {len(all_raw)} raw from {sources_ok} RSS + GDELT")
        existing = set()
        async for doc in db.news_items.find({},{"url":1}):
            if doc.get("url"): existing.add(doc["url"])
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        new = []
        for it in all_raw:
            if it["url"] and it["url"] in existing: continue
            try:
                pub = datetime.fromisoformat(it["published_at"].replace('Z','+00:00'))
                if pub.tzinfo is None: pub = pub.replace(tzinfo=timezone.utc)
                if pub < cutoff: continue
            except: pass
            new.append(it)
        new.sort(key=lambda x: x.get("relevance",0), reverse=True)
        logger.info(f"{len(new)} new relevant items")
        inserted = 0
        for i in range(0, min(len(new),60), 8):
            batch = new[i:i+8]
            enrichments = await asyncio.gather(*[enrich(it["title"],it["summary"],it["source"]) for it in batch], return_exceptions=True)
            for item, enrichment in zip(batch, enrichments):
                if isinstance(enrichment, Exception): enrichment = _fallback(item["title"],item["summary"])
                city = enrichment.get("city",""); country = enrichment.get("country","Global")
                lat, lon, precision = await geocode(city, country)
                doc = {
                    "id":str(uuid.uuid4()),"token":str(uuid.uuid4())[:8].upper(),
                    "title":item["title"],"summary":item["summary"],"url":item["url"],
                    "source":item["source"],"source_credibility":item.get("source_credibility","medium"),
                    "published_at":item["published_at"],"lat":lat,"lon":lon,
                    "country":country,"city":city,"region":enrichment.get("region","Global"),
                    "tags":enrichment.get("tags",[]),"confidence_score":enrichment.get("confidence_score",0.6),
                    "confidence_level":enrichment.get("confidence_level","developing"),
                    "threat_level":enrichment.get("threat_level","low"),
                    "actor_type":enrichment.get("actor_type","state"),"sub_category":None,
                    "category":enrichment.get("category","security"),
                    "actionable_insights":enrichment.get("actionable_insights",[]),
                    "key_actors":enrichment.get("key_actors",[]),
                    "severity_summary":enrichment.get("severity_summary",""),
                    "precision_level":precision,"user_id":"system",
                    "created_at":datetime.now(timezone.utc).isoformat(),
                    "created_at_dt":datetime.now(timezone.utc),
                    "updated_at":datetime.now(timezone.utc).isoformat(),
                }
                try:
                    await db.news_items.insert_one(doc)
                    inserted+=1
                    clean = {k:v for k,v in doc.items() if k!="_id"}
                    await broadcast({"type":"new_item","item":clean})
                except Exception as e:
                    if "duplicate" not in str(e).lower(): logger.error(f"Insert: {e}")
        total = await db.news_items.count_documents({})
        fetch_status.last_fetch_time = datetime.now(timezone.utc).isoformat()
        fetch_status.last_fetch_count = inserted
        fetch_status.total_items = total
        fetch_status.sources_checked = sources_ok
        logger.info(f"Done: {inserted} inserted, total {total}")
        return {"success":True,"fetched":len(all_raw),"inserted":inserted,"sources_checked":sources_ok}
    except Exception as e:
        logger.error(f"Fetch error: {e}"); return {"success":False,"error":str(e)}
    finally:
        fetch_status.is_fetching = False

async def cleanup_loop():
    while True:
        try:
            cutoff = (datetime.now(timezone.utc)-timedelta(days=7)).isoformat()
            r = await db.news_items.delete_many({"published_at":{"$lt":cutoff}})
            if r.deleted_count > 0: logger.info(f"Cleanup: removed {r.deleted_count} old items")
        except Exception as e: logger.error(f"Cleanup: {e}")
        await asyncio.sleep(3600)

async def fetch_loop():
    logger.info("Intel fetcher started")
    await asyncio.sleep(5)
    while True:
        try: await fetch_and_store()
        except Exception as e: logger.error(f"Fetch loop: {e}")
        await asyncio.sleep(120)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.news_items.create_index("url", unique=True, sparse=True)
        await db.news_items.create_index([("published_at",-1)])
        await db.news_items.create_index("threat_level")
        await db.news_items.create_index("category")
        await db.news_items.create_index("country")
        await db.geo_cache.create_index("key", unique=True)
        await db.chat_messages.create_index([("channel",1),("timestamp",-1)])
    except Exception as e: logger.warning(f"Index: {e}")
    t1 = asyncio.create_task(fetch_loop())
    t2 = asyncio.create_task(cleanup_loop())
    logger.info("Global Intel Desk backend ready")
    yield
    t1.cancel(); t2.cancel()
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS','*').split(','),
    allow_methods=["*"], allow_headers=["*"])

# ─── NEWS ENDPOINTS ───────────────────────────────────────────────────────────
@api_router.get("/news")
async def get_news(limit:int=Query(300,le=500),offset:int=0,
    category:Optional[str]=None,threat_level:Optional[str]=None,
    country:Optional[str]=None,search:Optional[str]=None,hours:Optional[int]=None):
    q: Dict[str,Any] = {}
    if category: q["category"]=category
    if threat_level: q["threat_level"]=threat_level
    if country: q["country"]={"$regex":country,"$options":"i"}
    if search: q["$or"]=[{"title":{"$regex":search,"$options":"i"}},{"summary":{"$regex":search,"$options":"i"}},{"country":{"$regex":search,"$options":"i"}}]
    if hours:
        cutoff=(datetime.now(timezone.utc)-timedelta(hours=hours)).isoformat()
        q["published_at"]={"$gte":cutoff}
    cur = db.news_items.find(q,{"_id":0}).sort("published_at",-1).skip(offset).limit(limit)
    return await cur.to_list(length=limit)

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
            yield f"data: {json.dumps({'type':'connected'})}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type':'heartbeat'})}\n\n"
        except: pass
        finally:
            if q in sse_clients: sse_clients.remove(q)
    return StreamingResponse(gen(), media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no","Connection":"keep-alive"})

@api_router.get("/news/{item_id}")
async def get_item(item_id: str):
    item = await db.news_items.find_one({"id":item_id},{"_id":0})
    if not item: raise HTTPException(404,"Not found")
    return item

@api_router.delete("/news/{item_id}")
async def delete_item(item_id: str):
    r = await db.news_items.delete_one({"id":item_id})
    if r.deleted_count==0: raise HTTPException(404,"Not found")
    await broadcast({"type":"deleted_item","id":item_id})
    return {"success":True}

# ─── CHAT ─────────────────────────────────────────────────────────────────────
CHAT_CHANNELS = {
    "general":{"name":"#general","desc":"General intel discussion"},
    "middle-east":{"name":"#middle-east","desc":"Middle East & North Africa"},
    "conflict":{"name":"#conflict","desc":"Active conflict zones"},
    "security":{"name":"#security","desc":"Security & threats"},
    "geopolitics":{"name":"#geopolitics","desc":"Geopolitical analysis"},
    "humanitarian":{"name":"#humanitarian","desc":"Humanitarian situations"},
}

class ChatMgr:
    def __init__(self): self.conns: Dict[str,List[Dict]] = {ch:[] for ch in CHAT_CHANNELS}
    async def connect(self, ws, ch, username, uid):
        await ws.accept(); self.conns.setdefault(ch,[]).append({"ws":ws,"username":username,"uid":uid})
        await self.sys(ch, f"{username} joined")
    def disconnect(self, ws, ch, username):
        self.conns[ch] = [c for c in self.conns.get(ch,[]) if c["ws"]!=ws]
    async def broadcast(self, ch, msg):
        dead=[]
        for c in self.conns.get(ch,[]):
            try: await c["ws"].send_json(msg)
            except: dead.append(c)
        for d in dead:
            if d in self.conns.get(ch,[]): self.conns[ch].remove(d)
    async def sys(self, ch, text):
        await self.broadcast(ch,{"type":"system","id":str(uuid.uuid4()),"channel":ch,"username":"SYSTEM",
            "text":text,"timestamp":datetime.now(timezone.utc).isoformat()})
    def online(self, ch): return len(self.conns.get(ch,[]))

chat = ChatMgr()

@api_router.get("/chat/channels")
async def chat_channels():
    return {"channels":[{"key":k,"name":v["name"],"description":v["desc"],"online":chat.online(k)} for k,v in CHAT_CHANNELS.items()]}

@api_router.get("/chat/messages/{channel}")
async def chat_messages(channel:str, limit:int=50):
    if channel not in CHAT_CHANNELS: raise HTTPException(400,"Invalid")
    cur = db.chat_messages.find({"channel":channel},{"_id":0}).sort("timestamp",-1).limit(limit)
    msgs = await cur.to_list(length=limit)
    return list(reversed(msgs))

@api_router.websocket("/chat/ws/{channel}")
async def chat_ws(ws:WebSocket, channel:str, username:str="Analyst", user_id:str="anon"):
    if channel not in CHAT_CHANNELS: await ws.close(4000); return
    await chat.connect(ws, channel, username[:30], user_id)
    await ws.send_json({"type":"online_count","channel":channel,"count":chat.online(channel)})
    try:
        while True:
            data = await ws.receive_json()
            if data.get("type")=="message" and data.get("text","").strip():
                doc = {"id":str(uuid.uuid4()),"channel":channel,"username":username[:30],
                       "text":data["text"].strip()[:500],"user_id":user_id,
                       "timestamp":datetime.now(timezone.utc).isoformat(),"type":"message"}
                await db.chat_messages.insert_one(doc)
                clean = {k:v for k,v in doc.items() if k!="_id"}
                await chat.broadcast(channel, clean)
    except WebSocketDisconnect:
        chat.disconnect(ws, channel, username)
        await chat.sys(channel, f"{username} left")

@api_router.get("/")
async def root(): return {"message":"Global Intel Desk API","status":"operational","version":"3.0"}

app.include_router(api_router)
