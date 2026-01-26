import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map NewsAPI categories to our intel categories
const categoryMapping: Record<string, string> = {
  general: "security",
  business: "economy",
  technology: "technology",
  science: "technology",
  health: "humanitarian",
  sports: "diplomacy",
  entertainment: "diplomacy",
};

// Keywords for threat level detection
const criticalKeywords = ["attack", "bomb", "explosion", "terror", "war", "killed", "massacre", "crisis"];
const highKeywords = ["conflict", "military", "troops", "missile", "threat", "violence", "emergency"];
const elevatedKeywords = ["tension", "protest", "sanctions", "warning", "concern", "dispute"];

// Country coordinate mapping for geocoding - using major city coordinates with safe land offsets
const countryCoordinates: Record<string, { lat: number; lon: number; region: string; offsetRange: number }> = {
  "us": { lat: 38.9072, lon: -77.0369, region: "North America", offsetRange: 0.3 },      // Washington DC
  "gb": { lat: 51.5074, lon: -0.1278, region: "Europe", offsetRange: 0.2 },              // London
  "de": { lat: 52.5200, lon: 13.4050, region: "Europe", offsetRange: 0.3 },              // Berlin
  "fr": { lat: 48.8566, lon: 2.3522, region: "Europe", offsetRange: 0.3 },               // Paris
  "ru": { lat: 55.7558, lon: 37.6173, region: "Europe", offsetRange: 0.5 },              // Moscow
  "cn": { lat: 39.9042, lon: 116.4074, region: "Asia", offsetRange: 0.4 },               // Beijing
  "jp": { lat: 35.6762, lon: 139.6503, region: "Asia", offsetRange: 0.15 },              // Tokyo (small offset - island)
  "in": { lat: 28.6139, lon: 77.2090, region: "Asia", offsetRange: 0.4 },                // New Delhi
  "br": { lat: -15.7801, lon: -47.9292, region: "South America", offsetRange: 0.5 },     // Brasilia
  "au": { lat: -35.2809, lon: 149.1300, region: "Oceania", offsetRange: 0.3 },           // Canberra
  "za": { lat: -25.7461, lon: 28.1881, region: "Africa", offsetRange: 0.3 },             // Pretoria
  "eg": { lat: 30.0444, lon: 31.2357, region: "Middle East", offsetRange: 0.2 },         // Cairo
  "sa": { lat: 24.7136, lon: 46.6753, region: "Middle East", offsetRange: 0.4 },         // Riyadh
  "ir": { lat: 35.6892, lon: 51.3890, region: "Middle East", offsetRange: 0.3 },         // Tehran
  "il": { lat: 31.7683, lon: 35.2137, region: "Middle East", offsetRange: 0.1 },         // Jerusalem (small country)
  "ua": { lat: 50.4501, lon: 30.5234, region: "Europe", offsetRange: 0.3 },              // Kyiv
  "kr": { lat: 37.5665, lon: 126.9780, region: "Asia", offsetRange: 0.15 },              // Seoul (peninsula)
  "mx": { lat: 19.4326, lon: -99.1332, region: "North America", offsetRange: 0.3 },      // Mexico City
  "ca": { lat: 45.4215, lon: -75.6972, region: "North America", offsetRange: 0.4 },      // Ottawa
  "ng": { lat: 9.0765, lon: 7.3986, region: "Africa", offsetRange: 0.3 },                // Abuja
  "pk": { lat: 33.6844, lon: 73.0479, region: "Asia", offsetRange: 0.3 },                // Islamabad
  "tr": { lat: 39.9334, lon: 32.8597, region: "Middle East", offsetRange: 0.3 },         // Ankara
  "ae": { lat: 24.4539, lon: 54.3773, region: "Middle East", offsetRange: 0.15 },        // Abu Dhabi
  "sg": { lat: 1.3521, lon: 103.8198, region: "Asia", offsetRange: 0.05 },               // Singapore (tiny)
  "it": { lat: 41.9028, lon: 12.4964, region: "Europe", offsetRange: 0.2 },              // Rome
  "es": { lat: 40.4168, lon: -3.7038, region: "Europe", offsetRange: 0.3 },              // Madrid
  "nl": { lat: 52.3676, lon: 4.9041, region: "Europe", offsetRange: 0.1 },               // Amsterdam
  "be": { lat: 50.8503, lon: 4.3517, region: "Europe", offsetRange: 0.1 },               // Brussels
  "ie": { lat: 53.3498, lon: -6.2603, region: "Europe", offsetRange: 0.15 },             // Dublin
  "nz": { lat: -41.2866, lon: 174.7756, region: "Oceania", offsetRange: 0.2 },           // Wellington
  "default": { lat: 40.7128, lon: -74.0060, region: "Global", offsetRange: 0.2 },        // New York (fallback)
};

// Comprehensive city database for precise geolocation - 500+ cities globally
const cityCoordinates: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  // ===================== USA CITIES (50+) =====================
  "washington": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "washington dc": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "new york": { lat: 40.7128, lon: -74.0060, country: "United States", region: "North America" },
  "new york city": { lat: 40.7128, lon: -74.0060, country: "United States", region: "North America" },
  "manhattan": { lat: 40.7831, lon: -73.9712, country: "United States", region: "North America" },
  "brooklyn": { lat: 40.6782, lon: -73.9442, country: "United States", region: "North America" },
  "los angeles": { lat: 34.0522, lon: -118.2437, country: "United States", region: "North America" },
  "hollywood": { lat: 34.0928, lon: -118.3287, country: "United States", region: "North America" },
  "chicago": { lat: 41.8781, lon: -87.6298, country: "United States", region: "North America" },
  "houston": { lat: 29.7604, lon: -95.3698, country: "United States", region: "North America" },
  "phoenix": { lat: 33.4484, lon: -112.0740, country: "United States", region: "North America" },
  "philadelphia": { lat: 39.9526, lon: -75.1652, country: "United States", region: "North America" },
  "san antonio": { lat: 29.4241, lon: -98.4936, country: "United States", region: "North America" },
  "san diego": { lat: 32.7157, lon: -117.1611, country: "United States", region: "North America" },
  "san jose": { lat: 37.3382, lon: -121.8863, country: "United States", region: "North America" },
  "san francisco": { lat: 37.7749, lon: -122.4194, country: "United States", region: "North America" },
  "silicon valley": { lat: 37.3875, lon: -122.0575, country: "United States", region: "North America" },
  "seattle": { lat: 47.6062, lon: -122.3321, country: "United States", region: "North America" },
  "miami": { lat: 25.7617, lon: -80.1918, country: "United States", region: "North America" },
  "atlanta": { lat: 33.7490, lon: -84.3880, country: "United States", region: "North America" },
  "boston": { lat: 42.3601, lon: -71.0589, country: "United States", region: "North America" },
  "dallas": { lat: 32.7767, lon: -96.7970, country: "United States", region: "North America" },
  "denver": { lat: 39.7392, lon: -104.9903, country: "United States", region: "North America" },
  "austin": { lat: 30.2672, lon: -97.7431, country: "United States", region: "North America" },
  "detroit": { lat: 42.3314, lon: -83.0458, country: "United States", region: "North America" },
  "las vegas": { lat: 36.1699, lon: -115.1398, country: "United States", region: "North America" },
  "portland": { lat: 45.5152, lon: -122.6784, country: "United States", region: "North America" },
  "baltimore": { lat: 39.2904, lon: -76.6122, country: "United States", region: "North America" },
  "cleveland": { lat: 41.4993, lon: -81.6944, country: "United States", region: "North America" },
  "minneapolis": { lat: 44.9778, lon: -93.2650, country: "United States", region: "North America" },
  "nashville": { lat: 36.1627, lon: -86.7816, country: "United States", region: "North America" },
  "orlando": { lat: 28.5383, lon: -81.3792, country: "United States", region: "North America" },
  "pittsburgh": { lat: 40.4406, lon: -79.9959, country: "United States", region: "North America" },
  "charlotte": { lat: 35.2271, lon: -80.8431, country: "United States", region: "North America" },
  "sacramento": { lat: 38.5816, lon: -121.4944, country: "United States", region: "North America" },
  "indianapolis": { lat: 39.7684, lon: -86.1581, country: "United States", region: "North America" },
  "cincinnati": { lat: 39.1031, lon: -84.5120, country: "United States", region: "North America" },
  "tampa": { lat: 27.9506, lon: -82.4572, country: "United States", region: "North America" },
  "honolulu": { lat: 21.3069, lon: -157.8583, country: "United States", region: "North America" },
  "anchorage": { lat: 61.2181, lon: -149.9003, country: "United States", region: "North America" },
  "pentagon": { lat: 38.8719, lon: -77.0563, country: "United States", region: "North America" },
  "white house": { lat: 38.8977, lon: -77.0365, country: "United States", region: "North America" },
  "wall street": { lat: 40.7074, lon: -74.0113, country: "United States", region: "North America" },
  "fort worth": { lat: 32.7555, lon: -97.3308, country: "United States", region: "North America" },
  "memphis": { lat: 35.1495, lon: -90.0490, country: "United States", region: "North America" },
  "new orleans": { lat: 29.9511, lon: -90.0715, country: "United States", region: "North America" },
  "st louis": { lat: 38.6270, lon: -90.1994, country: "United States", region: "North America" },
  "salt lake city": { lat: 40.7608, lon: -111.8910, country: "United States", region: "North America" },
  
  // ===================== CANADA CITIES (25+) =====================
  "ottawa": { lat: 45.4215, lon: -75.6972, country: "Canada", region: "North America" },
  "toronto": { lat: 43.6532, lon: -79.3832, country: "Canada", region: "North America" },
  "vancouver": { lat: 49.2827, lon: -123.1207, country: "Canada", region: "North America" },
  "montreal": { lat: 45.5017, lon: -73.5673, country: "Canada", region: "North America" },
  "calgary": { lat: 51.0447, lon: -114.0719, country: "Canada", region: "North America" },
  "edmonton": { lat: 53.5461, lon: -113.4938, country: "Canada", region: "North America" },
  "winnipeg": { lat: 49.8951, lon: -97.1384, country: "Canada", region: "North America" },
  "quebec city": { lat: 46.8139, lon: -71.2080, country: "Canada", region: "North America" },
  "hamilton": { lat: 43.2557, lon: -79.8711, country: "Canada", region: "North America" },
  "halifax": { lat: 44.6488, lon: -63.5752, country: "Canada", region: "North America" },
  "victoria": { lat: 48.4284, lon: -123.3656, country: "Canada", region: "North America" },
  "saskatoon": { lat: 52.1332, lon: -106.6700, country: "Canada", region: "North America" },
  "regina": { lat: 50.4452, lon: -104.6189, country: "Canada", region: "North America" },
  "st johns": { lat: 47.5615, lon: -52.7126, country: "Canada", region: "North America" },
  "kelowna": { lat: 49.8880, lon: -119.4960, country: "Canada", region: "North America" },
  "kitchener": { lat: 43.4516, lon: -80.4925, country: "Canada", region: "North America" },
  "waterloo": { lat: 43.4643, lon: -80.5204, country: "Canada", region: "North America" },
  "london ontario": { lat: 42.9849, lon: -81.2453, country: "Canada", region: "North America" },
  "mississauga": { lat: 43.5890, lon: -79.6441, country: "Canada", region: "North America" },
  "brampton": { lat: 43.7315, lon: -79.7624, country: "Canada", region: "North America" },

  // ===================== UK CITIES (30+) =====================
  "london": { lat: 51.5074, lon: -0.1278, country: "United Kingdom", region: "Europe" },
  "manchester": { lat: 53.4808, lon: -2.2426, country: "United Kingdom", region: "Europe" },
  "birmingham": { lat: 52.4862, lon: -1.8904, country: "United Kingdom", region: "Europe" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, country: "United Kingdom", region: "Europe" },
  "glasgow": { lat: 55.8642, lon: -4.2518, country: "United Kingdom", region: "Europe" },
  "liverpool": { lat: 53.4084, lon: -2.9916, country: "United Kingdom", region: "Europe" },
  "bristol": { lat: 51.4545, lon: -2.5879, country: "United Kingdom", region: "Europe" },
  "leeds": { lat: 53.8008, lon: -1.5491, country: "United Kingdom", region: "Europe" },
  "sheffield": { lat: 53.3811, lon: -1.4701, country: "United Kingdom", region: "Europe" },
  "newcastle": { lat: 54.9783, lon: -1.6178, country: "United Kingdom", region: "Europe" },
  "nottingham": { lat: 52.9548, lon: -1.1581, country: "United Kingdom", region: "Europe" },
  "southampton": { lat: 50.9097, lon: -1.4044, country: "United Kingdom", region: "Europe" },
  "portsmouth": { lat: 50.8198, lon: -1.0880, country: "United Kingdom", region: "Europe" },
  "cardiff": { lat: 51.4816, lon: -3.1791, country: "United Kingdom", region: "Europe" },
  "belfast": { lat: 54.5973, lon: -5.9301, country: "United Kingdom", region: "Europe" },
  "leicester": { lat: 52.6369, lon: -1.1398, country: "United Kingdom", region: "Europe" },
  "coventry": { lat: 52.4068, lon: -1.5197, country: "United Kingdom", region: "Europe" },
  "brighton": { lat: 50.8225, lon: -0.1372, country: "United Kingdom", region: "Europe" },
  "plymouth": { lat: 50.3755, lon: -4.1427, country: "United Kingdom", region: "Europe" },
  "reading": { lat: 51.4543, lon: -0.9781, country: "United Kingdom", region: "Europe" },
  "oxford": { lat: 51.7520, lon: -1.2577, country: "United Kingdom", region: "Europe" },
  "cambridge": { lat: 52.2053, lon: 0.1218, country: "United Kingdom", region: "Europe" },
  "westminster": { lat: 51.4975, lon: -0.1357, country: "United Kingdom", region: "Europe" },
  "downing street": { lat: 51.5034, lon: -0.1276, country: "United Kingdom", region: "Europe" },
  "aberdeen": { lat: 57.1497, lon: -2.0943, country: "United Kingdom", region: "Europe" },
  "dundee": { lat: 56.4620, lon: -2.9707, country: "United Kingdom", region: "Europe" },
  "swansea": { lat: 51.6214, lon: -3.9436, country: "United Kingdom", region: "Europe" },
  "derby": { lat: 52.9225, lon: -1.4746, country: "United Kingdom", region: "Europe" },
  "york": { lat: 53.9600, lon: -1.0873, country: "United Kingdom", region: "Europe" },
  "bath": { lat: 51.3811, lon: -2.3590, country: "United Kingdom", region: "Europe" },

  // ===================== GERMANY CITIES (25+) =====================
  "berlin": { lat: 52.5200, lon: 13.4050, country: "Germany", region: "Europe" },
  "munich": { lat: 48.1351, lon: 11.5820, country: "Germany", region: "Europe" },
  "frankfurt": { lat: 50.1109, lon: 8.6821, country: "Germany", region: "Europe" },
  "hamburg": { lat: 53.5511, lon: 9.9937, country: "Germany", region: "Europe" },
  "cologne": { lat: 50.9375, lon: 6.9603, country: "Germany", region: "Europe" },
  "koln": { lat: 50.9375, lon: 6.9603, country: "Germany", region: "Europe" },
  "stuttgart": { lat: 48.7758, lon: 9.1829, country: "Germany", region: "Europe" },
  "dusseldorf": { lat: 51.2277, lon: 6.7735, country: "Germany", region: "Europe" },
  "dortmund": { lat: 51.5136, lon: 7.4653, country: "Germany", region: "Europe" },
  "essen": { lat: 51.4556, lon: 7.0116, country: "Germany", region: "Europe" },
  "leipzig": { lat: 51.3397, lon: 12.3731, country: "Germany", region: "Europe" },
  "dresden": { lat: 51.0504, lon: 13.7373, country: "Germany", region: "Europe" },
  "hannover": { lat: 52.3759, lon: 9.7320, country: "Germany", region: "Europe" },
  "nuremberg": { lat: 49.4521, lon: 11.0767, country: "Germany", region: "Europe" },
  "bremen": { lat: 53.0793, lon: 8.8017, country: "Germany", region: "Europe" },
  "bonn": { lat: 50.7374, lon: 7.0982, country: "Germany", region: "Europe" },
  "heidelberg": { lat: 49.3988, lon: 8.6724, country: "Germany", region: "Europe" },
  "freiburg": { lat: 47.9990, lon: 7.8421, country: "Germany", region: "Europe" },
  "mainz": { lat: 49.9929, lon: 8.2473, country: "Germany", region: "Europe" },
  "karlsruhe": { lat: 49.0069, lon: 8.4037, country: "Germany", region: "Europe" },

  // ===================== FRANCE CITIES (25+) =====================
  "paris": { lat: 48.8566, lon: 2.3522, country: "France", region: "Europe" },
  "marseille": { lat: 43.2965, lon: 5.3698, country: "France", region: "Europe" },
  "lyon": { lat: 45.7640, lon: 4.8357, country: "France", region: "Europe" },
  "toulouse": { lat: 43.6047, lon: 1.4442, country: "France", region: "Europe" },
  "nice": { lat: 43.7102, lon: 7.2620, country: "France", region: "Europe" },
  "nantes": { lat: 47.2184, lon: -1.5536, country: "France", region: "Europe" },
  "strasbourg": { lat: 48.5734, lon: 7.7521, country: "France", region: "Europe" },
  "montpellier": { lat: 43.6108, lon: 3.8767, country: "France", region: "Europe" },
  "bordeaux": { lat: 44.8378, lon: -0.5792, country: "France", region: "Europe" },
  "lille": { lat: 50.6292, lon: 3.0573, country: "France", region: "Europe" },
  "rennes": { lat: 48.1173, lon: -1.6778, country: "France", region: "Europe" },
  "reims": { lat: 49.2583, lon: 4.0317, country: "France", region: "Europe" },
  "le havre": { lat: 49.4944, lon: 0.1079, country: "France", region: "Europe" },
  "saint-etienne": { lat: 45.4397, lon: 4.3872, country: "France", region: "Europe" },
  "toulon": { lat: 43.1242, lon: 5.9280, country: "France", region: "Europe" },
  "grenoble": { lat: 45.1885, lon: 5.7245, country: "France", region: "Europe" },
  "dijon": { lat: 47.3220, lon: 5.0415, country: "France", region: "Europe" },
  "angers": { lat: 47.4784, lon: -0.5632, country: "France", region: "Europe" },
  "cannes": { lat: 43.5528, lon: 7.0174, country: "France", region: "Europe" },
  "calais": { lat: 50.9513, lon: 1.8587, country: "France", region: "Europe" },

  // ===================== ITALY CITIES (25+) =====================
  "rome": { lat: 41.9028, lon: 12.4964, country: "Italy", region: "Europe" },
  "roma": { lat: 41.9028, lon: 12.4964, country: "Italy", region: "Europe" },
  "milan": { lat: 45.4642, lon: 9.1900, country: "Italy", region: "Europe" },
  "milano": { lat: 45.4642, lon: 9.1900, country: "Italy", region: "Europe" },
  "naples": { lat: 40.8518, lon: 14.2681, country: "Italy", region: "Europe" },
  "napoli": { lat: 40.8518, lon: 14.2681, country: "Italy", region: "Europe" },
  "turin": { lat: 45.0703, lon: 7.6869, country: "Italy", region: "Europe" },
  "torino": { lat: 45.0703, lon: 7.6869, country: "Italy", region: "Europe" },
  "palermo": { lat: 38.1157, lon: 13.3615, country: "Italy", region: "Europe" },
  "genoa": { lat: 44.4056, lon: 8.9463, country: "Italy", region: "Europe" },
  "genova": { lat: 44.4056, lon: 8.9463, country: "Italy", region: "Europe" },
  "bologna": { lat: 44.4949, lon: 11.3426, country: "Italy", region: "Europe" },
  "florence": { lat: 43.7696, lon: 11.2558, country: "Italy", region: "Europe" },
  "firenze": { lat: 43.7696, lon: 11.2558, country: "Italy", region: "Europe" },
  "venice": { lat: 45.4408, lon: 12.3155, country: "Italy", region: "Europe" },
  "venezia": { lat: 45.4408, lon: 12.3155, country: "Italy", region: "Europe" },
  "verona": { lat: 45.4384, lon: 10.9916, country: "Italy", region: "Europe" },
  "trieste": { lat: 45.6495, lon: 13.7768, country: "Italy", region: "Europe" },
  "messina": { lat: 38.1938, lon: 15.5540, country: "Italy", region: "Europe" },
  "padua": { lat: 45.4064, lon: 11.8768, country: "Italy", region: "Europe" },
  "bari": { lat: 41.1171, lon: 16.8719, country: "Italy", region: "Europe" },
  "catania": { lat: 37.5079, lon: 15.0830, country: "Italy", region: "Europe" },
  "pisa": { lat: 43.7228, lon: 10.4017, country: "Italy", region: "Europe" },
  "siena": { lat: 43.3188, lon: 11.3308, country: "Italy", region: "Europe" },

  // ===================== SPAIN CITIES (25+) =====================
  "madrid": { lat: 40.4168, lon: -3.7038, country: "Spain", region: "Europe" },
  "barcelona": { lat: 41.3851, lon: 2.1734, country: "Spain", region: "Europe" },
  "valencia": { lat: 39.4699, lon: -0.3763, country: "Spain", region: "Europe" },
  "seville": { lat: 37.3891, lon: -5.9845, country: "Spain", region: "Europe" },
  "sevilla": { lat: 37.3891, lon: -5.9845, country: "Spain", region: "Europe" },
  "zaragoza": { lat: 41.6488, lon: -0.8891, country: "Spain", region: "Europe" },
  "malaga": { lat: 36.7213, lon: -4.4214, country: "Spain", region: "Europe" },
  "murcia": { lat: 37.9922, lon: -1.1307, country: "Spain", region: "Europe" },
  "palma": { lat: 39.5696, lon: 2.6502, country: "Spain", region: "Europe" },
  "bilbao": { lat: 43.2630, lon: -2.9350, country: "Spain", region: "Europe" },
  "alicante": { lat: 38.3452, lon: -0.4810, country: "Spain", region: "Europe" },
  "cordoba": { lat: 37.8882, lon: -4.7794, country: "Spain", region: "Europe" },
  "valladolid": { lat: 41.6523, lon: -4.7245, country: "Spain", region: "Europe" },
  "vigo": { lat: 42.2406, lon: -8.7207, country: "Spain", region: "Europe" },
  "gijon": { lat: 43.5453, lon: -5.6635, country: "Spain", region: "Europe" },
  "granada": { lat: 37.1773, lon: -3.5986, country: "Spain", region: "Europe" },
  "san sebastian": { lat: 43.3183, lon: -1.9812, country: "Spain", region: "Europe" },
  "santander": { lat: 43.4623, lon: -3.8099, country: "Spain", region: "Europe" },
  "pamplona": { lat: 42.8125, lon: -1.6458, country: "Spain", region: "Europe" },
  "ibiza": { lat: 38.9067, lon: 1.4206, country: "Spain", region: "Europe" },

  // ===================== OTHER EUROPE (40+) =====================
  "amsterdam": { lat: 52.3676, lon: 4.9041, country: "Netherlands", region: "Europe" },
  "rotterdam": { lat: 51.9244, lon: 4.4777, country: "Netherlands", region: "Europe" },
  "the hague": { lat: 52.0705, lon: 4.3007, country: "Netherlands", region: "Europe" },
  "utrecht": { lat: 52.0907, lon: 5.1214, country: "Netherlands", region: "Europe" },
  "eindhoven": { lat: 51.4416, lon: 5.4697, country: "Netherlands", region: "Europe" },
  "brussels": { lat: 50.8503, lon: 4.3517, country: "Belgium", region: "Europe" },
  "antwerp": { lat: 51.2194, lon: 4.4025, country: "Belgium", region: "Europe" },
  "ghent": { lat: 51.0543, lon: 3.7174, country: "Belgium", region: "Europe" },
  "bruges": { lat: 51.2093, lon: 3.2247, country: "Belgium", region: "Europe" },
  "vienna": { lat: 48.2082, lon: 16.3738, country: "Austria", region: "Europe" },
  "salzburg": { lat: 47.8095, lon: 13.0550, country: "Austria", region: "Europe" },
  "innsbruck": { lat: 47.2692, lon: 11.4041, country: "Austria", region: "Europe" },
  "graz": { lat: 47.0707, lon: 15.4395, country: "Austria", region: "Europe" },
  "zurich": { lat: 47.3769, lon: 8.5417, country: "Switzerland", region: "Europe" },
  "geneva": { lat: 46.2044, lon: 6.1432, country: "Switzerland", region: "Europe" },
  "bern": { lat: 46.9480, lon: 7.4474, country: "Switzerland", region: "Europe" },
  "basel": { lat: 47.5596, lon: 7.5886, country: "Switzerland", region: "Europe" },
  "lausanne": { lat: 46.5197, lon: 6.6323, country: "Switzerland", region: "Europe" },
  "stockholm": { lat: 59.3293, lon: 18.0686, country: "Sweden", region: "Europe" },
  "gothenburg": { lat: 57.7089, lon: 11.9746, country: "Sweden", region: "Europe" },
  "malmo": { lat: 55.6050, lon: 13.0038, country: "Sweden", region: "Europe" },
  "oslo": { lat: 59.9139, lon: 10.7522, country: "Norway", region: "Europe" },
  "bergen": { lat: 60.3913, lon: 5.3221, country: "Norway", region: "Europe" },
  "trondheim": { lat: 63.4305, lon: 10.3951, country: "Norway", region: "Europe" },
  "copenhagen": { lat: 55.6761, lon: 12.5683, country: "Denmark", region: "Europe" },
  "aarhus": { lat: 56.1629, lon: 10.2039, country: "Denmark", region: "Europe" },
  "helsinki": { lat: 60.1699, lon: 24.9384, country: "Finland", region: "Europe" },
  "tampere": { lat: 61.4978, lon: 23.7610, country: "Finland", region: "Europe" },
  "turku": { lat: 60.4518, lon: 22.2666, country: "Finland", region: "Europe" },
  "dublin": { lat: 53.3498, lon: -6.2603, country: "Ireland", region: "Europe" },
  "cork": { lat: 51.8985, lon: -8.4756, country: "Ireland", region: "Europe" },
  "galway": { lat: 53.2707, lon: -9.0568, country: "Ireland", region: "Europe" },
  "limerick": { lat: 52.6638, lon: -8.6267, country: "Ireland", region: "Europe" },
  "lisbon": { lat: 38.7223, lon: -9.1393, country: "Portugal", region: "Europe" },
  "porto": { lat: 41.1579, lon: -8.6291, country: "Portugal", region: "Europe" },
  "faro": { lat: 37.0194, lon: -7.9322, country: "Portugal", region: "Europe" },
  "athens": { lat: 37.9838, lon: 23.7275, country: "Greece", region: "Europe" },
  "thessaloniki": { lat: 40.6401, lon: 22.9444, country: "Greece", region: "Europe" },
  "heraklion": { lat: 35.3387, lon: 25.1442, country: "Greece", region: "Europe" },
  "warsaw": { lat: 52.2297, lon: 21.0122, country: "Poland", region: "Europe" },
  "krakow": { lat: 50.0647, lon: 19.9450, country: "Poland", region: "Europe" },
  "gdansk": { lat: 54.3520, lon: 18.6466, country: "Poland", region: "Europe" },
  "wroclaw": { lat: 51.1079, lon: 17.0385, country: "Poland", region: "Europe" },
  "poznan": { lat: 52.4064, lon: 16.9252, country: "Poland", region: "Europe" },
  "lodz": { lat: 51.7592, lon: 19.4560, country: "Poland", region: "Europe" },
  "prague": { lat: 50.0755, lon: 14.4378, country: "Czech Republic", region: "Europe" },
  "brno": { lat: 49.1951, lon: 16.6068, country: "Czech Republic", region: "Europe" },
  "budapest": { lat: 47.4979, lon: 19.0402, country: "Hungary", region: "Europe" },
  "bucharest": { lat: 44.4268, lon: 26.1025, country: "Romania", region: "Europe" },
  "cluj": { lat: 46.7712, lon: 23.6236, country: "Romania", region: "Europe" },
  "timisoara": { lat: 45.7489, lon: 21.2087, country: "Romania", region: "Europe" },
  "bratislava": { lat: 48.1486, lon: 17.1077, country: "Slovakia", region: "Europe" },
  "sofia": { lat: 42.6977, lon: 23.3219, country: "Bulgaria", region: "Europe" },
  "zagreb": { lat: 45.8150, lon: 15.9819, country: "Croatia", region: "Europe" },
  "split": { lat: 43.5081, lon: 16.4402, country: "Croatia", region: "Europe" },
  "dubrovnik": { lat: 42.6507, lon: 18.0944, country: "Croatia", region: "Europe" },
  "belgrade": { lat: 44.7866, lon: 20.4489, country: "Serbia", region: "Europe" },
  "sarajevo": { lat: 43.8563, lon: 18.4131, country: "Bosnia", region: "Europe" },
  "ljubljana": { lat: 46.0569, lon: 14.5058, country: "Slovenia", region: "Europe" },
  "skopje": { lat: 41.9973, lon: 21.4280, country: "North Macedonia", region: "Europe" },
  "tirana": { lat: 41.3275, lon: 19.8187, country: "Albania", region: "Europe" },
  "podgorica": { lat: 42.4304, lon: 19.2594, country: "Montenegro", region: "Europe" },
  "pristina": { lat: 42.6629, lon: 21.1655, country: "Kosovo", region: "Europe" },

  // ===================== RUSSIA & EASTERN EUROPE (30+) =====================
  "moscow": { lat: 55.7558, lon: 37.6173, country: "Russia", region: "Europe" },
  "kremlin": { lat: 55.7520, lon: 37.6175, country: "Russia", region: "Europe" },
  "st petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "saint petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "novosibirsk": { lat: 55.0084, lon: 82.9357, country: "Russia", region: "Asia" },
  "yekaterinburg": { lat: 56.8389, lon: 60.6057, country: "Russia", region: "Europe" },
  "kazan": { lat: 55.8304, lon: 49.0661, country: "Russia", region: "Europe" },
  "nizhny novgorod": { lat: 56.2965, lon: 43.9361, country: "Russia", region: "Europe" },
  "chelyabinsk": { lat: 55.1644, lon: 61.4368, country: "Russia", region: "Europe" },
  "samara": { lat: 53.1959, lon: 50.1002, country: "Russia", region: "Europe" },
  "omsk": { lat: 54.9885, lon: 73.3242, country: "Russia", region: "Asia" },
  "rostov on don": { lat: 47.2357, lon: 39.7015, country: "Russia", region: "Europe" },
  "ufa": { lat: 54.7388, lon: 55.9721, country: "Russia", region: "Europe" },
  "krasnoyarsk": { lat: 56.0153, lon: 92.8932, country: "Russia", region: "Asia" },
  "voronezh": { lat: 51.6720, lon: 39.1843, country: "Russia", region: "Europe" },
  "perm": { lat: 58.0105, lon: 56.2502, country: "Russia", region: "Europe" },
  "volgograd": { lat: 48.7080, lon: 44.5133, country: "Russia", region: "Europe" },
  "sochi": { lat: 43.6028, lon: 39.7342, country: "Russia", region: "Europe" },
  "vladivostok": { lat: 43.1332, lon: 131.9113, country: "Russia", region: "Asia" },
  "irkutsk": { lat: 52.2855, lon: 104.2890, country: "Russia", region: "Asia" },
  "kyiv": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kiev": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kharkiv": { lat: 49.9935, lon: 36.2304, country: "Ukraine", region: "Europe" },
  "odesa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "odessa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "lviv": { lat: 49.8397, lon: 24.0297, country: "Ukraine", region: "Europe" },
  "dnipro": { lat: 48.4647, lon: 35.0462, country: "Ukraine", region: "Europe" },
  "mariupol": { lat: 47.0945, lon: 37.5494, country: "Ukraine", region: "Europe" },
  "donetsk": { lat: 48.0159, lon: 37.8029, country: "Ukraine", region: "Europe" },
  "luhansk": { lat: 48.5740, lon: 39.3078, country: "Ukraine", region: "Europe" },
  "crimea": { lat: 44.9521, lon: 34.1024, country: "Ukraine", region: "Europe" },
  "sevastopol": { lat: 44.6167, lon: 33.5167, country: "Ukraine", region: "Europe" },
  "zaporizhzhia": { lat: 47.8388, lon: 35.1396, country: "Ukraine", region: "Europe" },
  "kherson": { lat: 46.6354, lon: 32.6169, country: "Ukraine", region: "Europe" },
  "minsk": { lat: 53.9006, lon: 27.5590, country: "Belarus", region: "Europe" },
  "gomel": { lat: 52.4345, lon: 30.9754, country: "Belarus", region: "Europe" },
  "chisinau": { lat: 47.0105, lon: 28.8638, country: "Moldova", region: "Europe" },
  "tbilisi": { lat: 41.7151, lon: 44.8271, country: "Georgia", region: "Europe" },
  "batumi": { lat: 41.6458, lon: 41.6417, country: "Georgia", region: "Europe" },
  "yerevan": { lat: 40.1792, lon: 44.4991, country: "Armenia", region: "Europe" },
  "baku": { lat: 40.4093, lon: 49.8671, country: "Azerbaijan", region: "Europe" },

  // ===================== MIDDLE EAST (50+) =====================
  "jerusalem": { lat: 31.7683, lon: 35.2137, country: "Israel", region: "Middle East" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", region: "Middle East" },
  "haifa": { lat: 32.7940, lon: 34.9896, country: "Israel", region: "Middle East" },
  "gaza": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "gaza city": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "rafah": { lat: 31.2969, lon: 34.2408, country: "Palestine", region: "Middle East" },
  "khan younis": { lat: 31.3444, lon: 34.3089, country: "Palestine", region: "Middle East" },
  "west bank": { lat: 31.9474, lon: 35.2272, country: "Palestine", region: "Middle East" },
  "ramallah": { lat: 31.9038, lon: 35.2034, country: "Palestine", region: "Middle East" },
  "nablus": { lat: 32.2211, lon: 35.2544, country: "Palestine", region: "Middle East" },
  "hebron": { lat: 31.5326, lon: 35.0998, country: "Palestine", region: "Middle East" },
  "jenin": { lat: 32.4561, lon: 35.2942, country: "Palestine", region: "Middle East" },
  "beirut": { lat: 33.8938, lon: 35.5018, country: "Lebanon", region: "Middle East" },
  "tripoli lebanon": { lat: 34.4367, lon: 35.8497, country: "Lebanon", region: "Middle East" },
  "sidon": { lat: 33.5608, lon: 35.3716, country: "Lebanon", region: "Middle East" },
  "damascus": { lat: 33.5138, lon: 36.2765, country: "Syria", region: "Middle East" },
  "aleppo": { lat: 36.2021, lon: 37.1343, country: "Syria", region: "Middle East" },
  "homs": { lat: 34.7324, lon: 36.7137, country: "Syria", region: "Middle East" },
  "latakia": { lat: 35.5317, lon: 35.7920, country: "Syria", region: "Middle East" },
  "idlib": { lat: 35.9306, lon: 36.6339, country: "Syria", region: "Middle East" },
  "baghdad": { lat: 33.3152, lon: 44.3661, country: "Iraq", region: "Middle East" },
  "basra": { lat: 30.5085, lon: 47.7804, country: "Iraq", region: "Middle East" },
  "mosul": { lat: 36.3350, lon: 43.1189, country: "Iraq", region: "Middle East" },
  "erbil": { lat: 36.1912, lon: 44.0119, country: "Iraq", region: "Middle East" },
  "kirkuk": { lat: 35.4681, lon: 44.3922, country: "Iraq", region: "Middle East" },
  "tehran": { lat: 35.6892, lon: 51.3890, country: "Iran", region: "Middle East" },
  "isfahan": { lat: 32.6546, lon: 51.6680, country: "Iran", region: "Middle East" },
  "shiraz": { lat: 29.5918, lon: 52.5836, country: "Iran", region: "Middle East" },
  "mashhad": { lat: 36.2605, lon: 59.6168, country: "Iran", region: "Middle East" },
  "tabriz": { lat: 38.0962, lon: 46.2738, country: "Iran", region: "Middle East" },
  "kermanshah": { lat: 34.3142, lon: 47.0650, country: "Iran", region: "Middle East" },
  "qom": { lat: 34.6416, lon: 50.8746, country: "Iran", region: "Middle East" },
  "riyadh": { lat: 24.7136, lon: 46.6753, country: "Saudi Arabia", region: "Middle East" },
  "jeddah": { lat: 21.4858, lon: 39.1925, country: "Saudi Arabia", region: "Middle East" },
  "mecca": { lat: 21.3891, lon: 39.8579, country: "Saudi Arabia", region: "Middle East" },
  "medina": { lat: 24.5247, lon: 39.5692, country: "Saudi Arabia", region: "Middle East" },
  "dammam": { lat: 26.4207, lon: 50.0888, country: "Saudi Arabia", region: "Middle East" },
  "dubai": { lat: 25.2048, lon: 55.2708, country: "UAE", region: "Middle East" },
  "abu dhabi": { lat: 24.4539, lon: 54.3773, country: "UAE", region: "Middle East" },
  "sharjah": { lat: 25.3573, lon: 55.4033, country: "UAE", region: "Middle East" },
  "doha": { lat: 25.2854, lon: 51.5310, country: "Qatar", region: "Middle East" },
  "kuwait city": { lat: 29.3759, lon: 47.9774, country: "Kuwait", region: "Middle East" },
  "manama": { lat: 26.2285, lon: 50.5860, country: "Bahrain", region: "Middle East" },
  "muscat": { lat: 23.5880, lon: 58.3829, country: "Oman", region: "Middle East" },
  "ankara": { lat: 39.9334, lon: 32.8597, country: "Turkey", region: "Middle East" },
  "istanbul": { lat: 41.0082, lon: 28.9784, country: "Turkey", region: "Middle East" },
  "izmir": { lat: 38.4192, lon: 27.1287, country: "Turkey", region: "Middle East" },
  "antalya": { lat: 36.8969, lon: 30.7133, country: "Turkey", region: "Middle East" },
  "bursa": { lat: 40.1885, lon: 29.0610, country: "Turkey", region: "Middle East" },
  "adana": { lat: 36.9914, lon: 35.3308, country: "Turkey", region: "Middle East" },
  "gaziantep": { lat: 37.0662, lon: 37.3833, country: "Turkey", region: "Middle East" },
  "konya": { lat: 37.8746, lon: 32.4932, country: "Turkey", region: "Middle East" },
  "amman": { lat: 31.9454, lon: 35.9284, country: "Jordan", region: "Middle East" },
  "aqaba": { lat: 29.5270, lon: 35.0078, country: "Jordan", region: "Middle East" },
  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Middle East" },
  "alexandria": { lat: 31.2001, lon: 29.9187, country: "Egypt", region: "Middle East" },
  "giza": { lat: 30.0131, lon: 31.2089, country: "Egypt", region: "Middle East" },
  "luxor": { lat: 25.6872, lon: 32.6396, country: "Egypt", region: "Middle East" },
  "aswan": { lat: 24.0889, lon: 32.8998, country: "Egypt", region: "Middle East" },
  "sharm el sheikh": { lat: 27.9158, lon: 34.3300, country: "Egypt", region: "Middle East" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Middle East" },
  "kandahar": { lat: 31.6289, lon: 65.7372, country: "Afghanistan", region: "Middle East" },
  "herat": { lat: 34.3529, lon: 62.2040, country: "Afghanistan", region: "Middle East" },
  "mazar-i-sharif": { lat: 36.7069, lon: 67.1147, country: "Afghanistan", region: "Middle East" },
  "sanaa": { lat: 15.3694, lon: 44.1910, country: "Yemen", region: "Middle East" },
  "aden": { lat: 12.7797, lon: 45.0095, country: "Yemen", region: "Middle East" },
  "hodeidah": { lat: 14.7979, lon: 42.9535, country: "Yemen", region: "Middle East" },

  // ===================== CHINA CITIES (30+) =====================
  "beijing": { lat: 39.9042, lon: 116.4074, country: "China", region: "Asia" },
  "shanghai": { lat: 31.2304, lon: 121.4737, country: "China", region: "Asia" },
  "hong kong": { lat: 22.3193, lon: 114.1694, country: "China", region: "Asia" },
  "guangzhou": { lat: 23.1291, lon: 113.2644, country: "China", region: "Asia" },
  "shenzhen": { lat: 22.5431, lon: 114.0579, country: "China", region: "Asia" },
  "chengdu": { lat: 30.5728, lon: 104.0668, country: "China", region: "Asia" },
  "chongqing": { lat: 29.4316, lon: 106.9123, country: "China", region: "Asia" },
  "tianjin": { lat: 39.3434, lon: 117.3616, country: "China", region: "Asia" },
  "wuhan": { lat: 30.5928, lon: 114.3055, country: "China", region: "Asia" },
  "xian": { lat: 34.3416, lon: 108.9398, country: "China", region: "Asia" },
  "hangzhou": { lat: 30.2741, lon: 120.1551, country: "China", region: "Asia" },
  "nanjing": { lat: 32.0603, lon: 118.7969, country: "China", region: "Asia" },
  "suzhou": { lat: 31.2990, lon: 120.5853, country: "China", region: "Asia" },
  "shenyang": { lat: 41.8057, lon: 123.4315, country: "China", region: "Asia" },
  "harbin": { lat: 45.8038, lon: 126.5350, country: "China", region: "Asia" },
  "qingdao": { lat: 36.0671, lon: 120.3826, country: "China", region: "Asia" },
  "dalian": { lat: 38.9140, lon: 121.6147, country: "China", region: "Asia" },
  "kunming": { lat: 24.8801, lon: 102.8329, country: "China", region: "Asia" },
  "xiamen": { lat: 24.4798, lon: 118.0894, country: "China", region: "Asia" },
  "ningbo": { lat: 29.8683, lon: 121.5440, country: "China", region: "Asia" },
  "fuzhou": { lat: 26.0745, lon: 119.2965, country: "China", region: "Asia" },
  "zhengzhou": { lat: 34.7473, lon: 113.6250, country: "China", region: "Asia" },
  "jinan": { lat: 36.6512, lon: 117.1201, country: "China", region: "Asia" },
  "changsha": { lat: 28.2280, lon: 112.9388, country: "China", region: "Asia" },
  "nanchang": { lat: 28.6820, lon: 115.8579, country: "China", region: "Asia" },
  "urumqi": { lat: 43.8256, lon: 87.6168, country: "China", region: "Asia" },
  "lhasa": { lat: 29.6500, lon: 91.1000, country: "China", region: "Asia" },
  "macau": { lat: 22.1987, lon: 113.5439, country: "China", region: "Asia" },
  "xinjiang": { lat: 41.1129, lon: 85.2401, country: "China", region: "Asia" },
  "tibet": { lat: 29.6500, lon: 91.1000, country: "China", region: "Asia" },
  "taiwan": { lat: 23.6978, lon: 120.9605, country: "Taiwan", region: "Asia" },
  "taipei": { lat: 25.0330, lon: 121.5654, country: "Taiwan", region: "Asia" },
  "kaohsiung": { lat: 22.6273, lon: 120.3014, country: "Taiwan", region: "Asia" },
  "taichung": { lat: 24.1477, lon: 120.6736, country: "Taiwan", region: "Asia" },

  // ===================== JAPAN & KOREA (25+) =====================
  "tokyo": { lat: 35.6762, lon: 139.6503, country: "Japan", region: "Asia" },
  "osaka": { lat: 34.6937, lon: 135.5023, country: "Japan", region: "Asia" },
  "kyoto": { lat: 35.0116, lon: 135.7681, country: "Japan", region: "Asia" },
  "yokohama": { lat: 35.4437, lon: 139.6380, country: "Japan", region: "Asia" },
  "nagoya": { lat: 35.1815, lon: 136.9066, country: "Japan", region: "Asia" },
  "sapporo": { lat: 43.0618, lon: 141.3545, country: "Japan", region: "Asia" },
  "fukuoka": { lat: 33.5902, lon: 130.4017, country: "Japan", region: "Asia" },
  "kobe": { lat: 34.6901, lon: 135.1956, country: "Japan", region: "Asia" },
  "hiroshima": { lat: 34.3853, lon: 132.4553, country: "Japan", region: "Asia" },
  "nagasaki": { lat: 32.7503, lon: 129.8779, country: "Japan", region: "Asia" },
  "sendai": { lat: 38.2682, lon: 140.8694, country: "Japan", region: "Asia" },
  "okinawa": { lat: 26.2124, lon: 127.6809, country: "Japan", region: "Asia" },
  "nara": { lat: 34.6851, lon: 135.8048, country: "Japan", region: "Asia" },
  "seoul": { lat: 37.5665, lon: 126.9780, country: "South Korea", region: "Asia" },
  "busan": { lat: 35.1796, lon: 129.0756, country: "South Korea", region: "Asia" },
  "incheon": { lat: 37.4563, lon: 126.7052, country: "South Korea", region: "Asia" },
  "daegu": { lat: 35.8714, lon: 128.6014, country: "South Korea", region: "Asia" },
  "daejeon": { lat: 36.3504, lon: 127.3845, country: "South Korea", region: "Asia" },
  "gwangju": { lat: 35.1595, lon: 126.8526, country: "South Korea", region: "Asia" },
  "ulsan": { lat: 35.5384, lon: 129.3114, country: "South Korea", region: "Asia" },
  "suwon": { lat: 37.2636, lon: 127.0286, country: "South Korea", region: "Asia" },
  "pyongyang": { lat: 39.0392, lon: 125.7625, country: "North Korea", region: "Asia" },
  "kaesong": { lat: 37.9706, lon: 126.5614, country: "North Korea", region: "Asia" },
  "wonsan": { lat: 39.1526, lon: 127.4458, country: "North Korea", region: "Asia" },

  // ===================== INDIA CITIES (60+) =====================
  "new delhi": { lat: 28.6139, lon: 77.2090, country: "India", region: "Asia" },
  "delhi": { lat: 28.7041, lon: 77.1025, country: "India", region: "Asia" },
  "mumbai": { lat: 19.0760, lon: 72.8777, country: "India", region: "Asia" },
  "bombay": { lat: 19.0760, lon: 72.8777, country: "India", region: "Asia" },
  "bangalore": { lat: 12.9716, lon: 77.5946, country: "India", region: "Asia" },
  "bengaluru": { lat: 12.9716, lon: 77.5946, country: "India", region: "Asia" },
  "chennai": { lat: 13.0827, lon: 80.2707, country: "India", region: "Asia" },
  "madras": { lat: 13.0827, lon: 80.2707, country: "India", region: "Asia" },
  "kolkata": { lat: 22.5726, lon: 88.3639, country: "India", region: "Asia" },
  "calcutta": { lat: 22.5726, lon: 88.3639, country: "India", region: "Asia" },
  "hyderabad": { lat: 17.3850, lon: 78.4867, country: "India", region: "Asia" },
  "pune": { lat: 18.5204, lon: 73.8567, country: "India", region: "Asia" },
  "ahmedabad": { lat: 23.0225, lon: 72.5714, country: "India", region: "Asia" },
  "jaipur": { lat: 26.9124, lon: 75.7873, country: "India", region: "Asia" },
  "lucknow": { lat: 26.8467, lon: 80.9462, country: "India", region: "Asia" },
  "kanpur": { lat: 26.4499, lon: 80.3319, country: "India", region: "Asia" },
  "nagpur": { lat: 21.1458, lon: 79.0882, country: "India", region: "Asia" },
  "indore": { lat: 22.7196, lon: 75.8577, country: "India", region: "Asia" },
  "thane": { lat: 19.2183, lon: 72.9781, country: "India", region: "Asia" },
  "bhopal": { lat: 23.2599, lon: 77.4126, country: "India", region: "Asia" },
  "visakhapatnam": { lat: 17.6868, lon: 83.2185, country: "India", region: "Asia" },
  "vizag": { lat: 17.6868, lon: 83.2185, country: "India", region: "Asia" },
  "patna": { lat: 25.5941, lon: 85.1376, country: "India", region: "Asia" },
  "vadodara": { lat: 22.3072, lon: 73.1812, country: "India", region: "Asia" },
  "ghaziabad": { lat: 28.6692, lon: 77.4538, country: "India", region: "Asia" },
  "ludhiana": { lat: 30.9010, lon: 75.8573, country: "India", region: "Asia" },
  "agra": { lat: 27.1767, lon: 78.0081, country: "India", region: "Asia" },
  "nashik": { lat: 19.9975, lon: 73.7898, country: "India", region: "Asia" },
  "faridabad": { lat: 28.4089, lon: 77.3178, country: "India", region: "Asia" },
  "meerut": { lat: 28.9845, lon: 77.7064, country: "India", region: "Asia" },
  "rajkot": { lat: 22.3039, lon: 70.8022, country: "India", region: "Asia" },
  "varanasi": { lat: 25.3176, lon: 82.9739, country: "India", region: "Asia" },
  "srinagar": { lat: 34.0837, lon: 74.7973, country: "India", region: "Asia" },
  "aurangabad": { lat: 19.8762, lon: 75.3433, country: "India", region: "Asia" },
  "dhanbad": { lat: 23.7957, lon: 86.4304, country: "India", region: "Asia" },
  "amritsar": { lat: 31.6340, lon: 74.8723, country: "India", region: "Asia" },
  "navi mumbai": { lat: 19.0330, lon: 73.0297, country: "India", region: "Asia" },
  "allahabad": { lat: 25.4358, lon: 81.8463, country: "India", region: "Asia" },
  "prayagraj": { lat: 25.4358, lon: 81.8463, country: "India", region: "Asia" },
  "ranchi": { lat: 23.3441, lon: 85.3096, country: "India", region: "Asia" },
  "howrah": { lat: 22.5958, lon: 88.2636, country: "India", region: "Asia" },
  "coimbatore": { lat: 11.0168, lon: 76.9558, country: "India", region: "Asia" },
  "jabalpur": { lat: 23.1815, lon: 79.9864, country: "India", region: "Asia" },
  "gwalior": { lat: 26.2183, lon: 78.1828, country: "India", region: "Asia" },
  "vijayawada": { lat: 16.5062, lon: 80.6480, country: "India", region: "Asia" },
  "jodhpur": { lat: 26.2389, lon: 73.0243, country: "India", region: "Asia" },
  "madurai": { lat: 9.9252, lon: 78.1198, country: "India", region: "Asia" },
  "raipur": { lat: 21.2514, lon: 81.6296, country: "India", region: "Asia" },
  "kota": { lat: 25.2138, lon: 75.8648, country: "India", region: "Asia" },
  "chandigarh": { lat: 30.7333, lon: 76.7794, country: "India", region: "Asia" },
  "guwahati": { lat: 26.1445, lon: 91.7362, country: "India", region: "Asia" },
  "solapur": { lat: 17.6599, lon: 75.9064, country: "India", region: "Asia" },
  "hubli": { lat: 15.3647, lon: 75.1240, country: "India", region: "Asia" },
  "mysore": { lat: 12.2958, lon: 76.6394, country: "India", region: "Asia" },
  "mysuru": { lat: 12.2958, lon: 76.6394, country: "India", region: "Asia" },
  "tiruchirappalli": { lat: 10.7905, lon: 78.7047, country: "India", region: "Asia" },
  "trichy": { lat: 10.7905, lon: 78.7047, country: "India", region: "Asia" },
  "bareilly": { lat: 28.3670, lon: 79.4304, country: "India", region: "Asia" },
  "aligarh": { lat: 27.8974, lon: 78.0880, country: "India", region: "Asia" },
  "tiruppur": { lat: 11.1085, lon: 77.3411, country: "India", region: "Asia" },
  "gurgaon": { lat: 28.4595, lon: 77.0266, country: "India", region: "Asia" },
  "gurugram": { lat: 28.4595, lon: 77.0266, country: "India", region: "Asia" },
  "moradabad": { lat: 28.8386, lon: 78.7733, country: "India", region: "Asia" },
  "jalandhar": { lat: 31.3260, lon: 75.5762, country: "India", region: "Asia" },
  "bhubaneswar": { lat: 20.2961, lon: 85.8245, country: "India", region: "Asia" },
  "salem": { lat: 11.6643, lon: 78.1460, country: "India", region: "Asia" },
  "warangal": { lat: 17.9784, lon: 79.5941, country: "India", region: "Asia" },
  "thiruvananthapuram": { lat: 8.5241, lon: 76.9366, country: "India", region: "Asia" },
  "trivandrum": { lat: 8.5241, lon: 76.9366, country: "India", region: "Asia" },
  "kochi": { lat: 9.9312, lon: 76.2673, country: "India", region: "Asia" },
  "cochin": { lat: 9.9312, lon: 76.2673, country: "India", region: "Asia" },
  "dehradun": { lat: 30.3165, lon: 78.0322, country: "India", region: "Asia" },
  "shimla": { lat: 31.1048, lon: 77.1734, country: "India", region: "Asia" },
  "ramgarh": { lat: 23.6298, lon: 85.5614, country: "India", region: "Asia" },
  "noida": { lat: 28.5355, lon: 77.3910, country: "India", region: "Asia" },
  "greater noida": { lat: 28.4744, lon: 77.5040, country: "India", region: "Asia" },
  "panaji": { lat: 15.4909, lon: 73.8278, country: "India", region: "Asia" },
  "goa": { lat: 15.2993, lon: 74.1240, country: "India", region: "Asia" },
  "mangalore": { lat: 12.9141, lon: 74.8560, country: "India", region: "Asia" },
  "imphal": { lat: 24.8170, lon: 93.9368, country: "India", region: "Asia" },
  "shillong": { lat: 25.5788, lon: 91.8933, country: "India", region: "Asia" },
  "aizawl": { lat: 23.7271, lon: 92.7176, country: "India", region: "Asia" },
  "itanagar": { lat: 27.0844, lon: 93.6053, country: "India", region: "Asia" },
  "kohima": { lat: 25.6701, lon: 94.1077, country: "India", region: "Asia" },
  "agartala": { lat: 23.8315, lon: 91.2868, country: "India", region: "Asia" },
  "gangtok": { lat: 27.3389, lon: 88.6065, country: "India", region: "Asia" },
  "jammu": { lat: 32.7266, lon: 74.8570, country: "India", region: "Asia" },
  "udaipur": { lat: 24.5854, lon: 73.7125, country: "India", region: "Asia" },
  "ajmer": { lat: 26.4499, lon: 74.6399, country: "India", region: "Asia" },
  "bhilai": { lat: 21.2093, lon: 81.4285, country: "India", region: "Asia" },
  "bokaro": { lat: 23.6693, lon: 86.1511, country: "India", region: "Asia" },
  "jamshedpur": { lat: 22.8046, lon: 86.2029, country: "India", region: "Asia" },
  "belgaum": { lat: 15.8497, lon: 74.4977, country: "India", region: "Asia" },
  "tirupati": { lat: 13.6288, lon: 79.4192, country: "India", region: "Asia" },
  "nellore": { lat: 14.4426, lon: 79.9865, country: "India", region: "Asia" },
  "guntur": { lat: 16.3067, lon: 80.4365, country: "India", region: "Asia" },
  "kakinada": { lat: 16.9891, lon: 82.2475, country: "India", region: "Asia" },
  // IIT Locations
  "iit delhi": { lat: 28.5450, lon: 77.1926, country: "India", region: "Asia" },
  "iit bombay": { lat: 19.1334, lon: 72.9133, country: "India", region: "Asia" },
  "iit madras": { lat: 12.9915, lon: 80.2336, country: "India", region: "Asia" },
  "iit kanpur": { lat: 26.5123, lon: 80.2329, country: "India", region: "Asia" },
  "iit kharagpur": { lat: 22.3149, lon: 87.3105, country: "India", region: "Asia" },
  "iit roorkee": { lat: 29.8644, lon: 77.8960, country: "India", region: "Asia" },
  "iit guwahati": { lat: 26.1922, lon: 91.6945, country: "India", region: "Asia" },
  "iit hyderabad": { lat: 17.5948, lon: 78.1229, country: "India", region: "Asia" },
  "iit bhu": { lat: 25.2677, lon: 82.9913, country: "India", region: "Asia" },

  // ===================== PAKISTAN CITIES (20+) =====================
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "lahore": { lat: 31.5204, lon: 74.3587, country: "Pakistan", region: "Asia" },
  "faisalabad": { lat: 31.4504, lon: 73.1350, country: "Pakistan", region: "Asia" },
  "rawalpindi": { lat: 33.5651, lon: 73.0169, country: "Pakistan", region: "Asia" },
  "peshawar": { lat: 34.0151, lon: 71.5249, country: "Pakistan", region: "Asia" },
  "quetta": { lat: 30.1798, lon: 66.9750, country: "Pakistan", region: "Asia" },
  "multan": { lat: 30.1575, lon: 71.5249, country: "Pakistan", region: "Asia" },
  "hyderabad pakistan": { lat: 25.3960, lon: 68.3578, country: "Pakistan", region: "Asia" },
  "gujranwala": { lat: 32.1877, lon: 74.1945, country: "Pakistan", region: "Asia" },
  "sialkot": { lat: 32.4945, lon: 74.5229, country: "Pakistan", region: "Asia" },
  "bahawalpur": { lat: 29.3956, lon: 71.6836, country: "Pakistan", region: "Asia" },
  "sargodha": { lat: 32.0740, lon: 72.6861, country: "Pakistan", region: "Asia" },
  "sukkur": { lat: 27.7052, lon: 68.8574, country: "Pakistan", region: "Asia" },
  "larkana": { lat: 27.5570, lon: 68.2141, country: "Pakistan", region: "Asia" },
  "abbottabad": { lat: 34.1688, lon: 73.2215, country: "Pakistan", region: "Asia" },
  "gilgit": { lat: 35.9208, lon: 74.3144, country: "Pakistan", region: "Asia" },
  "muzaffarabad": { lat: 34.3595, lon: 73.4695, country: "Pakistan", region: "Asia" },

  // ===================== SOUTHEAST ASIA (40+) =====================
  "dhaka": { lat: 23.8103, lon: 90.4125, country: "Bangladesh", region: "Asia" },
  "chittagong": { lat: 22.3569, lon: 91.7832, country: "Bangladesh", region: "Asia" },
  "sylhet": { lat: 24.8949, lon: 91.8687, country: "Bangladesh", region: "Asia" },
  "khulna": { lat: 22.8456, lon: 89.5403, country: "Bangladesh", region: "Asia" },
  "rajshahi": { lat: 24.3745, lon: 88.6042, country: "Bangladesh", region: "Asia" },
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Asia" },
  "chiang mai": { lat: 18.7883, lon: 98.9853, country: "Thailand", region: "Asia" },
  "phuket": { lat: 7.8804, lon: 98.3923, country: "Thailand", region: "Asia" },
  "pattaya": { lat: 12.9236, lon: 100.8825, country: "Thailand", region: "Asia" },
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Asia" },
  "kuala lumpur": { lat: 3.1390, lon: 101.6869, country: "Malaysia", region: "Asia" },
  "penang": { lat: 5.4164, lon: 100.3327, country: "Malaysia", region: "Asia" },
  "johor bahru": { lat: 1.4927, lon: 103.7414, country: "Malaysia", region: "Asia" },
  "kota kinabalu": { lat: 5.9804, lon: 116.0735, country: "Malaysia", region: "Asia" },
  "jakarta": { lat: -6.2088, lon: 106.8456, country: "Indonesia", region: "Asia" },
  "surabaya": { lat: -7.2575, lon: 112.7521, country: "Indonesia", region: "Asia" },
  "bandung": { lat: -6.9175, lon: 107.6191, country: "Indonesia", region: "Asia" },
  "bali": { lat: -8.3405, lon: 115.0920, country: "Indonesia", region: "Asia" },
  "denpasar": { lat: -8.6705, lon: 115.2126, country: "Indonesia", region: "Asia" },
  "medan": { lat: 3.5952, lon: 98.6722, country: "Indonesia", region: "Asia" },
  "semarang": { lat: -6.9666, lon: 110.4196, country: "Indonesia", region: "Asia" },
  "yogyakarta": { lat: -7.7956, lon: 110.3695, country: "Indonesia", region: "Asia" },
  "makassar": { lat: -5.1477, lon: 119.4327, country: "Indonesia", region: "Asia" },
  "manila": { lat: 14.5995, lon: 120.9842, country: "Philippines", region: "Asia" },
  "quezon city": { lat: 14.6760, lon: 121.0437, country: "Philippines", region: "Asia" },
  "cebu": { lat: 10.3157, lon: 123.8854, country: "Philippines", region: "Asia" },
  "davao": { lat: 7.1907, lon: 125.4553, country: "Philippines", region: "Asia" },
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Asia" },
  "ho chi minh city": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Asia" },
  "saigon": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Asia" },
  "da nang": { lat: 16.0544, lon: 108.2022, country: "Vietnam", region: "Asia" },
  "hue": { lat: 16.4637, lon: 107.5909, country: "Vietnam", region: "Asia" },
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Asia" },
  "mandalay": { lat: 21.9588, lon: 96.0891, country: "Myanmar", region: "Asia" },
  "naypyidaw": { lat: 19.7633, lon: 96.0785, country: "Myanmar", region: "Asia" },
  "phnom penh": { lat: 11.5564, lon: 104.9282, country: "Cambodia", region: "Asia" },
  "siem reap": { lat: 13.3633, lon: 103.8564, country: "Cambodia", region: "Asia" },
  "vientiane": { lat: 17.9757, lon: 102.6331, country: "Laos", region: "Asia" },
  "kathmandu": { lat: 27.7172, lon: 85.3240, country: "Nepal", region: "Asia" },
  "pokhara": { lat: 28.2096, lon: 83.9856, country: "Nepal", region: "Asia" },
  "colombo": { lat: 6.9271, lon: 79.8612, country: "Sri Lanka", region: "Asia" },
  "kandy": { lat: 7.2906, lon: 80.6337, country: "Sri Lanka", region: "Asia" },
  "galle": { lat: 6.0535, lon: 80.2210, country: "Sri Lanka", region: "Asia" },
  "thimphu": { lat: 27.4728, lon: 89.6390, country: "Bhutan", region: "Asia" },
  "male": { lat: 4.1755, lon: 73.5093, country: "Maldives", region: "Asia" },

  // ===================== AFRICA CITIES (50+) =====================
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "kano": { lat: 12.0022, lon: 8.5919, country: "Nigeria", region: "Africa" },
  "ibadan": { lat: 7.3775, lon: 3.9470, country: "Nigeria", region: "Africa" },
  "port harcourt": { lat: 4.8156, lon: 7.0498, country: "Nigeria", region: "Africa" },
  "johannesburg": { lat: -26.2041, lon: 28.0473, country: "South Africa", region: "Africa" },
  "cape town": { lat: -33.9249, lon: 18.4241, country: "South Africa", region: "Africa" },
  "pretoria": { lat: -25.7461, lon: 28.1881, country: "South Africa", region: "Africa" },
  "durban": { lat: -29.8587, lon: 31.0218, country: "South Africa", region: "Africa" },
  "soweto": { lat: -26.2678, lon: 27.8585, country: "South Africa", region: "Africa" },
  "port elizabeth": { lat: -33.9608, lon: 25.6022, country: "South Africa", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "mombasa": { lat: -4.0435, lon: 39.6682, country: "Kenya", region: "Africa" },
  "kisumu": { lat: -0.1022, lon: 34.7617, country: "Kenya", region: "Africa" },
  "addis ababa": { lat: 9.0320, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "dire dawa": { lat: 9.5931, lon: 41.8661, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "omdurman": { lat: 15.6445, lon: 32.4777, country: "Sudan", region: "Africa" },
  "port sudan": { lat: 19.6158, lon: 37.2164, country: "Sudan", region: "Africa" },
  "casablanca": { lat: 33.5731, lon: -7.5898, country: "Morocco", region: "Africa" },
  "rabat": { lat: 34.0209, lon: -6.8416, country: "Morocco", region: "Africa" },
  "marrakech": { lat: 31.6295, lon: -7.9811, country: "Morocco", region: "Africa" },
  "fez": { lat: 34.0181, lon: -5.0078, country: "Morocco", region: "Africa" },
  "tangier": { lat: 35.7595, lon: -5.8340, country: "Morocco", region: "Africa" },
  "algiers": { lat: 36.7372, lon: 3.0867, country: "Algeria", region: "Africa" },
  "oran": { lat: 35.6969, lon: -0.6331, country: "Algeria", region: "Africa" },
  "constantine": { lat: 36.3650, lon: 6.6147, country: "Algeria", region: "Africa" },
  "tunis": { lat: 36.8065, lon: 10.1815, country: "Tunisia", region: "Africa" },
  "sfax": { lat: 34.7398, lon: 10.7600, country: "Tunisia", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "benghazi": { lat: 32.1167, lon: 20.0667, country: "Libya", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "lubumbashi": { lat: -11.6640, lon: 27.4794, country: "DR Congo", region: "Africa" },
  "luanda": { lat: -8.8390, lon: 13.2894, country: "Angola", region: "Africa" },
  "dar es salaam": { lat: -6.7924, lon: 39.2083, country: "Tanzania", region: "Africa" },
  "dodoma": { lat: -6.1630, lon: 35.7516, country: "Tanzania", region: "Africa" },
  "kampala": { lat: 0.3476, lon: 32.5825, country: "Uganda", region: "Africa" },
  "accra": { lat: 5.6037, lon: -0.1870, country: "Ghana", region: "Africa" },
  "kumasi": { lat: 6.6885, lon: -1.6244, country: "Ghana", region: "Africa" },
  "abidjan": { lat: 5.3600, lon: -4.0083, country: "Ivory Coast", region: "Africa" },
  "dakar": { lat: 14.7167, lon: -17.4677, country: "Senegal", region: "Africa" },
  "bamako": { lat: 12.6392, lon: -8.0029, country: "Mali", region: "Africa" },
  "ouagadougou": { lat: 12.3714, lon: -1.5197, country: "Burkina Faso", region: "Africa" },
  "conakry": { lat: 9.6412, lon: -13.5784, country: "Guinea", region: "Africa" },
  "freetown": { lat: 8.4657, lon: -13.2317, country: "Sierra Leone", region: "Africa" },
  "monrovia": { lat: 6.2907, lon: -10.7605, country: "Liberia", region: "Africa" },
  "maputo": { lat: -25.9692, lon: 32.5732, country: "Mozambique", region: "Africa" },
  "harare": { lat: -17.8252, lon: 31.0335, country: "Zimbabwe", region: "Africa" },
  "lusaka": { lat: -15.3875, lon: 28.3228, country: "Zambia", region: "Africa" },
  "lilongwe": { lat: -13.9626, lon: 33.7741, country: "Malawi", region: "Africa" },
  "antananarivo": { lat: -18.8792, lon: 47.5079, country: "Madagascar", region: "Africa" },
  "mogadishu": { lat: 2.0469, lon: 45.3182, country: "Somalia", region: "Africa" },
  "djibouti": { lat: 11.5721, lon: 43.1456, country: "Djibouti", region: "Africa" },
  "asmara": { lat: 15.3229, lon: 38.9251, country: "Eritrea", region: "Africa" },
  "juba": { lat: 4.8594, lon: 31.5713, country: "South Sudan", region: "Africa" },
  "kigali": { lat: -1.9706, lon: 30.1044, country: "Rwanda", region: "Africa" },
  "bujumbura": { lat: -3.3822, lon: 29.3644, country: "Burundi", region: "Africa" },
  "libreville": { lat: 0.4162, lon: 9.4673, country: "Gabon", region: "Africa" },
  "brazzaville": { lat: -4.2634, lon: 15.2429, country: "Congo", region: "Africa" },
  "yaounde": { lat: 3.8480, lon: 11.5021, country: "Cameroon", region: "Africa" },
  "douala": { lat: 4.0511, lon: 9.7679, country: "Cameroon", region: "Africa" },
  "niamey": { lat: 13.5127, lon: 2.1128, country: "Niger", region: "Africa" },
  "ndjamena": { lat: 12.1348, lon: 15.0557, country: "Chad", region: "Africa" },
  "bangui": { lat: 4.3947, lon: 18.5582, country: "Central African Republic", region: "Africa" },
  "nouakchott": { lat: 18.0735, lon: -15.9582, country: "Mauritania", region: "Africa" },
  "windhoek": { lat: -22.5609, lon: 17.0658, country: "Namibia", region: "Africa" },
  "gaborone": { lat: -24.6282, lon: 25.9231, country: "Botswana", region: "Africa" },

  // ===================== SOUTH/CENTRAL AMERICA (40+) =====================
  "mexico city": { lat: 19.4326, lon: -99.1332, country: "Mexico", region: "North America" },
  "guadalajara": { lat: 20.6597, lon: -103.3496, country: "Mexico", region: "North America" },
  "monterrey": { lat: 25.6866, lon: -100.3161, country: "Mexico", region: "North America" },
  "cancun": { lat: 21.1619, lon: -86.8515, country: "Mexico", region: "North America" },
  "tijuana": { lat: 32.5149, lon: -117.0382, country: "Mexico", region: "North America" },
  "puebla": { lat: 19.0414, lon: -98.2063, country: "Mexico", region: "North America" },
  "merida": { lat: 20.9674, lon: -89.5926, country: "Mexico", region: "North America" },
  "brasilia": { lat: -15.7801, lon: -47.9292, country: "Brazil", region: "South America" },
  "sao paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", region: "South America" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, country: "Brazil", region: "South America" },
  "salvador": { lat: -12.9714, lon: -38.5014, country: "Brazil", region: "South America" },
  "fortaleza": { lat: -3.7172, lon: -38.5433, country: "Brazil", region: "South America" },
  "belo horizonte": { lat: -19.9167, lon: -43.9345, country: "Brazil", region: "South America" },
  "manaus": { lat: -3.1190, lon: -60.0217, country: "Brazil", region: "South America" },
  "curitiba": { lat: -25.4290, lon: -49.2671, country: "Brazil", region: "South America" },
  "recife": { lat: -8.0476, lon: -34.8770, country: "Brazil", region: "South America" },
  "porto alegre": { lat: -30.0346, lon: -51.2177, country: "Brazil", region: "South America" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "South America" },
  "cordoba argentina": { lat: -31.4201, lon: -64.1888, country: "Argentina", region: "South America" },
  "rosario": { lat: -32.9442, lon: -60.6505, country: "Argentina", region: "South America" },
  "mendoza": { lat: -32.8908, lon: -68.8272, country: "Argentina", region: "South America" },
  "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "South America" },
  "valparaiso": { lat: -33.0472, lon: -71.6127, country: "Chile", region: "South America" },
  "concepcion": { lat: -36.8270, lon: -73.0503, country: "Chile", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "arequipa": { lat: -16.4090, lon: -71.5375, country: "Peru", region: "South America" },
  "cusco": { lat: -13.5320, lon: -71.9675, country: "Peru", region: "South America" },
  "bogota": { lat: 4.7110, lon: -74.0721, country: "Colombia", region: "South America" },
  "medellin": { lat: 6.2476, lon: -75.5658, country: "Colombia", region: "South America" },
  "cali": { lat: 3.4516, lon: -76.5320, country: "Colombia", region: "South America" },
  "cartagena": { lat: 10.3910, lon: -75.4794, country: "Colombia", region: "South America" },
  "barranquilla": { lat: 10.9685, lon: -74.7813, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "maracaibo": { lat: 10.6544, lon: -71.6400, country: "Venezuela", region: "South America" },
  "valencia venezuela": { lat: 10.1579, lon: -67.9972, country: "Venezuela", region: "South America" },
  "quito": { lat: -0.1807, lon: -78.4678, country: "Ecuador", region: "South America" },
  "guayaquil": { lat: -2.1894, lon: -79.8891, country: "Ecuador", region: "South America" },
  "la paz": { lat: -16.5000, lon: -68.1500, country: "Bolivia", region: "South America" },
  "santa cruz": { lat: -17.7833, lon: -63.1822, country: "Bolivia", region: "South America" },
  "asuncion": { lat: -25.2637, lon: -57.5759, country: "Paraguay", region: "South America" },
  "montevideo": { lat: -34.9011, lon: -56.1645, country: "Uruguay", region: "South America" },
  "havana": { lat: 23.1136, lon: -82.3666, country: "Cuba", region: "Caribbean" },
  "santiago de cuba": { lat: 20.0220, lon: -75.8301, country: "Cuba", region: "Caribbean" },
  "santo domingo": { lat: 18.4861, lon: -69.9312, country: "Dominican Republic", region: "Caribbean" },
  "port-au-prince": { lat: 18.5944, lon: -72.3074, country: "Haiti", region: "Caribbean" },
  "san juan": { lat: 18.4655, lon: -66.1057, country: "Puerto Rico", region: "Caribbean" },
  "kingston": { lat: 17.9714, lon: -76.7920, country: "Jamaica", region: "Caribbean" },
  "nassau": { lat: 25.0480, lon: -77.3554, country: "Bahamas", region: "Caribbean" },
  "panama city": { lat: 8.9824, lon: -79.5199, country: "Panama", region: "Central America" },
  "san jose costa rica": { lat: 9.9281, lon: -84.0907, country: "Costa Rica", region: "Central America" },
  "guatemala city": { lat: 14.6349, lon: -90.5069, country: "Guatemala", region: "Central America" },
  "san salvador": { lat: 13.6929, lon: -89.2182, country: "El Salvador", region: "Central America" },
  "tegucigalpa": { lat: 14.0723, lon: -87.1921, country: "Honduras", region: "Central America" },
  "managua": { lat: 12.1150, lon: -86.2362, country: "Nicaragua", region: "Central America" },
  "belize city": { lat: 17.5046, lon: -88.1962, country: "Belize", region: "Central America" },

  // ===================== OCEANIA (25+) =====================
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "melbourne": { lat: -37.8136, lon: 144.9631, country: "Australia", region: "Oceania" },
  "brisbane": { lat: -27.4698, lon: 153.0251, country: "Australia", region: "Oceania" },
  "perth": { lat: -31.9505, lon: 115.8605, country: "Australia", region: "Oceania" },
  "adelaide": { lat: -34.9285, lon: 138.6007, country: "Australia", region: "Oceania" },
  "canberra": { lat: -35.2809, lon: 149.1300, country: "Australia", region: "Oceania" },
  "gold coast": { lat: -28.0167, lon: 153.4000, country: "Australia", region: "Oceania" },
  "hobart": { lat: -42.8821, lon: 147.3272, country: "Australia", region: "Oceania" },
  "darwin": { lat: -12.4634, lon: 130.8456, country: "Australia", region: "Oceania" },
  "cairns": { lat: -16.9186, lon: 145.7781, country: "Australia", region: "Oceania" },
  "newcastle australia": { lat: -32.9283, lon: 151.7817, country: "Australia", region: "Oceania" },
  "wollongong": { lat: -34.4278, lon: 150.8931, country: "Australia", region: "Oceania" },
  "auckland": { lat: -36.8485, lon: 174.7633, country: "New Zealand", region: "Oceania" },
  "wellington": { lat: -41.2866, lon: 174.7756, country: "New Zealand", region: "Oceania" },
  "christchurch": { lat: -43.5321, lon: 172.6362, country: "New Zealand", region: "Oceania" },
  "queenstown": { lat: -45.0312, lon: 168.6626, country: "New Zealand", region: "Oceania" },
  "dunedin": { lat: -45.8788, lon: 170.5028, country: "New Zealand", region: "Oceania" },
  "hamilton nz": { lat: -37.7870, lon: 175.2793, country: "New Zealand", region: "Oceania" },
  "suva": { lat: -18.1416, lon: 178.4419, country: "Fiji", region: "Oceania" },
  "port moresby": { lat: -9.4438, lon: 147.1803, country: "Papua New Guinea", region: "Oceania" },
  "noumea": { lat: -22.2758, lon: 166.4580, country: "New Caledonia", region: "Oceania" },
  "papeete": { lat: -17.5350, lon: -149.5696, country: "French Polynesia", region: "Oceania" },
  "apia": { lat: -13.8333, lon: -171.7500, country: "Samoa", region: "Oceania" },
  "nuku alofa": { lat: -21.2085, lon: -175.1982, country: "Tonga", region: "Oceania" },
  "port vila": { lat: -17.7333, lon: 168.3167, country: "Vanuatu", region: "Oceania" },

  // ===================== CENTRAL ASIA (15+) =====================
  "astana": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Asia" },
  "nur-sultan": { lat: 51.1694, lon: 71.4491, country: "Kazakhstan", region: "Asia" },
  "almaty": { lat: 43.2220, lon: 76.8512, country: "Kazakhstan", region: "Asia" },
  "tashkent": { lat: 41.2995, lon: 69.2401, country: "Uzbekistan", region: "Asia" },
  "samarkand": { lat: 39.6542, lon: 66.9597, country: "Uzbekistan", region: "Asia" },
  "bukhara": { lat: 39.7681, lon: 64.4556, country: "Uzbekistan", region: "Asia" },
  "bishkek": { lat: 42.8746, lon: 74.5698, country: "Kyrgyzstan", region: "Asia" },
  "dushanbe": { lat: 38.5598, lon: 68.7870, country: "Tajikistan", region: "Asia" },
  "ashgabat": { lat: 37.9601, lon: 58.3261, country: "Turkmenistan", region: "Asia" },
  "ulaanbaatar": { lat: 47.8864, lon: 106.9057, country: "Mongolia", region: "Asia" },
};

// Extract specific location from news content using pattern matching
function extractLocationFromContent(title: string, description: string): { city: string | null; lat: number | null; lon: number | null; country: string | null; region: string | null } {
  const text = `${title} ${description}`.toLowerCase();
  
  // Sort city names by length (longest first) to match more specific locations first
  const sortedCities = Object.keys(cityCoordinates).sort((a, b) => b.length - a.length);
  
  for (const cityName of sortedCities) {
    // Use word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      const cityData = cityCoordinates[cityName];
      return {
        city: cityName,
        lat: cityData.lat,
        lon: cityData.lon,
        country: cityData.country,
        region: cityData.region,
      };
    }
  }
  
  return { city: null, lat: null, lon: null, country: null, region: null };
}

// Country code to full name
const countryNames: Record<string, string> = {
  "us": "United States",
  "gb": "United Kingdom",
  "de": "Germany",
  "fr": "France",
  "ru": "Russia",
  "cn": "China",
  "jp": "Japan",
  "in": "India",
  "br": "Brazil",
  "au": "Australia",
  "za": "South Africa",
  "eg": "Egypt",
  "sa": "Saudi Arabia",
  "ir": "Iran",
  "il": "Israel",
  "ua": "Ukraine",
  "kr": "South Korea",
  "mx": "Mexico",
  "ca": "Canada",
  "ng": "Nigeria",
  "pk": "Pakistan",
  "tr": "Turkey",
  "ae": "UAE",
  "sg": "Singapore",
  "it": "Italy",
  "es": "Spain",
  "nl": "Netherlands",
  "be": "Belgium",
  "ie": "Ireland",
  "nz": "New Zealand",
};

function detectThreatLevel(title: string, description: string): "critical" | "high" | "elevated" | "low" {
  const text = `${title} ${description}`.toLowerCase();
  
  if (criticalKeywords.some(kw => text.includes(kw))) return "critical";
  if (highKeywords.some(kw => text.includes(kw))) return "high";
  if (elevatedKeywords.some(kw => text.includes(kw))) return "elevated";
  return "low";
}

function detectCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes("military") || text.includes("attack") || text.includes("defense") || text.includes("security")) {
    return "security";
  }
  if (text.includes("war") || text.includes("conflict") || text.includes("troops") || text.includes("combat")) {
    return "conflict";
  }
  if (text.includes("diplomat") || text.includes("treaty") || text.includes("summit") || text.includes("relations")) {
    return "diplomacy";
  }
  if (text.includes("economy") || text.includes("trade") || text.includes("market") || text.includes("financial")) {
    return "economy";
  }
  if (text.includes("humanitarian") || text.includes("refugee") || text.includes("aid") || text.includes("disaster")) {
    return "humanitarian";
  }
  if (text.includes("tech") || text.includes("cyber") || text.includes("digital") || text.includes("ai")) {
    return "technology";
  }
  
  return "security";
}

function extractTags(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const tags: string[] = [];
  
  const tagKeywords = [
    "military", "terrorism", "cyber", "economy", "trade", "politics",
    "election", "climate", "energy", "nuclear", "sanctions", "protest",
    "refugee", "humanitarian", "technology", "ai", "defense", "security"
  ];
  
  tagKeywords.forEach(tag => {
    if (text.includes(tag) && tags.length < 5) {
      tags.push(tag);
    }
  });
  
  return tags.length > 0 ? tags : ["breaking-news"];
}

function detectCountryFromContent(title: string, description: string, sourceCountry?: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  const countryPatterns: Record<string, string[]> = {
    "ua": ["ukraine", "kyiv", "kiev", "ukrainian", "zelensky"],
    "ru": ["russia", "russian", "moscow", "kremlin", "putin"],
    "cn": ["china", "chinese", "beijing", "xi jinping"],
    "ir": ["iran", "iranian", "tehran"],
    "il": ["israel", "israeli", "tel aviv", "jerusalem", "netanyahu", "gaza", "hamas"],
    "gb": ["britain", "british", "uk ", "london", "england", "wales", "scotland", "westminster"],
    "de": ["germany", "german", "berlin", "merkel", "scholz"],
    "fr": ["france", "french", "paris", "macron"],
    "sa": ["saudi", "riyadh"],
    "tr": ["turkey", "turkish", "ankara", "erdogan"],
    "pk": ["pakistan", "pakistani", "islamabad", "karachi"],
    "in": ["india", "indian", "delhi", "mumbai", "modi"],
    "kr": ["south korea", "korean", "seoul"],
    "jp": ["japan", "japanese", "tokyo"],
    "au": ["australia", "australian", "sydney", "melbourne", "canberra"],
    "ca": ["canada", "canadian", "ottawa", "toronto"],
    "mx": ["mexico", "mexican", "mexico city"],
    "br": ["brazil", "brazilian", "brasilia", "sao paulo"],
    "eg": ["egypt", "egyptian", "cairo"],
    "za": ["south africa", "pretoria", "johannesburg"],
    "ng": ["nigeria", "nigerian", "lagos", "abuja"],
    "ae": ["uae", "dubai", "abu dhabi", "emirates"],
    "sg": ["singapore"],
    "it": ["italy", "italian", "rome", "milan"],
    "es": ["spain", "spanish", "madrid", "barcelona"],
    "nl": ["netherlands", "dutch", "amsterdam", "holland"],
    "nz": ["new zealand", "wellington", "auckland"],
    "us": ["united states", "u.s.", "america", "washington", "pentagon", "white house", "trump", "biden"],
  };
  
  // Check content first for more accurate detection
  for (const [code, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(p => text.includes(p))) {
      return code;
    }
  }
  
  // Use source country from API if available and valid
  if (sourceCountry && countryCoordinates[sourceCountry]) {
    return sourceCountry;
  }
  
  return "us"; // Default fallback
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    console.log("Fetching news for user:", userId);

    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    const mediastackApiKey = Deno.env.get("MEDIASTACK_API_KEY");
    
    if (!newsApiKey && !mediastackApiKey) {
      console.error("No news API keys configured");
      return new Response(JSON.stringify({ error: "No news API configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allArticles: any[] = [];

    // ==================== NEWSAPI.ORG ====================
    if (newsApiKey) {
      console.log("Fetching from NewsAPI.org...");
      
      // Fetch breaking news from multiple countries worldwide
      const countries = ["us", "gb", "au", "ca", "in", "za", "ae", "sg", "de", "fr", "it", "es", "nl", "be", "ie", "nz"];

      // Fetch top headlines from each country for global coverage
      for (const country of countries) {
        try {
          const response = await fetch(
            `https://newsapi.org/v2/top-headlines?country=${country}&pageSize=5`,
            {
              headers: {
                "X-Api-Key": newsApiKey,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.articles) {
              allArticles.push(...data.articles.map((a: any) => ({ ...a, sourceCountry: country, apiSource: "newsapi" })));
            }
          } else {
            console.error(`NewsAPI: Failed to fetch ${country}:`, response.status);
          }
        } catch (err) {
          console.error(`NewsAPI: Error fetching ${country}:`, err);
        }
      }

      // Fetch latest breaking news globally with broad development keywords
      const breakingQueries = [
        "breaking OR developing OR urgent",
        "government OR parliament OR minister OR president",
        "military OR defense OR troops OR security",
        "economy OR market OR trade OR sanctions",
        "protest OR strike OR election OR vote",
        "disaster OR emergency OR crisis OR humanitarian"
      ];

      for (const query of breakingQueries) {
        try {
          const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 24 hours
          const response = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=10`,
            {
              headers: {
                "X-Api-Key": newsApiKey,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.articles) {
              allArticles.push(...data.articles.map((a: any) => ({ ...a, queryType: query, apiSource: "newsapi" })));
            }
          }
        } catch (err) {
          console.error(`NewsAPI: Error fetching query "${query}":`, err);
        }
      }
      
      console.log(`NewsAPI: Fetched ${allArticles.filter(a => a.apiSource === "newsapi").length} articles`);
    }

    // ==================== MEDIASTACK ====================
    if (mediastackApiKey) {
      console.log("Fetching from Mediastack...");
      
      // Mediastack countries - using ISO codes
      const mediastackCountries = ["us", "gb", "au", "ca", "in", "de", "fr", "it", "es", "jp", "cn", "ru", "br", "za", "ae"];
      
      for (const country of mediastackCountries) {
        try {
          const response = await fetch(
            `http://api.mediastack.com/v1/news?access_key=${mediastackApiKey}&countries=${country}&languages=en&limit=5&sort=published_desc`,
          );

          if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
              // Transform Mediastack format to match our structure
              const transformedArticles = data.data.map((article: any) => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: { name: article.source },
                publishedAt: article.published_at,
                content: article.description,
                sourceCountry: country,
                apiSource: "mediastack",
              }));
              allArticles.push(...transformedArticles);
            }
          } else {
            console.error(`Mediastack: Failed to fetch ${country}:`, response.status);
          }
        } catch (err) {
          console.error(`Mediastack: Error fetching ${country}:`, err);
        }
      }

      // Fetch breaking/live news with keywords
      const mediastackKeywords = ["breaking", "military", "government", "crisis", "economy"];
      
      for (const keyword of mediastackKeywords) {
        try {
          const response = await fetch(
            `http://api.mediastack.com/v1/news?access_key=${mediastackApiKey}&keywords=${keyword}&languages=en&limit=10&sort=published_desc`,
          );

          if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
              const transformedArticles = data.data.map((article: any) => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: { name: article.source },
                publishedAt: article.published_at,
                content: article.description,
                queryType: keyword,
                apiSource: "mediastack",
              }));
              allArticles.push(...transformedArticles);
            }
          }
        } catch (err) {
          console.error(`Mediastack: Error fetching keyword "${keyword}":`, err);
        }
      }
      
      console.log(`Mediastack: Fetched ${allArticles.filter(a => a.apiSource === "mediastack").length} articles`);
    }

    console.log(`Fetched ${allArticles.length} articles total`);

    // Deduplicate by title
    const uniqueArticles = allArticles.filter((article, index, self) =>
      article.title && 
      article.title !== "[Removed]" &&
      index === self.findIndex(a => a.title === article.title)
    );

    console.log(`${uniqueArticles.length} unique articles after deduplication`);

    // Get existing URLs to avoid duplicates
    const { data: existingItems } = await supabaseClient
      .from("news_items")
      .select("url")
      .order("created_at", { ascending: false })
      .limit(500);

    const existingUrls = new Set(existingItems?.map(item => item.url) || []);

    // Transform and insert new articles
    const newArticles = uniqueArticles
      .filter(article => article.url && !existingUrls.has(article.url))
      .slice(0, 30); // Limit to 30 new articles per fetch

    console.log(`${newArticles.length} new articles to insert`);

    let insertedCount = 0;

    for (const article of newArticles) {
      const title = article.title || "Untitled";
      const description = article.description || article.content || "";
      
      // STEP 1: Try to extract specific city/location from content
      const extractedLocation = extractLocationFromContent(title, description);
      
      let finalLat: number;
      let finalLon: number;
      let finalCountry: string;
      let finalRegion: string;
      
      if (extractedLocation.lat && extractedLocation.lon) {
        // Use precise city coordinates with minimal offset for accuracy
        const microOffset = 0.01; // Very small offset to avoid exact overlaps
        finalLat = extractedLocation.lat + (Math.random() - 0.5) * microOffset;
        finalLon = extractedLocation.lon + (Math.random() - 0.5) * microOffset;
        finalCountry = extractedLocation.country || "Unknown";
        finalRegion = extractedLocation.region || "Global";
        console.log(`Precise location found: ${extractedLocation.city} -> ${finalLat}, ${finalLon}`);
      } else {
        // STEP 2: Fall back to country-level detection with larger offset
        const countryCode = detectCountryFromContent(title, description, article.sourceCountry);
        const coords = countryCoordinates[countryCode] || countryCoordinates["default"];
        
        // Use country-specific safe offset range
        const offsetRange = coords.offsetRange || 0.2;
        finalLat = coords.lat + (Math.random() - 0.5) * offsetRange;
        finalLon = coords.lon + (Math.random() - 0.5) * offsetRange;
        finalCountry = countryNames[countryCode] || "Unknown";
        finalRegion = coords.region;
        console.log(`Country-level location: ${countryCode} -> ${finalLat}, ${finalLon}`);
      }
      
      const newsItem = {
        title: title.substring(0, 255),
        summary: description.substring(0, 1000) || "No description available.",
        url: article.url,
        source: article.source?.name || "Unknown Source",
        source_credibility: "medium" as const,
        published_at: article.publishedAt || new Date().toISOString(),
        lat: finalLat,
        lon: finalLon,
        country: finalCountry,
        region: finalRegion,
        tags: extractTags(title, description),
        confidence_score: extractedLocation.lat ? 0.9 : 0.7, // Higher confidence for precise locations
        confidence_level: "developing" as const,
        threat_level: detectThreatLevel(title, description),
        actor_type: "organization" as const,
        category: detectCategory(title, description) as any,
        user_id: userId,
      };

      const { error: insertError } = await supabaseClient
        .from("news_items")
        .insert(newsItem);

      if (insertError) {
        console.error("Error inserting article:", insertError.message);
      } else {
        insertedCount++;
      }
    }

    console.log(`Successfully inserted ${insertedCount} new articles`);

    return new Response(
      JSON.stringify({
        success: true,
        fetched: uniqueArticles.length,
        inserted: insertedCount,
        message: `Fetched ${uniqueArticles.length} articles, inserted ${insertedCount} new items`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-news:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
