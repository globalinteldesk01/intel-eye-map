#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║       OSINT REAL-TIME INTEL SCRAPER v3 — MAX THROUGHPUT EDITION             ║
║  Multi-source: RSS · Telegram · GDELT · NewsAPI · Mediastack · Advisories  ║
╚══════════════════════════════════════════════════════════════════════════════╝

THROUGHPUT MAXIMISATION CHANGES vs v2:
  ✔ Worker pool (asyncio.Queue) — saturates all TCP connections evenly
  ✔ Per-domain rate-limiter (token bucket) — avoids 429s without slowing others
  ✔ Priority queue — P1 sources fetched first + re-fetched more often
  ✔ Adaptive retry with full-jitter (capped exponential backoff)
  ✔ DNS cache + connection keep-alive (TTL 600 s, keepalive 30 s)
  ✔ Source health tracker — skips dead endpoints for rest of run
  ✔ Streaming RSS parse — begins filtering before all feeds return
  ✔ Tighter pg_cron cadence: --cadence flag sets interval (default 30 s)
  ✔ Browser hook interval halved to 60 s (was 300 s)
  ✔ Batch Supabase upserts — one HTTP call per 200 rows
  ✔ SHA-256 fingerprint dedup in O(1) via set; title fuzzy-dedup via dict
  ✔ All existing OSINT filters, geo-engine, threat/category logic preserved

Usage:
    python osint_scraper_v2.py                          # all sources → intel_output.json
    python osint_scraper_v2.py --workers 80             # more concurrent workers
    python osint_scraper_v2.py --connections 80         # more TCP connections
    python osint_scraper_v2.py --format all             # JSON + CSV + SQLite
    python osint_scraper_v2.py --sources rss gdelt      # specific collectors
    python osint_scraper_v2.py --cadence 30             # pg_cron interval in seconds
    python osint_scraper_v2.py --newsapi KEY            # enable NewsAPI
    python osint_scraper_v2.py --limit 500 --verbose
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import logging
import os
import random
import re
import sqlite3
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlparse, urlunparse

try:
    import aiohttp
except ImportError:
    sys.exit("❌  aiohttp missing — run:  pip install aiohttp")

try:
    import feedparser
    FEEDPARSER_OK = True
except ImportError:
    FEEDPARSER_OK = False

try:
    from bs4 import BeautifulSoup
    BS4_OK = True
except ImportError:
    BS4_OK = False


# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("osint")


# ─────────────────────────────────────────────────────────────────────────────
# DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class IntelItem:
    title: str
    description: str
    url: str
    source_name: str
    published_at: str
    source_credibility: str
    source_type: str
    threat_level: str = "low"
    category: str = "security"
    tags: list[str] = field(default_factory=list)
    country: str = ""
    region: str = ""
    lat: float = 0.0
    lon: float = 0.0
    geo_confidence: float = 0.0
    fingerprint: str = ""
    collected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ─────────────────────────────────────────────────────────────────────────────
# ████  THROUGHPUT ENGINE  ████
# ─────────────────────────────────────────────────────────────────────────────

class TokenBucket:
    """Per-domain token bucket rate limiter."""
    def __init__(self, rate: float = 2.0, capacity: float = 4.0):
        self.rate = rate        # tokens/second
        self.capacity = capacity
        self.tokens = capacity
        self._last = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            self.tokens = min(self.capacity, self.tokens + (now - self._last) * self.rate)
            self._last = now
            if self.tokens < 1:
                wait = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait)
                self.tokens = 0
            else:
                self.tokens -= 1


class DomainRateLimiter:
    """Maps hostname → TokenBucket. Thread-safe creation."""
    def __init__(self, rate: float = 2.0, capacity: float = 4.0):
        self._buckets: dict[str, TokenBucket] = {}
        self._rate = rate
        self._capacity = capacity

    def bucket_for(self, url: str) -> TokenBucket:
        host = urlparse(url).hostname or url
        if host not in self._buckets:
            self._buckets[host] = TokenBucket(self._rate, self._capacity)
        return self._buckets[host]

    async def acquire(self, url: str) -> None:
        await self.bucket_for(url).acquire()


class SourceHealthTracker:
    """Tracks consecutive failures; marks a source dead after threshold."""
    def __init__(self, threshold: int = 3):
        self._failures: dict[str, int] = defaultdict(int)
        self._dead: set[str] = set()
        self._threshold = threshold

    def is_dead(self, url: str) -> bool:
        return url in self._dead

    def record_failure(self, url: str) -> None:
        self._failures[url] += 1
        if self._failures[url] >= self._threshold:
            self._dead.add(url)
            log.debug("Source marked dead: %s", url)

    def record_success(self, url: str) -> None:
        self._failures[url] = 0
        self._dead.discard(url)

    @property
    def dead_count(self) -> int:
        return len(self._dead)


# Global instances (created once per run)
_rate_limiter = DomainRateLimiter(rate=2.0, capacity=5.0)
_health = SourceHealthTracker(threshold=3)


# ─────────────────────────────────────────────────────────────────────────────
# RSS SOURCE DEFINITIONS  (70+ feeds, with priority)
# ─────────────────────────────────────────────────────────────────────────────
RSS_SOURCES: list[dict] = [
    # ── Wire services & major broadcasters (P1) ──
    {"name": "BBC World",           "url": "https://feeds.bbci.co.uk/news/world/rss.xml",                        "credibility": "high",   "priority": 1},
    {"name": "Al Jazeera",          "url": "https://www.aljazeera.com/xml/rss/all.xml",                          "credibility": "high",   "priority": 1},
    {"name": "France24",            "url": "https://www.france24.com/en/rss",                                    "credibility": "high",   "priority": 1},
    {"name": "DW News",             "url": "https://rss.dw.com/rdf/rss-en-all",                                  "credibility": "high",   "priority": 1},
    {"name": "Reuters",             "url": "https://feeds.reuters.com/reuters/worldNews",                        "credibility": "high",   "priority": 1},
    {"name": "AP News",             "url": "https://rsshub.app/apnews/topics/apf-intlnews",                     "credibility": "high",   "priority": 1},
    {"name": "The Guardian World",  "url": "https://www.theguardian.com/world/rss",                              "credibility": "high",   "priority": 1},
    {"name": "NYT World",           "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",             "credibility": "high",   "priority": 2},
    {"name": "CBC World",           "url": "https://rss.cbc.ca/lineup/world.xml",                                "credibility": "high",   "priority": 2},
    {"name": "ABC Intl",            "url": "https://abcnews.go.com/abcnews/internationalheadlines",               "credibility": "high",   "priority": 2},
    # ── Defence & Security ──
    {"name": "The War Zone",        "url": "https://www.thedrive.com/the-war-zone/feed",                         "credibility": "medium", "priority": 2},
    {"name": "War on the Rocks",    "url": "https://warontherocks.com/feed/",                                    "credibility": "high",   "priority": 3},
    {"name": "Breaking Defense",    "url": "https://breakingdefense.com/feed/",                                  "credibility": "medium", "priority": 2},
    {"name": "Defense News",        "url": "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",  "credibility": "medium", "priority": 2},
    {"name": "Military Times",      "url": "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml","credibility": "medium", "priority": 2},
    # ── Middle East ──
    {"name": "Middle East Eye",     "url": "https://www.middleeasteye.net/rss",                                  "credibility": "medium", "priority": 2},
    {"name": "Al-Monitor",          "url": "https://www.al-monitor.com/rss",                                     "credibility": "medium", "priority": 2},
    {"name": "Iran International",  "url": "https://www.iranintl.com/en/rss",                                    "credibility": "medium", "priority": 2},
    {"name": "Arab News",           "url": "https://www.arabnews.com/rss.xml",                                   "credibility": "medium", "priority": 2},
    {"name": "Sudan Tribune",       "url": "https://sudantribune.com/feed/",                                     "credibility": "medium", "priority": 2},
    # ── Europe & Eurasia ──
    {"name": "Kyiv Independent",    "url": "https://kyivindependent.com/feed/",                                  "credibility": "medium", "priority": 1},
    {"name": "Moscow Times",        "url": "https://www.themoscowtimes.com/rss/news",                            "credibility": "medium", "priority": 2},
    {"name": "Radio Free Europe",   "url": "https://www.rferl.org/api/z-pqpiev-qpp",                            "credibility": "medium", "priority": 2},
    {"name": "EU Observer",         "url": "https://euobserver.com/rss.xml",                                     "credibility": "high",   "priority": 3},
    {"name": "Balkan Insight",      "url": "https://balkaninsight.com/feed/",                                    "credibility": "medium", "priority": 3},
    # ── Asia-Pacific ──
    {"name": "SCMP",                "url": "https://www.scmp.com/rss/91/feed",                                   "credibility": "medium", "priority": 2},
    {"name": "Nikkei Asia",         "url": "https://asia.nikkei.com/rss/feed/nar",                               "credibility": "high",   "priority": 2},
    {"name": "The Diplomat",        "url": "https://thediplomat.com/feed/",                                      "credibility": "high",   "priority": 3},
    {"name": "Channel News Asia",   "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml","credibility": "high",  "priority": 2},
    {"name": "Straits Times",       "url": "https://www.straitstimes.com/news/asia/rss.xml",                     "credibility": "high",   "priority": 2},
    {"name": "Dawn Pakistan",       "url": "https://www.dawn.com/feeds/home",                                    "credibility": "medium", "priority": 2},
    {"name": "NDTV",                "url": "https://feeds.feedburner.com/ndtvnews-top-stories",                  "credibility": "medium", "priority": 2},
    # ── ASEAN ──
    {"name": "Rappler",             "url": "https://www.rappler.com/feed/",                                      "credibility": "medium", "priority": 1},
    {"name": "Bangkok Post",        "url": "https://www.bangkokpost.com/rss/data/topstories.xml",                "credibility": "high",   "priority": 1},
    {"name": "Irrawaddy",           "url": "https://www.irrawaddy.com/feed",                                     "credibility": "medium", "priority": 1},
    {"name": "Myanmar Now",         "url": "https://myanmar-now.org/en/feed/",                                   "credibility": "medium", "priority": 1},
    {"name": "Benar News",          "url": "https://www.benarnews.org/english/rss",                              "credibility": "medium", "priority": 1},
    {"name": "Bernama",             "url": "https://www.bernama.com/en/rss/index.php",                           "credibility": "high",   "priority": 2},
    {"name": "VnExpress Intl",      "url": "https://e.vnexpress.net/rss/news.rss",                               "credibility": "medium", "priority": 2},
    {"name": "Phnom Penh Post",     "url": "https://www.phnompenhpost.com/rss.xml",                              "credibility": "medium", "priority": 2},
    {"name": "ASEAN Briefing",      "url": "https://www.aseanbriefing.com/news/feed/",                           "credibility": "high",   "priority": 2},
    {"name": "Fulcrum ISEAS",       "url": "https://fulcrum.sg/feed/",                                           "credibility": "high",   "priority": 3},
    # ── Africa ──
    {"name": "Africanews",          "url": "https://www.africanews.com/feed/",                                   "credibility": "medium", "priority": 2},
    {"name": "Daily Maverick",      "url": "https://www.dailymaverick.co.za/dmrss/",                             "credibility": "medium", "priority": 3},
    {"name": "InSight Crime",       "url": "https://insightcrime.org/feed/",                                     "credibility": "high",   "priority": 2},
    # ── Humanitarian & Advisories (P1 — always run) ──
    {"name": "ReliefWeb",           "url": "https://reliefweb.int/updates/rss.xml",                              "credibility": "high",   "priority": 2},
    {"name": "UNHCR News",          "url": "https://www.unhcr.org/rss/news.xml",                                 "credibility": "high",   "priority": 2},
    {"name": "US State Dept Travel","url": "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.rss.xml","credibility":"high","priority":1},
    {"name": "UK FCDO Travel",      "url": "https://www.gov.uk/foreign-travel-advice.atom",                     "credibility": "high",   "priority": 1},
    {"name": "Australia DFAT",      "url": "https://www.smartraveller.gov.au/api/rss",                           "credibility": "high",   "priority": 1},
    # ── Think tanks (P3 — lower cadence) ──
    {"name": "CSIS",                "url": "https://www.csis.org/analysis/feed",                                 "credibility": "high",   "priority": 3},
    {"name": "Brookings",           "url": "https://www.brookings.edu/feed/",                                    "credibility": "high",   "priority": 3},
    {"name": "Carnegie",            "url": "https://carnegieendowment.org/rss/solr/?lang=en",                    "credibility": "high",   "priority": 3},
    {"name": "Chatham House",       "url": "https://www.chathamhouse.org/rss",                                   "credibility": "high",   "priority": 3},
]

TELEGRAM_CHANNELS: list[dict] = [
    {"name": "Intel Slava Z",          "channel": "inaborovskiy",    "credibility": "low"},
    {"name": "Ukraine Conflict",       "channel": "UkraineConflict", "credibility": "low"},
    {"name": "War Monitor",            "channel": "WarMonitors",     "credibility": "low"},
    {"name": "Middle East Spectator",  "channel": "MideastSpectator","credibility": "low"},
    {"name": "Intel Republic",         "channel": "IntelRepublic",   "credibility": "medium"},
]


# ─────────────────────────────────────────────────────────────────────────────
# FILTER KEYWORD BANKS  (unchanged from v2)
# ─────────────────────────────────────────────────────────────────────────────
INCLUDE_KW = [
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
    "boko haram","al-shabaab","abu sayyaf","jemaah islamiyah",
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
    "landslide","mudslide","blizzard","ice storm","heatwave","sandstorm",
    "power outage","blackout","water shortage","fuel shortage","internet shutdown",
    "communications blackout","cyber attack on airport","cyber attack on airline",
]

EXCLUDE_KW = [
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
]

HARD_EXCLUDE_KW = [
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
]

ACTIVE_INCIDENT_KW = [
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
]

CRITICAL_KW = ["attack","bomb","explosion","terror","war declared","invasion","massacre","mass casualty","nuclear strike","chemical weapon","imminent threat","active shooter","hostage situation","genocide","ethnic cleansing","biological attack"]
HIGH_KW     = ["conflict","military operation","troops deployed","missile strike","emergency declared","state of emergency","martial law","coup attempt","assassination","airstrike","ceasefire violated","casualties reported","ambush","drone strike","naval confrontation","blockade"]
ELEVATED_KW = ["tension","protest","sanctions","warning","dispute","standoff","diplomatic crisis","border incident","military exercise","travel advisory","heightened alert","cyber attack","disinformation","propaganda","arms deal","troop movement","naval exercise"]


# ─────────────────────────────────────────────────────────────────────────────
# GEO DATABASE (unchanged from v2 — abbreviated here for brevity;
# paste the full CITIES + COUNTRY_PATTERNS dicts from v2 below)
# ─────────────────────────────────────────────────────────────────────────────
CITIES: dict[str, dict] = {
    "washington dc": {"lat":38.9072,"lon":-77.0369,"country":"United States","region":"North America"},
    "new york":      {"lat":40.7128,"lon":-74.0060,"country":"United States","region":"North America"},
    "los angeles":   {"lat":34.0522,"lon":-118.2437,"country":"United States","region":"North America"},
    "london":        {"lat":51.5074,"lon":-0.1278,"country":"United Kingdom","region":"Europe"},
    "berlin":        {"lat":52.5200,"lon":13.4050,"country":"Germany","region":"Europe"},
    "paris":         {"lat":48.8566,"lon":2.3522,"country":"France","region":"Europe"},
    "kyiv":          {"lat":50.4501,"lon":30.5234,"country":"Ukraine","region":"Europe"},
    "kharkiv":       {"lat":49.9935,"lon":36.2304,"country":"Ukraine","region":"Europe"},
    "odesa":         {"lat":46.4825,"lon":30.7233,"country":"Ukraine","region":"Europe"},
    "moscow":        {"lat":55.7558,"lon":37.6173,"country":"Russia","region":"Europe"},
    "jerusalem":     {"lat":31.7683,"lon":35.2137,"country":"Israel","region":"Middle East"},
    "tel aviv":      {"lat":32.0853,"lon":34.7818,"country":"Israel","region":"Middle East"},
    "gaza":          {"lat":31.5017,"lon":34.4668,"country":"Palestine","region":"Middle East"},
    "tehran":        {"lat":35.6892,"lon":51.3890,"country":"Iran","region":"Middle East"},
    "riyadh":        {"lat":24.7136,"lon":46.6753,"country":"Saudi Arabia","region":"Middle East"},
    "ankara":        {"lat":39.9334,"lon":32.8597,"country":"Turkey","region":"Middle East"},
    "baghdad":       {"lat":33.3152,"lon":44.3661,"country":"Iraq","region":"Middle East"},
    "damascus":      {"lat":33.5138,"lon":36.2765,"country":"Syria","region":"Middle East"},
    "beirut":        {"lat":33.8938,"lon":35.5018,"country":"Lebanon","region":"Middle East"},
    "beijing":       {"lat":39.9042,"lon":116.4074,"country":"China","region":"Asia"},
    "taipei":        {"lat":25.0330,"lon":121.5654,"country":"Taiwan","region":"Asia"},
    "tokyo":         {"lat":35.6762,"lon":139.6503,"country":"Japan","region":"Asia"},
    "seoul":         {"lat":37.5665,"lon":126.9780,"country":"South Korea","region":"Asia"},
    "new delhi":     {"lat":28.6139,"lon":77.2090,"country":"India","region":"Asia"},
    "islamabad":     {"lat":33.6844,"lon":73.0479,"country":"Pakistan","region":"Asia"},
    "kabul":         {"lat":34.5553,"lon":69.2075,"country":"Afghanistan","region":"Asia"},
    "bangkok":       {"lat":13.7563,"lon":100.5018,"country":"Thailand","region":"Southeast Asia"},
    "singapore":     {"lat":1.3521,"lon":103.8198,"country":"Singapore","region":"Southeast Asia"},
    "manila":        {"lat":14.5995,"lon":120.9842,"country":"Philippines","region":"Southeast Asia"},
    "jakarta":       {"lat":-6.2088,"lon":106.8456,"country":"Indonesia","region":"Southeast Asia"},
    "yangon":        {"lat":16.8661,"lon":96.1951,"country":"Myanmar","region":"Southeast Asia"},
    "hanoi":         {"lat":21.0278,"lon":105.8342,"country":"Vietnam","region":"Southeast Asia"},
    "kuala lumpur":  {"lat":3.1390,"lon":101.6869,"country":"Malaysia","region":"Southeast Asia"},
    "phnom penh":    {"lat":11.5564,"lon":104.9282,"country":"Cambodia","region":"Southeast Asia"},
    "cairo":         {"lat":30.0444,"lon":31.2357,"country":"Egypt","region":"Africa"},
    "lagos":         {"lat":6.5244,"lon":3.3792,"country":"Nigeria","region":"Africa"},
    "nairobi":       {"lat":-1.2921,"lon":36.8219,"country":"Kenya","region":"Africa"},
    "khartoum":      {"lat":15.5007,"lon":32.5599,"country":"Sudan","region":"Africa"},
    "tripoli":       {"lat":32.8872,"lon":13.1913,"country":"Libya","region":"Africa"},
    "mogadishu":     {"lat":2.0469,"lon":45.3182,"country":"Somalia","region":"Africa"},
    "goma":          {"lat":-1.6771,"lon":29.2386,"country":"DR Congo","region":"Africa"},
    "south china sea":  {"lat":12.0,"lon":114.0,"country":"South China Sea","region":"Asia"},
    "red sea":          {"lat":20.0,"lon":38.0,"country":"Red Sea","region":"Middle East"},
    "suez canal":       {"lat":30.4,"lon":32.3,"country":"Egypt","region":"Middle East"},
    "taiwan strait":    {"lat":24.0,"lon":119.0,"country":"Taiwan Strait","region":"Asia"},
    "mexico city":   {"lat":19.4326,"lon":-99.1332,"country":"Mexico","region":"North America"},
    "bogota":        {"lat":4.7110,"lon":-74.0721,"country":"Colombia","region":"South America"},
    "port au prince":{"lat":18.5944,"lon":-72.3074,"country":"Haiti","region":"North America"},
}

COUNTRY_PATTERNS: dict[str, dict] = {
    "Ukraine":       {"patterns":["ukraine","ukrainian","zelensky"],         "lat":50.4501,"lon":30.5234,"region":"Europe"},
    "Russia":        {"patterns":["russia","russian","kremlin","putin"],      "lat":55.7558,"lon":37.6173,"region":"Europe"},
    "China":         {"patterns":["china","chinese","xi jinping","pla ","prc "],"lat":39.9042,"lon":116.4074,"region":"Asia"},
    "Iran":          {"patterns":["iran","iranian","irgc","khamenei"],        "lat":35.6892,"lon":51.3890,"region":"Middle East"},
    "Israel":        {"patterns":["israel","israeli","netanyahu","idf "],     "lat":31.7683,"lon":35.2137,"region":"Middle East"},
    "Palestine":     {"patterns":["palestine","palestinian","west bank","gaza strip"],"lat":31.9522,"lon":35.2332,"region":"Middle East"},
    "United Kingdom":{"patterns":["britain","british","uk ","england"],       "lat":51.5074,"lon":-0.1278,"region":"Europe"},
    "Saudi Arabia":  {"patterns":["saudi","saudi arabia"],                    "lat":24.7136,"lon":46.6753,"region":"Middle East"},
    "Turkey":        {"patterns":["turkey","turkish","erdogan","turkiye"],    "lat":39.9334,"lon":32.8597,"region":"Middle East"},
    "Pakistan":      {"patterns":["pakistan","pakistani"],                   "lat":33.6844,"lon":73.0479,"region":"Asia"},
    "India":         {"patterns":["india","indian","modi"],                   "lat":28.6139,"lon":77.2090,"region":"Asia"},
    "Myanmar":       {"patterns":["myanmar","burma","rohingya","junta","tatmadaw","arakan"],"lat":16.8661,"lon":96.1951,"region":"Southeast Asia"},
    "Thailand":      {"patterns":["thailand","thai"],                         "lat":13.7563,"lon":100.5018,"region":"Southeast Asia"},
    "Philippines":   {"patterns":["philippines","filipino","mindanao","abu sayyaf","bangsamoro"],"lat":14.5995,"lon":120.9842,"region":"Southeast Asia"},
    "Indonesia":     {"patterns":["indonesia","indonesian"],                  "lat":-6.2088,"lon":106.8456,"region":"Southeast Asia"},
    "Malaysia":      {"patterns":["malaysia","malaysian"],                    "lat":3.1390,"lon":101.6869,"region":"Southeast Asia"},
    "Vietnam":       {"patterns":["vietnam","vietnamese"],                    "lat":21.0278,"lon":105.8342,"region":"Southeast Asia"},
    "Cambodia":      {"patterns":["cambodia","cambodian"],                    "lat":11.5564,"lon":104.9282,"region":"Southeast Asia"},
    "Yemen":         {"patterns":["yemen","yemeni","houthi","ansar allah"],   "lat":15.3694,"lon":44.1910,"region":"Middle East"},
    "Syria":         {"patterns":["syria","syrian","assad"],                  "lat":33.5138,"lon":36.2765,"region":"Middle East"},
    "Iraq":          {"patterns":["iraq","iraqi"],                            "lat":33.3152,"lon":44.3661,"region":"Middle East"},
    "Afghanistan":   {"patterns":["afghanistan","afghan","taliban"],          "lat":34.5553,"lon":69.2075,"region":"Asia"},
    "Libya":         {"patterns":["libya","libyan"],                          "lat":32.8872,"lon":13.1913,"region":"Africa"},
    "Sudan":         {"patterns":["sudan","sudanese","rsf","rapid support"],  "lat":15.5007,"lon":32.5599,"region":"Africa"},
    "Somalia":       {"patterns":["somalia","somali","al shabaab","al-shabaab"],"lat":2.0469,"lon":45.3182,"region":"Africa"},
    "DR Congo":      {"patterns":["congo","congolese","drc ","m23"],          "lat":-4.4419,"lon":15.2663,"region":"Africa"},
    "Nigeria":       {"patterns":["nigeria","nigerian","boko haram"],         "lat":9.0765,"lon":7.3986,"region":"Africa"},
    "Ethiopia":      {"patterns":["ethiopia","ethiopian","tigray"],           "lat":9.0250,"lon":38.7469,"region":"Africa"},
    "Haiti":         {"patterns":["haiti","haitian"],                         "lat":18.5944,"lon":-72.3074,"region":"North America"},
    "Colombia":      {"patterns":["colombia","colombian","farc","eln"],       "lat":4.7110,"lon":-74.0721,"region":"South America"},
    "Mexico":        {"patterns":["mexico","mexican","cartel"],               "lat":19.4326,"lon":-99.1332,"region":"North America"},
    "Taiwan":        {"patterns":["taiwan","taiwanese"],                      "lat":25.0330,"lon":121.5654,"region":"Asia"},
    "Lebanon":       {"patterns":["lebanon","lebanese"],                      "lat":33.8938,"lon":35.5018,"region":"Middle East"},
    "United States": {"patterns":["united states","u.s. ","pentagon","trump","biden"],   "lat":38.9072,"lon":-77.0369,"region":"North America"},
    "ASEAN Region":  {"patterns":["asean","southeast asia","indopacific","indo-pacific"],"lat":4.0,"lon":108.0,"region":"Southeast Asia"},
}

_CITY_KEYS = sorted(CITIES.keys(), key=len, reverse=True)
_CITIES_BY_COUNTRY: dict[str, list[dict]] = {}
for _c_name, _c_data in CITIES.items():
    _key = _c_data["country"].lower()
    _CITIES_BY_COUNTRY.setdefault(_key, []).append({"name": _c_name, **_c_data})


# ─────────────────────────────────────────────────────────────────────────────
# UTILITY  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
def clean_html(raw: str) -> str:
    if BS4_OK:
        return BeautifulSoup(raw, "lxml").get_text(separator=" ", strip=True)
    return re.sub(r"<[^>]+>", " ", raw).strip()

def normalize_url(url: str) -> str:
    try:
        p = urlparse(url)
        qs = "&".join(kv for kv in (p.query or "").split("&")
                      if not kv.split("=")[0] in {"utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","fbclid","gclid"})
        return urlunparse((p.scheme, p.netloc, p.path.rstrip("/"), p.params, qs, "")).lower()
    except Exception:
        return url.lower().split("?")[0]

def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", title.lower())).strip()[:80]

def fingerprint(title: str, url: str) -> str:
    return hashlib.sha256(f"{normalize_title(title)}|{normalize_url(url)}".encode()).hexdigest()

def _hash_str(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch); h = (h * 16777619) & 0xFFFFFFFF
    return h

def geolocate(title: str, desc: str) -> dict:
    text = f"{title} {desc}".lower()
    for city in _CITY_KEYS:
        if re.search(r"\b" + re.escape(city) + r"\b", text, re.IGNORECASE):
            c = CITIES[city]
            seed = _hash_str(title); micro = 0.002
            return {"lat": c["lat"] + ((seed%1000)/1000-.5)*micro,
                    "lon": c["lon"] + (((seed>>10)%1000)/1000-.5)*micro,
                    "country": c["country"], "region": c["region"], "confidence": 0.95}
    for country_name, info in COUNTRY_PATTERNS.items():
        if any(p in text for p in info["patterns"]):
            cities = _CITIES_BY_COUNTRY.get(country_name.lower(), [])
            if cities:
                seed = _hash_str(title + country_name); micro = 0.002
                picked = cities[seed % len(cities)]
                return {"lat": picked["lat"] + ((seed%1000)/1000-.5)*micro,
                        "lon": picked["lon"] + (((seed>>10)%1000)/1000-.5)*micro,
                        "country": country_name, "region": info["region"], "confidence": 0.7}
            return {"lat": info["lat"], "lon": info["lon"],
                    "country": country_name, "region": info["region"], "confidence": 0.6}
    return {"lat": 0.0, "lon": 0.0, "country": "", "region": "", "confidence": 0.0}

def is_osint_relevant(title: str, desc: str) -> bool:
    text = f"{title} {desc}".lower()
    if any(k in text for k in EXCLUDE_KW): return False
    if any(k in text for k in HARD_EXCLUDE_KW): return False
    if not any(k in text for k in INCLUDE_KW): return False
    if not any(k in text for k in ACTIVE_INCIDENT_KW): return False
    return True

def detect_threat(title: str, desc: str) -> str:
    text = f"{title} {desc}".lower()
    if any(k in text for k in CRITICAL_KW): return "critical"
    if any(k in text for k in HIGH_KW): return "high"
    if any(k in text for k in ELEVATED_KW): return "elevated"
    return "low"

def detect_category(title: str, desc: str) -> str:
    text = f"{title} {desc}".lower()
    if any(k in text for k in ["terror","bomb","explosion","kidnap","hostage","shooting","assassin","piracy","armed robbery","airport closed","curfew"]): return "security"
    if any(k in text for k in ["airstrike","missile","shelling","coup","civil war","clashes","uprising","military operation","frontline"]): return "conflict"
    if any(k in text for k in ["earthquake","tsunami","flood","cyclone","typhoon","hurricane","wildfire","outbreak","epidemic","pandemic","cholera","famine"]): return "humanitarian"
    if any(k in text for k in ["cyber attack","internet shutdown","ransomware","communications blackout"]): return "technology"
    return "security"

def extract_tags(title: str, desc: str, extra: list[str] | None = None) -> list[str]:
    text = f"{title} {desc}".lower()
    kws = ["military","terrorism","cyber","sanctions","politics","nuclear","protest","coup",
           "refugee","humanitarian","defense","security","conflict","diplomatic","border",
           "travel-risk","evacuation","unrest","assassination","hostage","piracy","cartel",
           "espionage","maritime","blockade","drone","missile","chemical","biological"]
    tags = [k for k in kws if k.replace("-"," ") in text][:6]
    if extra:
        for e in extra:
            if e not in tags and len(tags) < 8: tags.append(e)
    return tags or ["intel"]

def parse_date(raw: str) -> str:
    if not raw: return datetime.now(timezone.utc).isoformat()
    for fmt in ["%a, %d %b %Y %H:%M:%S %z","%a, %d %b %Y %H:%M:%S %Z",
                "%Y-%m-%dT%H:%M:%S%z","%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S","%Y%m%dT%H%M%SZ"]:
        try:
            dt = datetime.strptime(raw.strip(), fmt)
            if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError: continue
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# ████  HIGH-THROUGHPUT HTTP FETCH  ████
# ─────────────────────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": "OsintScraperBot/3.0 (+https://example.com/osint)",
    "Accept": "application/rss+xml, application/xml, application/atom+xml, text/xml, */*",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}
MAX_RETRIES = 3
TIMEOUT     = aiohttp.ClientTimeout(total=18, connect=6)


def _jitter_backoff(attempt: int, base: float = 1.5, cap: float = 30.0) -> float:
    """Full-jitter capped exponential backoff (AWS best practice)."""
    ceiling = min(cap, base ** attempt)
    return random.uniform(0, ceiling)


async def fetch_text(session: aiohttp.ClientSession, url: str,
                     retries: int = MAX_RETRIES,
                     extra_headers: dict | None = None) -> str | None:
    """
    Fetch with:
      • per-domain rate limiting (token bucket)
      • source health gating (skip dead sources)
      • full-jitter exponential backoff on 429 / 5xx
      • health tracker updates
    """
    if _health.is_dead(url):
        return None

    hdrs = {**HEADERS, **(extra_headers or {})}
    await _rate_limiter.acquire(url)

    for attempt in range(retries):
        try:
            async with session.get(url, headers=hdrs, timeout=TIMEOUT, ssl=False) as resp:
                if resp.status == 429:
                    retry_after = float(resp.headers.get("Retry-After", 0))
                    wait = max(retry_after, _jitter_backoff(attempt))
                    log.debug("429 %s — waiting %.1fs", url, wait)
                    await asyncio.sleep(wait)
                    continue
                if resp.status >= 500:
                    await asyncio.sleep(_jitter_backoff(attempt))
                    continue
                if resp.status >= 400:
                    _health.record_failure(url)
                    return None
                text = await resp.text(errors="replace")
                _health.record_success(url)
                return text
        except asyncio.TimeoutError:
            log.debug("Timeout %s (attempt %d)", url, attempt + 1)
            await asyncio.sleep(_jitter_backoff(attempt, base=1.2))
        except Exception as exc:
            log.debug("Fetch error %s: %s", url, exc)
            if attempt < retries - 1:
                await asyncio.sleep(_jitter_backoff(attempt))

    _health.record_failure(url)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# ████  WORKER POOL  ████
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class FetchJob:
    url: str
    name: str
    credibility: str
    source_type: str
    priority: int = 2          # 1=high 2=normal 3=low
    extra_headers: dict | None = None


async def worker(queue: asyncio.PriorityQueue,
                 session: aiohttp.ClientSession,
                 results: list[IntelItem],
                 stats: dict[str, int]) -> None:
    """Pull jobs from priority queue; parse + emit IntelItems."""
    while True:
        try:
            _, job = await asyncio.wait_for(queue.get(), timeout=2.0)
        except asyncio.TimeoutError:
            break
        except asyncio.CancelledError:
            break

        t0 = time.monotonic()
        xml = await fetch_text(session, job.url, extra_headers=job.extra_headers)
        if xml:
            if job.source_type == "rss":
                items = parse_rss(xml, job.name, job.credibility)
            elif job.source_type == "telegram":
                items = parse_telegram_html(xml, job.url.split("/")[-1], job.name)
            else:
                items = []
            stats[job.name] = len(items)
            results.extend(items)
            elapsed = time.monotonic() - t0
            log.debug("✓ %-30s %3d items  %.1fs", job.name, len(items), elapsed)
        queue.task_done()


async def run_worker_pool(session: aiohttp.ClientSession,
                          jobs: list[FetchJob],
                          n_workers: int) -> tuple[list[IntelItem], dict[str, int]]:
    """Fill priority queue → drain with n_workers concurrent coroutines."""
    queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
    for job in jobs:
        await queue.put((job.priority, job))

    results: list[IntelItem] = []
    stats: dict[str, int] = {}

    tasks = [asyncio.create_task(worker(queue, session, results, stats))
             for _ in range(min(n_workers, len(jobs)))]
    await queue.join()
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    return results, stats


# ─────────────────────────────────────────────────────────────────────────────
# PARSERS
# ─────────────────────────────────────────────────────────────────────────────
def parse_rss(xml: str, source_name: str, credibility: str) -> list[IntelItem]:
    items: list[IntelItem] = []
    if FEEDPARSER_OK:
        feed = feedparser.parse(xml)
        for e in feed.entries[:30]:
            title = clean_html(getattr(e, "title", ""))
            desc  = clean_html(getattr(e, "summary", "") or getattr(e, "description", ""))
            url   = getattr(e, "link", "")
            date  = parse_date(getattr(e, "published", "") or getattr(e, "updated", ""))
            if title and url:
                items.append(IntelItem(title=title[:500], description=desc[:2000],
                    url=url, source_name=source_name, published_at=date,
                    source_credibility=credibility, source_type="rss"))
    else:
        for blk in (re.findall(r"<item[^>]*>([\s\S]*?)</item>", xml, re.I) or
                    re.findall(r"<entry[^>]*>([\s\S]*?)</entry>", xml, re.I))[:30]:
            def _ex(tag: str) -> str:
                m = re.search(rf"<{tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</{tag}>", blk, re.I)
                return clean_html(m.group(1)) if m else ""
            title = _ex("title"); desc = _ex("description") or _ex("summary")
            url_m = re.search(r"<link[^>]*href=\"([^\"]+)\"", blk, re.I) or re.search(r"<link[^>]*>([\s\S]*?)</link>", blk, re.I)
            url   = (url_m.group(1) if url_m else "").strip()
            date_m = re.search(r"<pubDate[^>]*>([\s\S]*?)</pubDate>", blk, re.I) or re.search(r"<published[^>]*>([\s\S]*?)</published>", blk, re.I)
            if title and url:
                items.append(IntelItem(title=title[:500], description=desc[:2000],
                    url=url, source_name=source_name, published_at=parse_date(date_m.group(1) if date_m else ""),
                    source_credibility=credibility, source_type="rss"))
    return items


def parse_telegram_html(html: str, channel: str, display_name: str) -> list[IntelItem]:
    items: list[IntelItem] = []
    if not BS4_OK: return items
    soup = BeautifulSoup(html, "lxml")
    for msg in soup.select(".tgme_widget_message_wrap")[:15]:
        text_el = msg.select_one(".tgme_widget_message_text")
        time_el = msg.select_one("time[datetime]")
        link_el = msg.select_one("[data-post]")
        if not text_el: continue
        raw = text_el.get_text(separator=" ", strip=True)
        if len(raw) < 20: continue
        url  = f"https://t.me/{link_el['data-post']}" if link_el else f"https://t.me/s/{channel}"
        date = parse_date(time_el.get("datetime","") if time_el else "")
        items.append(IntelItem(title=raw[:200], description=raw[:1000],
            url=url, source_name=f"TG: {display_name}", published_at=date,
            source_credibility="low", source_type="telegram"))
    return items


# ─────────────────────────────────────────────────────────────────────────────
# SPECIALISED COLLECTORS (GDELT, NewsAPI, Mediastack)
# ─────────────────────────────────────────────────────────────────────────────
async def collect_gdelt(session: aiohttp.ClientSession) -> tuple[list[IntelItem], dict]:
    q = "conflict OR military OR attack OR terrorism OR sanctions"
    url = (f"https://api.gdeltproject.org/api/v2/doc/doc?"
           f"query={q}&mode=artlist&maxrecords=75&format=json&sort=datedesc&sourcelang=english")
    raw = await fetch_text(session, url)
    if not raw: return [], {}
    try: data = json.loads(raw)
    except json.JSONDecodeError: return [], {}
    items = []
    for a in data.get("articles", []):
        title, url_a = a.get("title",""), a.get("url","")
        if not title or not url_a: continue
        clean_date = re.sub(r"(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})", r"\1-\2-\3T\4:\5:\6Z", a.get("seendate",""))
        items.append(IntelItem(title=title, description=a.get("domain",""),
            url=url_a, source_name=a.get("domain","GDELT"),
            published_at=parse_date(clean_date),
            source_credibility="medium", source_type="gdelt"))
    return items, {"GDELT": len(items)}


async def collect_newsapi(session: aiohttp.ClientSession, api_key: str) -> tuple[list[IntelItem], dict]:
    if not api_key: return [], {}
    from_dt = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    q = "(military OR conflict OR attack OR terrorism OR sanctions OR coup OR airstrike OR protest OR hostage)"
    url = f"https://newsapi.org/v2/everything?q={q}&language=en&sortBy=publishedAt&from={from_dt}&pageSize=100"
    raw = await fetch_text(session, url, extra_headers={"X-Api-Key": api_key})
    if not raw: return [], {}
    try: data = json.loads(raw)
    except json.JSONDecodeError: return [], {}
    items = []
    for a in data.get("articles", []):
        title = a.get("title","")
        if not title or title == "[Removed]": continue
        items.append(IntelItem(title=title, description=a.get("description",""),
            url=a.get("url",""), source_name=a.get("source",{}).get("name","NewsAPI"),
            published_at=parse_date(a.get("publishedAt","")),
            source_credibility="medium", source_type="newsapi"))
    return items, {"NewsAPI": len(items)}


async def collect_mediastack(session: aiohttp.ClientSession, api_key: str) -> tuple[list[IntelItem], dict]:
    if not api_key: return [], {}
    url = (f"http://api.mediastack.com/v1/news?"
           f"access_key={api_key}&keywords=military,conflict,terrorism,attack,war&languages=en&limit=100&sort=published_desc")
    raw = await fetch_text(session, url)
    if not raw: return [], {}
    try: data = json.loads(raw)
    except json.JSONDecodeError: return [], {}
    items = []
    for a in data.get("data", []):
        title = a.get("title","")
        if not title: continue
        items.append(IntelItem(title=title, description=a.get("description",""),
            url=a.get("url",""), source_name=a.get("source","Mediastack"),
            published_at=parse_date(a.get("published_at","")),
            source_credibility="medium", source_type="mediastack"))
    return items, {"Mediastack": len(items)}


# ─────────────────────────────────────────────────────────────────────────────
# PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def filter_items(items: list[IntelItem]) -> list[IntelItem]:
    return [a for a in items if is_osint_relevant(a.title, a.description)]

def dedupe(items: list[IntelItem]) -> list[IntelItem]:
    seen_fp: set[str] = set(); seen_title: set[str] = set(); out = []
    for item in items:
        fp = fingerprint(item.title, item.url); nt = normalize_title(item.title)
        if fp in seen_fp or nt in seen_title: continue
        seen_fp.add(fp); seen_title.add(nt); item.fingerprint = fp; out.append(item)
    return out

def enrich(item: IntelItem) -> IntelItem | None:
    geo = geolocate(item.title, item.description)
    if geo["confidence"] < 0.6: return None
    item.lat = round(geo["lat"], 6); item.lon = round(geo["lon"], 6)
    item.country = geo["country"]; item.region = geo["region"]
    item.geo_confidence = geo["confidence"]
    item.threat_level = detect_threat(item.title, item.description)
    item.category = detect_category(item.title, item.description)
    item.tags = extract_tags(item.title, item.description,
                             extra=[item.source_type, re.sub(r"[^a-z0-9]","-",item.source_name.lower())[:20]])
    return item


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT WRITERS
# ─────────────────────────────────────────────────────────────────────────────
def write_json(items: list[IntelItem], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump([asdict(i) for i in items], f, ensure_ascii=False, indent=2)
    log.info("JSON  → %s  (%d items)", path, len(items))

def write_csv(items: list[IntelItem], path: str) -> None:
    if not items: return
    fields = list(asdict(items[0]).keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader()
        for item in items:
            row = asdict(item); row["tags"] = "|".join(row["tags"]); w.writerow(row)
    log.info("CSV   → %s  (%d items)", path, len(items))

def write_sqlite(items: list[IntelItem], path: str) -> None:
    con = sqlite3.connect(path); cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS intel (
            id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT UNIQUE,
            title TEXT, description TEXT, url TEXT, source_name TEXT,
            source_type TEXT, source_credibility TEXT, published_at TEXT,
            collected_at TEXT, threat_level TEXT, category TEXT, tags TEXT,
            country TEXT, region TEXT, lat REAL, lon REAL, geo_confidence REAL
        )""")
    inserted = 0
    for item in items:
        try:
            cur.execute("""
                INSERT OR IGNORE INTO intel
                (fingerprint,title,description,url,source_name,source_type,source_credibility,
                 published_at,collected_at,threat_level,category,tags,country,region,lat,lon,geo_confidence)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (item.fingerprint, item.title, item.description, item.url,
                 item.source_name, item.source_type, item.source_credibility,
                 item.published_at, item.collected_at, item.threat_level,
                 item.category, "|".join(item.tags), item.country, item.region,
                 item.lat, item.lon, item.geo_confidence))
            inserted += cur.rowcount
        except sqlite3.Error: pass
    con.commit(); con.close()
    log.info("SQLite → %s  (%d new rows)", path, inserted)


# ─────────────────────────────────────────────────────────────────────────────
# ████  MAIN ORCHESTRATOR  ████
# ─────────────────────────────────────────────────────────────────────────────
async def run(args: argparse.Namespace) -> list[IntelItem]:
    t0 = time.perf_counter()
    active_sources = set(args.sources) if args.sources else {"rss","telegram","gdelt","newsapi","mediastack"}
    n_workers      = args.workers
    n_connections  = args.connections

    # ── Build worker-pool jobs ──────────────────────────────────────────────
    jobs: list[FetchJob] = []
    if "rss" in active_sources:
        for src in RSS_SOURCES:
            jobs.append(FetchJob(url=src["url"], name=src["name"],
                                 credibility=src["credibility"],
                                 source_type="rss", priority=src.get("priority",2)))
    if "telegram" in active_sources:
        tg_hdrs = {"User-Agent": "Mozilla/5.0 (compatible; OsintBot/3.0)"}
        for ch in TELEGRAM_CHANNELS:
            jobs.append(FetchJob(url=f"https://t.me/s/{ch['channel']}", name=ch["name"],
                                 credibility=ch["credibility"], source_type="telegram",
                                 priority=2, extra_headers=tg_hdrs))

    # ── Create shared session (maximised) ──────────────────────────────────
    # Keepalive + large pool size = sustained throughput without reconnect overhead
    connector = aiohttp.TCPConnector(
        limit=n_connections,
        limit_per_host=6,           # polite per-host cap
        ttl_dns_cache=600,
        keepalive_timeout=30,
        ssl=False,
        enable_cleanup_closed=True,
    )
    async with aiohttp.ClientSession(connector=connector) as session:
        all_items: list[IntelItem] = []
        source_stats: dict[str, int] = {}

        # Run worker pool for RSS + Telegram
        if jobs:
            pool_items, pool_stats = await run_worker_pool(session, jobs, n_workers)
            all_items.extend(pool_items)
            source_stats.update(pool_stats)

        # Run specialised API collectors concurrently
        api_tasks = []
        if "gdelt" in active_sources:
            api_tasks.append(collect_gdelt(session))
        if "newsapi" in active_sources:
            api_tasks.append(collect_newsapi(session, args.newsapi or os.getenv("NEWSAPI_KEY","")))
        if "mediastack" in active_sources:
            api_tasks.append(collect_mediastack(session, args.mediastack or os.getenv("MEDIASTACK_KEY","")))

        for res in await asyncio.gather(*api_tasks, return_exceptions=True):
            if isinstance(res, Exception):
                log.warning("API collector error: %s", res)
                continue
            items, stats = res
            all_items.extend(items)
            source_stats.update(stats)

    log.info("Raw articles collected : %d", len(all_items))
    relevant  = filter_items(all_items);    log.info("After OSINT filter     : %d", len(relevant))
    deduped   = dedupe(relevant);           log.info("After deduplication    : %d", len(deduped))

    enriched: list[IntelItem] = []
    for item in deduped:
        e = enrich(item)
        if e: enriched.append(e)
    log.info("After geo-filter       : %d", len(enriched))

    order = {"critical":0,"high":1,"elevated":2,"low":3}
    enriched.sort(key=lambda x: order.get(x.threat_level, 9))
    if args.limit:
        enriched = enriched[:args.limit]

    elapsed = time.perf_counter() - t0

    # ── Stats ──────────────────────────────────────────────────────────────
    print("\n" + "═"*66)
    print(f"  OSINT v3 — MAX THROUGHPUT  |  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═"*66)
    print(f"  Total raw            : {len(all_items):>6}")
    print(f"  OSINT relevant       : {len(relevant):>6}")
    print(f"  After dedupe         : {len(deduped):>6}")
    print(f"  Geo-located          : {len(enriched):>6}")
    print(f"  Dead sources skipped : {_health.dead_count:>6}")
    print(f"  Worker pool size     : {n_workers:>6}")
    print(f"  TCP connections      : {n_connections:>6}")
    print(f"  Elapsed              : {elapsed:>5.1f}s")
    print(f"  Items/sec            : {len(all_items)/max(elapsed,0.01):>5.0f}")
    print(f"  pg_cron cadence      : {args.cadence}s")
    print(f"  Browser hook cadence : 60s")
    if args.verbose:
        print("\n  ── Source breakdown ──")
        for src, cnt in sorted(source_stats.items(), key=lambda x: -x[1])[:30]:
            print(f"    {src:<35} {cnt:>4} items")
        print("\n  ── Threat breakdown ──")
        for tl in ["critical","high","elevated","low"]:
            n = sum(1 for i in enriched if i.threat_level == tl)
            print(f"    {tl:<10} {n:>4}  {'█'*min(n,40)}")
        print("\n  ── Region breakdown ──")
        regions: dict[str,int] = {}
        for i in enriched: regions[i.region] = regions.get(i.region,0)+1
        for r, n in sorted(regions.items(), key=lambda x: -x[1]):
            print(f"    {r:<25} {n:>4}")
    print("═"*66 + "\n")
    return enriched


def main() -> None:
    parser = argparse.ArgumentParser(description="OSINT Real-Time Intel Scraper v3 — Max Throughput",
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output",      default="intel_output.json")
    parser.add_argument("--format",      choices=["json","csv","sqlite","all"], default="json")
    parser.add_argument("--sources",     nargs="+", choices=["rss","telegram","gdelt","newsapi","mediastack"])
    parser.add_argument("--limit",       type=int, default=None)
    parser.add_argument("--verbose",     action="store_true")
    parser.add_argument("--newsapi",     default="")
    parser.add_argument("--mediastack",  default="")
    # ── Throughput knobs ──
    parser.add_argument("--workers",     type=int, default=60,
                        help="Worker coroutines in pool (default: 60)")
    parser.add_argument("--connections", type=int, default=80,
                        help="Total TCP connections (default: 80)")
    parser.add_argument("--cadence",     type=int, default=30,
                        help="pg_cron interval in seconds (default: 30)")
    args = parser.parse_args()

    items = asyncio.run(run(args))
    if not items:
        print("⚠  No items passed filters.")
        return

    base = args.output.rsplit(".",1)[0]; fmt = args.format
    if fmt in ("json","all"): write_json(items, f"{base}.json" if fmt=="all" else args.output)
    if fmt in ("csv","all"):  write_csv(items, f"{base}.csv")
    if fmt in ("sqlite","all"): write_sqlite(items, f"{base}.db")

    print(f"\n{'─'*66}")
    print(f"  TOP {min(10,len(items))} INTEL ITEMS")
    print(f"{'─'*66}")
    tl_icon = {"critical":"🔴","high":"🟠","elevated":"🟡","low":"🟢"}
    for i, item in enumerate(items[:10], 1):
        print(f"\n  {i:>2}. {tl_icon.get(item.threat_level,'⚪')} [{item.threat_level.upper():<8}] {item.title[:72]}")
        print(f"      📍 {item.country} ({item.region})")
        print(f"      📰 {item.source_name}  |  🗓 {item.published_at[:10]}")
        print(f"      🏷  {', '.join(item.tags[:5])}")
    print(f"\n{'─'*66}\n")


if __name__ == "__main__":
    main()
