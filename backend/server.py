from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import json
import uuid
import feedparser
import httpx
import re
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# CITY-LEVEL COORDINATES (600+ major cities for precise map plotting)
# =============================================================================
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    # --- Middle East ---
    "Gaza City": (31.5017, 34.4674),
    "Rafah": (31.2967, 34.2408),
    "Khan Younis": (31.3461, 34.3063),
    "Jenin": (32.4641, 35.2989),
    "Ramallah": (31.9038, 35.2034),
    "Hebron": (31.5293, 35.0977),
    "Nablus": (32.2211, 35.2544),
    "Tel Aviv": (32.0853, 34.7818),
    "Jerusalem": (31.7683, 35.2137),
    "Haifa": (32.7940, 34.9896),
    "Beersheba": (31.2516, 34.7915),
    "Beirut": (33.8938, 35.5018),
    "Sidon": (33.5606, 35.3714),
    "Tyre": (33.2719, 35.2039),
    "Damascus": (33.5102, 36.2913),
    "Aleppo": (36.2021, 37.1343),
    "Homs": (34.7274, 36.7171),
    "Idlib": (35.9310, 36.6317),
    "Deir ez-Zor": (35.3351, 40.1416),
    "Raqqa": (35.9504, 39.0134),
    "Deraa": (32.6200, 36.1000),
    "Baghdad": (33.3152, 44.3661),
    "Mosul": (36.3350, 43.1189),
    "Basra": (30.5085, 47.7804),
    "Kirkuk": (35.4681, 44.3922),
    "Erbil": (36.1901, 44.0091),
    "Sulaymaniyah": (35.5572, 45.4329),
    "Fallujah": (33.3535, 43.7836),
    "Ramadi": (33.4258, 43.3028),
    "Tikrit": (34.6057, 43.6870),
    "Najaf": (31.9928, 44.3352),
    "Karbala": (32.6159, 44.0244),
    "Tehran": (35.6892, 51.3890),
    "Isfahan": (32.6546, 51.6680),
    "Mashhad": (36.2605, 59.6168),
    "Tabriz": (38.0962, 46.2738),
    "Ahvaz": (31.3183, 48.6706),
    "Shiraz": (29.5918, 52.5836),
    "Sanaa": (15.3694, 44.1910),
    "Aden": (12.7797, 45.0367),
    "Hodeidah": (14.7978, 42.9554),
    "Taiz": (13.5795, 44.0210),
    "Marib": (15.4749, 45.3250),
    "Amman": (31.9554, 35.9453),
    "Zarqa": (32.0728, 36.0877),
    "Irbid": (32.5556, 35.8498),
    "Riyadh": (24.7136, 46.6753),
    "Jeddah": (21.3891, 39.8579),
    "Mecca": (21.4225, 39.8262),
    "Medina": (24.5247, 39.5692),
    "Dubai": (25.2048, 55.2708),
    "Abu Dhabi": (24.4539, 54.3773),
    "Doha": (25.2854, 51.5310),
    "Kuwait City": (29.3759, 47.9774),
    "Manama": (26.2154, 50.5650),
    "Muscat": (23.5880, 58.3829),
    "Cairo": (30.0444, 31.2357),
    "Alexandria": (31.2001, 29.9187),
    "Port Said": (31.2653, 32.3019),
    "Suez": (29.9668, 32.5498),
    "Tripoli": (32.9022, 13.1805),
    "Benghazi": (32.1194, 20.0864),
    "Misrata": (32.3754, 15.0926),
    "Sirte": (31.2089, 16.5891),
    "Derna": (32.7631, 22.6387),
    "Sabha": (27.0369, 14.4290),
    "Tunis": (36.8190, 10.1658),
    "Sfax": (34.7406, 10.7603),
    "Sousse": (35.8288, 10.6360),
    "Algiers": (36.7372, 3.0863),
    "Oran": (35.6969, -0.6331),
    "Constantine": (36.3652, 6.6147),
    "Rabat": (34.0209, -6.8416),
    "Casablanca": (33.5731, -7.5898),
    "Fez": (34.0181, -5.0078),
    "Marrakech": (31.6295, -7.9811),
    "Tangier": (35.7595, -5.8340),
    "Ankara": (39.9334, 32.8597),
    "Istanbul": (41.0082, 28.9784),
    "Izmir": (38.4192, 27.1287),
    "Diyarbakir": (37.9144, 40.2306),
    "Gaziantep": (37.0662, 37.3833),
    "Adana": (37.0000, 35.3213),
    "Kabul": (34.5553, 69.2075),
    "Kandahar": (31.6289, 65.7372),
    "Herat": (34.3482, 62.1999),
    "Kunduz": (36.7285, 68.8577),
    "Jalalabad": (34.4415, 70.4479),
    "Mazar-i-Sharif": (36.7069, 67.1108),
    "Lashkar Gah": (31.5930, 64.3601),
    # --- East Africa ---
    "Nairobi": (-1.2921, 36.8219),
    "Mombasa": (-4.0435, 39.6682),
    "Kisumu": (-0.0917, 34.7679),
    "Eldoret": (0.5143, 35.2698),
    "Nakuru": (-0.3031, 36.0800),
    "Addis Ababa": (9.0320, 38.7423),
    "Dire Dawa": (9.5930, 41.8661),
    "Gondar": (12.6090, 37.4746),
    "Mekelle": (13.4967, 39.4753),
    "Tigray": (14.0342, 38.3165),
    "Bahir Dar": (11.5742, 37.3614),
    "Hawassa": (7.0621, 38.4763),
    "Kampala": (0.3476, 32.5825),
    "Gulu": (2.7756, 32.2990),
    "Mbarara": (-0.6072, 30.6545),
    "Kigali": (-1.9536, 30.0606),
    "Butare": (-2.5970, 29.7396),
    "Dar es Salaam": (-6.7924, 39.2083),
    "Zanzibar City": (-6.1659, 39.2026),
    "Arusha": (-3.3869, 36.6823),
    "Dodoma": (-6.1722, 35.7395),
    "Mwanza": (-2.5116, 32.9013),
    "Mogadishu": (2.0469, 45.3182),
    "Bosaso": (11.2847, 49.1816),
    "Hargeisa": (9.5633, 44.0650),
    "Kismayo": (0.3582, 42.5454),
    "Baidoa": (3.1187, 43.6473),
    "Galkayo": (6.7665, 47.4303),
    "Djibouti City": (11.5720, 43.1456),
    "Khartoum": (15.5007, 32.5599),
    "Omdurman": (15.6452, 32.4777),
    "Port Sudan": (19.6163, 37.2166),
    "El Fasher": (13.6282, 25.3493),
    "El Geneina": (13.4516, 22.4474),
    "Nyala": (12.0566, 24.8800),
    "Kassala": (15.4615, 36.4003),
    "Juba": (4.8594, 31.5713),
    "Malakal": (9.5329, 31.6597),
    "Wau": (7.7036, 27.9913),
    "Bor": (6.2040, 31.5586),
    "Bentiu": (9.2333, 29.8000),
    "Asmara": (15.3389, 38.9311),
    "Massawa": (15.6094, 39.4703),
    # --- West & Central Africa ---
    "Lagos": (6.5244, 3.3792),
    "Abuja": (9.0579, 7.4951),
    "Kano": (12.0022, 8.5920),
    "Port Harcourt": (4.8156, 7.0498),
    "Ibadan": (7.3775, 3.9470),
    "Kaduna": (10.5222, 7.4383),
    "Maiduguri": (11.8311, 13.1511),
    "Sokoto": (13.0059, 5.2476),
    "Enugu": (6.4584, 7.5464),
    "Borno": (11.8311, 13.1511),
    "Accra": (5.6037, -0.1870),
    "Kumasi": (6.6885, -1.6244),
    "Tamale": (9.4008, -0.8393),
    "Abidjan": (5.3600, -4.0083),
    "Bouake": (7.6924, -5.0314),
    "Yamoussoukro": (6.8276, -5.2893),
    "Dakar": (14.7645, -17.3660),
    "Ziguinchor": (12.5567, -16.2714),
    "Bamako": (12.6392, -8.0029),
    "Timbuktu": (16.7722, -3.0026),
    "Gao": (16.2711, -0.0437),
    "Mopti": (14.4944, -4.1975),
    "Kidal": (18.4413, 1.4077),
    "Ouagadougou": (12.3714, -1.5197),
    "Bobo-Dioulasso": (11.1771, -4.2979),
    "Niamey": (13.5137, 2.1098),
    "Agadez": (16.9742, 7.9893),
    "Diffa": (13.3167, 12.6167),
    "N'Djamena": (12.1348, 15.0557),
    "Moundou": (8.5670, 16.0814),
    "Bangui": (4.3612, 18.5550),
    "Bossangoa": (6.4893, 17.4581),
    "Kinshasa": (-4.3217, 15.3222),
    "Goma": (-1.6790, 29.2285),
    "Bukavu": (-2.4966, 28.8575),
    "Bunia": (1.5595, 30.2529),
    "Butembo": (0.1431, 29.2918),
    "Beni": (0.4920, 29.4728),
    "Lubumbashi": (-11.6876, 27.5026),
    "Mbandaka": (0.0477, 18.2563),
    "Brazzaville": (-4.2634, 15.2429),
    "Douala": (4.0511, 9.7679),
    "Yaounde": (3.8480, 11.5021),
    "Bamenda": (5.9597, 10.1459),
    "Luanda": (-8.8147, 13.2302),
    "Monrovia": (6.2907, -10.7605),
    "Freetown": (8.4657, -13.2317),
    "Conakry": (9.6966, -13.5780),
    "Bissau": (11.8636, -15.5977),
    "Banjul": (13.4549, -16.5790),
    "Nouakchott": (18.0735, -15.9582),
    "Lome": (6.1375, 1.2123),
    "Cotonou": (6.3654, 2.4183),
    "Malabo": (3.7523, 8.7742),
    "Libreville": (0.3924, 9.4536),
    # --- Southern Africa ---
    "Johannesburg": (-26.2041, 28.0473),
    "Cape Town": (-33.9249, 18.4241),
    "Durban": (-29.8587, 31.0218),
    "Pretoria": (-25.7479, 28.2293),
    "Harare": (-17.8292, 31.0522),
    "Bulawayo": (-20.1325, 28.6264),
    "Mutare": (-18.9736, 32.6709),
    "Lusaka": (-15.4167, 28.2833),
    "Livingstone": (-17.8616, 25.8541),
    "Lilongwe": (-13.9626, 33.7741),
    "Blantyre": (-15.7861, 35.0058),
    "Maputo": (-25.9692, 32.5732),
    "Beira": (-19.8437, 34.8389),
    "Windhoek": (-22.5597, 17.0832),
    "Gaborone": (-24.6282, 25.9231),
    "Maseru": (-29.3142, 27.4833),
    "Mbabane": (-26.3054, 31.1367),
    "Antananarivo": (-18.8792, 47.5079),
    "Bujumbura": (-3.3869, 29.3622),
    # --- Eastern Europe & Caucasus ---
    "Kyiv": (50.4501, 30.5234),
    "Kiev": (50.4501, 30.5234),
    "Kharkiv": (49.9935, 36.2304),
    "Mariupol": (47.0951, 37.5439),
    "Odesa": (46.4825, 30.7233),
    "Odessa": (46.4825, 30.7233),
    "Zaporizhzhia": (47.8388, 35.1396),
    "Kherson": (46.6354, 32.6169),
    "Mykolaiv": (46.9750, 31.9946),
    "Lviv": (49.8397, 24.0297),
    "Dnipro": (48.4647, 35.0462),
    "Donetsk": (48.0159, 37.8028),
    "Luhansk": (48.5740, 39.3078),
    "Bakhmut": (48.5953, 37.9974),
    "Avdiivka": (48.1391, 37.7516),
    "Sumy": (50.9077, 34.7981),
    "Poltava": (49.5883, 34.5514),
    "Chernihiv": (51.4982, 31.2893),
    "Zaporizhzhia": (47.8388, 35.1396),
    "Kremenchuk": (49.0676, 33.4155),
    "Sevastopol": (44.6166, 33.5254),
    "Simferopol": (44.9521, 34.1024),
    "Crimea": (45.0843, 34.1978),
    "Moscow": (55.7558, 37.6176),
    "Saint Petersburg": (59.9311, 30.3609),
    "St. Petersburg": (59.9311, 30.3609),
    "Novosibirsk": (54.9884, 82.9057),
    "Volgograd": (48.7194, 44.5018),
    "Rostov-on-Don": (47.2357, 39.7015),
    "Belgorod": (50.5997, 36.5854),
    "Kursk": (51.7302, 36.1920),
    "Bryansk": (53.2441, 34.3643),
    "Minsk": (53.9045, 27.5615),
    "Brest": (52.0975, 23.6872),
    "Warsaw": (52.2297, 21.0122),
    "Krakow": (50.0647, 19.9450),
    "Gdansk": (54.3520, 18.6466),
    "Belgrade": (44.7866, 20.4489),
    "Novi Sad": (45.2671, 19.8335),
    "Pristina": (42.6629, 21.1655),
    "Sarajevo": (43.8563, 18.4131),
    "Mostar": (43.3438, 17.8078),
    "Tirana": (41.3275, 19.8187),
    "Skopje": (41.9961, 21.4316),
    "Budapest": (47.4979, 19.0402),
    "Prague": (50.0755, 14.4378),
    "Bratislava": (48.1486, 17.1077),
    "Ljubljana": (46.0569, 14.5058),
    "Zagreb": (45.8150, 15.9819),
    "Sofia": (42.6977, 23.3219),
    "Bucharest": (44.4268, 26.1025),
    "Chisinau": (47.0245, 28.8324),
    "Tbilisi": (41.6941, 44.8337),
    "Batumi": (41.6167, 41.6367),
    "Yerevan": (40.1872, 44.5152),
    "Stepanakert": (39.8200, 46.7540),
    "Baku": (40.4093, 49.8671),
    "Ganja": (40.6828, 46.3606),
    "Tallinn": (59.4370, 24.7536),
    "Riga": (56.9496, 24.1052),
    "Vilnius": (54.6872, 25.2797),
    "Helsinki": (60.1699, 24.9384),
    # --- Western Europe ---
    "London": (51.5074, -0.1278),
    "Manchester": (53.4808, -2.2426),
    "Birmingham": (52.4862, -1.8904),
    "Liverpool": (53.4084, -2.9916),
    "Glasgow": (55.8642, -4.2518),
    "Edinburgh": (55.9533, -3.1883),
    "Belfast": (54.5973, -5.9301),
    "Paris": (48.8566, 2.3522),
    "Marseille": (43.2965, 5.3698),
    "Lyon": (45.7640, 4.8357),
    "Toulouse": (43.6047, 1.4442),
    "Nice": (43.7102, 7.2620),
    "Strasbourg": (48.5734, 7.7521),
    "Berlin": (52.5200, 13.4050),
    "Munich": (48.1351, 11.5820),
    "Hamburg": (53.5753, 10.0153),
    "Frankfurt": (50.1109, 8.6821),
    "Cologne": (50.9333, 6.9500),
    "Dresden": (51.0504, 13.7373),
    "Madrid": (40.4168, -3.7038),
    "Barcelona": (41.3851, 2.1734),
    "Valencia": (39.4699, -0.3763),
    "Seville": (37.3891, -5.9845),
    "Bilbao": (43.2630, -2.9350),
    "Rome": (41.9028, 12.4964),
    "Milan": (45.4654, 9.1859),
    "Naples": (40.8518, 14.2681),
    "Turin": (45.0703, 7.6869),
    "Palermo": (38.1157, 13.3615),
    "Amsterdam": (52.3676, 4.9041),
    "Rotterdam": (51.9244, 4.4777),
    "Brussels": (50.8503, 4.3517),
    "Vienna": (48.2082, 16.3738),
    "Zurich": (47.3769, 8.5417),
    "Geneva": (46.2044, 6.1432),
    "Bern": (46.9480, 7.4474),
    "Athens": (37.9838, 23.7275),
    "Thessaloniki": (40.6401, 22.9444),
    "Lisbon": (38.7223, -9.1393),
    "Porto": (41.1579, -8.6291),
    "Stockholm": (59.3293, 18.0686),
    "Oslo": (59.9139, 10.7522),
    "Copenhagen": (55.6761, 12.5683),
    "Dublin": (53.3498, -6.2603),
    "Kiev": (50.4501, 30.5234),
    # --- South Asia ---
    "New Delhi": (28.6139, 77.2090),
    "Delhi": (28.6139, 77.2090),
    "Mumbai": (19.0760, 72.8777),
    "Bombay": (19.0760, 72.8777),
    "Kolkata": (22.5726, 88.3639),
    "Calcutta": (22.5726, 88.3639),
    "Chennai": (13.0827, 80.2707),
    "Madras": (13.0827, 80.2707),
    "Bengaluru": (12.9716, 77.5946),
    "Bangalore": (12.9716, 77.5946),
    "Hyderabad": (17.3850, 78.4867),
    "Ahmedabad": (23.0225, 72.5714),
    "Pune": (18.5204, 73.8567),
    "Jaipur": (26.9124, 75.7873),
    "Lucknow": (26.8467, 80.9462),
    "Srinagar": (34.0837, 74.7973),
    "Jammu": (32.7266, 74.8570),
    "Manipur": (24.6637, 93.9063),
    "Imphal": (24.8170, 93.9368),
    "Patna": (25.5941, 85.1376),
    "Bhopal": (23.2599, 77.4126),
    "Varanasi": (25.3176, 82.9739),
    "Lahore": (31.5204, 74.3587),
    "Karachi": (24.8607, 67.0011),
    "Islamabad": (33.7294, 73.0931),
    "Peshawar": (34.0151, 71.5249),
    "Quetta": (30.1798, 66.9750),
    "Multan": (30.1575, 71.5249),
    "Rawalpindi": (33.5651, 73.0169),
    "Swat": (35.2227, 72.4258),
    "Balochistan": (28.4907, 65.0958),
    "Dhaka": (23.8103, 90.4125),
    "Chittagong": (22.3569, 91.7832),
    "Cox's Bazar": (21.4272, 92.0058),
    "Sylhet": (24.9045, 91.8611),
    "Kathmandu": (27.7172, 85.3240),
    "Colombo": (6.9271, 79.8612),
    "Jaffna": (9.6615, 80.0255),
    "Dushanbe": (38.5598, 68.7870),
    "Tashkent": (41.2995, 69.2401),
    "Samarkand": (39.6270, 66.9750),
    "Bishkek": (42.8746, 74.5698),
    "Almaty": (43.2220, 76.8512),
    "Astana": (51.1801, 71.4460),
    "Nur-Sultan": (51.1801, 71.4460),
    "Ashgabat": (37.9601, 58.3261),
    # --- East & Southeast Asia ---
    "Beijing": (39.9042, 116.4074),
    "Peking": (39.9042, 116.4074),
    "Shanghai": (31.2304, 121.4737),
    "Hong Kong": (22.3193, 114.1694),
    "Guangzhou": (23.1291, 113.2644),
    "Shenzhen": (22.5431, 114.0579),
    "Chengdu": (30.5728, 104.0668),
    "Wuhan": (30.5928, 114.3055),
    "Xian": (34.3416, 108.9398),
    "Nanjing": (32.0603, 118.7969),
    "Chongqing": (29.4316, 106.9123),
    "Urumqi": (43.8256, 87.6168),
    "Lhasa": (29.6520, 91.1721),
    "Taipei": (25.0330, 121.5654),
    "Tokyo": (35.6762, 139.6503),
    "Osaka": (34.6937, 135.5023),
    "Hiroshima": (34.3853, 132.4553),
    "Seoul": (37.5665, 126.9780),
    "Busan": (35.1796, 129.0756),
    "Pyongyang": (39.0392, 125.7625),
    "Wonsan": (39.1529, 127.4436),
    "Bangkok": (13.7563, 100.5018),
    "Chiang Mai": (18.7883, 98.9853),
    "Hanoi": (21.0285, 105.8542),
    "Ho Chi Minh City": (10.8231, 106.6297),
    "Saigon": (10.8231, 106.6297),
    "Da Nang": (16.0544, 108.2022),
    "Phnom Penh": (11.5564, 104.9282),
    "Siem Reap": (13.3671, 103.8448),
    "Vientiane": (17.9757, 102.6331),
    "Naypyidaw": (19.7633, 96.0785),
    "Yangon": (16.8661, 96.1951),
    "Rangoon": (16.8661, 96.1951),
    "Mandalay": (21.9588, 96.0891),
    "Myitkyina": (25.3824, 97.3965),
    "Sagaing": (21.8861, 95.9808),
    "Singapore": (1.3521, 103.8198),
    "Kuala Lumpur": (3.1390, 101.6869),
    "Johor Bahru": (1.4927, 103.7414),
    "Jakarta": (-6.2088, 106.8456),
    "Surabaya": (-7.2575, 112.7521),
    "Medan": (3.5952, 98.6722),
    "Bandung": (-6.9175, 107.6191),
    "Makassar": (-5.1477, 119.4327),
    "Aceh": (4.6951, 96.7494),
    "Papua": (-4.2699, 138.0804),
    "Manila": (14.5995, 120.9842),
    "Cebu": (10.3157, 123.8854),
    "Davao": (7.1907, 125.4553),
    "Marawi": (7.9986, 124.2928),
    "Ulaanbaatar": (47.8864, 106.9057),
    # --- Americas ---
    "New York": (40.7128, -74.0060),
    "Washington DC": (38.9072, -77.0369),
    "Washington": (38.9072, -77.0369),
    "Los Angeles": (34.0522, -118.2437),
    "Chicago": (41.8781, -87.6298),
    "Miami": (25.7617, -80.1918),
    "Houston": (29.7604, -95.3698),
    "Phoenix": (33.4484, -112.0740),
    "Dallas": (32.7767, -96.7970),
    "San Francisco": (37.7749, -122.4194),
    "Seattle": (47.6062, -122.3321),
    "Boston": (42.3601, -71.0589),
    "Atlanta": (33.7490, -84.3880),
    "Denver": (39.7392, -104.9903),
    "Toronto": (43.6532, -79.3832),
    "Montreal": (45.5017, -73.5673),
    "Vancouver": (49.2827, -123.1207),
    "Ottawa": (45.4215, -75.6972),
    "Mexico City": (19.4326, -99.1332),
    "Guadalajara": (20.6597, -103.3496),
    "Monterrey": (25.6866, -100.3161),
    "Bogota": (4.7110, -74.0721),
    "Medellin": (6.2476, -75.5659),
    "Cali": (3.4516, -76.5320),
    "Caracas": (10.4806, -66.9036),
    "Maracaibo": (10.6544, -71.6422),
    "Lima": (-12.0464, -77.0428),
    "Santiago": (-33.4489, -70.6693),
    "Buenos Aires": (-34.6037, -58.3816),
    "Cordoba": (-31.4201, -64.1888),
    "Sao Paulo": (-23.5505, -46.6333),
    "Rio de Janeiro": (-22.9068, -43.1729),
    "Brasilia": (-15.7801, -47.9292),
    "Recife": (-8.0476, -34.8770),
    "Fortaleza": (-3.7172, -38.5434),
    "Havana": (23.1136, -82.3666),
    "Port-au-Prince": (18.5944, -72.3074),
    "Santo Domingo": (18.4861, -69.9312),
    "Tegucigalpa": (14.0723, -87.2027),
    "Managua": (12.1364, -86.2514),
    "Guatemala City": (14.6349, -90.5069),
    "San Salvador": (13.6929, -89.2182),
    "San Jose": (9.9281, -84.0907),
    "Panama City": (8.9936, -79.5197),
    "Quito": (-0.1807, -78.4678),
    "Guayaquil": (-2.1894, -79.8891),
    "La Paz": (-16.5000, -68.1500),
    "Santa Cruz": (-17.7863, -63.1812),
    "Asuncion": (-25.2867, -57.6470),
    "Montevideo": (-34.9011, -56.1645),
    "Georgetown": (6.8013, -58.1551),
    "Port of Spain": (10.6549, -61.5019),
    "Kingston": (17.9970, -76.7936),
    # --- Oceania ---
    "Sydney": (-33.8688, 151.2093),
    "Melbourne": (-37.8136, 144.9631),
    "Brisbane": (-27.4698, 153.0251),
    "Perth": (-31.9505, 115.8605),
    "Canberra": (-35.2809, 149.1300),
    "Auckland": (-36.8485, 174.7633),
    "Wellington": (-41.2865, 174.7762),
    "Port Moresby": (-9.4438, 147.1803),
    "Suva": (-18.1248, 178.4501),
    "Dili": (-8.5586, 125.5736),
}

# =============================================================================
# COUNTRY COORDINATES MAPPING (fallback when no city found)
# =============================================================================
COUNTRY_COORDS: Dict[str, tuple] = {
    "Afghanistan": (33.93, 67.71), "Albania": (41.15, 20.17), "Algeria": (28.03, 1.66),
    "Angola": (-11.20, 17.87), "Argentina": (-38.42, -63.62), "Armenia": (40.07, 45.04),
    "Australia": (-25.27, 133.78), "Austria": (47.52, 14.55), "Azerbaijan": (40.14, 47.58),
    "Bahrain": (26.04, 50.53), "Bangladesh": (23.68, 90.35), "Belarus": (53.71, 27.95),
    "Belgium": (50.50, 4.47), "Bolivia": (-16.29, -63.59), "Bosnia": (43.92, 17.68),
    "Brazil": (-14.24, -51.93), "Bulgaria": (42.73, 25.49), "Burkina Faso": (12.36, -1.53),
    "Cambodia": (12.57, 104.99), "Cameroon": (3.85, 11.52), "Canada": (56.13, -106.35),
    "Central African Republic": (6.61, 20.94), "Chad": (15.45, 18.73), "Chile": (-35.68, -71.54),
    "China": (35.86, 104.20), "Colombia": (4.57, -74.30), "Congo": (-0.23, 15.83),
    "Democratic Republic of Congo": (-4.04, 21.76), "DRC": (-4.04, 21.76), "Croatia": (45.10, 15.20),
    "Cuba": (21.52, -79.37), "Cyprus": (35.13, 33.43), "Czech Republic": (49.82, 15.47),
    "Denmark": (56.26, 9.50), "Ecuador": (-1.83, -78.18), "Egypt": (26.82, 30.80),
    "El Salvador": (13.79, -88.90), "Eritrea": (15.18, 39.78), "Estonia": (58.60, 25.01),
    "Ethiopia": (9.15, 40.49), "Finland": (61.92, 25.75), "France": (46.23, 2.21),
    "Gabon": (-0.80, 11.61), "Georgia": (41.69, 44.03), "Germany": (51.17, 10.45),
    "Ghana": (7.95, -1.02), "Greece": (39.07, 21.82), "Guatemala": (15.78, -90.23),
    "Guinea": (9.95, -11.24), "Haiti": (18.97, -72.29), "Honduras": (15.20, -86.24),
    "Hungary": (47.16, 19.50), "India": (20.59, 78.96), "Indonesia": (-0.79, 113.92),
    "Iran": (32.43, 53.69), "Iraq": (33.22, 43.68), "Ireland": (53.41, -8.24),
    "Israel": (31.05, 34.85), "Italy": (41.87, 12.57), "Japan": (36.20, 138.25),
    "Jordan": (30.59, 36.24), "Kazakhstan": (48.02, 66.92), "Kenya": (-0.02, 37.91),
    "Kosovo": (42.60, 20.90), "Kuwait": (29.31, 47.48), "Kyrgyzstan": (41.20, 74.77),
    "Laos": (19.86, 102.50), "Latvia": (56.88, 24.60), "Lebanon": (33.85, 35.86),
    "Libya": (26.34, 17.23), "Lithuania": (55.17, 23.88), "Madagascar": (-18.77, 46.87),
    "Malawi": (-13.25, 34.30), "Malaysia": (4.21, 101.98), "Mali": (17.57, -4.00),
    "Mauritania": (21.00, -10.94), "Mexico": (23.63, -102.55), "Moldova": (47.41, 28.37),
    "Mongolia": (46.86, 103.85), "Montenegro": (42.71, 19.37), "Morocco": (31.79, -7.09),
    "Mozambique": (-18.67, 35.53), "Myanmar": (21.92, 95.96), "Burma": (21.92, 95.96),
    "Namibia": (-22.96, 18.49), "Nepal": (28.39, 84.12), "Netherlands": (52.13, 5.29),
    "New Zealand": (-40.90, 174.89), "Nicaragua": (12.87, -85.21), "Niger": (17.61, 8.08),
    "Nigeria": (9.08, 8.68), "North Korea": (40.34, 127.51), "North Macedonia": (41.61, 21.74),
    "Norway": (60.47, 8.47), "Oman": (21.51, 55.92), "Pakistan": (30.38, 69.35),
    "Palestine": (31.95, 35.23), "Gaza": (31.35, 34.31), "West Bank": (31.95, 35.20),
    "Panama": (8.54, -80.78), "Papua New Guinea": (-6.31, 143.96), "Paraguay": (-23.44, -58.44),
    "Peru": (-9.19, -75.02), "Philippines": (12.88, 121.77), "Poland": (51.92, 19.15),
    "Portugal": (39.40, -8.22), "Qatar": (25.35, 51.18), "Romania": (45.94, 24.97),
    "Russia": (61.52, 105.32), "Rwanda": (-1.94, 29.87), "Saudi Arabia": (23.89, 45.08),
    "Senegal": (14.50, -14.45), "Serbia": (44.02, 21.01), "Sierra Leone": (8.46, -11.78),
    "Somalia": (5.15, 46.20), "South Africa": (-30.56, 22.94), "South Korea": (35.91, 127.77),
    "South Sudan": (7.87, 29.87), "Spain": (40.46, -3.75), "Sri Lanka": (7.87, 80.77),
    "Sudan": (12.86, 30.22), "Sweden": (60.13, 18.64), "Switzerland": (46.82, 8.23),
    "Syria": (34.80, 38.10), "Taiwan": (23.70, 121.00), "Tajikistan": (38.86, 71.28),
    "Tanzania": (-6.37, 34.89), "Thailand": (15.87, 100.99), "Tunisia": (33.89, 9.54),
    "Turkey": (38.96, 35.24), "Turkmenistan": (38.97, 59.56), "Uganda": (1.37, 32.29),
    "Ukraine": (48.38, 31.17), "United Arab Emirates": (23.42, 53.85), "UAE": (23.42, 53.85),
    "United Kingdom": (55.38, -3.44), "UK": (55.38, -3.44), "Britain": (55.38, -3.44),
    "United States": (37.09, -95.71), "USA": (37.09, -95.71), "America": (37.09, -95.71),
    "Uruguay": (-32.52, -55.77), "Uzbekistan": (41.38, 64.59), "Venezuela": (6.42, -66.59),
    "Vietnam": (14.06, 108.28), "Yemen": (15.55, 48.52), "Zambia": (-13.13, 27.85),
    "Zimbabwe": (-19.02, 29.15), "Europe": (54.53, 15.26), "Africa": (8.78, 34.51),
    "Asia": (34.05, 100.62), "Middle East": (29.31, 42.46), "Global": (20.00, 0.00),
    "International": (20.00, 0.00), "Sahel": (15.00, 3.00), "East Africa": (-1.00, 36.00),
    "West Africa": (12.00, -2.00), "Horn of Africa": (8.00, 44.00), "Central Africa": (-2.00, 23.00),
    "Southeast Asia": (5.00, 115.00), "Central Asia": (43.00, 68.00), "South America": (-15.00, -60.00),
    "Central America": (14.00, -87.00), "Caribbean": (18.00, -72.00), "North Africa": (25.00, 15.00),
    "Eastern Europe": (52.00, 30.00), "Western Europe": (48.00, 5.00), "Balkans": (44.00, 20.00),
    "Caucasus": (42.00, 45.00), "South Asia": (25.00, 78.00),
}

# =============================================================================
# EXPANDED RSS FEED SOURCES (45+ sources covering all regions)
# =============================================================================
RSS_FEEDS = [
    # --- Global ---
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "source": "BBC World", "credibility": "high", "region": "global"},
    {"url": "https://www.aljazeera.com/xml/rss/all.xml", "source": "Al Jazeera", "credibility": "high", "region": "global"},
    {"url": "https://www.france24.com/en/rss", "source": "France 24", "credibility": "high", "region": "global"},
    {"url": "https://rss.dw.com/xml/rss-en-world", "source": "Deutsche Welle", "credibility": "high", "region": "global"},
    {"url": "https://www.voanews.com/rss/world", "source": "VOA News", "credibility": "high", "region": "global"},
    {"url": "https://news.un.org/feed/subscribe/en/news/all/rss.xml", "source": "UN News", "credibility": "high", "region": "global"},
    {"url": "https://www.theguardian.com/world/rss", "source": "The Guardian", "credibility": "high", "region": "global"},
    {"url": "https://feeds.skynews.com/feeds/rss/world.xml", "source": "Sky News", "credibility": "high", "region": "global"},
    {"url": "https://reliefweb.int/updates/rss.xml", "source": "ReliefWeb", "credibility": "high", "region": "humanitarian"},
    {"url": "https://feeds.npr.org/1004/rss.xml", "source": "NPR World", "credibility": "high", "region": "global"},
    {"url": "https://www.euronews.com/rss?format=mrss&level=theme&name=news", "source": "Euronews", "credibility": "high", "region": "europe"},
    {"url": "https://abcnews.go.com/abcnews/internationalheadlines", "source": "ABC News", "credibility": "medium", "region": "global"},
    # --- BBC Regional ---
    {"url": "https://feeds.bbci.co.uk/news/world/africa/rss.xml", "source": "BBC Africa", "credibility": "high", "region": "africa"},
    {"url": "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", "source": "BBC Middle East", "credibility": "high", "region": "middle_east"},
    {"url": "https://feeds.bbci.co.uk/news/world/south_asia/rss.xml", "source": "BBC South Asia", "credibility": "high", "region": "south_asia"},
    {"url": "https://feeds.bbci.co.uk/news/world/asia/rss.xml", "source": "BBC Asia", "credibility": "high", "region": "asia"},
    {"url": "https://feeds.bbci.co.uk/news/world/europe/rss.xml", "source": "BBC Europe", "credibility": "high", "region": "europe"},
    {"url": "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", "source": "BBC Latin America", "credibility": "high", "region": "latin_america"},
    {"url": "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", "source": "BBC US & Canada", "credibility": "high", "region": "north_america"},
    # --- VOA Regional ---
    {"url": "https://www.voanews.com/rss/africa", "source": "VOA Africa", "credibility": "high", "region": "africa"},
    {"url": "https://www.voanews.com/rss/middleeast", "source": "VOA Middle East", "credibility": "high", "region": "middle_east"},
    {"url": "https://www.voanews.com/rss/eastasia", "source": "VOA East Asia", "credibility": "high", "region": "asia"},
    {"url": "https://www.voanews.com/rss/southasia", "source": "VOA South Asia", "credibility": "high", "region": "south_asia"},
    {"url": "https://www.voanews.com/rss/europe", "source": "VOA Europe", "credibility": "high", "region": "europe"},
    # --- Al Jazeera Regional ---
    {"url": "https://www.aljazeera.com/xml/rss/africa.xml", "source": "Al Jazeera Africa", "credibility": "high", "region": "africa"},
    {"url": "https://www.aljazeera.com/xml/rss/middleeast.xml", "source": "Al Jazeera Middle East", "credibility": "high", "region": "middle_east"},
    {"url": "https://www.aljazeera.com/xml/rss/asia.xml", "source": "Al Jazeera Asia", "credibility": "high", "region": "asia"},
    # --- Middle East Specialized ---
    {"url": "https://www.middleeasteye.net/rss", "source": "Middle East Eye", "credibility": "high", "region": "middle_east"},
    {"url": "https://www.arabnews.com/rss.xml", "source": "Arab News", "credibility": "medium", "region": "middle_east"},
    {"url": "https://www.timesofisrael.com/feed/", "source": "Times of Israel", "credibility": "medium", "region": "middle_east"},
    {"url": "https://www.jpost.com/Rss/RssFeedsHeadlines.aspx", "source": "Jerusalem Post", "credibility": "medium", "region": "middle_east"},
    # --- Africa Specialized ---
    {"url": "https://www.punchng.com/feed/", "source": "Punch Nigeria", "credibility": "medium", "region": "africa"},
    {"url": "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", "source": "AllAfrica", "credibility": "medium", "region": "africa"},
    {"url": "https://rss.dw.com/xml/rss-en-africa", "source": "DW Africa", "credibility": "high", "region": "africa"},
    # --- Asia Pacific ---
    {"url": "https://www3.nhk.or.jp/rss/news/cat0.xml", "source": "NHK World", "credibility": "high", "region": "asia"},
    {"url": "https://feeds.feedburner.com/ndtvnews-world-news", "source": "NDTV World", "credibility": "medium", "region": "south_asia"},
    {"url": "https://www.dawn.com/feeds/home", "source": "Dawn Pakistan", "credibility": "high", "region": "south_asia"},
    {"url": "https://rss.dw.com/xml/rss-en-asia", "source": "DW Asia", "credibility": "high", "region": "asia"},
    # --- Europe/Russia/Ukraine ---
    {"url": "https://rss.dw.com/xml/rss-en-eu", "source": "DW Europe", "credibility": "high", "region": "europe"},
    {"url": "https://kyivindependent.com/feed/", "source": "Kyiv Independent", "credibility": "high", "region": "europe"},
    # --- Latin America ---
    {"url": "https://en.mercopress.com/rss/news/all.rss", "source": "MercoPress", "credibility": "medium", "region": "latin_america"},
    # --- Conflict & Humanitarian Specialized ---
    {"url": "https://www.rfi.fr/en/rss", "source": "RFI English", "credibility": "high", "region": "global"},
    {"url": "https://www.crisisgroup.org/rss", "source": "Crisis Group", "credibility": "high", "region": "global"},
    {"url": "https://www.unhcr.org/news/rss.xml", "source": "UNHCR", "credibility": "high", "region": "humanitarian"},
    {"url": "https://www.msf.org/rss.xml", "source": "MSF", "credibility": "high", "region": "humanitarian"},
]

# =============================================================================
# MODELS
# =============================================================================
class NewsItemCreate(BaseModel):
    title: str
    summary: str
    url: str = ""
    source: str = "Manual"
    source_credibility: str = "medium"
    published_at: Optional[str] = None
    lat: float = 0.0
    lon: float = 0.0
    country: str = "Global"
    region: str = "Global"
    tags: List[str] = []
    confidence_score: float = 0.7
    confidence_level: str = "probable"
    threat_level: str = "elevated"
    actor_type: str = "state"
    sub_category: Optional[str] = None
    category: str = "security"

class NewsItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    title: str
    summary: str
    url: str = ""
    source: str = "Manual"
    source_credibility: str = "medium"
    published_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    lat: float = 0.0
    lon: float = 0.0
    country: str = "Global"
    city: str = ""
    region: str = "Global"
    tags: List[str] = []
    confidence_score: float = 0.7
    confidence_level: str = "probable"
    threat_level: str = "elevated"
    actor_type: str = "state"
    sub_category: Optional[str] = None
    category: str = "security"
    user_id: str = "system"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FetchStatus(BaseModel):
    is_fetching: bool = False
    last_fetch_time: Optional[str] = None
    last_fetch_count: int = 0
    total_items: int = 0
    sources_checked: int = 0

# =============================================================================
# GLOBAL STATE
# =============================================================================
fetch_status = FetchStatus()
sse_clients: List[asyncio.Queue] = []
_last_nominatim_time: float = 0.0

# =============================================================================
# CITY-LEVEL LOCATION EXTRACTION
# =============================================================================
# Pre-sort cities by name length (longest first) to match "New York" before "York"
_SORTED_CITIES = sorted(CITY_COORDS.items(), key=lambda x: len(x[0]), reverse=True)

def extract_city_from_text(title: str, summary: str = "") -> Optional[Tuple[str, float, float]]:
    """Extract the most specific city location from article text.
    Returns (city_name, lat, lon) or None."""
    # Search title first (more precise), then summary
    for text in [title, summary]:
        text_lower = text.lower()
        for city_name, coords in _SORTED_CITIES:
            city_lower = city_name.lower()
            # Use word boundary pattern
            pattern = r'(?<![a-zA-Z])' + re.escape(city_lower) + r'(?![a-zA-Z])'
            if re.search(pattern, text_lower):
                # Add tiny random jitter so multiple events in same city don't overlap exactly
                lat = coords[0] + random.uniform(-0.08, 0.08)
                lon = coords[1] + random.uniform(-0.08, 0.08)
                return (city_name, round(lat, 4), round(lon, 4))
    return None

async def geocode_with_nominatim(location: str, http_client: httpx.AsyncClient) -> Optional[Tuple[float, float]]:
    """Geocode a location using Nominatim (OpenStreetMap) with MongoDB caching."""
    global _last_nominatim_time
    if not location or location.strip() in ("Global", "International", ""):
        return None
    # Check cache first
    try:
        cached = await db.geocode_cache.find_one({"location": location.lower()})
        if cached and cached.get("lat") and cached.get("lon"):
            return (float(cached["lat"]), float(cached["lon"]))
    except Exception:
        pass
    # Rate limit: 1 request/second (Nominatim ToS)
    now = asyncio.get_event_loop().time()
    wait_time = 1.1 - (now - _last_nominatim_time)
    if wait_time > 0:
        await asyncio.sleep(wait_time)
    try:
        _last_nominatim_time = asyncio.get_event_loop().time()
        resp = await http_client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location, "format": "json", "limit": 1},
            headers={"User-Agent": "IntelDashboard/2.0 (global-intel-tracker)"},
            timeout=8.0
        )
        if resp.status_code == 200:
            results = resp.json()
            if results:
                lat = float(results[0]["lat"])
                lon = float(results[0]["lon"])
                # Cache result
                await db.geocode_cache.update_one(
                    {"location": location.lower()},
                    {"$set": {"lat": lat, "lon": lon, "display_name": results[0].get("display_name", ""),
                              "cached_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True
                )
                return (lat, lon)
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for '{location}': {e}")
    return None

# =============================================================================
# AI ENRICHMENT
# =============================================================================
ENRICHMENT_SYSTEM_PROMPT = """You are a professional intelligence analyst. Analyze news articles and classify them.

Return ONLY a JSON object with these exact fields (no markdown, no extra text):
{
  "category": "one of: security, conflict, diplomacy, economy, humanitarian, technology",
  "threat_level": "one of: critical, high, elevated, low",
  "country": "primary country name (English, or 'Global')",
  "city": "most specific city or location mentioned (exact name, or empty string if none)",
  "region": "geographic region (Middle East, Eastern Europe, Sub-Saharan Africa, South Asia, East Asia, Southeast Asia, Central Asia, North Africa, West Africa, East Africa, Horn of Africa, Sahel, Balkans, Caucasus, Caribbean, South America, Central America, North America, Western Europe, Global)",
  "actor_type": "one of: state, non_state, igo, hybrid",
  "tags": ["3 to 5 specific keyword tags"],
  "confidence_level": "one of: confirmed, probable, possible, unconfirmed",
  "confidence_score": 0.0
}

Guidelines:
- threat_level 'critical': mass casualties, WMD, major infrastructure attacks
- threat_level 'high': significant violence, major political crisis, large-scale displacement
- threat_level 'elevated': ongoing tensions, moderate incidents, concerning developments
- threat_level 'low': diplomatic meetings, routine politics, minor incidents
- city: be VERY specific - if article mentions 'protests in Karachi', set city to 'Karachi'
- If location is a neighborhood or district, use the parent city
- confidence_score: 0.9=official verified, 0.7=reliable outlet, 0.5=single source, 0.3=unverified"""

async def enrich_article(title: str, summary: str, source: str, http_client: Optional[httpx.AsyncClient] = None) -> dict:
    """Use LLM to classify and enrich a news article, then geocode to city level."""
    # Step 1: Try city extraction from text (fast, no API)
    city_match = extract_city_from_text(title, summary)
    
    try:
        if not EMERGENT_LLM_KEY:
            result = _rule_based_enrichment(title, summary)
        else:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"enrich-{uuid.uuid4()}",
                system_message=ENRICHMENT_SYSTEM_PROMPT
            ).with_model("openai", "gpt-4.1-mini")
            
            prompt = f"""Analyze this news article:
Title: {title[:300]}
Content: {summary[:500]}
Source: {source}

Return JSON only."""
            response = await chat.send_message(UserMessage(text=prompt))
            clean_response = response.strip()
            if clean_response.startswith('```'):
                clean_response = re.sub(r'```(?:json)?\n?', '', clean_response)
                clean_response = clean_response.rstrip('`').strip()
            data = json.loads(clean_response)
            
            category = data.get("category", "security")
            if category not in ["security", "conflict", "diplomacy", "economy", "humanitarian", "technology"]:
                category = "security"
            threat_level = data.get("threat_level", "low")
            if threat_level not in ["critical", "high", "elevated", "low"]:
                threat_level = "low"
            actor_type = data.get("actor_type", "state")
            if actor_type not in ["state", "non_state", "igo", "hybrid"]:
                actor_type = "state"
            confidence_level = data.get("confidence_level", "probable")
            if confidence_level not in ["confirmed", "probable", "possible", "unconfirmed"]:
                confidence_level = "probable"
            confidence_score = float(data.get("confidence_score", 0.6))
            tags = data.get("tags", [])
            if not isinstance(tags, list):
                tags = []
            tags = [str(t) for t in tags[:5]]
            
            country = data.get("country", "Global")
            ai_city = data.get("city", "").strip()
            region = data.get("region", "Global")
            result = {
                "category": category, "threat_level": threat_level,
                "country": country, "city": ai_city, "region": region,
                "actor_type": actor_type, "tags": tags,
                "confidence_level": confidence_level,
                "confidence_score": round(min(max(confidence_score, 0.0), 1.0), 2),
            }
    except Exception as e:
        logger.warning(f"AI enrichment failed: {e}")
        result = _rule_based_enrichment(title, summary)
    
    # Step 2: Determine best coordinates (city > text extraction > country)
    lat, lon = 20.0, 0.0
    resolved_city = ""
    
    if city_match:
        # City found directly in text (most precise)
        resolved_city = city_match[0]
        lat, lon = city_match[1], city_match[2]
    else:
        ai_city = result.get("city", "").strip()
        if ai_city and ai_city not in ("Global", "International", ""):
            # Try our city database first
            city_lower = ai_city.lower()
            db_match = None
            for name, coords in CITY_COORDS.items():
                if name.lower() == city_lower:
                    db_match = (name, coords[0], coords[1])
                    break
            if db_match:
                resolved_city = db_match[0]
                lat = db_match[1] + random.uniform(-0.08, 0.08)
                lon = db_match[2] + random.uniform(-0.08, 0.08)
            elif http_client:
                # Try Nominatim for unknown cities
                geo = await geocode_with_nominatim(ai_city, http_client)
                if geo:
                    resolved_city = ai_city
                    lat = geo[0] + random.uniform(-0.05, 0.05)
                    lon = geo[1] + random.uniform(-0.05, 0.05)
                else:
                    # Fall back to country
                    country = result.get("country", "Global")
                    coords = COUNTRY_COORDS.get(country, COUNTRY_COORDS.get(result.get("region", "Global"), (20.0, 0.0)))
                    lat = coords[0] + random.uniform(-1.5, 1.5)
                    lon = coords[1] + random.uniform(-1.5, 1.5)
            else:
                country = result.get("country", "Global")
                coords = COUNTRY_COORDS.get(country, (20.0, 0.0))
                lat = coords[0] + random.uniform(-1.5, 1.5)
                lon = coords[1] + random.uniform(-1.5, 1.5)
        else:
            # No city - use country coordinates
            country = result.get("country", "Global")
            coords = COUNTRY_COORDS.get(country, COUNTRY_COORDS.get(result.get("region", "Global"), (20.0, 0.0)))
            lat = coords[0] + random.uniform(-1.5, 1.5)
            lon = coords[1] + random.uniform(-1.5, 1.5)
    
    result["lat"] = round(lat, 4)
    result["lon"] = round(lon, 4)
    result["city"] = resolved_city
    return result

def _rule_based_enrichment(title: str, summary: str) -> dict:
    """Fallback rule-based classification."""
    text = (title + " " + summary).lower()
    category = "security"
    if any(w in text for w in ["war", "battle", "troops", "casualties", "fighting", "siege", "ceasefire", "offensive", "airstrike", "bombing", "shelling"]):
        category = "conflict"
    elif any(w in text for w in ["diplomatic", "summit", "sanctions", "embassy", "treaty", "agreement", "negotiate", "minister visited"]):
        category = "diplomacy"
    elif any(w in text for w in ["economy", "gdp", "trade", "market", "inflation", "recession", "oil price", "financial", "currency"]):
        category = "economy"
    elif any(w in text for w in ["refugees", "humanitarian", "disaster", "flood", "earthquake", "famine", "displaced", "relief", "aid", "drought"]):
        category = "humanitarian"
    elif any(w in text for w in ["cyber", "artificial intelligence", "drone technology", "surveillance", "hacking", "malware"]):
        category = "technology"
    threat_level = "low"
    if any(w in text for w in ["killed", "dead", "casualties", "massacre", "mass grave", "genocide", "nuclear", "chemical weapon", "explosion", "bombing"]):
        threat_level = "critical"
    elif any(w in text for w in ["attack", "conflict", "fighting", "war", "troops", "offensive", "battle", "airstrike", "crisis", "shelling"]):
        threat_level = "high"
    elif any(w in text for w in ["tension", "threat", "protest", "demonstration", "unrest", "concern", "warning", "election"]):
        threat_level = "elevated"
    country = "Global"
    for country_name in COUNTRY_COORDS.keys():
        if country_name.lower() in text and country_name not in ["Europe", "Africa", "Asia", "Global", "International"]:
            country = country_name
            break
    tags = []
    for tag, keywords in {"conflict": ["war", "conflict", "military"], "security": ["security", "attack", "terror"], "diplomacy": ["diplomatic", "summit", "sanctions"], "economy": ["economy", "trade", "financial"], "humanitarian": ["humanitarian", "refugees", "aid"]}.items():
        if any(k in text for k in keywords):
            tags.append(tag)
    if not tags:
        tags = ["global", "news", "intelligence"]
    return {
        "category": category, "threat_level": threat_level,
        "country": country, "city": "", "region": "Global",
        "actor_type": "state", "tags": tags[:5],
        "confidence_level": "probable", "confidence_score": 0.65,
    }

# =============================================================================
# RSS FETCHER
# =============================================================================
async def fetch_rss_feed(feed_info: dict, http_client: httpx.AsyncClient) -> List[dict]:
    """Fetch and parse a single RSS feed."""
    items = []
    try:
        response = await http_client.get(feed_info["url"], timeout=15.0, follow_redirects=True)
        if response.status_code == 200:
            feed = feedparser.parse(response.content)
            for entry in feed.entries[:12]:  # Max 12 per feed
                title = entry.get("title", "").strip()
                summary = entry.get("summary", entry.get("description", "")).strip()
                summary = re.sub(r'<[^>]+>', '', summary).strip()
                summary = re.sub(r'\s+', ' ', summary).strip()
                url = entry.get("link", "").strip()
                published_at = datetime.now(timezone.utc).isoformat()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        import time
                        published_at = datetime.fromtimestamp(time.mktime(entry.published_parsed), tz=timezone.utc).isoformat()
                    except Exception:
                        pass
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    try:
                        import time
                        published_at = datetime.fromtimestamp(time.mktime(entry.updated_parsed), tz=timezone.utc).isoformat()
                    except Exception:
                        pass
                if title and len(title) > 10:
                    items.append({
                        "title": title[:300],
                        "summary": summary[:800] if summary else title,
                        "url": url,
                        "source": feed_info["source"],
                        "source_credibility": feed_info["credibility"],
                        "published_at": published_at,
                    })
    except Exception as e:
        logger.warning(f"Failed to fetch {feed_info['source']}: {e}")
    return items

async def fetch_and_store_news() -> dict:
    """Main news fetching function."""
    global fetch_status
    if fetch_status.is_fetching:
        return {"success": False, "message": "Fetch already in progress"}
    fetch_status.is_fetching = True
    logger.info("Starting news fetch from all sources...")
    try:
        all_raw_items = []
        sources_checked = 0
        async with httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (compatible; IntelDashboard/2.0)"},
            timeout=20.0
        ) as http_client:
            tasks = [fetch_rss_feed(feed, http_client) for feed in RSS_FEEDS]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, list):
                    all_raw_items.extend(result)
                    sources_checked += 1
                else:
                    logger.warning(f"Feed {RSS_FEEDS[i]['source']} failed: {result}")
            
            logger.info(f"Fetched {len(all_raw_items)} raw articles from {sources_checked} sources")
            
            # Check existing URLs to avoid duplicates
            existing_urls = set()
            async for item in db.news_items.find({}, {"url": 1}):
                if item.get("url"):
                    existing_urls.add(item["url"])
            new_items = [item for item in all_raw_items if item["url"] not in existing_urls and item["url"]]
            
            # Only last 72 hours
            cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
            recent_items = []
            for item in new_items:
                try:
                    pub_dt = datetime.fromisoformat(item["published_at"].replace('Z', '+00:00'))
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    if pub_dt > cutoff:
                        recent_items.append(item)
                except Exception:
                    recent_items.append(item)
            
            logger.info(f"Found {len(recent_items)} new articles to process")
            items_to_process = recent_items[:25]  # Process up to 25 per fetch
            
            inserted_count = 0
            batch_size = 5
            for i in range(0, len(items_to_process), batch_size):
                batch = items_to_process[i:i+batch_size]
                tasks = [enrich_article(item["title"], item["summary"], item["source"], http_client) for item in batch]
                enrichments = await asyncio.gather(*tasks, return_exceptions=True)
                for item, enrichment in zip(batch, enrichments):
                    if isinstance(enrichment, Exception):
                        enrichment = _rule_based_enrichment(item["title"], item["summary"])
                    news_item = {
                        "id": str(uuid.uuid4()),
                        "token": str(uuid.uuid4())[:8].upper(),
                        "title": item["title"],
                        "summary": item["summary"],
                        "url": item["url"],
                        "source": item["source"],
                        "source_credibility": item.get("source_credibility", "medium"),
                        "published_at": item["published_at"],
                        "lat": enrichment.get("lat", 0.0),
                        "lon": enrichment.get("lon", 0.0),
                        "country": enrichment.get("country", "Global"),
                        "city": enrichment.get("city", ""),
                        "region": enrichment.get("region", "Global"),
                        "tags": enrichment.get("tags", []),
                        "confidence_score": enrichment.get("confidence_score", 0.6),
                        "confidence_level": enrichment.get("confidence_level", "probable"),
                        "threat_level": enrichment.get("threat_level", "low"),
                        "actor_type": enrichment.get("actor_type", "state"),
                        "sub_category": None,
                        "category": enrichment.get("category", "security"),
                        "user_id": "system",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    try:
                        await db.news_items.insert_one(news_item)
                        inserted_count += 1
                        news_item_clean = {k: v for k, v in news_item.items() if k != "_id"}
                        await broadcast_sse({"type": "new_item", "item": news_item_clean})
                    except Exception as e:
                        logger.error(f"Failed to insert news item: {e}")
        
        total_items = await db.news_items.count_documents({})
        fetch_status.last_fetch_time = datetime.now(timezone.utc).isoformat()
        fetch_status.last_fetch_count = inserted_count
        fetch_status.total_items = total_items
        fetch_status.sources_checked = sources_checked
        logger.info(f"Fetch complete: {inserted_count} new items, total: {total_items}")
        return {"success": True, "fetched": len(all_raw_items), "inserted": inserted_count, "sources_checked": sources_checked}
    except Exception as e:
        logger.error(f"News fetch error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        fetch_status.is_fetching = False

# =============================================================================
# SSE BROADCASTING
# =============================================================================
async def broadcast_sse(data: dict):
    if not sse_clients:
        return
    disconnected = []
    for q in sse_clients:
        try:
            await q.put(data)
        except Exception:
            disconnected.append(q)
    for q in disconnected:
        if q in sse_clients:
            sse_clients.remove(q)

# =============================================================================
# BACKGROUND FETCHER
# =============================================================================
async def background_news_fetcher():
    logger.info("Background news fetcher started")
    await asyncio.sleep(5)
    await fetch_and_store_news()
    while True:
        await asyncio.sleep(180)  # Every 3 minutes
        logger.info("Auto-fetching news...")
        await fetch_and_store_news()

# =============================================================================
# LIFESPAN
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.news_items.create_index("url", unique=True, sparse=True)
        await db.news_items.create_index([("published_at", -1)])
        await db.news_items.create_index("threat_level")
        await db.news_items.create_index("category")
        await db.news_items.create_index("country")
        await db.news_items.create_index("city")
        await db.geocode_cache.create_index("location", unique=True)
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    bg_task = asyncio.create_task(background_news_fetcher())
    logger.info("Background news fetcher task started")
    yield
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass
    client.close()

# =============================================================================
# FASTAPI APP
# =============================================================================
app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# NEWS ENDPOINTS
# =============================================================================
@api_router.get("/news", response_model=List[dict])
async def get_news(
    limit: int = Query(default=300, le=1000),
    offset: int = Query(default=0),
    category: Optional[str] = Query(default=None),
    threat_level: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    hours: Optional[int] = Query(default=None),
):
    query: Dict[str, Any] = {}
    if category:
        query["category"] = category
    if threat_level:
        query["threat_level"] = threat_level
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"summary": {"$regex": search, "$options": "i"}},
            {"country": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
            {"tags": {"$elemMatch": {"$regex": search, "$options": "i"}}},
        ]
    if hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query["published_at"] = {"$gte": cutoff.isoformat()}
    cursor = db.news_items.find(query, {"_id": 0}).sort("published_at", -1).skip(offset).limit(limit)
    items = await cursor.to_list(length=limit)
    return items

@api_router.get("/news/status")
async def get_news_status():
    total = await db.news_items.count_documents({})
    fetch_status.total_items = total
    return fetch_status.dict()

@api_router.post("/news/fetch")
async def trigger_news_fetch():
    result = await fetch_and_store_news()
    return result

@api_router.get("/news/stream")
async def news_stream():
    q: asyncio.Queue = asyncio.Queue()
    sse_clients.append(q)
    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Real-time stream connected'})}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat', 'time': datetime.now(timezone.utc).isoformat()})}\n\n"
        except (asyncio.CancelledError, Exception):
            pass
        finally:
            if q in sse_clients:
                sse_clients.remove(q)
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
    )

@api_router.get("/news/{item_id}", response_model=dict)
async def get_news_item(item_id: str):
    item = await db.news_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="News item not found")
    return item

@api_router.post("/news", response_model=dict)
async def create_news_item(item: NewsItemCreate):
    enrichment = {}
    if item.lat == 0.0 and item.lon == 0.0:
        enrichment = await enrich_article(item.title, item.summary, item.source)
    news_item = {
        "id": str(uuid.uuid4()),
        "token": str(uuid.uuid4())[:8].upper(),
        "title": item.title, "summary": item.summary,
        "url": item.url, "source": item.source,
        "source_credibility": item.source_credibility,
        "published_at": item.published_at or datetime.now(timezone.utc).isoformat(),
        "lat": enrichment.get("lat", item.lat), "lon": enrichment.get("lon", item.lon),
        "country": enrichment.get("country", item.country),
        "city": enrichment.get("city", ""),
        "region": enrichment.get("region", item.region),
        "tags": enrichment.get("tags", item.tags),
        "confidence_score": enrichment.get("confidence_score", item.confidence_score),
        "confidence_level": enrichment.get("confidence_level", item.confidence_level),
        "threat_level": enrichment.get("threat_level", item.threat_level),
        "actor_type": enrichment.get("actor_type", item.actor_type),
        "sub_category": item.sub_category, "category": enrichment.get("category", item.category),
        "user_id": "user", "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.news_items.insert_one(news_item)
    news_item_clean = {k: v for k, v in news_item.items() if k != "_id"}
    await broadcast_sse({"type": "new_item", "item": news_item_clean})
    return news_item_clean

@api_router.delete("/news/{item_id}")
async def delete_news_item(item_id: str):
    result = await db.news_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News item not found")
    await broadcast_sse({"type": "deleted_item", "id": item_id})
    return {"success": True, "id": item_id}

@api_router.get("/")
async def root():
    return {"message": "Intel Dashboard API v2", "status": "operational", "sources": len(RSS_FEEDS), "cities_indexed": len(CITY_COORDS)}

@api_router.post("/status")
async def create_status_check(data: dict):
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/status")
async def get_status():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)
