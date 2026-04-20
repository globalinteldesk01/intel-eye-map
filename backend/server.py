from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, asyncio, json, uuid, feedparser, httpx, re, random, time
import trafilatura
from langdetect import detect, LangDetectException
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── INTELLIGENCE RELEVANCE FILTER ───────────────────────────────────────────
# Keywords that indicate LOCAL/NOISE content — skip these
NOISE_KEYWORDS: set = {
    # Sports & Entertainment
    "cricket","ipl","t20","test match","odi","bollywood","film","movie","actor","actress",
    "celebrity","viral video","trending","social media","meme","tiktok","instagram",
    "box office","music album","reality show","tv serial","web series","ott",
    "sports","football result","basketball score","tennis tournament","golf championship",
    "swimming meet","olympics medal","nba","nfl","nhl","epl","la liga","serie a",
    # Weather (local forecasts — keep disaster events)
    "heavy rainfall forecast","weather forecast","monsoon forecast","rain forecast",
    "temperature forecast","humidity","fog advisory","wind speed forecast",
    "weather update today","sky condition","partly cloudy","sunny day",
    "moderate to heavy rain","rain likely","showers expected",
    # Local government / admin (no security relevance)
    "disallows","budget release","fund release","audit report","coa finding",
    "salary increase","pension fund","procurement","bid award","contract awarded",
    "mayor inaugurates","governor visits","councilor proposes","senator files bill",
    "senate hearing","house panel","committee approves","plenary session",
    "price order","oil firm","petrol pump","electricity tariff","water tariff",
    "tax collection","customs bureau","revenue target","gdp growth rate",
    # Local traffic / infrastructure
    "traffic jam","road closure","metro disruption","bus route","commute","pothole",
    "water supply interruption","scheduled maintenance","power interruption schedule",
    "metro line","lrt","mrt","bus rapid transit","train delay",
    # Finance / Economy (retail local)
    "stock tips","sensex today","nifty","mutual fund","fixed deposit","emi",
    "home loan rate","property price","apartment sale","real estate","petrol price today",
    "peso exchange","rupee rate","currency pair","crypto price","bitcoin price",
    # Lifestyle & Fluff
    "recipe","food review","restaurant","fashion","beauty tips","makeup tutorial",
    "horoscope","astrology","zodiac","vastu","feng shui","diet plan","weight loss",
    "skin care","hair care","relationship advice","love life","dating tips",
    "home decor","interior design","diy","gardening tips",
    # Education (routine)
    "exam schedule","admit card","result declared","university admission","scholarship",
    "board exam","jee mains","neet exam","entrance test","school holiday",
    "academic calendar","semester","graduation ceremony",
    # Tech reviews (consumer)
    "smartphone review","gadget review","iphone launched","samsung galaxy","laptop review",
    "app update","software update","gaming news","esports",
    # Tourism / lifestyle travel
    "travel tips","holiday package","tourist spot","visa fee","hotel booking",
    "tourism festival","hill station","beach resort","pilgrimage","staycation",
    # Local court/police (routine, non-security)
    "traffic violation","traffic fine","parking ticket","minor accident",
    "shoplifting","small claims court","civil case","labour dispute",
    "child custody","divorce","property dispute","land dispute",
    # Business routine
    "quarterly earnings","revenue report","ipo launch","stock listing",
    "company merger","product launch","brand ambassador","advertising campaign",
}

# Keywords that GUARANTEE inclusion regardless of source
SECURITY_MUST_INCLUDE: set = {
    "attack","explosion","bomb","blast","shooting","killed","dead","casualties",
    "protest","riot","unrest","coup","conflict","war","military","airstrike","shelling",
    "terrorism","terrorist","militant","insurgent","rebel","extremist","jihadist",
    "earthquake","flood","hurricane","cyclone","tsunami","disaster","emergency",
    "arrest","detained","hostage","kidnap","abduct",
    "sanction","diplomat","summit","nuclear","missile","drone","weapons",
    "crisis","threat","warning","curfew","siege","massacre","genocide",
    "refugee","displaced","famine","outbreak","epidemic","pandemic","quarantine",
    "assassination","murder","execution","genocide","ethnic cleansing",
    "houthi","hamas","hezbollah","taliban","isis","al-qaeda","boko haram",
    "frontline","offensive","ceasefire","occupation","liberation","annexation",
}

def score_article_relevance(title: str, summary: str) -> int:
    """
    Score an article's intelligence relevance.
    Returns:
       2 = must include (clear security/intel event)
       1 = include (geopolitically relevant)
       0 = borderline (include with caution)
      -1 = skip (local noise / fluff)
    """
    text = (title + " " + summary).lower()

    # Hard reject: clearly noise
    noise_hits = sum(1 for kw in NOISE_KEYWORDS if kw in text)
    if noise_hits >= 2:
        return -1

    # Hard include: clear security/intel signal
    if any(kw in text for kw in SECURITY_MUST_INCLUDE):
        return 2

    # Reject single-noise-word articles that have no redeeming value
    if noise_hits == 1 and len(title) < 60:
        return -1

    # Include if it mentions countries or regions in a news context
    geo_terms = ["minister","government","president","parliament","military","police",
                 "opposition","election","border","troops","forces","civilians",
                 "victims","emergency","crisis","incident","official","spokesman"]
    if any(term in text for term in geo_terms):
        return 1

    return 0  # borderline — include anyway (better to over-include)


def extract_full_text(url: str, fallback_summary: str) -> str:
    """Use trafilatura to extract full article text — best-in-class extractor."""
    if not url or not url.startswith("http"):
        return fallback_summary
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=False,
                no_fallback=False,
                favor_precision=True,
            )
            if text and len(text) > 100:
                # Return first 800 chars of full text
                return text[:800].strip()
    except Exception:
        pass
    return fallback_summary


def is_english(text: str) -> bool:
    """Check if text is in English."""
    try:
        return detect(text[:200]) == 'en'
    except LangDetectException:
        return True  # default to include if detection fails

# ─── COMPREHENSIVE CITY DATABASE (Hyperlocal Geocoding) ─────────────────────
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    # MIDDLE EAST & NORTH AFRICA
    "Gaza City": (31.5017, 34.4674), "Gaza": (31.5017, 34.4674), "Khan Younis": (31.3462, 34.3060),
    "Rafah": (31.2961, 34.2536), "Ramallah": (31.9038, 35.2034), "Nablus": (32.2211, 35.2544),
    "Hebron": (31.5326, 35.0998), "Jenin": (32.4617, 35.2961), "West Bank": (31.9500, 35.3000),
    "Tel Aviv": (32.0853, 34.7818), "Jerusalem": (31.7683, 35.2137), "Haifa": (32.7940, 34.9896),
    "Beirut": (33.8938, 35.5018), "Tripoli": (34.4367, 35.8497), "Sidon": (33.5608, 35.3708),
    "Tyre": (33.2705, 35.1975), "Baalbek": (34.0047, 36.2076), "South Lebanon": (33.2700, 35.3700),
    "Damascus": (33.5138, 36.2765), "Aleppo": (36.2021, 37.1343), "Homs": (34.7324, 36.7137),
    "Idlib": (35.9306, 36.6340), "Deir ez-Zor": (35.3360, 40.1406), "Latakia": (35.5317, 35.7919),
    "Raqqa": (35.9500, 38.9969), "Daraa": (32.6189, 36.1021), "Kobane": (36.8921, 38.3564),
    "Mosul": (36.3566, 43.1580), "Baghdad": (33.3152, 44.3661), "Basra": (30.5085, 47.7804),
    "Erbil": (36.1912, 44.0092), "Kirkuk": (35.4681, 44.3922), "Fallujah": (33.3500, 43.7833),
    "Ramadi": (33.4213, 43.2896), "Tikrit": (34.5983, 43.6882), "Najaf": (31.9960, 44.3340),
    "Karbala": (32.6163, 44.0247), "Sulaymaniyah": (35.5573, 45.4348),
    "Tehran": (35.6892, 51.3890), "Isfahan": (32.6546, 51.6680), "Shiraz": (29.5918, 52.5836),
    "Mashhad": (36.2605, 59.6168), "Tabriz": (38.0962, 46.2738), "Ahvaz": (31.3183, 48.6706),
    "Sanaa": (15.3694, 44.1910), "Aden": (12.7855, 45.0187), "Hodeidah": (14.7980, 42.9511),
    "Taiz": (13.5776, 44.0177), "Marib": (15.4667, 45.3333), "Mukalla": (14.5425, 49.1244),
    "Riyadh": (24.6877, 46.7219), "Jeddah": (21.5433, 39.1728), "Mecca": (21.3891, 39.8579),
    "Medina": (24.5247, 39.5692), "Dammam": (26.4207, 50.0888),
    "Dubai": (25.2048, 55.2708), "Abu Dhabi": (24.4539, 54.3773),
    "Amman": (31.9539, 35.9106), "Zarqa": (32.0729, 36.0879), "Irbid": (32.5556, 35.8500),
    "Kuwait City": (29.3759, 47.9774), "Manama": (26.2285, 50.5860),
    "Doha": (25.2854, 51.5310), "Muscat": (23.6100, 58.5900),
    "Ankara": (39.9334, 32.8597), "Istanbul": (41.0082, 28.9784), "Izmir": (38.4237, 27.1428),
    "Diyarbakir": (37.9144, 40.2306), "Gaziantep": (37.0662, 37.3833), "Adana": (37.0000, 35.3213),
    "Cairo": (30.0444, 31.2357), "Alexandria": (31.2001, 29.9187), "Suez": (29.9737, 32.5311),
    "Port Said": (31.2565, 32.2841), "Luxor": (25.6872, 32.6396),
    "Tripoli Libya": (32.9025, 13.1805), "Benghazi": (32.1166, 20.0691), "Misrata": (32.3754, 15.0925),
    "Tunis": (36.8190, 10.1658), "Sfax": (34.7400, 10.7600), "Sousse": (35.8253, 10.6360),
    "Algiers": (36.7372, 3.0865), "Oran": (35.6971, 0.6308), "Constantine": (36.3650, 6.6147),
    "Casablanca": (33.5731, -7.5898), "Rabat": (34.0209, -6.8416), "Marrakech": (31.6295, -7.9811),
    "Fes": (34.0181, -5.0078),
    # SOUTH ASIA
    "Kabul": (34.5553, 69.2075), "Kandahar": (31.6110, 65.6986), "Herat": (34.3529, 62.2040),
    "Jalalabad": (34.4415, 70.4360), "Mazar-i-Sharif": (36.7058, 67.1135),
    "Islamabad": (33.7294, 73.0931), "Karachi": (24.8607, 67.0104), "Lahore": (31.5204, 74.3587),
    "Peshawar": (34.0151, 71.5249), "Quetta": (30.1798, 66.9750), "Rawalpindi": (33.5971, 73.0429),
    "Faisalabad": (31.4504, 73.1350), "Hyderabad Pakistan": (25.3960, 68.3578),
    "New Delhi": (28.6139, 77.2090), "Delhi": (28.6139, 77.2090), "Mumbai": (19.0760, 72.8777),
    "Kolkata": (22.5726, 88.3639), "Chennai": (13.0827, 80.2707), "Bengaluru": (12.9716, 77.5946),
    "Hyderabad": (17.3850, 78.4867), "Ahmedabad": (23.0225, 72.5714), "Pune": (18.5204, 73.8567),
    "Surat": (21.1702, 72.8311), "Jaipur": (26.9124, 75.7873), "Lucknow": (26.8467, 80.9462),
    "Dhaka": (23.8103, 90.4125), "Chittagong": (22.3569, 91.7832), "Sylhet": (24.8949, 91.8687),
    "Colombo": (6.9271, 79.8612), "Kandy": (7.2906, 80.6337), "Jaffna": (9.6615, 80.0255),
    "Kathmandu": (27.7172, 85.3240), "Pokhara": (28.2096, 83.9856),
    # EAST & SOUTHEAST ASIA
    "Beijing": (39.9042, 116.4074), "Shanghai": (31.2304, 121.4737), "Guangzhou": (23.1291, 113.2644),
    "Shenzhen": (22.5431, 114.0579), "Hong Kong": (22.3193, 114.1694), "Macau": (22.1987, 113.5439),
    "Chongqing": (29.5630, 106.5516), "Wuhan": (30.5928, 114.3055), "Xi'an": (34.3416, 108.9398),
    "Urumqi": (43.8256, 87.6168), "Lhasa": (29.6520, 91.1721), "Chengdu": (30.5723, 104.0665),
    "Nanjing": (32.0603, 118.7969),
    "Taipei": (25.0330, 121.5654), "Kaohsiung": (22.6273, 120.3014), "Taichung": (24.1477, 120.6736),
    "Seoul": (37.5665, 126.9780), "Busan": (35.1796, 129.0756), "Incheon": (37.4563, 126.7052),
    "Pyongyang": (39.0392, 125.7625), "Wonsan": (39.1543, 127.4387), "Kaesong": (37.9703, 126.5570),
    "Tokyo": (35.6762, 139.6503), "Osaka": (34.6937, 135.5023), "Kyoto": (35.0116, 135.7681),
    "Hiroshima": (34.3853, 132.4553), "Nagasaki": (32.7503, 129.8779), "Fukuoka": (33.5904, 130.4017),
    "Ulaanbaatar": (47.8864, 106.9057),
    "Bangkok": (13.7563, 100.5018), "Chiang Mai": (18.7883, 98.9853), "Pattaya": (12.9236, 100.8825),
    "Manila": (14.5995, 120.9842), "Cebu City": (10.3157, 123.8854), "Davao": (7.1907, 125.4553),
    "Jakarta": (6.2088, 106.8456), "Surabaya": (-7.2575, 112.7521), "Medan": (3.5952, 98.6722),
    "Banda Aceh": (5.5483, 95.3238), "Makassar": (-5.1477, 119.4327),
    "Kuala Lumpur": (3.1390, 101.6869), "Penang": (5.4141, 100.3288), "Kota Kinabalu": (5.9804, 116.0735),
    "Singapore": (1.3521, 103.8198),
    "Yangon": (16.8661, 96.1951), "Mandalay": (21.9588, 96.0891), "Naypyidaw": (19.7633, 96.0785),
    "Hanoi": (21.0285, 105.8542), "Ho Chi Minh City": (10.8231, 106.6297), "Da Nang": (16.0544, 108.2022),
    "Phnom Penh": (11.5564, 104.9282), "Vientiane": (17.9757, 102.6331),
    "Dili": (-8.5569, 125.5789), "Bandar Seri Begawan": (4.9031, 114.9398),
    # CENTRAL ASIA
    "Tashkent": (41.2995, 69.2401), "Samarkand": (39.6270, 66.9749), "Namangan": (40.9983, 71.6726),
    "Almaty": (43.2220, 76.8512), "Nur-Sultan": (51.1801, 71.4460), "Astana": (51.1801, 71.4460),
    "Bishkek": (42.8746, 74.5698), "Osh": (40.5283, 72.7978),
    "Dushanbe": (38.5598, 68.7738), "Ashgabat": (37.9601, 58.3261),
    "Baku": (40.4093, 49.8671), "Ganja": (40.6828, 46.3606), "Nagorno-Karabakh": (39.9000, 46.7500),
    # CAUCASUS
    "Tbilisi": (41.6938, 44.8015), "Batumi": (41.6484, 41.6407), "Kutaisi": (42.2679, 42.6946),
    "Yerevan": (40.1872, 44.5152),
    # EASTERN EUROPE & RUSSIA
    "Moscow": (55.7558, 37.6176), "Saint Petersburg": (59.9311, 30.3609), "Novosibirsk": (54.9885, 82.9207),
    "Kaliningrad": (54.7104, 20.4522), "Murmansk": (68.9792, 33.0925), "Vladivostok": (43.1056, 131.8735),
    "Kyiv": (50.4501, 30.5234), "Kharkiv": (49.9935, 36.2304), "Mariupol": (47.0971, 37.5420),
    "Zaporizhzhia": (47.8388, 35.1396), "Odessa": (46.4825, 30.7233), "Lviv": (49.8397, 24.0297),
    "Dnipro": (48.4647, 35.0462), "Donetsk": (48.0159, 37.8028), "Luhansk": (48.5740, 39.3070),
    "Crimea": (45.0000, 34.0000), "Sevastopol": (44.6167, 33.5253), "Kherson": (46.6354, 32.6169),
    "Bakhmut": (48.5969, 38.0000), "Avdiivka": (48.1378, 37.7556), "Sumy": (50.9077, 34.7981),
    "Mykolaiv": (46.9750, 31.9946),
    "Warsaw": (52.2297, 21.0122), "Krakow": (50.0647, 19.9450), "Gdansk": (54.3520, 18.6466),
    "Prague": (50.0755, 14.4378), "Brno": (49.1951, 16.6068),
    "Budapest": (47.4979, 19.0402), "Debrecen": (47.5316, 21.6273),
    "Bucharest": (44.4268, 26.1025), "Cluj-Napoca": (46.7712, 23.6236),
    "Belgrade": (44.8176, 20.4569), "Novi Sad": (45.2671, 19.8335),
    "Sofia": (42.6977, 23.3219), "Plovdiv": (42.1354, 24.7453),
    "Zagreb": (45.8150, 15.9819), "Split": (43.5081, 16.4402),
    "Sarajevo": (43.8563, 18.4131), "Mostar": (43.3438, 17.8078), "Banja Luka": (44.7722, 17.1910),
    "Pristina": (42.6629, 21.1655), "Podgorica": (42.4304, 19.2594),
    "Tirana": (41.3275, 19.8187), "Skopje": (41.9973, 21.4280),
    "Minsk": (53.9045, 27.5615), "Grodno": (53.6884, 23.8258),
    "Riga": (56.9460, 24.1059), "Tallinn": (59.4370, 24.7536), "Vilnius": (54.6872, 25.2797),
    "Chisinau": (47.0105, 28.8638),
    # WESTERN EUROPE
    "London": (51.5074, -0.1278), "Birmingham": (52.4862, -1.8904), "Manchester": (53.4808, -2.2426),
    "Glasgow": (55.8642, -4.2518), "Leeds": (53.8008, -1.5491), "Liverpool": (53.4084, -2.9916),
    "Belfast": (54.5973, -5.9301), "Dublin": (53.3498, -6.2603), "Edinburgh": (55.9533, -3.1883),
    "Paris": (48.8566, 2.3522), "Lyon": (45.7640, 4.8357), "Marseille": (43.2965, 5.3698),
    "Strasbourg": (48.5734, 7.7521), "Toulouse": (43.6047, 1.4442), "Nice": (43.7102, 7.2620),
    "Berlin": (52.5200, 13.4050), "Munich": (48.1351, 11.5820), "Hamburg": (53.5753, 10.0153),
    "Frankfurt": (50.1109, 8.6821), "Cologne": (50.9333, 6.9500), "Stuttgart": (48.7758, 9.1829),
    "Dresden": (51.0504, 13.7373), "Leipzig": (51.3397, 12.3731),
    "Madrid": (40.4168, -3.7038), "Barcelona": (41.3851, 2.1734), "Valencia": (39.4699, -0.3763),
    "Seville": (37.3891, -5.9845), "Bilbao": (43.2627, -2.9253),
    "Rome": (41.9028, 12.4964), "Milan": (45.4654, 9.1859), "Naples": (40.8518, 14.2681),
    "Turin": (45.0703, 7.6869), "Venice": (45.4408, 12.3155), "Palermo": (38.1157, 13.3615),
    "Amsterdam": (52.3676, 4.9041), "Rotterdam": (51.9244, 4.4777), "The Hague": (52.0705, 4.3007),
    "Brussels": (50.8503, 4.3517), "Antwerp": (51.2194, 4.4025), "Ghent": (51.0543, 3.7174),
    "Zurich": (47.3769, 8.5417), "Geneva": (46.2044, 6.1432), "Bern": (46.9480, 7.4474),
    "Vienna": (48.2082, 16.3738), "Graz": (47.0707, 15.4395), "Innsbruck": (47.2692, 11.4041),
    "Stockholm": (59.3293, 18.0686), "Gothenburg": (57.7089, 11.9746), "Malmö": (55.6050, 13.0038),
    "Oslo": (59.9139, 10.7522), "Bergen": (60.3913, 5.3221), "Trondheim": (63.4305, 10.3951),
    "Copenhagen": (55.6761, 12.5683), "Aarhus": (56.1629, 10.2039),
    "Helsinki": (60.1699, 24.9384), "Tampere": (61.4978, 23.7610),
    "Athens": (37.9838, 23.7275), "Thessaloniki": (40.6401, 22.9444),
    "Lisbon": (38.7223, -9.1393), "Porto": (41.1579, -8.6291),
    "Nicosia": (35.1856, 33.3823),
    # SUB-SAHARAN AFRICA
    "Lagos": (6.5244, 3.3792), "Abuja": (9.0765, 7.3986), "Kano": (12.0022, 8.5920),
    "Ibadan": (7.3776, 3.9470), "Port Harcourt": (4.8156, 7.0498), "Maiduguri": (11.8464, 13.1572),
    "Borno": (11.8333, 13.1667), "Sokoto": (13.0606, 5.2339), "Kaduna": (10.5167, 7.4500),
    "Nairobi": (1.2921, 36.8219), "Mombasa": (-4.0435, 39.6682), "Kisumu": (-0.1022, 34.7617),
    "Kampala": (0.3163, 32.5822), "Gulu": (2.7747, 32.2996),
    "Dar es Salaam": (-6.7924, 39.2083), "Dodoma": (-6.1722, 35.7395), "Zanzibar": (-6.1659, 39.1989),
    "Addis Ababa": (9.0320, 38.7423), "Dire Dawa": (9.5931, 41.8661), "Tigray": (13.9333, 38.4500),
    "Mekelle": (13.4967, 39.4770),
    "Khartoum": (15.5007, 32.5599), "Omdurman": (15.6453, 32.4799), "Port Sudan": (19.6158, 37.2164),
    "Juba": (4.8594, 31.5713), "Malakal": (9.5335, 31.6606), "Wau": (7.7009, 27.9998),
    "Mogadishu": (2.0469, 45.3182), "Kismaayo": (-0.3579, 42.5454), "Hargeisa": (9.5603, 44.0659),
    "Djibouti City": (11.8251, 42.5903),
    "Asmara": (15.3389, 38.9319),
    "Kinshasa": (-4.4419, 15.2663), "Lubumbashi": (-11.6609, 27.4794), "Goma": (-1.6796, 29.2285),
    "Bukavu": (-2.5083, 28.8608), "Bunia": (1.5643, 30.2488), "Beni": (0.4894, 29.4736),
    "Bangui": (4.3947, 18.5582),
    "N'Djamena": (12.1048, 15.0445), "Moundou": (8.5661, 16.0817),
    "Niamey": (13.5137, 2.1098), "Agadez": (16.9742, 7.9895),
    "Ouagadougou": (12.3714, -1.5197), "Bobo-Dioulasso": (11.1771, -4.2979),
    "Bamako": (12.6392, -8.0029), "Gao": (16.2667, -0.0500), "Timbuktu": (16.7735, -3.0074),
    "Dakar": (14.7167, -17.4677), "Ziguinchor": (12.5833, -16.2719),
    "Conakry": (9.5370, -13.6773), "Freetown": (8.4840, -13.2344),
    "Monrovia": (6.3005, -10.7969), "Abidjan": (5.3600, -4.0083), "Yamoussoukro": (6.8276, -5.2893),
    "Accra": (5.6037, -0.1870), "Kumasi": (6.6885, -1.6244),
    "Lome": (6.1375, 1.2123), "Cotonou": (6.3654, 2.4183), "Porto-Novo": (6.4969, 2.6289),
    "Yaounde": (3.8667, 11.5167), "Douala": (4.0483, 9.7043),
    "Libreville": (0.3901, 9.4544), "Brazzaville": (-4.2634, 15.2429),
    "Luanda": (-8.8368, 13.2344), "Huambo": (-12.7667, 15.7333),
    "Maputo": (-25.9692, 32.5732), "Beira": (-19.8436, 34.8389),
    "Harare": (-17.8252, 31.0335), "Bulawayo": (-20.1325, 28.6264),
    "Lusaka": (-15.4167, 28.2833), "Ndola": (-12.9587, 28.6366),
    "Lilongwe": (-13.9833, 33.7833), "Blantyre": (-15.7861, 35.0058),
    "Johannesburg": (-26.2041, 28.0473), "Cape Town": (-33.9249, 18.4241),
    "Durban": (-29.8587, 31.0218), "Pretoria": (-25.7461, 28.1881),
    "Antananarivo": (-18.9137, 47.5361),
    "Windhoek": (-22.5597, 17.0832), "Gaborone": (-24.6282, 25.9231),
    "Mbabane": (-26.3054, 31.1367), "Maseru": (-29.3167, 27.4833),
    # AMERICAS
    "Washington DC": (38.9072, -77.0369), "New York": (40.7128, -74.0060),
    "Los Angeles": (34.0522, -118.2437), "Chicago": (41.8781, -87.6298),
    "Houston": (29.7604, -95.3698), "Miami": (25.7617, -80.1918),
    "San Francisco": (37.7749, -122.4194), "Seattle": (47.6062, -122.3321),
    "Boston": (42.3601, -71.0589), "Atlanta": (33.7490, -84.3880),
    "Mexico City": (19.4326, -99.1332), "Guadalajara": (20.6597, -103.3496),
    "Monterrey": (25.6866, -100.3161), "Tijuana": (32.5149, -117.0382),
    "Bogota": (4.7110, -74.0721), "Medellin": (6.2442, -75.5812), "Cali": (3.4516, -76.5320),
    "Cartagena": (10.3910, -75.4794),
    "Caracas": (10.4806, -66.9036), "Maracaibo": (10.6317, -71.6411),
    "Lima": (-12.0464, -77.0428), "Arequipa": (-16.4090, -71.5375), "Cusco": (-13.5319, -71.9675),
    "La Paz": (-16.5000, -68.1500), "Santa Cruz Bolivia": (-17.7863, -63.1812),
    "Quito": (-0.1807, -78.4678), "Guayaquil": (-2.1710, -79.9224),
    "Santiago": (-33.4489, -70.6693), "Valparaiso": (-33.0472, -71.6127),
    "Buenos Aires": (-34.6037, -58.3816), "Cordoba Argentina": (-31.4201, -64.1888),
    "Rosario": (-32.9442, -60.6505), "Mendoza": (-32.8908, -68.8272),
    "Asuncion": (-25.2867, -57.6470), "Montevideo": (-34.9011, -56.1645),
    "Brasilia": (-15.7801, -47.9292), "Sao Paulo": (-23.5505, -46.6333),
    "Rio de Janeiro": (-22.9068, -43.1729), "Belo Horizonte": (-19.9167, -43.9345),
    "Salvador Brazil": (-12.9777, -38.5016), "Fortaleza": (-3.7172, -38.5434),
    "Manaus": (-3.1190, -60.0217),
    "Havana": (23.1136, -82.3666), "Caracas": (10.4806, -66.9036),
    "Port-au-Prince": (18.5944, -72.3074), "Cap-Haitien": (19.7577, -72.2036),
    "Guatemala City": (14.6349, -90.5069), "San Salvador": (13.6929, -89.2182),
    "Tegucigalpa": (14.0723, -87.2020), "Managua": (12.1364, -86.2514),
    "San Jose Costa Rica": (9.9281, -84.0907), "Panama City": (8.9936, -79.5197),
    "Kingston Jamaica": (17.9970, -76.7936), "Port of Spain": (10.6596, -61.4789),
    # PACIFIC & OCEANIA
    "Sydney": (-33.8688, 151.2093), "Melbourne": (-37.8136, 144.9631),
    "Brisbane": (-27.4698, 153.0251), "Perth": (-31.9505, 115.8605),
    "Adelaide": (-34.9285, 138.6007), "Canberra": (-35.2809, 149.1300),
    "Auckland": (-36.8485, 174.7633), "Wellington": (-41.2866, 174.7756),
    "Suva": (-18.1416, 178.4415), "Port Moresby": (-9.4438, 147.1803),
    # NATIONAL CAPITALS (catch-all)
    "Kabul": (34.5553, 69.2075), "Tirana": (41.3275, 19.8187),
    "Andorra la Vella": (42.5063, 1.5218), "Luanda": (-8.8368, 13.2344),
    "Nassau": (25.0480, -77.3558), "Manama": (26.2285, 50.5860),
    "Dhaka": (23.8103, 90.4125), "Thimphu": (27.4712, 89.6339),
    "Sarajevo": (43.8563, 18.4131), "Gaborone": (-24.6282, 25.9231),
    "Ouagadougou": (12.3714, -1.5197), "Bujumbura": (-3.3812, 29.3609),
    "Phnom Penh": (11.5564, 104.9282), "Yaounde": (3.8667, 11.5167),
    "Ottawa": (45.4215, -75.6919), "Toronto": (43.6532, -79.3832), "Vancouver": (49.2827, -123.1207),
    "Praia": (14.9315, -23.5136), "Bangui": (4.3947, 18.5582),
    "N'Djamena": (12.1048, 15.0445), "Moroni": (-11.7022, 43.2551),
    "Brazzaville": (-4.2634, 15.2429), "Kinshasa": (-4.4419, 15.2663),
    "San Jose": (9.9281, -84.0907),
    "Zagreb": (45.8150, 15.9819), "Havana": (23.1136, -82.3666),
    "Nicosia": (35.1856, 33.3823), "Prague": (50.0755, 14.4378),
    "Djibouti": (11.8251, 42.5903), "Roseau": (15.3017, -61.3881),
    "Santo Domingo": (18.4861, -69.9312), "Quito": (-0.1807, -78.4678),
    "Cairo": (30.0444, 31.2357), "San Salvador": (13.6929, -89.2182),
    "Malabo": (3.7523, 8.7741), "Asmara": (15.3389, 38.9319),
    "Tallinn": (59.4370, 24.7536), "Addis Ababa": (9.0320, 38.7423),
    "Suva": (-18.1416, 178.4415), "Helsinki": (60.1699, 24.9384),
    "Libreville": (0.3901, 9.4544), "Banjul": (13.4549, -16.5790),
    "Tbilisi": (41.6938, 44.8015), "Berlin": (52.5200, 13.4050),
    "Accra": (5.6037, -0.1870), "Guatemala City": (14.6349, -90.5069),
    "Conakry": (9.5370, -13.6773), "Bissau": (11.8636, -15.5977),
    "Georgetown": (6.8013, -58.1551), "Port-au-Prince": (18.5944, -72.3074),
    "Tegucigalpa": (14.0723, -87.2020), "Budapest": (47.4979, 19.0402),
    "Reykjavik": (64.1466, -21.9426), "New Delhi": (28.6139, 77.2090),
    "Jakarta": (-6.2088, 106.8456), "Tehran": (35.6892, 51.3890),
    "Baghdad": (33.3152, 44.3661), "Dublin": (53.3498, -6.2603),
    "Jerusalem": (31.7683, 35.2137), "Rome": (41.9028, 12.4964),
    "Kingston": (17.9970, -76.7936), "Tokyo": (35.6762, 139.6503),
    "Amman": (31.9539, 35.9106), "Nur-Sultan": (51.1801, 71.4460),
    "Nairobi": (-1.2921, 36.8219), "Tarawa": (1.3382, 172.9790),
    "Seoul": (37.5665, 126.9780), "Pristina": (42.6629, 21.1655),
    "Kuwait City": (29.3759, 47.9774), "Bishkek": (42.8746, 74.5698),
    "Vientiane": (17.9757, 102.6331), "Riga": (56.9460, 24.1059),
    "Beirut": (33.8938, 35.5018), "Maseru": (-29.3167, 27.4833),
    "Monrovia": (6.3005, -10.7969), "Tripoli": (32.9025, 13.1805),
    "Vaduz": (47.1415, 9.5215), "Vilnius": (54.6872, 25.2797),
    "Luxembourg": (49.6117, 6.1319), "Skopje": (41.9973, 21.4280),
    "Antananarivo": (-18.9137, 47.5361), "Lilongwe": (-13.9833, 33.7833),
    "Kuala Lumpur": (3.1390, 101.6869), "Male": (4.1755, 73.5093),
    "Bamako": (12.6392, -8.0029), "Valletta": (35.8997, 14.5146),
    "Majuro": (7.0897, 171.3802), "Nouakchott": (18.0858, -15.9785),
    "Port Louis": (-20.1609, 57.4989), "Palikir": (6.9248, 158.1610),
    "Chisinau": (47.0105, 28.8638), "Ulaanbaatar": (47.8864, 106.9057),
    "Podgorica": (42.4304, 19.2594), "Rabat": (34.0209, -6.8416),
    "Maputo": (-25.9692, 32.5732), "Windhoek": (-22.5597, 17.0832),
    "Yaren": (-0.5477, 166.9209), "Kathmandu": (27.7172, 85.3240),
    "Amsterdam": (52.3676, 4.9041), "Wellington": (-41.2866, 174.7756),
    "Managua": (12.1364, -86.2514), "Niamey": (13.5137, 2.1098),
    "Abuja": (9.0765, 7.3986), "Oslo": (59.9139, 10.7522),
    "Muscat": (23.6100, 58.5900), "Islamabad": (33.7294, 73.0931),
    "Ngerulmud": (7.5006, 134.6242), "Panama City": (8.9936, -79.5197),
    "Port Moresby": (-9.4438, 147.1803), "Asuncion": (-25.2867, -57.6470),
    "Lima": (-12.0464, -77.0428), "Manila": (14.5995, 120.9842),
    "Warsaw": (52.2297, 21.0122), "Lisbon": (38.7223, -9.1393),
    "San Juan": (18.4655, -66.1057), "Doha": (25.2854, 51.5310),
    "Bucharest": (44.4268, 26.1025), "Moscow": (55.7558, 37.6176),
    "Kigali": (-1.9441, 30.0619), "Basseterre": (17.3026, -62.7177),
    "Castries": (14.0101, -60.9875), "Kingstown": (13.1600, -61.2248),
    "Apia": (-13.8506, -171.7513), "Sao Tome": (0.3365, 6.7273),
    "Riyadh": (24.6877, 46.7219), "Dakar": (14.7167, -17.4677),
    "Belgrade": (44.8176, 20.4569), "Freetown": (8.4840, -13.2344),
    "Singapore": (1.3521, 103.8198), "Bratislava": (48.1486, 17.1077),
    "Ljubljana": (46.0569, 14.5058), "Honiara": (-9.4333, 160.0333),
    "Mogadishu": (2.0469, 45.3182), "Pretoria": (-25.7461, 28.1881),
    "Madrid": (40.4168, -3.7038), "Colombo": (6.9271, 79.8612),
    "Khartoum": (15.5007, 32.5599), "Paramaribo": (5.8664, -55.1668),
    "Mbabane": (-26.3054, 31.1367), "Stockholm": (59.3293, 18.0686),
    "Bern": (46.9480, 7.4474), "Damascus": (33.5138, 36.2765),
    "Taipei": (25.0330, 121.5654), "Dushanbe": (38.5598, 68.7738),
    "Dodoma": (-6.1722, 35.7395), "Bangkok": (13.7563, 100.5018),
    "Dili": (-8.5569, 125.5789), "Lome": (6.1375, 1.2123),
    "Nuku'alofa": (-21.1789, -175.1982), "Port of Spain": (10.6596, -61.4789),
    "Tunis": (36.8190, 10.1658), "Ankara": (39.9334, 32.8597),
    "Ashgabat": (37.9601, 58.3261), "Funafuti": (-8.5211, 179.1983),
    "Kampala": (0.3163, 32.5822), "Kyiv": (50.4501, 30.5234),
    "Abu Dhabi": (24.4539, 54.3773), "London": (51.5074, -0.1278),
    "Washington": (38.9072, -77.0369), "Tashkent": (41.2995, 69.2401),
    "Port Vila": (-17.7334, 168.3210), "Vatican City": (41.9029, 12.4534),
    "Caracas": (10.4806, -66.9036), "Hanoi": (21.0285, 105.8542),
    "Sana'a": (15.3694, 44.1910), "Lusaka": (-15.4167, 28.2833),
    "Harare": (-17.8252, 31.0335),
}

# Country-level fallback
COUNTRY_COORDS: Dict[str, Tuple[float, float]] = {
    "Afghanistan": (33.93, 67.71), "Albania": (41.15, 20.17), "Algeria": (28.03, 1.66),
    "Angola": (-11.20, 17.87), "Argentina": (-38.42, -63.62), "Armenia": (40.07, 45.04),
    "Australia": (-25.27, 133.78), "Austria": (47.52, 14.55), "Azerbaijan": (40.14, 47.58),
    "Bahrain": (26.04, 50.53), "Bangladesh": (23.68, 90.35), "Belarus": (53.71, 27.95),
    "Belgium": (50.50, 4.47), "Bolivia": (-16.29, -63.59), "Bosnia": (43.92, 17.68),
    "Brazil": (-14.24, -51.93), "Bulgaria": (42.73, 25.49), "Burkina Faso": (12.36, -1.53),
    "Cambodia": (12.57, 104.99), "Cameroon": (3.85, 11.52), "Canada": (56.13, -106.35),
    "Central African Republic": (6.61, 20.94), "Chad": (15.45, 18.73), "Chile": (-35.68, -71.54),
    "China": (35.86, 104.20), "Colombia": (4.57, -74.30), "Congo": (-0.23, 15.83),
    "Democratic Republic of Congo": (-4.04, 21.76), "Croatia": (45.10, 15.20), "Cuba": (21.52, -79.37),
    "Cyprus": (35.13, 33.43), "Czech Republic": (49.82, 15.47), "Denmark": (56.26, 9.50),
    "Ecuador": (-1.83, -78.18), "Egypt": (26.82, 30.80), "El Salvador": (13.79, -88.90),
    "Eritrea": (15.18, 39.78), "Estonia": (58.60, 25.01), "Ethiopia": (9.15, 40.49),
    "Finland": (61.92, 25.75), "France": (46.23, 2.21), "Gabon": (-0.80, 11.61),
    "Georgia": (41.69, 44.03), "Germany": (51.17, 10.45), "Ghana": (7.95, -1.02),
    "Greece": (39.07, 21.82), "Guatemala": (15.78, -90.23), "Guinea": (9.95, -11.24),
    "Haiti": (18.97, -72.29), "Honduras": (15.20, -86.24), "Hungary": (47.16, 19.50),
    "India": (20.59, 78.96), "Indonesia": (-0.79, 113.92), "Iran": (32.43, 53.69),
    "Iraq": (33.22, 43.68), "Ireland": (53.41, -8.24), "Israel": (31.05, 34.85),
    "Italy": (41.87, 12.57), "Japan": (36.20, 138.25), "Jordan": (30.59, 36.24),
    "Kazakhstan": (48.02, 66.92), "Kenya": (-0.02, 37.91), "Kosovo": (42.60, 20.90),
    "Kuwait": (29.31, 47.48), "Kyrgyzstan": (41.20, 74.77), "Laos": (19.86, 102.50),
    "Latvia": (56.88, 24.60), "Lebanon": (33.85, 35.86), "Libya": (26.34, 17.23),
    "Lithuania": (55.17, 23.88), "Malaysia": (4.21, 101.98), "Mali": (17.57, -4.00),
    "Mexico": (23.63, -102.55), "Moldova": (47.41, 28.37), "Mongolia": (46.86, 103.85),
    "Morocco": (31.79, -7.09), "Mozambique": (-18.67, 35.53), "Myanmar": (21.92, 95.96),
    "Nepal": (28.39, 84.12), "Netherlands": (52.13, 5.29), "New Zealand": (-40.90, 174.89),
    "Nicaragua": (12.87, -85.21), "Niger": (17.61, 8.08), "Nigeria": (9.08, 8.68),
    "North Korea": (40.34, 127.51), "Norway": (60.47, 8.47), "Oman": (21.51, 55.92),
    "Pakistan": (30.38, 69.35), "Palestine": (31.95, 35.23), "Panama": (8.54, -80.78),
    "Peru": (-9.19, -75.02), "Philippines": (12.88, 121.77), "Poland": (51.92, 19.15),
    "Portugal": (39.40, -8.22), "Qatar": (25.35, 51.18), "Romania": (45.94, 24.97),
    "Russia": (61.52, 105.32), "Rwanda": (-1.94, 29.87), "Saudi Arabia": (23.89, 45.08),
    "Serbia": (44.02, 21.01), "Somalia": (5.15, 46.20), "South Africa": (-30.56, 22.94),
    "South Korea": (35.91, 127.77), "South Sudan": (7.87, 29.87), "Spain": (40.46, -3.75),
    "Sri Lanka": (7.87, 80.77), "Sudan": (12.86, 30.22), "Sweden": (60.13, 18.64),
    "Switzerland": (46.82, 8.23), "Syria": (34.80, 38.10), "Taiwan": (23.70, 121.00),
    "Tajikistan": (38.86, 71.28), "Tanzania": (-6.37, 34.89), "Thailand": (15.87, 100.99),
    "Tunisia": (33.89, 9.54), "Turkey": (38.96, 35.24), "Uganda": (1.37, 32.29),
    "Ukraine": (48.38, 31.17), "United Arab Emirates": (23.42, 53.85), "UAE": (23.42, 53.85),
    "United Kingdom": (55.38, -3.44), "UK": (55.38, -3.44),
    "United States": (37.09, -95.71), "USA": (37.09, -95.71),
    "Uruguay": (-32.52, -55.77), "Uzbekistan": (41.38, 64.59), "Venezuela": (6.42, -66.59),
    "Vietnam": (14.06, 108.28), "Yemen": (15.55, 48.52), "Zambia": (-13.13, 27.85),
    "Zimbabwe": (-19.02, 29.15), "Global": (20.00, 0.00),
}

# ─── LAYER 1: UNIVERSAL RISK KEYWORDS ────────────────────────────────────────
LAYER1_QUERIES = [
    # 🚨 Security / Terror
    ("explosion blast bomb IED shooting attack terrorism hostage", "Security"),
    ("suicide bomber ambush militant armed group checkpoint attack", "Security"),
    # 🟠 Civil Unrest
    ("protest riot clash demonstration curfew unrest strike coup", "Unrest"),
    ("crackdown opposition arrested political prisoner", "Unrest"),
    # ⚫ Crime
    ("kidnapping robbery carjacking gang murder assault", "Crime"),
    ("drug cartel trafficking organized crime ransom", "Crime"),
    # 🔵 Disaster
    ("earthquake flood cyclone wildfire landslide storm tsunami", "Disaster"),
    ("eruption disaster emergency shelter evacuation", "Disaster"),
    # 🟡 Infrastructure
    ("airport closed flight cancelled power outage internet shutdown", "Infrastructure"),
    ("border closed road blocked fuel shortage", "Infrastructure"),
    # ☣️ WMD / CBRN
    ("nuclear biological chemical weapon WMD radiological", "WMD"),
    # 🌍 Humanitarian
    ("famine starvation displacement refugee crisis humanitarian", "Humanitarian"),
]

# ─── LAYER 2: COUNTRY-SPECIFIC KEYWORDS ──────────────────────────────────────
COUNTRY_KEYWORDS: dict = {
    # SOUTH ASIA ──────────────────────────────────────────────────────────────
    "India":        ["naxal","naxalite","bandh","hartal","curfew imposed","communal violence","ULFA","Maoist","AFSPA","insurgency northeast","blast Delhi","blast Mumbai"],
    "Pakistan":     ["TTP","tehrik","suicide bomber","sectarian","FATA","militant killed","IED blast","Rangers operation","FC attack","Balochistan attack","blasphemy violence"],
    "Afghanistan":  ["Taliban","IS-K","suicide bombing Kabul","checkpoint attack","IED Afghanistan","blast Kandahar","ISKP attack"],
    "Bangladesh":   ["hartal","hartaal","Jamaat","student protest","political violence","opposition arrested Bangladesh"],
    "Sri Lanka":    ["political crisis Lanka","protest Colombo","LTTE resurgence"],
    "Nepal":        ["Maoist Nepal","bandh Nepal","protest Kathmandu"],
    "Myanmar":      ["junta","coup Myanmar","SAC attack","PDF ambush","military airstrike","Kachin","Shan State","ARSA Rakhine","ethnic armed Myanmar"],
    # SOUTHEAST ASIA ──────────────────────────────────────────────────────────
    "Thailand":     ["coup Thailand","monarchy protest","yellow shirt","red shirt","southern insurgency Thailand","Pattani separatist","Narathiwat attack","Yala bomb"],
    "Philippines":  ["NPA","New People's Army","Abu Sayyaf","Bangsamoro","Moro","Mindanao attack","BIFF","MILF","Sulu attack"],
    "Indonesia":    ["JAD","Jemaah Islamiyah","Papua separatist","KKB Papua","OPM","Poso attack","Papua killing"],
    "Malaysia":     ["kidnapping Sabah","Abu Sayyaf Malaysia","militant Malaysia","Lahad Datu"],
    "Vietnam":      ["protest Vietnam","dissident Vietnam","land seizure"],
    "Cambodia":     ["opposition Cambodia","crackdown Cambodia","Hun Sen"],
    "Laos":         ["Hmong Laos","political prisoner Laos"],
    "Singapore":    ["terrorism Singapore","radicalised Singapore"],
    # MIDDLE EAST ─────────────────────────────────────────────────────────────
    "Israel":       ["rocket fire","iron dome","IDF operation","Hamas attack","Hezbollah rocket","settler violence","stabbing Jerusalem","intifada","Rafah operation","Gaza ground"],
    "Palestine":    ["IDF airstrike","settler attack","checkpoint","Rafah crossing","Khan Younis","West Bank raid","blockade Gaza"],
    "Lebanon":      ["Hezbollah","Israeli strike Lebanon","blast Beirut","political assassination Lebanon","Dahiyeh","Bekaa Valley"],
    "Syria":        ["Assad","HTS","SDF","airstrike Syria","barrel bomb","chemical Syria","Idlib attack","Deir ez-Zor"],
    "Iraq":         ["PMF","Hashd","IED Iraq","IRGC proxy","drone attack Iraq","rocket Taji","Baghdad Green Zone","Erbil attack"],
    "Iran":         ["IRGC","protest Iran","Mahsa Amini","nuclear enrichment","Revolutionary Guard","Basij crackdown","execution Iran"],
    "Yemen":        ["Houthi","Ansar Allah","Saudi airstrike Yemen","drone Yemen","Hodeidah port","Red Sea attack","ship seized"],
    "Saudi Arabia": ["drone attack Saudi","Aramco attack","Houthi missile Saudi","Abqaiq attack"],
    "Turkey":       ["PKK attack","YPG Turkey","Kurdish militant","Erdogan opposition","protest Istanbul","Ankara attack"],
    "Egypt":        ["Sinai attack","Muslim Brotherhood Egypt","jihadist Sinai","Hasm"],
    "Jordan":       ["attack Jordan","border Jordan Syria","Islamic State Jordan"],
    "Libya":        ["LNA","GNA","Haftar","Tripoli fighting","militia Libya","Benghazi attack"],
    "Tunisia":      ["attack Tunisia","political crisis Tunisia","Sfax migrants"],
    "Algeria":      ["protest Algeria","Hirak Algeria","GSIM Algeria"],
    "Morocco":      ["protest Morocco","attack Morocco","Rif protests"],
    # AFRICA ──────────────────────────────────────────────────────────────────
    "Nigeria":      ["Boko Haram","ISWAP","bandits","banditry","kidnap schoolchildren","farmer herder clash","IPOB","ESN","Biafra","sit-at-home","Zamfara attack","Kaduna attack","Borno attack"],
    "Somalia":      ["Al-Shabaab","AMISOM","IED Somalia","hotel attack Mogadishu","car bomb Somalia","Jubbaland","Galmudug attack"],
    "Kenya":        ["Al-Shabaab Kenya","security operation Kenya","protest Nairobi","Garissa attack"],
    "Ethiopia":     ["TPLF","Tigray","Amhara Fano","OLA Oromo","drone strike Ethiopia","Afar conflict","famine Ethiopia"],
    "Sudan":        ["SAF","RSF","Rapid Support Forces","Darfur conflict","Khartoum fighting","El Fasher","ethnic cleansing Sudan"],
    "DR Congo":     ["M23","ADF","FDLR","Ituri attack","Kivu fighting","Goma advance","MONUSCO"],
    "Mali":         ["JNIM","Wagner Mali","jihadist attack Mali","Bamako attack","coup Mali","Azawad"],
    "Burkina Faso": ["JNIM Burkina","jihadist attack Burkina","coup Burkina","Sahel attack","Ouagadougou attack"],
    "Niger":        ["coup Niger","JNIM Niger","Sahel attack","jihadist ambush Niger"],
    "Mozambique":   ["Al-Shabaab Mozambique","Cabo Delgado attack","insurgency Mozambique","Pemba attack"],
    "Central African Republic": ["FACA","Wagner CAR","Seleka","Anti-balaka","CAR armed group"],
    "South Sudan":  ["SSPDF","SPLM-IO","Nuer Dinka conflict","famine South Sudan","Jonglei attack"],
    "Rwanda":       ["FDLR Rwanda","M23 Rwanda","Kigali security"],
    "Uganda":       ["ADF Uganda","attack Uganda","protest Kampala","Bobi Wine"],
    "Cameroon":     ["Anglophone crisis","Ambazonia","Boko Haram Cameroon","NOSO attack"],
    "Chad":         ["FACT Chad","armed group Chad","Boko Haram Chad","political crisis Chad"],
    "Sahel":        ["jihadist Sahel","JNIM","GSIM","Sahel attack","West Africa attack"],
    "Zimbabwe":     ["Mnangagwa opposition","protest Zimbabwe","crackdown Zimbabwe"],
    "South Africa": ["load shedding violence","xenophobic attack","township violence","ANC protest"],
    # EASTERN EUROPE ──────────────────────────────────────────────────────────
    "Ukraine":      ["Ukrainian front","Russian advance","shelling Zaporizhzhia","Kharkiv attack","Odessa strike","Kherson","Bakhmut","Avdiivka","drone Ukraine","missile Ukraine","HIMARS","frontline"],
    "Russia":       ["Wagner","FSB","opposition Russia","Ukrainian strike Russia","Belgorod attack","Bryansk attack","Kursk offensive"],
    "Belarus":      ["Lukashenko","opposition Belarus","migrant crisis Belarus","Minsk crackdown"],
    "Georgia":      ["Abkhazia conflict","South Ossetia","protest Tbilisi","Russian occupation Georgia"],
    "Azerbaijan":   ["Nagorno-Karabakh","Karabakh","Armenian ceasefire","Baku offensive"],
    "Serbia":       ["Kosovo Serbia tension","Novi Sad protest","Serbian militia"],
    "Kosovo":       ["Serbia Kosovo border","KFOR","ethnic tension Kosovo","north Kosovo"],
    "Moldova":      ["Transnistria","pro-Russian Moldova","Chisinau protest"],
    # CENTRAL ASIA ────────────────────────────────────────────────────────────
    "Kazakhstan":   ["Almaty protest","unrest Kazakhstan","CSTO Kazakhstan","political prisoner Kazakhstan"],
    "Kyrgyzstan":   ["political crisis Kyrgyz","Kyrgyz Tajik border clash","protest Bishkek"],
    "Tajikistan":   ["GBAO conflict","Gorno-Badakhshan","political repression Tajikistan"],
    "Uzbekistan":   ["Karakalpakstan protest","crackdown Uzbekistan"],
    "Turkmenistan": ["oppression Turkmenistan","border Turkmenistan"],
    # EAST ASIA ───────────────────────────────────────────────────────────────
    "China":        ["Xinjiang crackdown","Hong Kong protest","Taiwan strait","Uyghur","Tibet unrest","PLA military","lockdown China","protest China"],
    "Taiwan":       ["China military Taiwan","PLA drill","Taiwan strait tension","invasion Taiwan","ADIZ violation"],
    "North Korea":  ["DPRK missile","nuclear test North Korea","Kim Jong Un","ballistic missile","ICBM launch","North Korea provocation"],
    "South Korea":  ["North Korea provocation","military exercise Korea","protest Seoul"],
    "Japan":        ["North Korea missile Japan","earthquake Japan tsunami","Okinawa base tension"],
    "Hong Kong":    ["protest Hong Kong","crackdown Hong Kong","national security Hong Kong"],
    # AMERICAS ────────────────────────────────────────────────────────────────
    "Mexico":       ["cartel","narco","CJNG","Sinaloa","kidnapping Mexico","femicide Mexico","extortion Mexico City","plaza battle","carjacking Mexico"],
    "Colombia":     ["ELN","FARC dissidents","disidencias","coca","paro armado","armed strike Colombia","Clan del Golfo","attack Colombia"],
    "Venezuela":    ["Maduro","opposition Venezuela","Tren de Aragua","colectivos","economic crisis Venezuela","political prisoner Venezuela"],
    "Brazil":       ["PCC","CV gang","favela shooting","police operation Rio","Bolsonaro","protest Brazil","violence Brazil"],
    "Honduras":     ["MS-13","Mara","gang Honduras","femicide Honduras","sicario"],
    "El Salvador":  ["gang crackdown","MS-13","Barrio 18","prison El Salvador"],
    "Guatemala":    ["gang Guatemala","caravan Guatemala","political crisis Guatemala"],
    "Haiti":        ["gang Haiti","Port-au-Prince gang","G9","Ariel Henry","kidnapping Haiti","cholera Haiti"],
    "Ecuador":      ["cartel Ecuador","prison riot Ecuador","narco Ecuador","assassination Ecuador"],
    "Peru":         ["protest Peru","Sendero Luminoso","VRAEM","political crisis Peru","Lima unrest"],
    "Bolivia":      ["protest Bolivia","coup Bolivia","Evo Morales","political crisis Bolivia"],
    "Chile":        ["mapuche conflict","arson Chile","protest Santiago","La Araucanía attack"],
    "Paraguay":     ["EPP Paraguay","armed group Paraguay","kidnapping Paraguay","Concepcion attack"],
    "Argentina":    ["protest Argentina","economic crisis Argentina","Milei protest"],
    "Cuba":         ["protest Cuba","political prisoner Cuba","11J Cuba"],
    "Nicaragua":    ["Ortega Nicaragua","crackdown Nicaragua","political prisoner Nicaragua"],
    # WESTERN EUROPE ──────────────────────────────────────────────────────────
    "France":       ["gilets jaunes","banlieue riot","knife attack France","terrorism France","protest Paris","Seine-Saint-Denis attack"],
    "Germany":      ["AfD protest","right wing Germany","knife attack Germany","Berlin attack","islamist Germany"],
    "United Kingdom":["knife crime UK","London stabbing","Northern Ireland tension","far right UK","terror arrest UK"],
    "Spain":        ["Catalonia independence","attack Spain","protest Madrid","ETA Spain"],
    "Italy":        ["mafia Italy","Ndrangheta","Camorra","migrant Italy","protest Rome"],
    "Sweden":       ["gang shooting Sweden","Quran burning protest","riot Sweden","bomb Sweden"],
    "Netherlands":  ["riot Netherlands","protest Amsterdam","shooting Netherlands","far right"],
    "Belgium":      ["terror Belgium","attack Brussels","protest Belgium"],
    "Ireland":      ["riot Dublin","attack Ireland","protest Ireland"],
    # PACIFIC ─────────────────────────────────────────────────────────────────
    "Papua New Guinea": ["tribal fighting PNG","election violence PNG","attack PNG"],
    "Fiji":         ["coup Fiji","political crisis Fiji"],
    "Solomon Islands": ["unrest Solomon","Australia RAMSI","protest Honiara"],
}

# ─── LAYER 3: CRITICAL LOCATION KEYWORDS ─────────────────────────────────────
LOCATION_QUERIES = [
    # Major conflict cities
    ("Kabul Kandahar Jalalabad attack blast", "Afghanistan"),
    ("Baghdad Mosul Erbil Basra attack IED", "Iraq"),
    ("Gaza City Khan Younis Rafah airstrike", "Palestine"),
    ("Kyiv Kharkiv Zaporizhzhia Odessa shelling", "Ukraine"),
    ("Mogadishu Kismayo Beledweyne attack", "Somalia"),
    ("Khartoum Darfur El Fasher fighting", "Sudan"),
    ("Bamako Timbuktu attack jihadist", "Mali"),
    ("Ouagadougou Kaya attack jihadist", "Burkina Faso"),
    ("Lagos Maiduguri Abuja Kaduna attack", "Nigeria"),
    ("Nairobi Mombasa Garissa attack", "Kenya"),
    ("Addis Ababa Mekelle Tigray Gondar", "Ethiopia"),
    ("Karachi Lahore Islamabad Peshawar blast", "Pakistan"),
    ("Mumbai Delhi Srinagar Manipur attack", "India"),
    ("Bangkok Pattani Narathiwat Yala attack", "Thailand"),
    ("Manila Mindanao Marawi attack", "Philippines"),
    ("Mexico City Culiacan Tijuana Juarez cartel", "Mexico"),
    ("Bogota Medellin Cali ELN attack", "Colombia"),
    ("Port-au-Prince Cite Soleil gang Haiti", "Haiti"),
    ("Caracas Maracaibo violence Venezuela", "Venezuela"),
    ("Beirut Dahiyeh southern Lebanon strike", "Lebanon"),
    ("Damascus Idlib Aleppo airstrike", "Syria"),
    # Major airports (travel security critical)
    ("airport attack security threat closed", "Airports"),
    ("embassy attack consulate threat security", "Embassies"),
    # Maritime / key straits
    ("Red Sea attack Houthi ship seized", "Maritime"),
    ("Strait Hormuz tanker attacked", "Maritime"),
    ("South China Sea incident", "Maritime"),
]
RSS_FEEDS = [
    # ── GLOBAL WIRE SERVICES ──────────────────────────────────────────────────
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
    {"url":"https://abcnews.go.com/abcnews/internationalheadlines","source":"ABC News Intl","credibility":"high","region":"Global"},
    {"url":"https://rss.cnn.com/rss/edition_world.rss","source":"CNN World","credibility":"high","region":"Global"},
    {"url":"https://www.cbsnews.com/latest/rss/world","source":"CBS News World","credibility":"high","region":"Global"},
    {"url":"https://apnews.com/hub/world-news/rss","source":"AP News","credibility":"high","region":"Global"},
    {"url":"https://www.independent.co.uk/news/world/rss","source":"The Independent","credibility":"high","region":"Global"},
    {"url":"https://www.telegraph.co.uk/news/world/rss.xml","source":"The Telegraph","credibility":"high","region":"Global"},
    # ── GOVERNMENT / OFFICIAL ─────────────────────────────────────────────────
    {"url":"https://travel.state.gov/content/travel/en/RSS.rss.html","source":"US State Dept Travel","credibility":"high","region":"Global"},
    {"url":"https://www.gov.uk/foreign-travel-advice.atom","source":"UK FCDO Travel","credibility":"high","region":"Global"},
    {"url":"https://www.smartraveller.gov.au/destinations/rss.xml","source":"Australia DFAT","credibility":"high","region":"Global"},
    {"url":"https://www.nato.int/rss.xml","source":"NATO News","credibility":"high","region":"Global"},
    {"url":"https://www.state.gov/rss-feeds/press-releases/","source":"US State Dept PR","credibility":"high","region":"Global"},
    # ── DISASTERS & EMERGENCIES ───────────────────────────────────────────────
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom","source":"USGS Significant EQ","credibility":"high","region":"Global"},
    {"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom","source":"USGS M4.5+ Today","credibility":"high","region":"Global"},
    {"url":"https://www.gdacs.org/xml/rss_24h.xml","source":"GDACS Disasters","credibility":"high","region":"Global"},
    {"url":"https://reliefweb.int/disasters/rss.xml","source":"ReliefWeb Disasters","credibility":"high","region":"Global"},
    {"url":"https://reliefweb.int/updates/rss.xml","source":"ReliefWeb Updates","credibility":"high","region":"Global"},
    # ── HEALTH / MEDICAL ──────────────────────────────────────────────────────
    {"url":"https://www.who.int/feeds/entity/don/en/rss.xml","source":"WHO Disease Outbreaks","credibility":"high","region":"Global"},
    {"url":"https://wwwnc.cdc.gov/travel/notices/rss.xml","source":"CDC Travel Health","credibility":"high","region":"Global"},
    {"url":"https://www.who.int/feeds/entity/hac/en/rss.xml","source":"WHO Emergencies","credibility":"high","region":"Global"},
    # ── AVIATION ──────────────────────────────────────────────────────────────
    {"url":"https://aviation-safety.net/news/rss.php","source":"Aviation Safety Network","credibility":"high","region":"Global"},
    # ── MIDDLE EAST ──────────────────────────────────────────────────────────
    {"url":"https://www.arabnews.com/rss.xml","source":"Arab News","credibility":"medium","region":"Middle East"},
    {"url":"https://www.jpost.com/rss/rssfeedsfrontpage.aspx","source":"Jerusalem Post","credibility":"medium","region":"Middle East"},
    {"url":"https://www.middleeasteye.net/rss","source":"Middle East Eye","credibility":"medium","region":"Middle East"},
    {"url":"https://www.iranintl.com/en/rss","source":"Iran International","credibility":"medium","region":"Middle East"},
    {"url":"https://www.haaretz.com/cmlink/1.628765","source":"Haaretz","credibility":"high","region":"Middle East"},
    {"url":"https://english.alarabiya.net/rss.xml","source":"Al Arabiya English","credibility":"medium","region":"Middle East"},
    {"url":"https://www.timesofisrael.com/feed/","source":"Times of Israel","credibility":"medium","region":"Middle East"},
    {"url":"https://www.rudaw.net/english/feed","source":"Rudaw Kurdistan","credibility":"medium","region":"Middle East"},
    {"url":"https://www.naharnet.com/stories/en/rss","source":"Naharnet Lebanon","credibility":"medium","region":"Middle East"},
    {"url":"https://www.dailysabah.com/rss","source":"Daily Sabah Turkey","credibility":"medium","region":"Middle East"},
    {"url":"https://www.trtworld.com/rss","source":"TRT World","credibility":"medium","region":"Middle East"},
    {"url":"https://gulfnews.com/rss","source":"Gulf News UAE","credibility":"medium","region":"Middle East"},
    {"url":"https://saudigazette.com.sa/rss","source":"Saudi Gazette","credibility":"medium","region":"Middle East"},
    {"url":"https://www.bbc.co.uk/news/world/middle_east/rss.xml","source":"BBC Middle East","credibility":"high","region":"Middle East"},
    # ── EASTERN EUROPE & RUSSIA ──────────────────────────────────────────────
    {"url":"https://kyivindependent.com/feed/","source":"Kyiv Independent","credibility":"high","region":"Eastern Europe"},
    {"url":"https://www.ukrinform.net/rss/block-lastnews","source":"Ukrinform","credibility":"high","region":"Eastern Europe"},
    {"url":"https://euromaidan.press/feed/","source":"Euromaidan Press","credibility":"high","region":"Eastern Europe"},
    {"url":"https://www.themoscowtimes.com/rss/news","source":"The Moscow Times","credibility":"high","region":"Eastern Europe"},
    {"url":"https://balkaninsight.com/feed/","source":"Balkan Insight","credibility":"high","region":"Balkans"},
    {"url":"https://www.intellinews.com/rss/","source":"Intel News EE","credibility":"medium","region":"Eastern Europe"},
    # ── SOUTH ASIA ────────────────────────────────────────────────────────────
    {"url":"https://www.dawn.com/feeds/home","source":"Dawn Pakistan","credibility":"high","region":"South Asia"},
    {"url":"https://www.thenews.com.pk/rss/1/8","source":"The News Pakistan","credibility":"medium","region":"South Asia"},
    {"url":"https://tribune.com.pk/rss","source":"Express Tribune Pakistan","credibility":"high","region":"South Asia"},
    {"url":"https://www.thehindu.com/news/international/?service=rss","source":"The Hindu International","credibility":"high","region":"South Asia"},
    {"url":"https://www.thehindu.com/news/national/?service=rss","source":"The Hindu National","credibility":"high","region":"South Asia"},
    {"url":"https://www.thedailystar.net/frontpage/rss.xml","source":"Daily Star Bangladesh","credibility":"high","region":"South Asia"},
    {"url":"https://kathmandupost.com/rss","source":"Kathmandu Post","credibility":"high","region":"South Asia"},
    {"url":"https://colombogazette.com/feed/","source":"Colombo Gazette","credibility":"medium","region":"South Asia"},
    {"url":"https://www.nepalitimes.com/feed/","source":"Nepali Times","credibility":"high","region":"South Asia"},
    {"url":"https://www.bbc.co.uk/news/world/south_asia/rss.xml","source":"BBC South Asia","credibility":"high","region":"South Asia"},
    # ── SOUTHEAST ASIA ────────────────────────────────────────────────────────
    {"url":"https://www.bangkokpost.com/rss/data/topstories.xml","source":"Bangkok Post","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.straitstimes.com/news/asia/rss.xml","source":"Straits Times","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.rappler.com/rss/nation.xml","source":"Rappler Philippines","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.thejakartapost.com/news/rss","source":"Jakarta Post","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.irrawaddy.com/feed","source":"The Irrawaddy Myanmar","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.phnompenhpost.com/rss.xml","source":"Phnom Penh Post","credibility":"medium","region":"Southeast Asia"},
    {"url":"https://vietnamnews.vn/rss/world.rss","source":"Vietnam News","credibility":"medium","region":"Southeast Asia"},
    {"url":"https://en.tempo.co/rss/feed","source":"Tempo Indonesia","credibility":"medium","region":"Southeast Asia"},
    {"url":"https://www.freemalaysiatoday.com/feed/","source":"Free Malaysia Today","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.channelnewsasia.com/rssfeeds/8395984","source":"Channel NewsAsia","credibility":"high","region":"Southeast Asia"},
    {"url":"https://www.bbc.co.uk/news/world/asia_pacific/rss.xml","source":"BBC Asia Pacific","credibility":"high","region":"Southeast Asia"},
    # ── EAST ASIA ─────────────────────────────────────────────────────────────
    {"url":"https://www.japantimes.co.jp/feed/","source":"Japan Times","credibility":"high","region":"East Asia"},
    {"url":"https://www.scmp.com/rss/91/feed","source":"S China Morning Post","credibility":"high","region":"East Asia"},
    {"url":"https://www.koreaherald.com/rss_2.0/All-News.xml","source":"Korea Herald","credibility":"medium","region":"East Asia"},
    {"url":"https://www.taiwannews.com.tw/en/rss","source":"Taiwan News","credibility":"medium","region":"East Asia"},
    {"url":"https://www.rfa.org/english/rss2.0","source":"Radio Free Asia","credibility":"high","region":"East Asia"},
    {"url":"https://asia.nikkei.com/rss/feed/nar","source":"Nikkei Asia","credibility":"high","region":"East Asia"},
    # ── AFRICA ────────────────────────────────────────────────────────────────
    {"url":"https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf","source":"AllAfrica","credibility":"medium","region":"Africa"},
    {"url":"https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf","source":"AllAfrica Latest","credibility":"medium","region":"Africa"},
    {"url":"https://www.premiumtimesng.com/feed","source":"Premium Times Nigeria","credibility":"medium","region":"West Africa"},
    {"url":"https://www.dailymaverick.co.za/feed/","source":"Daily Maverick SA","credibility":"high","region":"Southern Africa"},
    {"url":"https://www.nation.co.ke/news/rss.xml","source":"Daily Nation Kenya","credibility":"high","region":"East Africa"},
    {"url":"https://www.theeastafrican.co.ke/tea/news/rss_feed","source":"The East African","credibility":"high","region":"East Africa"},
    {"url":"https://www.addisstandard.com/feed/","source":"Addis Standard","credibility":"high","region":"Horn of Africa"},
    {"url":"https://sudantribune.com/spip.php?page=backend","source":"Sudan Tribune","credibility":"medium","region":"Horn of Africa"},
    {"url":"https://www.thecitizentz.com/news/rss.xml","source":"The Citizen Tanzania","credibility":"medium","region":"East Africa"},
    {"url":"https://www.monitor.co.ug/monitor/News/rss_feed","source":"Monitor Uganda","credibility":"medium","region":"East Africa"},
    {"url":"https://www.newtimes.co.rw/rss","source":"New Times Rwanda","credibility":"medium","region":"East Africa"},
    {"url":"https://www.libyaobserver.ly/feed","source":"Libya Observer","credibility":"medium","region":"North Africa"},
    {"url":"https://www.moroccoworldnews.com/feed/","source":"Morocco World News","credibility":"medium","region":"North Africa"},
    {"url":"https://www.theafricareport.com/feed/","source":"The Africa Report","credibility":"high","region":"Africa"},
    {"url":"https://rfi.fr/en/rss","source":"RFI Africa/World","credibility":"high","region":"Africa"},
    {"url":"https://www.bbc.co.uk/news/world/africa/rss.xml","source":"BBC Africa","credibility":"high","region":"Africa"},
    # ── AMERICAS ──────────────────────────────────────────────────────────────
    {"url":"https://insightcrime.org/feed/","source":"InSight Crime","credibility":"high","region":"Latin America"},
    {"url":"https://en.mercopress.com/rss","source":"MercoPress","credibility":"medium","region":"South America"},
    {"url":"https://www.theguardian.com/world/americas/rss","source":"Guardian Americas","credibility":"high","region":"South America"},
    {"url":"https://rss.cnn.com/rss/cnn_americas.rss","source":"CNN Americas","credibility":"high","region":"Americas"},
    {"url":"https://www.bbc.co.uk/news/world/latin_america/rss.xml","source":"BBC Latin America","credibility":"high","region":"Latin America"},
    # ── CENTRAL ASIA ──────────────────────────────────────────────────────────
    {"url":"https://akipress.com/rss/news_en.rss","source":"AKIpress Kyrgyzstan","credibility":"medium","region":"Central Asia"},
    {"url":"https://www.silkroadbriefing.com/news/feed/","source":"Silk Road Briefing","credibility":"medium","region":"Central Asia"},
    {"url":"https://eurasianet.org/feed","source":"Eurasianet","credibility":"high","region":"Central Asia"},
    # ── WESTERN EUROPE ────────────────────────────────────────────────────────
    {"url":"https://www.politico.eu/feed/","source":"Politico Europe","credibility":"high","region":"Western Europe"},
    {"url":"https://www.euractiv.com/feed/","source":"EurActiv","credibility":"high","region":"Western Europe"},
    {"url":"https://www.thelocal.com/rss","source":"The Local Europe","credibility":"medium","region":"Western Europe"},
    # ── PACIFIC ───────────────────────────────────────────────────────────────
    {"url":"https://www.abc.net.au/news/feed/51120/rss.xml","source":"ABC Australia","credibility":"high","region":"Pacific"},
    {"url":"https://www.rnz.co.nz/news/world.rss","source":"RNZ New Zealand","credibility":"high","region":"Pacific"},
    {"url":"https://www.rnz.co.nz/international/pacific-news.rss","source":"RNZ Pacific","credibility":"high","region":"Pacific"},
    # ── SECURITY & INTELLIGENCE ───────────────────────────────────────────────
    {"url":"https://www.crisisgroup.org/rss.xml","source":"ICG Crisis Group","credibility":"high","region":"Global"},
    {"url":"https://www.icrc.org/en/rss/news","source":"ICRC Red Cross","credibility":"high","region":"Global"},
    {"url":"https://thediplomat.com/feed/","source":"The Diplomat","credibility":"high","region":"Asia"},
    {"url":"https://warontherocks.com/feed/","source":"War on the Rocks","credibility":"high","region":"Global"},
    {"url":"https://www.bellingcat.com/feed/","source":"Bellingcat OSINT","credibility":"high","region":"Global"},
    {"url":"https://foreignpolicy.com/feed/","source":"Foreign Policy","credibility":"high","region":"Global"},
    {"url":"https://www.rand.org/pubs/feeds/periodicals.xml","source":"RAND Research","credibility":"high","region":"Global"},
    {"url":"https://smallwarsjournal.com/blog/feed","source":"Small Wars Journal","credibility":"high","region":"Global"},
    {"url":"https://www.lawfareblog.com/rss.xml","source":"Lawfare Blog","credibility":"high","region":"Global"},
]

# ─── NOMINATIM GEOCODER (city-level precision) ───────────────────────────────
nominatim_semaphore = asyncio.Semaphore(1)
nominatim_last_call = 0.0
geo_memory_cache: Dict[str, Tuple[float, float]] = {}

async def geocode_city(city: str, country: str) -> Tuple[float, float, str]:
    """Returns (lat, lon, precision) with city-level accuracy."""
    global nominatim_last_call
    if not city or city.lower() in ("unknown", "global", "international", ""):
        lat, lon = COUNTRY_COORDS.get(country, (20.0, 0.0))
        return lat, lon, "country"
    # Check city database first (instant lookup)
    city_key = city.strip()
    if city_key in CITY_COORDS:
        lat, lon = CITY_COORDS[city_key]
        jitter = lambda: random.uniform(-0.008, 0.008)
        return round(lat + jitter(), 5), round(lon + jitter(), 5), "city"
    # Check memory cache
    cache_key = f"{city_key},{country}".lower()
    if cache_key in geo_memory_cache:
        lat, lon = geo_memory_cache[cache_key]
        return lat, lon, "city"
    # Check MongoDB cache
    cached = await db.geo_cache.find_one({"key": cache_key})
    if cached:
        geo_memory_cache[cache_key] = (cached["lat"], cached["lon"])
        return cached["lat"], cached["lon"], "city"
    # Use Nominatim API (rate-limited to 1 req/sec)
    async with nominatim_semaphore:
        now = time.time()
        wait = 1.1 - (now - nominatim_last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        nominatim_last_call = time.time()
        try:
            query = f"{city_key}, {country}" if country and country.lower() not in city_key.lower() else city_key
            async with httpx.AsyncClient(timeout=8.0) as hclient:
                resp = await hclient.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": query, "format": "json", "limit": 1, "addressdetails": 0},
                    headers={"User-Agent": "IntelDashboard/2.0 (intel-dashboard@globalinteldesk.com)"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                        jitter = lambda: random.uniform(-0.005, 0.005)
                        lat, lon = round(lat + jitter(), 5), round(lon + jitter(), 5)
                        geo_memory_cache[cache_key] = (lat, lon)
                        await db.geo_cache.insert_one({"key": cache_key, "lat": lat, "lon": lon, "city": city_key, "country": country})
                        return lat, lon, "city"
        except Exception as e:
            logger.warning(f"Nominatim failed for '{city_key}': {e}")
    # Fallback: country centroid
    lat, lon = COUNTRY_COORDS.get(country, (20.0, 0.0))
    jitter = lambda: random.uniform(-1.5, 1.5)
    return round(lat + jitter(), 5), round(lon + jitter(), 5), "country"

# ─── AI ENRICHMENT SYSTEM (Travel Security Focused) ─────────────────────────
ENRICHMENT_PROMPT = """You are a senior travel security analyst for a world-class intelligence firm protecting high-net-worth individuals, C-suite executives, and corporate travelers globally.

Analyze this intelligence report and return ONLY a valid JSON object (no markdown, no text before or after):
{
  "category": "security|conflict|diplomacy|economy|humanitarian|technology",
  "threat_level": "critical|high|elevated|low",
  "travel_impact": "critical|high|medium|low|none",
  "threat_type": "terrorism|crime|civil_unrest|natural_disaster|health|transport_disruption|military|political|kidnapping|cyber",
  "country": "full English country name",
  "city": "most specific location - city/district/airport/neighborhood. Be VERY precise.",
  "region": "one of: Middle East|Eastern Europe|South Asia|East Asia|Southeast Asia|Central Asia|North Africa|Sub-Saharan Africa|West Africa|East Africa|Horn of Africa|Sahel|Balkans|Caucasus|Caribbean|South America|Central America|North America|Western Europe|Pacific|Global",
  "actor_type": "state|non-state|organization",
  "tags": ["3-5 specific intelligence tags"],
  "confidence_level": "verified|developing|breaking",
  "confidence_score": 0.85,
  "traveler_advice": "DIRECT instruction for travelers: what to do/avoid RIGHT NOW in 1-2 sentences.",
  "affected_zones": ["specific areas, airports, roads, districts affected"],
  "evacuation_relevance": false,
  "actionable_insights": ["2-3 immediate security actions for executive travelers"],
  "key_actors": ["key organizations/groups involved"],
  "severity_summary": "one crisp sentence: who/what/where/impact for travel security"
}

Travel Impact Scale:
- 'critical': Immediate life threat — active attack, evacuation needed, airport/border closed
- 'high': Significant disruption — civil unrest, natural disaster, disease outbreak, major crime wave
- 'medium': Exercise caution — protests, elevated crime, weather disruption, political tension
- 'low': Situational awareness — minor incidents, diplomatic friction, manageable disruption
- 'none': Background intel — no direct travel impact

Threat Classification:
- 'terrorism': attacks, IEDs, vehicle ramming, mass shooting, suicide bombs
- 'crime': kidnapping, carjacking, robbery, mugging, express kidnap, organized crime
- 'civil_unrest': protests, riots, strikes, roadblocks, curfews
- 'natural_disaster': earthquake, tsunami, flood, cyclone, volcanic eruption, wildfire
- 'health': disease outbreak, contamination, medical emergency, quarantine
- 'transport_disruption': airport closure, flight cancellation, rail strike, road blockage
- 'military': armed conflict, airstrikes, shelling, military operations
- 'political': coup, election violence, diplomatic crisis, sanctions impact
- 'kidnapping': executive kidnap risk, ransom events, express kidnapping
- 'cyber': infrastructure attacks, communications disruption

Traveler Advice Rules:
- Be SPECIFIC and ACTIONABLE ("Avoid Nairobi CBD, use protected convoy if movement essential")
- For travel_impact 'critical': include evacuation/shelter-in-place instruction
- For 'none': can be "No travel impact. Monitor for updates."
- City: NEVER return "Unknown" - use country capital if city unclear"""

async def enrich_article(title: str, summary: str, source: str) -> dict:
    """AI enrichment with travel security focus."""
    try:
        if not EMERGENT_LLM_KEY:
            return _fallback_enrich(title, summary)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"enrich-{uuid.uuid4()}",
            system_message=ENRICHMENT_PROMPT
        ).with_model("openai", "gpt-4.1-mini")
        prompt = f"Title: {title[:300]}\nContent: {summary[:600]}\nSource: {source}\n\nReturn JSON only."
        response = await chat.send_message(UserMessage(text=prompt))
        clean = re.sub(r'```(?:json)?\n?', '', response.strip()).rstrip('`').strip()
        data = json.loads(clean)
        # Validate & normalize
        cat = data.get("category", "security")
        if cat not in ["security","conflict","diplomacy","economy","humanitarian","technology"]:
            cat = "security"
        tl = data.get("threat_level", "low")
        if tl not in ["critical","high","elevated","low"]:
            tl = "low"
        ti = data.get("travel_impact", "low")
        if ti not in ["critical","high","medium","low","none"]:
            ti = "low"
        tt = data.get("threat_type", "security")
        if tt not in ["terrorism","crime","civil_unrest","natural_disaster","health","transport_disruption","military","political","kidnapping","cyber"]:
            tt = "security"
        at = data.get("actor_type", "state")
        if at not in ["state","non-state","organization"]:
            at = "state"
        cl = data.get("confidence_level", "developing")
        if cl not in ["verified","developing","breaking"]:
            cl = "developing"
        return {
            "category": cat, "threat_level": tl, "travel_impact": ti, "threat_type": tt,
            "country": data.get("country", "Global"),
            "city": data.get("city", ""),
            "region": data.get("region", "Global"),
            "actor_type": at,
            "tags": [str(t) for t in data.get("tags", [])[:5]],
            "confidence_level": cl,
            "confidence_score": round(min(max(float(data.get("confidence_score", 0.6)), 0.0), 1.0), 2),
            "traveler_advice": data.get("traveler_advice", "")[:300],
            "affected_zones": data.get("affected_zones", [])[:5],
            "evacuation_relevance": bool(data.get("evacuation_relevance", False)),
            "actionable_insights": data.get("actionable_insights", [])[:3],
            "key_actors": data.get("key_actors", [])[:4],
            "severity_summary": data.get("severity_summary", ""),
        }
    except Exception as e:
        logger.warning(f"AI enrichment failed: {e}")
        return _fallback_enrich(title, summary)

def _fallback_enrich(title: str, summary: str) -> dict:
    text = (title + " " + summary).lower()
    cat = "security"
    if any(w in text for w in ["war","battle","troops","casualties","fighting","airstrike","bombing","shelling"]):
        cat = "conflict"
    elif any(w in text for w in ["diplomatic","summit","sanctions","treaty","negotiate","minister visit"]):
        cat = "diplomacy"
    elif any(w in text for w in ["economy","gdp","trade","inflation","recession","oil price","financial"]):
        cat = "economy"
    elif any(w in text for w in ["refugee","humanitarian","disaster","flood","earthquake","famine","displaced"]):
        cat = "humanitarian"
    elif any(w in text for w in ["cyber","drone tech","ai","hacking","malware","surveillance"]):
        cat = "technology"
    tl = "low"
    if any(w in text for w in ["killed","dead","casualties","massacre","nuclear","chemical weapon","explosion"]):
        tl = "critical"
    elif any(w in text for w in ["attack","conflict","fighting","military operation","airstrike","offensive"]):
        tl = "high"
    elif any(w in text for w in ["tension","threat","protest","unrest","warning","election","crisis"]):
        tl = "elevated"
    city = ""
    for c in CITY_COORDS.keys():
        if c.lower() in text:
            city = c
            break
    country = "Global"
    for c in COUNTRY_COORDS.keys():
        if c.lower() in text:
            country = c
            break
    return {
        "category": cat, "threat_level": tl, "country": country, "city": city,
        "region": "Global", "actor_type": "state",
        "travel_impact": "medium" if tl in ["critical","high"] else "low",
        "threat_type": "terrorism" if cat == "conflict" else "civil_unrest" if cat == "security" else "political",
        "traveler_advice": "Monitor situation. Follow official guidance.",
        "affected_zones": [],
        "evacuation_relevance": False,
        "tags": [cat, tl], "confidence_level": "developing",
        "confidence_score": 0.55, "actionable_insights": [],
        "key_actors": [], "severity_summary": title[:100],
    }

# ─── MODELS ──────────────────────────────────────────────────────────────────
class NewsItemCreate(BaseModel):
    title: str; summary: str; url: str = ""; source: str = "Manual"
    source_credibility: str = "medium"; published_at: Optional[str] = None
    lat: float = 0.0; lon: float = 0.0; country: str = "Global"; region: str = "Global"
    tags: List[str] = []; confidence_score: float = 0.7
    confidence_level: str = "developing"; threat_level: str = "elevated"
    actor_type: str = "state"; sub_category: Optional[str] = None
    category: str = "security"; city: str = ""

class FetchStatus(BaseModel):
    is_fetching: bool = False; last_fetch_time: Optional[str] = None
    last_fetch_count: int = 0; total_items: int = 0; sources_checked: int = 0

fetch_status = FetchStatus()
sse_clients: List[asyncio.Queue] = []

# ─── RSS INGESTION ────────────────────────────────────────────────────────────
async def fetch_rss_feed(feed_info: dict, hclient: httpx.AsyncClient) -> List[dict]:
    items = []
    try:
        resp = await hclient.get(feed_info["url"], timeout=15.0, follow_redirects=True)
        if resp.status_code == 200:
            feed = feedparser.parse(resp.content)
            for entry in feed.entries[:12]:
                title = re.sub(r'<[^>]+>', '', entry.get("title", "")).strip()
                summary = re.sub(r'<[^>]+>', '', entry.get("summary", entry.get("description", ""))).strip()
                summary = re.sub(r'\s+', ' ', summary).strip()
                url = entry.get("link", "").strip()
                pub = datetime.now(timezone.utc).isoformat()
                for attr in ["published_parsed", "updated_parsed"]:
                    val = getattr(entry, attr, None)
                    if val:
                        try:
                            import calendar
                            pub = datetime.fromtimestamp(calendar.timegm(val), tz=timezone.utc).isoformat()
                            break
                        except: pass
                if title and len(title) > 10:
                    # ── RELEVANCE FILTER ─────────────────────────────────────
                    relevance = score_article_relevance(title, summary or "")
                    if relevance < 0:
                        continue  # skip noise
                    # Language check — only English
                    if not is_english(title):
                        continue
                    items.append({"title": title[:300], "summary": (summary or title)[:800],
                                  "url": url, "source": feed_info["source"],
                                  "source_credibility": feed_info["credibility"],
                                  "source_region": feed_info["region"], "published_at": pub,
                                  "relevance_score": relevance})
    except Exception as e:
        logger.warning(f"RSS feed {feed_info['source']} failed: {e}")
    return items

async def fetch_gdelt_events() -> List[dict]:
    """
    3-Layer GDELT query engine covering 70,000+ global sources.
    Layer 1: Universal risk keywords
    Layer 2: Country-specific local context terms
    Layer 3: City / location / landmark queries
    Uses 15-min timespan for near real-time (GDELT updates every 15 min).
    """
    items = []

    # Build full query list from all 3 layers
    all_queries: List[tuple] = []

    # Layer 1 — Universal (15-min timespan = breaking news)
    for q, category in LAYER1_QUERIES:
        all_queries.append((q, category, "15min"))

    # Layer 2 — Country-specific (30-min window)
    for country, keywords in COUNTRY_KEYWORDS.items():
        if keywords:
            q = " OR ".join(f'"{kw}"' if " " in kw else kw for kw in keywords[:6])
            all_queries.append((q, country, "30min"))

    # Layer 3 — Location/landmark (30-min window)
    for q, location in LOCATION_QUERIES:
        all_queries.append((q, location, "30min"))

    logger.info(f"GDELT: running {len(all_queries)} queries across 3 layers")

    try:
        async with httpx.AsyncClient(timeout=25.0) as hclient:
            # Run in batches of 15 to avoid overwhelming GDELT
            batch_size = 15
            for batch_start in range(0, len(all_queries), batch_size):
                batch = all_queries[batch_start:batch_start + batch_size]
                tasks = [
                    hclient.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={
                            "query": q, "mode": "artlist",
                            "maxrecords": "25", "format": "json",
                            "timespan": timespan, "sort": "DateDesc",
                        }
                    )
                    for q, region, timespan in batch
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, resp in enumerate(results):
                    if isinstance(resp, Exception):
                        continue
                    try:
                        if resp.status_code == 200:
                            data = resp.json()
                            region = batch[i][1]
                            for art in data.get("articles", []):
                                title = art.get("title", "").strip()
                                url = art.get("url", "").strip()
                                summary = art.get("seendescription", title)[:800]
                                if title and len(title) > 15 and url:
                                    # Relevance filter on GDELT too
                                    rel = score_article_relevance(title, summary)
                                    if rel < 0:
                                        continue
                                    if not is_english(title):
                                        continue
                                    items.append({
                                        "title": title[:300], "summary": summary,
                                        "url": url,
                                        "source": art.get("domain", f"GDELT/{region}"),
                                        "source_credibility": "medium",
                                        "source_region": region,
                                        "published_at": datetime.now(timezone.utc).isoformat(),
                                        "relevance_score": rel,
                                    })
                    except Exception:
                        pass
                # Small pause between batches to be respectful
                await asyncio.sleep(0.5)
    except Exception as e:
        logger.warning(f"GDELT 3-layer fetch error: {e}")

    # Deduplicate by URL within this batch
    seen_urls: set = set()
    unique = []
    for item in items:
        if item["url"] not in seen_urls:
            seen_urls.add(item["url"])
            unique.append(item)

    logger.info(f"GDELT 3-layer: {len(unique)} unique articles from {len(all_queries)} queries")
    return unique


# ─── MAIN FETCH & STORE ───────────────────────────────────────────────────────
async def fetch_and_store_news() -> dict:
    global fetch_status
    if fetch_status.is_fetching:
        return {"success": False, "message": "Fetch in progress"}
    fetch_status.is_fetching = True
    try:
        all_raw = []
        sources_ok = 0
        # RSS feeds
        async with httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (compatible; IntelDashboard/2.0)"},
            timeout=20.0
        ) as hclient:
            tasks = [fetch_rss_feed(f, hclient) for f in RSS_FEEDS]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, r in enumerate(results):
                if isinstance(r, list):
                    all_raw.extend(r)
                    sources_ok += 1
        # GDELT
        gdelt_items = await fetch_gdelt_events()
        all_raw.extend(gdelt_items)
        logger.info(f"Fetched {len(all_raw)} raw items from {sources_ok} RSS + GDELT")
        # Deduplicate by URL
        existing_urls = set()
        async for item in db.news_items.find({}, {"url": 1}):
            if item.get("url"):
                existing_urls.add(item["url"])
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        new_items = []
        for item in all_raw:
            if item["url"] and item["url"] in existing_urls:
                continue
            try:
                pub = datetime.fromisoformat(item["published_at"].replace('Z', '+00:00'))
                if pub.tzinfo is None:
                    pub = pub.replace(tzinfo=timezone.utc)
                if pub < cutoff:
                    continue
            except: pass
            new_items.append(item)

        # Sort by relevance score — process highest-relevance first
        new_items.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        logger.info(f"{len(new_items)} new relevant items to process (noise filtered)")
        inserted = 0
        # Process in batches of 8 — use trafilatura to enrich thin summaries
        for i in range(0, min(len(new_items), 60), 8):
            batch = new_items[i:i+8]
            # Enhance summaries with full article text for thin items
            enhanced_batch = []
            for it in batch:
                summary = it["summary"]
                if len(summary) < 200 and it.get("url"):
                    full_text = await asyncio.get_event_loop().run_in_executor(
                        None, extract_full_text, it["url"], summary
                    )
                    enhanced_batch.append({**it, "summary": full_text})
                else:
                    enhanced_batch.append(it)
            enrichments = await asyncio.gather(
                *[enrich_article(it["title"], it["summary"], it["source"]) for it in enhanced_batch],
                return_exceptions=True
            )
            for item, enrichment in zip(enhanced_batch, enrichments):
                if isinstance(enrichment, Exception):
                    enrichment = _fallback_enrich(item["title"], item["summary"])
                # Geocode to city level
                city = enrichment.get("city", "")
                country = enrichment.get("country", "Global")
                lat, lon, precision = await geocode_city(city, country)
                doc = {
                    "id": str(uuid.uuid4()),
                    "token": str(uuid.uuid4())[:8].upper(),
                    "title": item["title"], "summary": item["summary"],
                    "url": item["url"], "source": item["source"],
                    "source_credibility": item.get("source_credibility", "medium"),
                    "published_at": item["published_at"],
                    "lat": lat, "lon": lon,
                    "country": country, "city": city,
                    "region": enrichment.get("region", "Global"),
                    "tags": enrichment.get("tags", []),
                    "confidence_score": enrichment.get("confidence_score", 0.6),
                    "confidence_level": enrichment.get("confidence_level", "developing"),
                    "threat_level": enrichment.get("threat_level", "low"),
                    "travel_impact": enrichment.get("travel_impact", "low"),
                    "threat_type": enrichment.get("threat_type", "political"),
                    "traveler_advice": enrichment.get("traveler_advice", ""),
                    "affected_zones": enrichment.get("affected_zones", []),
                    "evacuation_relevance": enrichment.get("evacuation_relevance", False),
                    "actor_type": enrichment.get("actor_type", "state"),
                    "sub_category": None,
                    "category": enrichment.get("category", "security"),
                    "actionable_insights": enrichment.get("actionable_insights", []),
                    "key_actors": enrichment.get("key_actors", []),
                    "severity_summary": enrichment.get("severity_summary", ""),
                    "precision_level": precision,
                    "user_id": "system",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_at_dt": datetime.now(timezone.utc),  # for 7-day TTL index
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    await db.news_items.insert_one(doc)
                    inserted += 1
                    clean = {k: v for k, v in doc.items() if k != "_id"}
                    await broadcast_sse({"type": "new_item", "item": clean})
                except Exception as e:
                    logger.error(f"Insert failed: {e}")
        total = await db.news_items.count_documents({})
        fetch_status.last_fetch_time = datetime.now(timezone.utc).isoformat()
        fetch_status.last_fetch_count = inserted
        fetch_status.total_items = total
        fetch_status.sources_checked = sources_ok
        logger.info(f"Fetch complete: {inserted} inserted, total {total}")
        return {"success": True, "fetched": len(all_raw), "inserted": inserted, "sources_checked": sources_ok}
    except Exception as e:
        logger.error(f"Fetch error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        fetch_status.is_fetching = False

# ─── SSE ──────────────────────────────────────────────────────────────────────
async def broadcast_sse(data: dict):
    for q in list(sse_clients):
        try: await q.put(data)
        except: sse_clients.remove(q) if q in sse_clients else None

# ─── 7-DAY CLEANUP ────────────────────────────────────────────────────────────
async def cleanup_old_intel():
    """Delete items older than 7 days — runs every hour."""
    while True:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            result = await db.news_items.delete_many({"published_at": {"$lt": cutoff}})
            if result.deleted_count > 0:
                total = await db.news_items.count_documents({})
                logger.info(f"Cleanup: removed {result.deleted_count} items older than 7 days. Remaining: {total}")
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
        await asyncio.sleep(3600)  # run every hour

async def fetch_breaking_news():
    """
    Fast-lane fetch every 90 seconds — Layer 1 universal risk keywords only.
    Catches breaking intel published in the last 15 minutes.
    """
    while True:
        try:
            items = []
            async with httpx.AsyncClient(timeout=20.0) as hclient:
                tasks = [
                    hclient.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={"query": q, "mode": "artlist", "maxrecords": "15",
                                "format": "json", "timespan": "15min", "sort": "DateDesc"}
                    )
                    for q, _ in LAYER1_QUERIES
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, resp in enumerate(results):
                    if isinstance(resp, Exception):
                        continue
                    try:
                        if resp.status_code == 200:
                            data = resp.json()
                            for art in data.get("articles", []):
                                title = art.get("title", "").strip()
                                url = art.get("url", "").strip()
                                if title and len(title) > 15 and url:
                                    items.append({
                                        "title": title[:300],
                                        "summary": art.get("seendescription", title)[:800],
                                        "url": url,
                                        "source": art.get("domain", "GDELT/Breaking"),
                                        "source_credibility": "medium",
                                        "source_region": LAYER1_QUERIES[i][1],
                                        "published_at": datetime.now(timezone.utc).isoformat(),
                                    })
                    except Exception:
                        pass

            if items:
                # Check existing URLs
                existing = set()
                async for doc in db.news_items.find({}, {"url": 1}):
                    if doc.get("url"):
                        existing.add(doc["url"])

                new_items = [it for it in items if it["url"] not in existing]
                inserted = 0
                for item in new_items[:10]:  # max 10 per breaking cycle
                    try:
                        enrichment = await enrich_article(item["title"], item["summary"], item["source"])
                        city = enrichment.get("city", "")
                        country = enrichment.get("country", "Global")
                        lat, lon, precision = await geocode_city(city, country)
                        doc = {
                            "id": str(uuid.uuid4()), "token": str(uuid.uuid4())[:8].upper(),
                            "title": item["title"], "summary": item["summary"],
                            "url": item["url"], "source": item["source"],
                            "source_credibility": "medium",
                            "published_at": item["published_at"],
                            "lat": lat, "lon": lon,
                            "country": country, "city": city,
                            "region": enrichment.get("region", "Global"),
                            "tags": enrichment.get("tags", []),
                            "confidence_score": enrichment.get("confidence_score", 0.6),
                            "confidence_level": enrichment.get("confidence_level", "breaking"),
                            "threat_level": enrichment.get("threat_level", "elevated"),
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
                        await db.news_items.insert_one(doc)
                        clean = {k: v for k, v in doc.items() if k != "_id"}
                        await broadcast_sse({"type": "new_item", "item": clean})
                        inserted += 1
                    except Exception:
                        pass
                if inserted:
                    logger.info(f"Breaking news: {inserted} new items (Layer 1 fast-lane)")
        except Exception as e:
            logger.error(f"Breaking news fetch error: {e}")
        await asyncio.sleep(90)  # every 90 seconds


# ─── CONTINUOUS BACKGROUND FETCHER ────────────────────────────────────────────
async def background_fetcher():
    """Runs forever. Full 3-layer fetch every 2 minutes. Never crashes."""
    logger.info("Continuous intel fetcher started — 7-day rolling window")
    await asyncio.sleep(10)
    while True:
        try:
            await fetch_and_store_news()
        except Exception as e:
            logger.error(f"Fetch cycle error (will retry in 2 min): {e}")
        await asyncio.sleep(120)  # every 2 minutes

# ─── LIFESPAN ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.news_items.create_index("url", unique=True, sparse=True)
        await db.news_items.create_index([("published_at", -1)])
        await db.news_items.create_index("threat_level")
        await db.news_items.create_index("category")
        await db.news_items.create_index("country")
        await db.news_items.create_index("city")
        await db.geo_cache.create_index("key", unique=True)
        await db.chat_messages.create_index([("channel", 1), ("timestamp", -1)])
        await db.chat_messages.create_index("timestamp")
        # TTL index — MongoDB auto-deletes docs 7 days after created_at
        await db.news_items.create_index(
            [("created_at_dt", 1)],
            expireAfterSeconds=604800,  # 7 days
            sparse=True,
        )
        logger.info("DB indexes ready")
    except Exception as e:
        logger.warning(f"Index warning: {e}")
    bg = asyncio.create_task(background_fetcher())
    cleanup = asyncio.create_task(cleanup_old_intel())
    breaking = asyncio.create_task(fetch_breaking_news())
    logger.info("Intel flow: breaking (90s) + full 3-layer (2min) | 7-day rolling storage")
    yield
    bg.cancel()
    cleanup.cancel()
    breaking.cancel()
    try: await bg
    except asyncio.CancelledError: pass
    client.close()

# ─── APP & ROUTES ─────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"])

@api_router.get("/news", response_model=List[dict])
async def get_news(limit: int = Query(default=300, le=500), offset: int = Query(default=0),
    category: Optional[str] = None, threat_level: Optional[str] = None,
    country: Optional[str] = None, city: Optional[str] = None,
    search: Optional[str] = None, hours: Optional[int] = None):
    q: Dict[str, Any] = {}
    if category: q["category"] = category
    if threat_level: q["threat_level"] = threat_level
    if country: q["country"] = {"$regex": country, "$options": "i"}
    if city: q["city"] = {"$regex": city, "$options": "i"}
    if search:
        q["$or"] = [{"title": {"$regex": search, "$options": "i"}},
                    {"summary": {"$regex": search, "$options": "i"}},
                    {"country": {"$regex": search, "$options": "i"}},
                    {"city": {"$regex": search, "$options": "i"}},
                    {"tags": {"$elemMatch": {"$regex": search, "$options": "i"}}}]
    if hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        q["published_at"] = {"$gte": cutoff.isoformat()}
    cursor = db.news_items.find(q, {"_id": 0}).sort("published_at", -1).skip(offset).limit(limit)
    return await cursor.to_list(length=limit)

@api_router.get("/news/status")
async def get_status():
    total = await db.news_items.count_documents({})
    fetch_status.total_items = total
    return fetch_status.dict()

@api_router.post("/news/fetch")
async def trigger_fetch():
    return await fetch_and_store_news()

@api_router.get("/news/stream")
async def news_stream():
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
                    yield f"data: {json.dumps({'type':'heartbeat','time':datetime.now(timezone.utc).isoformat()})}\n\n"
        except (asyncio.CancelledError, Exception):
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

@api_router.post("/news")
async def create_item(item: NewsItemCreate):
    enrichment = {}
    if item.lat == 0.0 and item.lon == 0.0:
        enrichment = await enrich_article(item.title, item.summary, item.source)
    city = enrichment.get("city", item.city) or item.city
    country = enrichment.get("country", item.country)
    lat, lon, precision = await geocode_city(city, country) if (item.lat == 0.0) else (item.lat, item.lon, "manual")
    doc = {
        "id": str(uuid.uuid4()), "token": str(uuid.uuid4())[:8].upper(),
        "title": item.title, "summary": item.summary, "url": item.url,
        "source": item.source, "source_credibility": item.source_credibility,
        "published_at": item.published_at or datetime.now(timezone.utc).isoformat(),
        "lat": lat, "lon": lon, "country": country, "city": city,
        "region": enrichment.get("region", item.region),
        "tags": enrichment.get("tags", item.tags),
        "confidence_score": enrichment.get("confidence_score", item.confidence_score),
        "confidence_level": enrichment.get("confidence_level", item.confidence_level),
        "threat_level": enrichment.get("threat_level", item.threat_level),
        "actor_type": enrichment.get("actor_type", item.actor_type),
        "sub_category": item.sub_category, "category": enrichment.get("category", item.category),
        "actionable_insights": enrichment.get("actionable_insights", []),
        "key_actors": enrichment.get("key_actors", []),
        "severity_summary": enrichment.get("severity_summary", ""),
        "precision_level": precision,
        "user_id": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.news_items.insert_one(doc)
    clean = {k: v for k, v in doc.items() if k != "_id"}
    await broadcast_sse({"type": "new_item", "item": clean})
    return clean

@api_router.delete("/news/{item_id}")
async def delete_item(item_id: str):
    result = await db.news_items.delete_one({"id": item_id})
    if result.deleted_count == 0: raise HTTPException(404, "Not found")
    await broadcast_sse({"type": "deleted_item", "id": item_id})
    return {"success": True, "id": item_id}

@api_router.get("/")
async def root():
    return {"message": "Intel Dashboard API v2 - Hyperlocal Intelligence", "status": "operational"}

@api_router.get("/status")
async def api_status():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# ─── INTEL CHAT SYSTEM ────────────────────────────────────────────────────────

CHAT_CHANNELS = {
    "general":     {"name": "#general",     "description": "General intel discussion"},
    "middle-east": {"name": "#middle-east", "description": "Middle East & North Africa"},
    "conflict":    {"name": "#conflict",    "description": "Active conflict zones"},
    "security":    {"name": "#security",    "description": "Security & threats"},
    "geopolitics": {"name": "#geopolitics", "description": "Geopolitical analysis"},
    "humanitarian":{"name": "#humanitarian","description": "Humanitarian situations"},
    "asia-pacific":{"name": "#asia-pacific","description": "Asia Pacific intel"},
    "americas":    {"name": "#americas",    "description": "Americas intelligence"},
}

class ChatConnectionManager:
    def __init__(self):
        # channel -> list of (websocket, username, user_id)
        self.connections: Dict[str, List[Dict]] = {ch: [] for ch in CHAT_CHANNELS}
        self.online_counts: Dict[str, int] = {ch: 0 for ch in CHAT_CHANNELS}

    async def connect(self, ws: WebSocket, channel: str, username: str, user_id: str):
        await ws.accept()
        if channel not in self.connections:
            self.connections[channel] = []
        self.connections[channel].append({"ws": ws, "username": username, "user_id": user_id})
        self.online_counts[channel] = len(self.connections[channel])
        # Notify others
        await self.broadcast_system(channel, f"{username} joined the channel", exclude_ws=None)

    def disconnect(self, ws: WebSocket, channel: str, username: str):
        if channel in self.connections:
            self.connections[channel] = [c for c in self.connections[channel] if c["ws"] != ws]
            self.online_counts[channel] = len(self.connections[channel])

    async def broadcast(self, channel: str, message: dict):
        if channel not in self.connections:
            return
        dead = []
        for conn in self.connections[channel]:
            try:
                await conn["ws"].send_json(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            if d in self.connections[channel]:
                self.connections[channel].remove(d)

    async def broadcast_system(self, channel: str, text: str, exclude_ws=None):
        msg = {
            "type": "system",
            "id": str(uuid.uuid4()),
            "channel": channel,
            "username": "SYSTEM",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if channel not in self.connections:
            return
        for conn in self.connections[channel]:
            if exclude_ws and conn["ws"] == exclude_ws:
                continue
            try:
                await conn["ws"].send_json(msg)
            except Exception:
                pass

    def get_online_count(self, channel: str) -> int:
        return len(self.connections.get(channel, []))

    def get_total_online(self) -> int:
        return sum(len(v) for v in self.connections.values())

chat_manager = ChatConnectionManager()

class ChatMessageCreate(BaseModel):
    channel: str
    username: str
    text: str
    user_id: str = "anonymous"

@api_router.get("/chat/channels")
async def get_channels():
    result = []
    for key, info in CHAT_CHANNELS.items():
        result.append({
            "key": key,
            "name": info["name"],
            "description": info["description"],
            "online": chat_manager.get_online_count(key),
        })
    return {"channels": result, "total_online": chat_manager.get_total_online()}

@api_router.get("/chat/messages/{channel}")
async def get_chat_messages(channel: str, limit: int = Query(default=50, le=100)):
    if channel not in CHAT_CHANNELS:
        raise HTTPException(400, "Invalid channel")
    cursor = db.chat_messages.find({"channel": channel}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    messages = await cursor.to_list(length=limit)
    return list(reversed(messages))

@api_router.post("/chat/messages")
async def post_chat_message(msg: ChatMessageCreate):
    if channel := msg.channel:
        if channel not in CHAT_CHANNELS:
            raise HTTPException(400, "Invalid channel")
    doc = {
        "id": str(uuid.uuid4()),
        "channel": msg.channel,
        "username": msg.username[:30],
        "text": msg.text[:500],
        "user_id": msg.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "message",
    }
    await db.chat_messages.insert_one(doc)
    clean = {k: v for k, v in doc.items() if k != "_id"}
    # Broadcast to WebSocket clients
    await chat_manager.broadcast(msg.channel, clean)
    return clean

@api_router.websocket("/chat/ws/{channel}")
async def chat_websocket(ws: WebSocket, channel: str, username: str = "Analyst", user_id: str = "anon"):
    if channel not in CHAT_CHANNELS:
        await ws.close(code=4000)
        return

    username = username[:30] if username else "Analyst"
    await chat_manager.connect(ws, channel, username, user_id)

    # Send online count update
    await ws.send_json({
        "type": "online_count",
        "channel": channel,
        "count": chat_manager.get_online_count(channel),
        "total": chat_manager.get_total_online(),
    })

    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "message" and data.get("text", "").strip():
                text = data["text"].strip()[:500]
                doc = {
                    "id": str(uuid.uuid4()),
                    "channel": channel,
                    "username": username,
                    "text": text,
                    "user_id": user_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "type": "message",
                }
                await db.chat_messages.insert_one(doc)
                clean = {k: v for k, v in doc.items() if k != "_id"}
                await chat_manager.broadcast(channel, clean)
            elif data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        chat_manager.disconnect(ws, channel, username)
        await chat_manager.broadcast_system(channel, f"{username} left the channel")
    except Exception as e:
        logger.error(f"Chat WS error: {e}")
        chat_manager.disconnect(ws, channel, username)

app.include_router(api_router)
