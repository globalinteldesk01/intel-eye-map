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
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
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
# COUNTRY COORDINATES MAPPING
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
    "Lithuania": (55.17, 23.88), "Madagascar": (-18.77, 46.87), "Malawi": (-13.25, 34.30),
    "Malaysia": (4.21, 101.98), "Mali": (17.57, -4.00), "Mauritania": (21.00, -10.94),
    "Mexico": (23.63, -102.55), "Moldova": (47.41, 28.37), "Mongolia": (46.86, 103.85),
    "Montenegro": (42.71, 19.37), "Morocco": (31.79, -7.09), "Mozambique": (-18.67, 35.53),
    "Myanmar": (21.92, 95.96), "Namibia": (-22.96, 18.49), "Nepal": (28.39, 84.12),
    "Netherlands": (52.13, 5.29), "New Zealand": (-40.90, 174.89), "Nicaragua": (12.87, -85.21),
    "Niger": (17.61, 8.08), "Nigeria": (9.08, 8.68), "North Korea": (40.34, 127.51),
    "North Macedonia": (41.61, 21.74), "Norway": (60.47, 8.47), "Oman": (21.51, 55.92),
    "Pakistan": (30.38, 69.35), "Palestine": (31.95, 35.23), "Gaza": (31.35, 34.31),
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
    "Vietnam": (14.06, 108.28), "West Bank": (31.95, 35.20), "Yemen": (15.55, 48.52),
    "Zambia": (-13.13, 27.85), "Zimbabwe": (-19.02, 29.15), "Europe": (54.53, 15.26),
    "Africa": (8.78, 34.51), "Asia": (34.05, 100.62), "Middle East": (29.31, 42.46),
    "Global": (20.00, 0.00), "International": (20.00, 0.00),
    "Western Sahara": (24.21, -12.89), "Kosovo": (42.60, 20.90),
    "Sahel": (15.00, 3.00), "East Africa": (-1.00, 36.00), "West Africa": (12.00, -2.00),
    "Horn of Africa": (8.00, 44.00), "Central Africa": (-2.00, 23.00),
    "Southeast Asia": (5.00, 115.00), "Central Asia": (43.00, 68.00),
    "South America": (-15.00, -60.00), "Central America": (14.00, -87.00),
    "Caribbean": (18.00, -72.00), "North Africa": (25.00, 15.00),
    "Eastern Europe": (52.00, 30.00), "Western Europe": (48.00, 5.00),
    "Balkans": (44.00, 20.00), "Caucasus": (42.00, 45.00),
}

# =============================================================================
# RSS FEED SOURCES
# =============================================================================
RSS_FEEDS = [
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "source": "BBC World", "credibility": "high"},
    {"url": "https://www.aljazeera.com/xml/rss/all.xml", "source": "Al Jazeera", "credibility": "high"},
    {"url": "https://www.france24.com/en/rss", "source": "France 24", "credibility": "high"},
    {"url": "https://rss.dw.com/xml/rss-en-world", "source": "Deutsche Welle", "credibility": "high"},
    {"url": "https://www.voanews.com/rss/world", "source": "Voice of America", "credibility": "high"},
    {"url": "https://news.un.org/feed/subscribe/en/news/all/rss.xml", "source": "UN News", "credibility": "high"},
    {"url": "https://www.theguardian.com/world/rss", "source": "The Guardian", "credibility": "high"},
    {"url": "https://feeds.skynews.com/feeds/rss/world.xml", "source": "Sky News", "credibility": "high"},
    {"url": "https://reliefweb.int/updates/rss.xml", "source": "ReliefWeb", "credibility": "high"},
    {"url": "https://abcnews.go.com/abcnews/internationalheadlines", "source": "ABC News", "credibility": "medium"},
    {"url": "https://feeds.npr.org/1004/rss.xml", "source": "NPR World", "credibility": "high"},
    {"url": "https://www.euronews.com/rss?format=mrss&level=theme&name=news", "source": "Euronews", "credibility": "high"},
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
# GLOBAL FETCH STATE
# =============================================================================
fetch_status = FetchStatus()
sse_clients: List[asyncio.Queue] = []

# =============================================================================
# AI ENRICHMENT
# =============================================================================
ENRICHMENT_SYSTEM_PROMPT = """You are a professional intelligence analyst. Analyze news articles and classify them for a security/intelligence dashboard.

Return ONLY a JSON object with these exact fields (no markdown, no extra text):
{
  "category": "one of: security, conflict, diplomacy, economy, humanitarian, technology",
  "threat_level": "one of: critical, high, elevated, low",
  "country": "primary country name (use full English name, or 'Global' if worldwide)",
  "region": "geographic region (Middle East, Eastern Europe, Sub-Saharan Africa, South Asia, East Asia, Southeast Asia, Central Asia, North Africa, West Africa, East Africa, Horn of Africa, Sahel, Balkans, Caucasus, Caribbean, South America, Central America, North America, Western Europe, Global)",
  "actor_type": "one of: state, non_state, igo, hybrid",
  "tags": ["3 to 5 specific keyword tags"],
  "confidence_level": "one of: confirmed, probable, possible, unconfirmed",
  "confidence_score": 0.0
}

Guidelines:
- threat_level 'critical': mass casualties, WMD threats, major attacks on infrastructure
- threat_level 'high': significant violence, major political crisis, large-scale displacement  
- threat_level 'elevated': ongoing tensions, moderate incidents, concerning developments
- threat_level 'low': diplomatic meetings, routine politics, minor incidents, policy news
- actor_type 'state': governments, militaries, police
- actor_type 'non_state': terrorist groups, rebel factions, militias, protesters
- actor_type 'igo': UN, NATO, EU, African Union, other international organizations
- actor_type 'hybrid': unclear mix or multiple actors
- confidence_level 'confirmed': verified by official sources
- confidence_level 'probable': reliable sources, likely accurate
- confidence_level 'possible': single/limited sources, unverified claims
- confidence_level 'unconfirmed': rumors, social media, unverified
- confidence_score: 0.9=confirmed official, 0.7=reliable outlet, 0.5=single source, 0.3=unverified"""

async def enrich_article(title: str, summary: str, source: str) -> dict:
    """Use LLM to classify and enrich a news article."""
    try:
        if not EMERGENT_LLM_KEY:
            return _rule_based_enrichment(title, summary)
        
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
        
        # Clean up response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = re.sub(r'```(?:json)?\n?', '', clean_response)
            clean_response = clean_response.rstrip('`').strip()
        
        data = json.loads(clean_response)
        
        # Ensure all required fields are present
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
        
        country = data.get("country", "Global")
        region = data.get("region", "Global")
        
        # Get coordinates for country
        lat, lon = COUNTRY_COORDS.get(country, COUNTRY_COORDS.get(region, (20.0, 0.0)))
        
        # Add slight randomization to coordinates to avoid overlapping pins
        import random
        lat += random.uniform(-2.0, 2.0)
        lon += random.uniform(-2.0, 2.0)
        
        confidence_score = float(data.get("confidence_score", 0.6))
        tags = data.get("tags", [])
        if not isinstance(tags, list):
            tags = []
        tags = [str(t) for t in tags[:5]]
        
        return {
            "category": category,
            "threat_level": threat_level,
            "country": country,
            "region": region,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "actor_type": actor_type,
            "tags": tags,
            "confidence_level": confidence_level,
            "confidence_score": round(min(max(confidence_score, 0.0), 1.0), 2),
        }
    except Exception as e:
        logger.warning(f"AI enrichment failed, using rule-based: {e}")
        return _rule_based_enrichment(title, summary)

def _rule_based_enrichment(title: str, summary: str) -> dict:
    """Fallback rule-based classification."""
    text = (title + " " + summary).lower()
    
    # Category classification
    category = "security"
    if any(w in text for w in ["war", "battle", "troops", "casualties", "fighting", "siege", "ceasefire", "offensive", "airstrike", "bombing"]):
        category = "conflict"
    elif any(w in text for w in ["diplomatic", "summit", "sanctions", "embassy", "treaty", "agreement", "negotiate", "minister", "president visited"]):
        category = "diplomacy"
    elif any(w in text for w in ["economy", "gdp", "trade", "market", "inflation", "recession", "oil price", "financial", "currency", "investment"]):
        category = "economy"
    elif any(w in text for w in ["refugees", "humanitarian", "disaster", "flood", "earthquake", "famine", "displaced", "relief", "aid", "drought"]):
        category = "humanitarian"
    elif any(w in text for w in ["cyber", "artificial intelligence", "drone technology", "surveillance", "hacking", "malware", "tech"]):
        category = "technology"
    elif any(w in text for w in ["attack", "bomb", "terror", "military", "weapon", "security", "police", "arrest", "protest"]):
        category = "security"
    
    # Threat level
    threat_level = "low"
    if any(w in text for w in ["killed", "dead", "casualties", "massacre", "mass grave", "genocide", "nuclear", "chemical weapon", "explosion"]):
        threat_level = "critical"
    elif any(w in text for w in ["attack", "conflict", "fighting", "war", "troops", "offensive", "battle", "airstrike", "crisis"]):
        threat_level = "high"
    elif any(w in text for w in ["tension", "threat", "protest", "demonstration", "unrest", "concern", "warning", "election"]):
        threat_level = "elevated"
    
    # Country detection from text
    country = "Global"
    region = "Global"
    for country_name in COUNTRY_COORDS.keys():
        if country_name.lower() in text and country_name not in ["Europe", "Africa", "Asia", "Global", "International"]:
            country = country_name
            break
    
    lat, lon = COUNTRY_COORDS.get(country, (20.0, 0.0))
    
    import random
    lat += random.uniform(-1.5, 1.5)
    lon += random.uniform(-1.5, 1.5)
    
    # Tags
    tags = []
    tag_keywords = {
        "conflict": ["war", "conflict", "military"],
        "security": ["security", "attack", "terror"],
        "diplomacy": ["diplomatic", "summit", "sanctions"],
        "economy": ["economy", "trade", "financial"],
        "humanitarian": ["humanitarian", "refugees", "aid"],
    }
    for tag, keywords in tag_keywords.items():
        if any(k in text for k in keywords):
            tags.append(tag)
    if not tags:
        tags = ["global", "news", "intelligence"]
    
    return {
        "category": category,
        "threat_level": threat_level,
        "country": country,
        "region": region,
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "actor_type": "state",
        "tags": tags[:5],
        "confidence_level": "probable",
        "confidence_score": 0.65,
    }

# =============================================================================
# RSS FETCHER
# =============================================================================
async def fetch_rss_feed(feed_info: dict, client: httpx.AsyncClient) -> List[dict]:
    """Fetch and parse a single RSS feed."""
    items = []
    try:
        response = await client.get(feed_info["url"], timeout=15.0, follow_redirects=True)
        if response.status_code == 200:
            feed = feedparser.parse(response.content)
            for entry in feed.entries[:15]:  # Max 15 per feed
                title = entry.get("title", "").strip()
                summary = entry.get("summary", entry.get("description", "")).strip()
                # Clean HTML tags from summary
                summary = re.sub(r'<[^>]+>', '', summary).strip()
                summary = re.sub(r'\s+', ' ', summary).strip()
                
                url = entry.get("link", "").strip()
                
                # Parse published date
                published_at = datetime.now(timezone.utc).isoformat()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        import time
                        published_at = datetime.fromtimestamp(
                            time.mktime(entry.published_parsed), tz=timezone.utc
                        ).isoformat()
                    except:
                        pass
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    try:
                        import time
                        published_at = datetime.fromtimestamp(
                            time.mktime(entry.updated_parsed), tz=timezone.utc
                        ).isoformat()
                    except:
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
    """Main news fetching function - fetches all RSS feeds and stores new items."""
    global fetch_status
    
    if fetch_status.is_fetching:
        return {"success": False, "message": "Fetch already in progress"}
    
    fetch_status.is_fetching = True
    logger.info("Starting news fetch from all sources...")
    
    try:
        all_raw_items = []
        sources_checked = 0
        
        # Fetch all RSS feeds concurrently
        async with httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (compatible; IntelDashboard/1.0)"},
            timeout=20.0
        ) as client:
            tasks = [fetch_rss_feed(feed, client) for feed in RSS_FEEDS]
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
        
        # Filter new items
        new_items = [item for item in all_raw_items if item["url"] not in existing_urls and item["url"]]
        
        # Also filter by published_at - only items from last 48 hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        recent_new_items = []
        for item in new_items:
            try:
                pub_dt = datetime.fromisoformat(item["published_at"].replace('Z', '+00:00'))
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                if pub_dt > cutoff:
                    recent_new_items.append(item)
            except:
                recent_new_items.append(item)  # Include if date parsing fails
        
        logger.info(f"Found {len(recent_new_items)} new articles to process")
        
        # Limit to 20 new items per fetch to avoid rate limiting
        items_to_process = recent_new_items[:20]
        
        # Enrich and store articles
        inserted_count = 0
        enrichment_tasks = []
        
        # Process in batches of 5 concurrently
        batch_size = 5
        for i in range(0, len(items_to_process), batch_size):
            batch = items_to_process[i:i+batch_size]
            tasks = [enrich_article(item["title"], item["summary"], item["source"]) for item in batch]
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
                    
                    # Broadcast to SSE clients
                    news_item_clean = {k: v for k, v in news_item.items() if k != "_id"}
                    await broadcast_sse({"type": "new_item", "item": news_item_clean})
                    
                except Exception as e:
                    logger.error(f"Failed to insert news item: {e}")
        
        # Update status
        total_items = await db.news_items.count_documents({})
        fetch_status.last_fetch_time = datetime.now(timezone.utc).isoformat()
        fetch_status.last_fetch_count = inserted_count
        fetch_status.total_items = total_items
        fetch_status.sources_checked = sources_checked
        
        logger.info(f"News fetch complete: {inserted_count} new items inserted, total: {total_items}")
        return {
            "success": True,
            "fetched": len(all_raw_items),
            "inserted": inserted_count,
            "sources_checked": sources_checked,
            "message": f"Successfully fetched {inserted_count} new items"
        }
        
    except Exception as e:
        logger.error(f"News fetch error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        fetch_status.is_fetching = False

# =============================================================================
# SSE BROADCASTING
# =============================================================================
async def broadcast_sse(data: dict):
    """Broadcast data to all connected SSE clients."""
    if not sse_clients:
        return
    disconnected = []
    for q in sse_clients:
        try:
            await q.put(data)
        except:
            disconnected.append(q)
    for q in disconnected:
        if q in sse_clients:
            sse_clients.remove(q)

# =============================================================================
# BACKGROUND FETCHER
# =============================================================================
async def background_news_fetcher():
    """Background task that fetches news every 3 minutes."""
    logger.info("Background news fetcher started")
    # Initial fetch after 5 seconds
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
    # Create indexes
    try:
        await db.news_items.create_index("url", unique=True, sparse=True)
        await db.news_items.create_index([("published_at", -1)])
        await db.news_items.create_index("threat_level")
        await db.news_items.create_index("category")
        await db.news_items.create_index("country")
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    
    # Start background fetcher
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
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0),
    category: Optional[str] = Query(default=None),
    threat_level: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    hours: Optional[int] = Query(default=None),
):
    """Get news items with optional filtering."""
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
    """Get news fetch status."""
    total = await db.news_items.count_documents({})
    fetch_status.total_items = total
    return fetch_status.dict()

@api_router.post("/news/fetch")
async def trigger_news_fetch():
    """Manually trigger a news fetch."""
    result = await fetch_and_store_news()
    return result

@api_router.get("/news/stream")
async def news_stream():
    """SSE endpoint for real-time news updates."""
    q: asyncio.Queue = asyncio.Queue()
    sse_clients.append(q)
    
    async def event_generator():
        try:
            # Send initial connection event
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Real-time news stream connected'})}\n\n"
            
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    yield f"data: {json.dumps({'type': 'heartbeat', 'time': datetime.now(timezone.utc).isoformat()})}\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"SSE error: {e}")
        finally:
            if q in sse_clients:
                sse_clients.remove(q)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )

@api_router.get("/news/{item_id}", response_model=dict)
async def get_news_item(item_id: str):
    """Get a single news item."""
    item = await db.news_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="News item not found")
    return item

@api_router.post("/news", response_model=dict)
async def create_news_item(item: NewsItemCreate):
    """Create a custom news item."""
    enrichment = {}
    if item.lat == 0.0 and item.lon == 0.0:
        enrichment = await enrich_article(item.title, item.summary, item.source)
    
    news_item = {
        "id": str(uuid.uuid4()),
        "token": str(uuid.uuid4())[:8].upper(),
        "title": item.title,
        "summary": item.summary,
        "url": item.url,
        "source": item.source,
        "source_credibility": item.source_credibility,
        "published_at": item.published_at or datetime.now(timezone.utc).isoformat(),
        "lat": enrichment.get("lat", item.lat),
        "lon": enrichment.get("lon", item.lon),
        "country": enrichment.get("country", item.country),
        "region": enrichment.get("region", item.region),
        "tags": enrichment.get("tags", item.tags),
        "confidence_score": enrichment.get("confidence_score", item.confidence_score),
        "confidence_level": enrichment.get("confidence_level", item.confidence_level),
        "threat_level": enrichment.get("threat_level", item.threat_level),
        "actor_type": enrichment.get("actor_type", item.actor_type),
        "sub_category": item.sub_category,
        "category": enrichment.get("category", item.category),
        "user_id": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.news_items.insert_one(news_item)
    news_item_clean = {k: v for k, v in news_item.items() if k != "_id"}
    await broadcast_sse({"type": "new_item", "item": news_item_clean})
    return news_item_clean

@api_router.delete("/news/{item_id}")
async def delete_news_item(item_id: str):
    """Delete a news item."""
    result = await db.news_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News item not found")
    await broadcast_sse({"type": "deleted_item", "id": item_id})
    return {"success": True, "id": item_id}

@api_router.get("/")
async def root():
    return {"message": "Intel Dashboard API", "status": "operational"}

@api_router.post("/status")
async def create_status_check(data: dict):
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/status")
async def get_status():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router
app.include_router(api_router)
