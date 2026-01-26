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

// Comprehensive city database for precise geolocation
const cityCoordinates: Record<string, { lat: number; lon: number; country: string; region: string }> = {
  // USA cities
  "washington": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "washington dc": { lat: 38.9072, lon: -77.0369, country: "United States", region: "North America" },
  "new york": { lat: 40.7128, lon: -74.0060, country: "United States", region: "North America" },
  "los angeles": { lat: 34.0522, lon: -118.2437, country: "United States", region: "North America" },
  "chicago": { lat: 41.8781, lon: -87.6298, country: "United States", region: "North America" },
  "houston": { lat: 29.7604, lon: -95.3698, country: "United States", region: "North America" },
  "phoenix": { lat: 33.4484, lon: -112.0740, country: "United States", region: "North America" },
  "philadelphia": { lat: 39.9526, lon: -75.1652, country: "United States", region: "North America" },
  "san francisco": { lat: 37.7749, lon: -122.4194, country: "United States", region: "North America" },
  "seattle": { lat: 47.6062, lon: -122.3321, country: "United States", region: "North America" },
  "miami": { lat: 25.7617, lon: -80.1918, country: "United States", region: "North America" },
  "atlanta": { lat: 33.7490, lon: -84.3880, country: "United States", region: "North America" },
  "boston": { lat: 42.3601, lon: -71.0589, country: "United States", region: "North America" },
  "dallas": { lat: 32.7767, lon: -96.7970, country: "United States", region: "North America" },
  "denver": { lat: 39.7392, lon: -104.9903, country: "United States", region: "North America" },
  "pentagon": { lat: 38.8719, lon: -77.0563, country: "United States", region: "North America" },
  "white house": { lat: 38.8977, lon: -77.0365, country: "United States", region: "North America" },
  
  // UK cities
  "london": { lat: 51.5074, lon: -0.1278, country: "United Kingdom", region: "Europe" },
  "manchester": { lat: 53.4808, lon: -2.2426, country: "United Kingdom", region: "Europe" },
  "birmingham": { lat: 52.4862, lon: -1.8904, country: "United Kingdom", region: "Europe" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, country: "United Kingdom", region: "Europe" },
  "glasgow": { lat: 55.8642, lon: -4.2518, country: "United Kingdom", region: "Europe" },
  "liverpool": { lat: 53.4084, lon: -2.9916, country: "United Kingdom", region: "Europe" },
  "bristol": { lat: 51.4545, lon: -2.5879, country: "United Kingdom", region: "Europe" },
  "leeds": { lat: 53.8008, lon: -1.5491, country: "United Kingdom", region: "Europe" },
  "westminster": { lat: 51.4975, lon: -0.1357, country: "United Kingdom", region: "Europe" },
  
  // European cities
  "paris": { lat: 48.8566, lon: 2.3522, country: "France", region: "Europe" },
  "marseille": { lat: 43.2965, lon: 5.3698, country: "France", region: "Europe" },
  "lyon": { lat: 45.7640, lon: 4.8357, country: "France", region: "Europe" },
  "berlin": { lat: 52.5200, lon: 13.4050, country: "Germany", region: "Europe" },
  "munich": { lat: 48.1351, lon: 11.5820, country: "Germany", region: "Europe" },
  "frankfurt": { lat: 50.1109, lon: 8.6821, country: "Germany", region: "Europe" },
  "hamburg": { lat: 53.5511, lon: 9.9937, country: "Germany", region: "Europe" },
  "rome": { lat: 41.9028, lon: 12.4964, country: "Italy", region: "Europe" },
  "milan": { lat: 45.4642, lon: 9.1900, country: "Italy", region: "Europe" },
  "naples": { lat: 40.8518, lon: 14.2681, country: "Italy", region: "Europe" },
  "madrid": { lat: 40.4168, lon: -3.7038, country: "Spain", region: "Europe" },
  "barcelona": { lat: 41.3851, lon: 2.1734, country: "Spain", region: "Europe" },
  "amsterdam": { lat: 52.3676, lon: 4.9041, country: "Netherlands", region: "Europe" },
  "brussels": { lat: 50.8503, lon: 4.3517, country: "Belgium", region: "Europe" },
  "vienna": { lat: 48.2082, lon: 16.3738, country: "Austria", region: "Europe" },
  "zurich": { lat: 47.3769, lon: 8.5417, country: "Switzerland", region: "Europe" },
  "geneva": { lat: 46.2044, lon: 6.1432, country: "Switzerland", region: "Europe" },
  "stockholm": { lat: 59.3293, lon: 18.0686, country: "Sweden", region: "Europe" },
  "oslo": { lat: 59.9139, lon: 10.7522, country: "Norway", region: "Europe" },
  "copenhagen": { lat: 55.6761, lon: 12.5683, country: "Denmark", region: "Europe" },
  "helsinki": { lat: 60.1699, lon: 24.9384, country: "Finland", region: "Europe" },
  "dublin": { lat: 53.3498, lon: -6.2603, country: "Ireland", region: "Europe" },
  "lisbon": { lat: 38.7223, lon: -9.1393, country: "Portugal", region: "Europe" },
  "athens": { lat: 37.9838, lon: 23.7275, country: "Greece", region: "Europe" },
  "warsaw": { lat: 52.2297, lon: 21.0122, country: "Poland", region: "Europe" },
  "prague": { lat: 50.0755, lon: 14.4378, country: "Czech Republic", region: "Europe" },
  "budapest": { lat: 47.4979, lon: 19.0402, country: "Hungary", region: "Europe" },
  "bucharest": { lat: 44.4268, lon: 26.1025, country: "Romania", region: "Europe" },
  
  // Eastern Europe / Russia
  "moscow": { lat: 55.7558, lon: 37.6173, country: "Russia", region: "Europe" },
  "st petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "saint petersburg": { lat: 59.9343, lon: 30.3351, country: "Russia", region: "Europe" },
  "kremlin": { lat: 55.7520, lon: 37.6175, country: "Russia", region: "Europe" },
  "kyiv": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kiev": { lat: 50.4501, lon: 30.5234, country: "Ukraine", region: "Europe" },
  "kharkiv": { lat: 49.9935, lon: 36.2304, country: "Ukraine", region: "Europe" },
  "odesa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "odessa": { lat: 46.4825, lon: 30.7233, country: "Ukraine", region: "Europe" },
  "lviv": { lat: 49.8397, lon: 24.0297, country: "Ukraine", region: "Europe" },
  "mariupol": { lat: 47.0945, lon: 37.5494, country: "Ukraine", region: "Europe" },
  "donetsk": { lat: 48.0159, lon: 37.8029, country: "Ukraine", region: "Europe" },
  "crimea": { lat: 44.9521, lon: 34.1024, country: "Ukraine", region: "Europe" },
  "sevastopol": { lat: 44.6167, lon: 33.5167, country: "Ukraine", region: "Europe" },
  "minsk": { lat: 53.9006, lon: 27.5590, country: "Belarus", region: "Europe" },
  
  // Middle East
  "jerusalem": { lat: 31.7683, lon: 35.2137, country: "Israel", region: "Middle East" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, country: "Israel", region: "Middle East" },
  "gaza": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "gaza city": { lat: 31.5017, lon: 34.4668, country: "Palestine", region: "Middle East" },
  "rafah": { lat: 31.2969, lon: 34.2408, country: "Palestine", region: "Middle East" },
  "khan younis": { lat: 31.3444, lon: 34.3089, country: "Palestine", region: "Middle East" },
  "west bank": { lat: 31.9474, lon: 35.2272, country: "Palestine", region: "Middle East" },
  "ramallah": { lat: 31.9038, lon: 35.2034, country: "Palestine", region: "Middle East" },
  "tehran": { lat: 35.6892, lon: 51.3890, country: "Iran", region: "Middle East" },
  "isfahan": { lat: 32.6546, lon: 51.6680, country: "Iran", region: "Middle East" },
  "riyadh": { lat: 24.7136, lon: 46.6753, country: "Saudi Arabia", region: "Middle East" },
  "jeddah": { lat: 21.4858, lon: 39.1925, country: "Saudi Arabia", region: "Middle East" },
  "mecca": { lat: 21.3891, lon: 39.8579, country: "Saudi Arabia", region: "Middle East" },
  "medina": { lat: 24.5247, lon: 39.5692, country: "Saudi Arabia", region: "Middle East" },
  "dubai": { lat: 25.2048, lon: 55.2708, country: "UAE", region: "Middle East" },
  "abu dhabi": { lat: 24.4539, lon: 54.3773, country: "UAE", region: "Middle East" },
  "doha": { lat: 25.2854, lon: 51.5310, country: "Qatar", region: "Middle East" },
  "ankara": { lat: 39.9334, lon: 32.8597, country: "Turkey", region: "Middle East" },
  "istanbul": { lat: 41.0082, lon: 28.9784, country: "Turkey", region: "Middle East" },
  "beirut": { lat: 33.8938, lon: 35.5018, country: "Lebanon", region: "Middle East" },
  "damascus": { lat: 33.5138, lon: 36.2765, country: "Syria", region: "Middle East" },
  "aleppo": { lat: 36.2021, lon: 37.1343, country: "Syria", region: "Middle East" },
  "baghdad": { lat: 33.3152, lon: 44.3661, country: "Iraq", region: "Middle East" },
  "amman": { lat: 31.9454, lon: 35.9284, country: "Jordan", region: "Middle East" },
  "cairo": { lat: 30.0444, lon: 31.2357, country: "Egypt", region: "Middle East" },
  "alexandria": { lat: 31.2001, lon: 29.9187, country: "Egypt", region: "Middle East" },
  "kabul": { lat: 34.5553, lon: 69.2075, country: "Afghanistan", region: "Middle East" },
  "sanaa": { lat: 15.3694, lon: 44.1910, country: "Yemen", region: "Middle East" },
  "aden": { lat: 12.7797, lon: 45.0095, country: "Yemen", region: "Middle East" },
  
  // Asia - China
  "beijing": { lat: 39.9042, lon: 116.4074, country: "China", region: "Asia" },
  "shanghai": { lat: 31.2304, lon: 121.4737, country: "China", region: "Asia" },
  "hong kong": { lat: 22.3193, lon: 114.1694, country: "China", region: "Asia" },
  "guangzhou": { lat: 23.1291, lon: 113.2644, country: "China", region: "Asia" },
  "shenzhen": { lat: 22.5431, lon: 114.0579, country: "China", region: "Asia" },
  "taipei": { lat: 25.0330, lon: 121.5654, country: "Taiwan", region: "Asia" },
  "tokyo": { lat: 35.6762, lon: 139.6503, country: "Japan", region: "Asia" },
  "osaka": { lat: 34.6937, lon: 135.5023, country: "Japan", region: "Asia" },
  "seoul": { lat: 37.5665, lon: 126.9780, country: "South Korea", region: "Asia" },
  "pyongyang": { lat: 39.0392, lon: 125.7625, country: "North Korea", region: "Asia" },
  
  // India - Major Cities
  "new delhi": { lat: 28.6139, lon: 77.2090, country: "India", region: "Asia" },
  "delhi": { lat: 28.7041, lon: 77.1025, country: "India", region: "Asia" },
  "mumbai": { lat: 19.0760, lon: 72.8777, country: "India", region: "Asia" },
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
  
  // IIT Locations (important for tech news)
  "iit delhi": { lat: 28.5450, lon: 77.1926, country: "India", region: "Asia" },
  "iit bombay": { lat: 19.1334, lon: 72.9133, country: "India", region: "Asia" },
  "iit madras": { lat: 12.9915, lon: 80.2336, country: "India", region: "Asia" },
  "iit kanpur": { lat: 26.5123, lon: 80.2329, country: "India", region: "Asia" },
  "iit kharagpur": { lat: 22.3149, lon: 87.3105, country: "India", region: "Asia" },
  "iit roorkee": { lat: 29.8644, lon: 77.8960, country: "India", region: "Asia" },
  "iit guwahati": { lat: 26.1922, lon: 91.6945, country: "India", region: "Asia" },
  
  // Pakistan
  "islamabad": { lat: 33.6844, lon: 73.0479, country: "Pakistan", region: "Asia" },
  "karachi": { lat: 24.8607, lon: 67.0011, country: "Pakistan", region: "Asia" },
  "lahore": { lat: 31.5204, lon: 74.3587, country: "Pakistan", region: "Asia" },
  "faisalabad": { lat: 31.4504, lon: 73.1350, country: "Pakistan", region: "Asia" },
  "rawalpindi": { lat: 33.5651, lon: 73.0169, country: "Pakistan", region: "Asia" },
  "peshawar": { lat: 34.0151, lon: 71.5249, country: "Pakistan", region: "Asia" },
  "quetta": { lat: 30.1798, lon: 66.9750, country: "Pakistan", region: "Asia" },
  
  // Other South/Southeast Asia
  "dhaka": { lat: 23.8103, lon: 90.4125, country: "Bangladesh", region: "Asia" },
  "chittagong": { lat: 22.3569, lon: 91.7832, country: "Bangladesh", region: "Asia" },
  "bangkok": { lat: 13.7563, lon: 100.5018, country: "Thailand", region: "Asia" },
  "singapore": { lat: 1.3521, lon: 103.8198, country: "Singapore", region: "Asia" },
  "kuala lumpur": { lat: 3.1390, lon: 101.6869, country: "Malaysia", region: "Asia" },
  "jakarta": { lat: -6.2088, lon: 106.8456, country: "Indonesia", region: "Asia" },
  "manila": { lat: 14.5995, lon: 120.9842, country: "Philippines", region: "Asia" },
  "hanoi": { lat: 21.0278, lon: 105.8342, country: "Vietnam", region: "Asia" },
  "ho chi minh city": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Asia" },
  "saigon": { lat: 10.8231, lon: 106.6297, country: "Vietnam", region: "Asia" },
  "yangon": { lat: 16.8661, lon: 96.1951, country: "Myanmar", region: "Asia" },
  "kathmandu": { lat: 27.7172, lon: 85.3240, country: "Nepal", region: "Asia" },
  "colombo": { lat: 6.9271, lon: 79.8612, country: "Sri Lanka", region: "Asia" },
  
  // Africa
  "lagos": { lat: 6.5244, lon: 3.3792, country: "Nigeria", region: "Africa" },
  "abuja": { lat: 9.0765, lon: 7.3986, country: "Nigeria", region: "Africa" },
  "johannesburg": { lat: -26.2041, lon: 28.0473, country: "South Africa", region: "Africa" },
  "cape town": { lat: -33.9249, lon: 18.4241, country: "South Africa", region: "Africa" },
  "pretoria": { lat: -25.7461, lon: 28.1881, country: "South Africa", region: "Africa" },
  "nairobi": { lat: -1.2921, lon: 36.8219, country: "Kenya", region: "Africa" },
  "addis ababa": { lat: 9.0320, lon: 38.7469, country: "Ethiopia", region: "Africa" },
  "khartoum": { lat: 15.5007, lon: 32.5599, country: "Sudan", region: "Africa" },
  "casablanca": { lat: 33.5731, lon: -7.5898, country: "Morocco", region: "Africa" },
  "algiers": { lat: 36.7372, lon: 3.0867, country: "Algeria", region: "Africa" },
  "tunis": { lat: 36.8065, lon: 10.1815, country: "Tunisia", region: "Africa" },
  "tripoli": { lat: 32.8872, lon: 13.1913, country: "Libya", region: "Africa" },
  "kinshasa": { lat: -4.4419, lon: 15.2663, country: "DR Congo", region: "Africa" },
  "dar es salaam": { lat: -6.7924, lon: 39.2083, country: "Tanzania", region: "Africa" },
  "accra": { lat: 5.6037, lon: -0.1870, country: "Ghana", region: "Africa" },
  
  // Americas
  "ottawa": { lat: 45.4215, lon: -75.6972, country: "Canada", region: "North America" },
  "toronto": { lat: 43.6532, lon: -79.3832, country: "Canada", region: "North America" },
  "vancouver": { lat: 49.2827, lon: -123.1207, country: "Canada", region: "North America" },
  "montreal": { lat: 45.5017, lon: -73.5673, country: "Canada", region: "North America" },
  "mexico city": { lat: 19.4326, lon: -99.1332, country: "Mexico", region: "North America" },
  "guadalajara": { lat: 20.6597, lon: -103.3496, country: "Mexico", region: "North America" },
  "brasilia": { lat: -15.7801, lon: -47.9292, country: "Brazil", region: "South America" },
  "sao paulo": { lat: -23.5505, lon: -46.6333, country: "Brazil", region: "South America" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, country: "Brazil", region: "South America" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "South America" },
  "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "South America" },
  "lima": { lat: -12.0464, lon: -77.0428, country: "Peru", region: "South America" },
  "bogota": { lat: 4.7110, lon: -74.0721, country: "Colombia", region: "South America" },
  "caracas": { lat: 10.4806, lon: -66.9036, country: "Venezuela", region: "South America" },
  "havana": { lat: 23.1136, lon: -82.3666, country: "Cuba", region: "Caribbean" },
  
  // Oceania
  "sydney": { lat: -33.8688, lon: 151.2093, country: "Australia", region: "Oceania" },
  "melbourne": { lat: -37.8136, lon: 144.9631, country: "Australia", region: "Oceania" },
  "brisbane": { lat: -27.4698, lon: 153.0251, country: "Australia", region: "Oceania" },
  "perth": { lat: -31.9505, lon: 115.8605, country: "Australia", region: "Oceania" },
  "canberra": { lat: -35.2809, lon: 149.1300, country: "Australia", region: "Oceania" },
  "auckland": { lat: -36.8485, lon: 174.7633, country: "New Zealand", region: "Oceania" },
  "wellington": { lat: -41.2866, lon: 174.7756, country: "New Zealand", region: "Oceania" },
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
