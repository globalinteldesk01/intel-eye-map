import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OSINT-focused search topics for geopolitical intelligence
const OSINT_TOPICS = [
  'military conflict breaking news',
  'terrorism attack threat',
  'civil unrest protests',
  'coup government overthrow',
  'diplomatic crisis international',
  'sanctions embargo',
  'missile strike bombing',
  'humanitarian crisis emergency',
  'border conflict tension',
  'cyber attack infrastructure'
];

// ==================== EXPANDED LOCATION DATABASE ====================
// Multi-word locations checked FIRST (before single-word country scan)
const MULTI_WORD_LOCATIONS: Array<{ keywords: string[]; country: string; lat: number; lon: number; region: string }> = [
  // Conflict-zone cities
  { keywords: ['khan younis', 'khan yunis'], country: 'Palestine', lat: 31.3462, lon: 34.3061, region: 'Middle East' },
  { keywords: ['rafah crossing', 'rafah border'], country: 'Palestine', lat: 31.2747, lon: 34.2475, region: 'Middle East' },
  { keywords: ['south china sea'], country: 'China', lat: 14.5, lon: 115.0, region: 'East Asia' },
  { keywords: ['red sea'], country: 'Yemen', lat: 15.5, lon: 40.0, region: 'Middle East' },
  { keywords: ['west bank'], country: 'Palestine', lat: 31.95, lon: 35.25, region: 'Middle East' },
  { keywords: ['golan heights'], country: 'Syria', lat: 33.1, lon: 35.8, region: 'Middle East' },
  { keywords: ['strait of hormuz', 'hormuz strait'], country: 'Iran', lat: 26.6, lon: 56.3, region: 'Middle East' },
  { keywords: ['suez canal'], country: 'Egypt', lat: 30.45, lon: 32.35, region: 'North Africa' },
  { keywords: ['bab el mandeb', 'bab al-mandab'], country: 'Yemen', lat: 12.58, lon: 43.33, region: 'Middle East' },
  { keywords: ['black sea'], country: 'Ukraine', lat: 43.5, lon: 34.0, region: 'Eastern Europe' },
  { keywords: ['taiwan strait'], country: 'Taiwan', lat: 24.0, lon: 119.5, region: 'East Asia' },
  { keywords: ['horn of africa'], country: 'Somalia', lat: 8.0, lon: 48.0, region: 'East Africa' },
  { keywords: ['sahel region'], country: 'Mali', lat: 15.0, lon: 0.0, region: 'West Africa' },
  { keywords: ['cape town'], country: 'South Africa', lat: -33.9249, lon: 18.4241, region: 'Southern Africa' },
  { keywords: ['addis ababa'], country: 'Ethiopia', lat: 9.0222, lon: 38.7469, region: 'East Africa' },
  { keywords: ['tel aviv'], country: 'Israel', lat: 32.0853, lon: 34.7818, region: 'Middle East' },
  { keywords: ['new delhi'], country: 'India', lat: 28.6139, lon: 77.2090, region: 'South Asia' },
  { keywords: ['kuala lumpur'], country: 'Malaysia', lat: 3.1390, lon: 101.6869, region: 'Southeast Asia' },
  { keywords: ['hong kong'], country: 'China', lat: 22.3193, lon: 114.1694, region: 'East Asia' },
  { keywords: ['buenos aires'], country: 'Argentina', lat: -34.6037, lon: -58.3816, region: 'South America' },
  { keywords: ['abu dhabi'], country: 'UAE', lat: 24.4539, lon: 54.3773, region: 'Middle East' },
  { keywords: ['rio de janeiro'], country: 'Brazil', lat: -22.9068, lon: -43.1729, region: 'South America' },
  { keywords: ['sri lanka'], country: 'Sri Lanka', lat: 6.9271, lon: 79.8612, region: 'South Asia' },
  { keywords: ['north korea'], country: 'North Korea', lat: 39.0392, lon: 125.7625, region: 'East Asia' },
  { keywords: ['south korea'], country: 'South Korea', lat: 37.5665, lon: 126.9780, region: 'East Asia' },
  { keywords: ['south africa'], country: 'South Africa', lat: -25.7461, lon: 28.1881, region: 'Southern Africa' },
  { keywords: ['saudi arabia'], country: 'Saudi Arabia', lat: 24.7136, lon: 46.6753, region: 'Middle East' },
  { keywords: ['united states', 'u.s.', 'u.s'], country: 'United States', lat: 38.9072, lon: -77.0369, region: 'North America' },
  { keywords: ['united kingdom', 'u.k.', 'u.k'], country: 'United Kingdom', lat: 51.5074, lon: -0.1278, region: 'Western Europe' },
  { keywords: ['burkina faso'], country: 'Burkina Faso', lat: 12.3714, lon: -1.5197, region: 'West Africa' },
  { keywords: ['czech republic', 'czechia'], country: 'Czech Republic', lat: 50.0755, lon: 14.4378, region: 'Eastern Europe' },
  { keywords: ['democratic republic of congo', 'drc congo'], country: 'Democratic Republic of Congo', lat: -4.4419, lon: 15.2663, region: 'Central Africa' },
];

// City-level aliases: city name -> { country, lat, lon, region }
const CITY_DATABASE: Record<string, { country: string; lat: number; lon: number; region: string }> = {
  // Ukraine conflict cities
  'kyiv': { country: 'Ukraine', lat: 50.4501, lon: 30.5234, region: 'Eastern Europe' },
  'kiev': { country: 'Ukraine', lat: 50.4501, lon: 30.5234, region: 'Eastern Europe' },
  'kharkiv': { country: 'Ukraine', lat: 49.9935, lon: 36.2304, region: 'Eastern Europe' },
  'odesa': { country: 'Ukraine', lat: 46.4825, lon: 30.7233, region: 'Eastern Europe' },
  'odessa': { country: 'Ukraine', lat: 46.4825, lon: 30.7233, region: 'Eastern Europe' },
  'donetsk': { country: 'Ukraine', lat: 48.0159, lon: 37.8029, region: 'Eastern Europe' },
  'luhansk': { country: 'Ukraine', lat: 48.5740, lon: 39.3078, region: 'Eastern Europe' },
  'lviv': { country: 'Ukraine', lat: 49.8397, lon: 24.0297, region: 'Eastern Europe' },
  'mariupol': { country: 'Ukraine', lat: 47.0958, lon: 37.5494, region: 'Eastern Europe' },
  'zaporizhzhia': { country: 'Ukraine', lat: 47.8388, lon: 35.1396, region: 'Eastern Europe' },
  'kherson': { country: 'Ukraine', lat: 46.6354, lon: 32.6169, region: 'Eastern Europe' },
  'crimea': { country: 'Ukraine', lat: 44.9521, lon: 34.1024, region: 'Eastern Europe' },
  'donbas': { country: 'Ukraine', lat: 48.3, lon: 38.0, region: 'Eastern Europe' },
  'dnipro': { country: 'Ukraine', lat: 48.4647, lon: 35.0462, region: 'Eastern Europe' },
  'sumy': { country: 'Ukraine', lat: 50.9077, lon: 34.7981, region: 'Eastern Europe' },
  // Russia
  'moscow': { country: 'Russia', lat: 55.7558, lon: 37.6173, region: 'Eastern Europe' },
  'kremlin': { country: 'Russia', lat: 55.7520, lon: 37.6175, region: 'Eastern Europe' },
  'grozny': { country: 'Russia', lat: 43.3187, lon: 45.6919, region: 'Eastern Europe' },
  'st petersburg': { country: 'Russia', lat: 59.9311, lon: 30.3609, region: 'Eastern Europe' },
  'belgorod': { country: 'Russia', lat: 50.5997, lon: 36.5882, region: 'Eastern Europe' },
  // Middle East cities
  'gaza': { country: 'Palestine', lat: 31.5, lon: 34.47, region: 'Middle East' },
  'rafah': { country: 'Palestine', lat: 31.2969, lon: 34.2475, region: 'Middle East' },
  'jerusalem': { country: 'Israel', lat: 31.7683, lon: 35.2137, region: 'Middle East' },
  'tel aviv': { country: 'Israel', lat: 32.0853, lon: 34.7818, region: 'Middle East' },
  'haifa': { country: 'Israel', lat: 32.7940, lon: 34.9896, region: 'Middle East' },
  'beirut': { country: 'Lebanon', lat: 33.8938, lon: 35.5018, region: 'Middle East' },
  'damascus': { country: 'Syria', lat: 33.5138, lon: 36.2765, region: 'Middle East' },
  'aleppo': { country: 'Syria', lat: 36.2021, lon: 37.1343, region: 'Middle East' },
  'idlib': { country: 'Syria', lat: 35.9306, lon: 36.6339, region: 'Middle East' },
  'tehran': { country: 'Iran', lat: 35.6892, lon: 51.3890, region: 'Middle East' },
  'isfahan': { country: 'Iran', lat: 32.6546, lon: 51.6680, region: 'Middle East' },
  'baghdad': { country: 'Iraq', lat: 33.3152, lon: 44.3661, region: 'Middle East' },
  'mosul': { country: 'Iraq', lat: 36.3350, lon: 43.1189, region: 'Middle East' },
  'basra': { country: 'Iraq', lat: 30.5085, lon: 47.7804, region: 'Middle East' },
  'erbil': { country: 'Iraq', lat: 36.1912, lon: 44.0091, region: 'Middle East' },
  'ankara': { country: 'Turkey', lat: 39.9334, lon: 32.8597, region: 'Middle East' },
  'istanbul': { country: 'Turkey', lat: 41.0082, lon: 28.9784, region: 'Middle East' },
  'riyadh': { country: 'Saudi Arabia', lat: 24.7136, lon: 46.6753, region: 'Middle East' },
  'jeddah': { country: 'Saudi Arabia', lat: 21.4858, lon: 39.1925, region: 'Middle East' },
  'sanaa': { country: 'Yemen', lat: 15.3694, lon: 44.1910, region: 'Middle East' },
  'aden': { country: 'Yemen', lat: 12.7855, lon: 45.0187, region: 'Middle East' },
  'marib': { country: 'Yemen', lat: 15.4544, lon: 45.3261, region: 'Middle East' },
  'ramallah': { country: 'Palestine', lat: 31.9038, lon: 35.2034, region: 'Middle East' },
  'nablus': { country: 'Palestine', lat: 32.2211, lon: 35.2544, region: 'Middle East' },
  'jenin': { country: 'Palestine', lat: 32.4607, lon: 35.3027, region: 'Middle East' },
  'khan younis': { country: 'Palestine', lat: 31.3462, lon: 34.3061, region: 'Middle East' },
  'doha': { country: 'Qatar', lat: 25.2854, lon: 51.5310, region: 'Middle East' },
  'dubai': { country: 'UAE', lat: 25.2048, lon: 55.2708, region: 'Middle East' },
  'muscat': { country: 'Oman', lat: 23.5880, lon: 58.3829, region: 'Middle East' },
  'amman': { country: 'Jordan', lat: 31.9454, lon: 35.9284, region: 'Middle East' },
  // Africa
  'cairo': { country: 'Egypt', lat: 30.0444, lon: 31.2357, region: 'North Africa' },
  'tripoli': { country: 'Libya', lat: 32.8872, lon: 13.1913, region: 'North Africa' },
  'benghazi': { country: 'Libya', lat: 32.1194, lon: 20.0868, region: 'North Africa' },
  'khartoum': { country: 'Sudan', lat: 15.5007, lon: 32.5599, region: 'North Africa' },
  'mogadishu': { country: 'Somalia', lat: 2.0469, lon: 45.3182, region: 'East Africa' },
  'nairobi': { country: 'Kenya', lat: -1.2921, lon: 36.8219, region: 'East Africa' },
  'lagos': { country: 'Nigeria', lat: 6.5244, lon: 3.3792, region: 'West Africa' },
  'abuja': { country: 'Nigeria', lat: 9.0579, lon: 7.4951, region: 'West Africa' },
  'johannesburg': { country: 'South Africa', lat: -26.2041, lon: 28.0473, region: 'Southern Africa' },
  'pretoria': { country: 'South Africa', lat: -25.7461, lon: 28.1881, region: 'Southern Africa' },
  'bamako': { country: 'Mali', lat: 12.6392, lon: -8.0029, region: 'West Africa' },
  'ouagadougou': { country: 'Burkina Faso', lat: 12.3714, lon: -1.5197, region: 'West Africa' },
  'niamey': { country: 'Niger', lat: 13.5116, lon: 2.1254, region: 'West Africa' },
  'kinshasa': { country: 'Democratic Republic of Congo', lat: -4.4419, lon: 15.2663, region: 'Central Africa' },
  'goma': { country: 'Democratic Republic of Congo', lat: -1.6785, lon: 29.2285, region: 'Central Africa' },
  // Asia
  'kabul': { country: 'Afghanistan', lat: 34.5553, lon: 69.2075, region: 'Central Asia' },
  'islamabad': { country: 'Pakistan', lat: 33.6844, lon: 73.0479, region: 'South Asia' },
  'karachi': { country: 'Pakistan', lat: 24.8607, lon: 67.0011, region: 'South Asia' },
  'lahore': { country: 'Pakistan', lat: 31.5204, lon: 74.3587, region: 'South Asia' },
  'beijing': { country: 'China', lat: 39.9042, lon: 116.4074, region: 'East Asia' },
  'shanghai': { country: 'China', lat: 31.2304, lon: 121.4737, region: 'East Asia' },
  'taipei': { country: 'Taiwan', lat: 25.0330, lon: 121.5654, region: 'East Asia' },
  'pyongyang': { country: 'North Korea', lat: 39.0392, lon: 125.7625, region: 'East Asia' },
  'seoul': { country: 'South Korea', lat: 37.5665, lon: 126.9780, region: 'East Asia' },
  'tokyo': { country: 'Japan', lat: 35.6762, lon: 139.6503, region: 'East Asia' },
  'yangon': { country: 'Myanmar', lat: 16.8661, lon: 96.1951, region: 'Southeast Asia' },
  'naypyidaw': { country: 'Myanmar', lat: 19.7633, lon: 96.0785, region: 'Southeast Asia' },
  'bangkok': { country: 'Thailand', lat: 13.7563, lon: 100.5018, region: 'Southeast Asia' },
  'hanoi': { country: 'Vietnam', lat: 21.0278, lon: 105.8342, region: 'Southeast Asia' },
  'manila': { country: 'Philippines', lat: 14.5995, lon: 120.9842, region: 'Southeast Asia' },
  'jakarta': { country: 'Indonesia', lat: -6.2088, lon: 106.8456, region: 'Southeast Asia' },
  'dhaka': { country: 'Bangladesh', lat: 23.8103, lon: 90.4125, region: 'South Asia' },
  'colombo': { country: 'Sri Lanka', lat: 6.9271, lon: 79.8612, region: 'South Asia' },
  'kathmandu': { country: 'Nepal', lat: 27.7172, lon: 85.3240, region: 'South Asia' },
  'mumbai': { country: 'India', lat: 19.0760, lon: 72.8777, region: 'South Asia' },
  'kashmir': { country: 'India', lat: 34.0837, lon: 74.7973, region: 'South Asia' },
  // Americas
  'washington': { country: 'United States', lat: 38.9072, lon: -77.0369, region: 'North America' },
  'caracas': { country: 'Venezuela', lat: 10.4806, lon: -66.9036, region: 'South America' },
  'bogota': { country: 'Colombia', lat: 4.7110, lon: -74.0721, region: 'South America' },
  'mexico city': { country: 'Mexico', lat: 19.4326, lon: -99.1332, region: 'North America' },
  'lima': { country: 'Peru', lat: -12.0464, lon: -77.0428, region: 'South America' },
  'santiago': { country: 'Chile', lat: -33.4489, lon: -70.6693, region: 'South America' },
  // Europe
  'london': { country: 'United Kingdom', lat: 51.5074, lon: -0.1278, region: 'Western Europe' },
  'paris': { country: 'France', lat: 48.8566, lon: 2.3522, region: 'Western Europe' },
  'berlin': { country: 'Germany', lat: 52.5200, lon: 13.4050, region: 'Western Europe' },
  'rome': { country: 'Italy', lat: 41.9028, lon: 12.4964, region: 'Western Europe' },
  'madrid': { country: 'Spain', lat: 40.4168, lon: -3.7038, region: 'Western Europe' },
  'warsaw': { country: 'Poland', lat: 52.2297, lon: 21.0122, region: 'Eastern Europe' },
  'bucharest': { country: 'Romania', lat: 44.4268, lon: 26.1025, region: 'Eastern Europe' },
  'budapest': { country: 'Hungary', lat: 47.4979, lon: 19.0402, region: 'Eastern Europe' },
  'prague': { country: 'Czech Republic', lat: 50.0755, lon: 14.4378, region: 'Eastern Europe' },
  'athens': { country: 'Greece', lat: 37.9838, lon: 23.7275, region: 'Southern Europe' },
  'belgrade': { country: 'Serbia', lat: 44.8176, lon: 20.4633, region: 'Eastern Europe' },
  'pristina': { country: 'Kosovo', lat: 42.6026, lon: 20.9030, region: 'Eastern Europe' },
  'sarajevo': { country: 'Bosnia', lat: 43.8563, lon: 18.4131, region: 'Eastern Europe' },
  'bratislava': { country: 'Slovakia', lat: 48.1486, lon: 17.1077, region: 'Eastern Europe' },
  // Actor/group keywords mapped to locations
  'houthi': { country: 'Yemen', lat: 15.3694, lon: 44.1910, region: 'Middle East' },
  'hezbollah': { country: 'Lebanon', lat: 33.8547, lon: 35.8623, region: 'Middle East' },
  'hamas': { country: 'Palestine', lat: 31.5, lon: 34.47, region: 'Middle East' },
  'taliban': { country: 'Afghanistan', lat: 34.5553, lon: 69.2075, region: 'Central Asia' },
  'isis': { country: 'Syria', lat: 35.0, lon: 38.0, region: 'Middle East' },
  'isil': { country: 'Syria', lat: 35.0, lon: 38.0, region: 'Middle East' },
  'boko haram': { country: 'Nigeria', lat: 11.8469, lon: 13.1600, region: 'West Africa' },
  'al shabaab': { country: 'Somalia', lat: 2.0469, lon: 45.3182, region: 'East Africa' },
  'al-shabaab': { country: 'Somalia', lat: 2.0469, lon: 45.3182, region: 'East Africa' },
  'wagner': { country: 'Russia', lat: 55.7558, lon: 37.6173, region: 'Eastern Europe' },
};

// Country-level fallback
const COUNTRY_DATABASE: Record<string, { lat: number; lon: number; region: string }> = {
  'nigeria': { lat: 9.0820, lon: 8.6753, region: 'West Africa' },
  'palestine': { lat: 31.9522, lon: 35.2332, region: 'Middle East' },
  'israel': { lat: 31.0461, lon: 34.8516, region: 'Middle East' },
  'ukraine': { lat: 48.3794, lon: 31.1656, region: 'Eastern Europe' },
  'russia': { lat: 55.7558, lon: 37.6173, region: 'Eastern Europe' },
  'syria': { lat: 34.8021, lon: 38.9968, region: 'Middle East' },
  'iran': { lat: 35.6892, lon: 51.3890, region: 'Middle East' },
  'china': { lat: 39.9042, lon: 116.4074, region: 'East Asia' },
  'india': { lat: 28.6139, lon: 77.2090, region: 'South Asia' },
  'taiwan': { lat: 25.0330, lon: 121.5654, region: 'East Asia' },
  'yemen': { lat: 15.3694, lon: 44.1910, region: 'Middle East' },
  'iraq': { lat: 33.3152, lon: 44.3661, region: 'Middle East' },
  'afghanistan': { lat: 34.5553, lon: 69.2075, region: 'Central Asia' },
  'pakistan': { lat: 33.6844, lon: 73.0479, region: 'South Asia' },
  'lebanon': { lat: 33.8938, lon: 35.5018, region: 'Middle East' },
  'turkey': { lat: 39.9334, lon: 32.8597, region: 'Middle East' },
  'ethiopia': { lat: 9.1450, lon: 40.4897, region: 'East Africa' },
  'sudan': { lat: 15.5007, lon: 32.5599, region: 'North Africa' },
  'libya': { lat: 32.8872, lon: 13.1913, region: 'North Africa' },
  'myanmar': { lat: 19.7633, lon: 96.0785, region: 'Southeast Asia' },
  'venezuela': { lat: 10.4806, lon: -66.9036, region: 'South America' },
  'mexico': { lat: 19.4326, lon: -99.1332, region: 'North America' },
  'philippines': { lat: 14.5995, lon: 120.9842, region: 'Southeast Asia' },
  'somalia': { lat: 2.0469, lon: 45.3182, region: 'East Africa' },
  'kenya': { lat: -1.2921, lon: 36.8219, region: 'East Africa' },
  'mali': { lat: 12.6392, lon: -8.0029, region: 'West Africa' },
  'niger': { lat: 13.5116, lon: 2.1254, region: 'West Africa' },
  'egypt': { lat: 30.0444, lon: 31.2357, region: 'North Africa' },
  'morocco': { lat: 33.9716, lon: -6.8498, region: 'North Africa' },
  'algeria': { lat: 36.7538, lon: 3.0588, region: 'North Africa' },
  'tunisia': { lat: 36.8065, lon: 10.1815, region: 'North Africa' },
  'jordan': { lat: 31.9454, lon: 35.9284, region: 'Middle East' },
  'kuwait': { lat: 29.3759, lon: 47.9774, region: 'Middle East' },
  'bahrain': { lat: 26.0667, lon: 50.5577, region: 'Middle East' },
  'qatar': { lat: 25.2854, lon: 51.5310, region: 'Middle East' },
  'oman': { lat: 23.5880, lon: 58.3829, region: 'Middle East' },
  'bangladesh': { lat: 23.8103, lon: 90.4125, region: 'South Asia' },
  'nepal': { lat: 27.7172, lon: 85.3240, region: 'South Asia' },
  'thailand': { lat: 13.7563, lon: 100.5018, region: 'Southeast Asia' },
  'vietnam': { lat: 21.0278, lon: 105.8342, region: 'Southeast Asia' },
  'indonesia': { lat: -6.2088, lon: 106.8456, region: 'Southeast Asia' },
  'malaysia': { lat: 3.1390, lon: 101.6869, region: 'Southeast Asia' },
  'singapore': { lat: 1.3521, lon: 103.8198, region: 'Southeast Asia' },
  'japan': { lat: 35.6762, lon: 139.6503, region: 'East Asia' },
  'australia': { lat: -35.2809, lon: 149.1300, region: 'Oceania' },
  'france': { lat: 48.8566, lon: 2.3522, region: 'Western Europe' },
  'germany': { lat: 52.5200, lon: 13.4050, region: 'Western Europe' },
  'italy': { lat: 41.9028, lon: 12.4964, region: 'Western Europe' },
  'spain': { lat: 40.4168, lon: -3.7038, region: 'Western Europe' },
  'poland': { lat: 52.2297, lon: 21.0122, region: 'Eastern Europe' },
  'romania': { lat: 44.4268, lon: 26.1025, region: 'Eastern Europe' },
  'hungary': { lat: 47.4979, lon: 19.0402, region: 'Eastern Europe' },
  'greece': { lat: 37.9838, lon: 23.7275, region: 'Southern Europe' },
  'serbia': { lat: 44.8176, lon: 20.4633, region: 'Eastern Europe' },
  'kosovo': { lat: 42.6026, lon: 20.9030, region: 'Eastern Europe' },
  'bosnia': { lat: 43.8563, lon: 18.4131, region: 'Eastern Europe' },
  'croatia': { lat: 45.8150, lon: 15.9819, region: 'Eastern Europe' },
  'canada': { lat: 45.4215, lon: -75.6972, region: 'North America' },
  'brazil': { lat: -15.8267, lon: -47.9218, region: 'South America' },
  'argentina': { lat: -34.6037, lon: -58.3816, region: 'South America' },
  'colombia': { lat: 4.7110, lon: -74.0721, region: 'South America' },
  'chile': { lat: -33.4489, lon: -70.6693, region: 'South America' },
  'peru': { lat: -12.0464, lon: -77.0428, region: 'South America' },
  'ecuador': { lat: -0.1807, lon: -78.4678, region: 'South America' },
};

// Regional fallback keywords
const REGION_KEYWORDS: Record<string, { country: string; lat: number; lon: number; region: string }> = {
  'middle east': { country: 'Middle East', lat: 29.0, lon: 41.0, region: 'Middle East' },
  'middle eastern': { country: 'Middle East', lat: 29.0, lon: 41.0, region: 'Middle East' },
  'gulf states': { country: 'Middle East', lat: 25.0, lon: 51.0, region: 'Middle East' },
  'persian gulf': { country: 'Iran', lat: 27.0, lon: 51.0, region: 'Middle East' },
  'southeast asia': { country: 'Southeast Asia', lat: 10.0, lon: 106.0, region: 'Southeast Asia' },
  'east africa': { country: 'East Africa', lat: 0.0, lon: 37.0, region: 'East Africa' },
  'west africa': { country: 'West Africa', lat: 10.0, lon: -2.0, region: 'West Africa' },
  'north africa': { country: 'North Africa', lat: 30.0, lon: 10.0, region: 'North Africa' },
  'central asia': { country: 'Central Asia', lat: 41.0, lon: 65.0, region: 'Central Asia' },
  'european': { country: 'Europe', lat: 50.0, lon: 10.0, region: 'Western Europe' },
  'nato': { country: 'NATO', lat: 50.8503, lon: 4.3517, region: 'Western Europe' },
  'kremlin': { country: 'Russia', lat: 55.7520, lon: 37.6175, region: 'Eastern Europe' },
  'pentagon': { country: 'United States', lat: 38.8719, lon: -77.0563, region: 'North America' },
};

// ==================== TYPES ====================
type NewsCategory = 'security' | 'diplomacy' | 'economy' | 'conflict' | 'humanitarian' | 'technology';
type ThreatLevel = 'low' | 'elevated' | 'high' | 'critical';
type ConfidenceLevel = 'verified' | 'developing' | 'breaking';
type SourceCredibility = 'high' | 'medium' | 'low';
type ActorType = 'state' | 'non-state' | 'organization';

// ==================== TITLE NORMALIZATION (dedup key) ====================
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60);
}

// ==================== CLASSIFICATION ====================
function classifyCategory(title: string, summary: string): NewsCategory {
  const text = (title + ' ' + summary).toLowerCase();
  if (/war|military|attack|conflict|strike|combat|offensive|troops|army|invasion|airstrike|bombing/i.test(text)) return 'conflict';
  if (/election|vote|political|government|diplomat|summit|treaty|sanction|embassy|bilateral|international relations/i.test(text)) return 'diplomacy';
  if (/security|threat|terror|terrorism|extremist|militant|armed group|insurgent/i.test(text)) return 'security';
  if (/economy|market|trade|inflation|currency|gdp|recession|sanctions|embargo|oil|energy|commodities/i.test(text)) return 'economy';
  if (/disaster|earthquake|flood|hurricane|refugee|humanitarian|famine|crisis|evacuation|emergency|aid/i.test(text)) return 'humanitarian';
  if (/cyber|hack|data breach|ransomware|malware|digital|technology|infrastructure attack/i.test(text)) return 'technology';
  return 'security';
}

function determineThreatLevel(title: string, summary: string): ThreatLevel {
  const text = (title + ' ' + summary).toLowerCase();
  if (/killed|dead|massacre|coup|war declared|nuclear|bombing|mass casualty|invasion|genocide/i.test(text)) return 'critical';
  if (/injured|conflict|protest|crisis|hostage|attack|strike|violence|clashes/i.test(text)) return 'high';
  if (/dispute|tension|concern|warning|alert|threat|escalation|standoff/i.test(text)) return 'elevated';
  return 'low';
}

function calculateSourceCredibility(source: string): { credibility: SourceCredibility; score: number } {
  const s = source.toLowerCase();
  const high = ['bbc', 'reuters', 'ap news', 'associated press', 'afp', 'cnn', 'guardian', 'new york times', 'washington post', 'economist'];
  const med = ['aljazeera', 'france24', 'dw', 'independent', 'sky news', 'nbc', 'abc news', 'cbs', 'politico', 'foreign policy'];
  if (high.some(h => s.includes(h))) return { credibility: 'high', score: 0.85 };
  if (med.some(m => s.includes(m))) return { credibility: 'medium', score: 0.70 };
  return { credibility: 'low', score: 0.55 };
}

function determineActorType(text: string): ActorType {
  const t = text.toLowerCase();
  if (/government|military|army|navy|air force|official|ministry|president|prime minister|parliament/i.test(t)) return 'state';
  if (/rebel|insurgent|militia|terrorist|extremist|guerrilla|faction|armed group|separatist/i.test(t)) return 'non-state';
  return 'organization';
}

// ==================== OSINT RELEVANCE ====================
function isOsintRelevant(title: string, summary: string): boolean {
  const text = (title + ' ' + summary).toLowerCase();
  const exclude = ['entertainment', 'celebrity', 'sports', 'movie', 'music', 'fashion', 'recipe', 'lifestyle', 'shopping', 'sale', 'discount', 'weather forecast', 'horoscope', 'lottery'];
  if (exclude.some(kw => text.includes(kw))) return false;
  const include = [
    'military', 'conflict', 'war', 'attack', 'bombing', 'strike', 'troops',
    'terrorist', 'terrorism', 'extremist', 'militant', 'insurgent',
    'security', 'threat', 'intelligence', 'espionage', 'spy',
    'diplomatic', 'sanctions', 'embassy', 'bilateral', 'summit',
    'protest', 'unrest', 'riot', 'coup', 'revolution',
    'humanitarian', 'refugee', 'crisis', 'disaster',
    'cyber', 'hack', 'breach', 'infrastructure',
    'missile', 'nuclear', 'weapon', 'drone',
    'border', 'territory', 'invasion', 'occupation',
    'hostage', 'kidnap', 'assassination', 'execution'
  ];
  return include.some(kw => text.includes(kw));
}

// ==================== LOCATION EXTRACTION (3-tier) ====================
function extractLocation(text: string): { country: string; region: string; lat: number; lon: number } {
  const textLower = text.toLowerCase();

  // Tier 1: Multi-word locations (most specific, e.g. "South China Sea")
  for (const loc of MULTI_WORD_LOCATIONS) {
    if (loc.keywords.some(kw => textLower.includes(kw))) {
      const offset = (Math.random() - 0.5) * 0.02; // micro-offset to prevent stacking
      return { country: loc.country, region: loc.region, lat: loc.lat + offset, lon: loc.lon + offset };
    }
  }

  // Tier 2: City-level (specific coordinates)
  for (const [city, data] of Object.entries(CITY_DATABASE)) {
    if (textLower.includes(city)) {
      const offset = (Math.random() - 0.5) * 0.02;
      return { country: data.country, region: data.region, lat: data.lat + offset, lon: data.lon + offset };
    }
  }

  // Tier 3: Country-level fallback
  for (const [country, data] of Object.entries(COUNTRY_DATABASE)) {
    if (textLower.includes(country)) {
      const offset = (Math.random() - 0.5) * 0.02;
      return { country: country.charAt(0).toUpperCase() + country.slice(1), region: data.region, lat: data.lat + offset, lon: data.lon + offset };
    }
  }

  // Tier 4: Regional keyword fallback
  for (const [keyword, data] of Object.entries(REGION_KEYWORDS)) {
    if (textLower.includes(keyword)) {
      const offset = (Math.random() - 0.5) * 0.05;
      return { country: data.country, region: data.region, lat: data.lat + offset, lon: data.lon + offset };
    }
  }

  // No match -> return null-island marker (will be rejected before insert)
  return { country: 'Unknown', region: 'Global', lat: 0, lon: 0 };
}

// ==================== TEXT CLEANING ====================
function cleanText(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/https?:\/\/news\.google\.com\/rss\/articles\/[^\s]*/g, '');
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  cleaned = cleaned.replace(/\[.*?\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function extractCleanSummary(description: string, title: string): string {
  let summary = cleanText(description);
  if (!summary || summary.length < 20) summary = title;
  const titleClean = cleanText(title).toLowerCase();
  if (summary.toLowerCase().startsWith(titleClean)) {
    summary = summary.substring(titleClean.length).replace(/^[:\-–—\s]+/, '').trim();
  }
  if (summary.length < 20) summary = `Intelligence report: ${cleanText(title)}`;
  return summary;
}

// ==================== URL EXTRACTION ====================
// Google News RSS uses protobuf-encoded base64 URLs. The actual article URL
// is embedded as a length-prefixed string inside the decoded binary data.
function decodeGoogleNewsUrl(googleUrl: string): string | null {
  try {
    // Extract the base64 portion after /articles/
    const match = googleUrl.match(/\/articles\/(CB[A-Za-z0-9_-]+)/);
    if (!match) return null;
    
    let encoded = match[1];
    // URL-safe base64 to standard
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (encoded.length % 4 !== 0) encoded += '=';
    
    // Decode to binary string
    const decoded = atob(encoded);
    
    // Find ALL http(s) URLs in the decoded bytes
    const urls: string[] = [];
    let i = 0;
    while (i < decoded.length) {
      // Look for 'http' sequence
      if (decoded.substring(i, i + 4) === 'http') {
        let url = '';
        for (let j = i; j < decoded.length; j++) {
          const code = decoded.charCodeAt(j);
          // Stop at non-printable or control characters
          if (code < 32 || code > 126) break;
          url += decoded[j];
        }
        // Clean trailing garbage
        url = url.replace(/[^a-zA-Z0-9\/_\-.~:?#\[\]@!$&'()*+,;=%]+$/, '');
        if (url.length > 25) urls.push(url);
        i += url.length;
      } else {
        i++;
      }
    }
    
    // Return the longest URL that's NOT google.com (it's usually the article URL)
    const nonGoogleUrls = urls.filter(u => !u.includes('google.com') && !u.includes('google.co'));
    if (nonGoogleUrls.length > 0) {
      return nonGoogleUrls.sort((a, b) => b.length - a.length)[0];
    }
    
    return null;
  } catch { return null; }
}

async function resolveUrl(googleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(googleUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    clearTimeout(timeout);
    
    const finalUrl = response.url;
    // Only return if it resolved away from Google
    if (finalUrl && !finalUrl.includes('news.google.com')) {
      return finalUrl;
    }
    
    // Try to extract from page content
    const html = await response.text();
    const dataUrlMatch = html.match(/data-url="([^"]+)"/);
    if (dataUrlMatch?.[1]) return dataUrlMatch[1];
    
    const jsRedirectMatch = html.match(/window\.location\.replace\("([^"]+)"\)/);
    if (jsRedirectMatch?.[1]) return jsRedirectMatch[1];
    
    return null;
  } catch {
    return null;
  }
}

// ==================== RSS SCRAPING ====================
async function scrapeGoogleNewsRss(query: string): Promise<Array<{
  title: string; link: string; sourceUrl: string; source: string; summary: string; published: string;
}>> {
  const articles: Array<{ title: string; link: string; sourceUrl: string; source: string; summary: string; published: string }> = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
    console.log(`Fetching RSS for: ${query}`);
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!response.ok) { console.error(`RSS fetch failed: ${response.status}`); return articles; }
    
    const xml = await response.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    for (const item of items.slice(0, 10)) {
      try {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*url="([^"]*)"[^>]*>(.*?)<\/source>/) || item.match(/<source[^>]*>(.*?)<\/source>/);
        
        const title = cleanText(titleMatch?.[1] || '');
        const googleLink = linkMatch?.[1]?.trim() || '';
        // Extract actual source URL from <source url="..."> attribute
        const sourceUrl = sourceMatch?.[1]?.startsWith('http') ? sourceMatch[1] : '';
        const source = cleanText(sourceMatch?.[2] || sourceMatch?.[1] || 'Google News');
        const summary = extractCleanSummary(descMatch?.[1] || '', title);
        const published = pubDateMatch?.[1]?.trim() || new Date().toISOString();
        
        if (title && googleLink) articles.push({ title, link: googleLink, sourceUrl, source, summary, published });
      } catch { continue; }
    }
  } catch (error) { console.error(`RSS scrape error for "${query}":`, error); }
  return articles;
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    let userId: string;
    
    const isServiceRole = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "INVALID");
    
    if (isServiceRole) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: systemUser } = await serviceClient
        .from('user_roles').select('user_id').eq('role', 'analyst').limit(1).single();
      if (!systemUser) {
        return new Response(JSON.stringify({ error: "No analyst user found for cron execution" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = systemUser.user_id;
      console.log('Cron job execution - using system analyst:', userId);
    } else if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse request body
    let topics = OSINT_TOPICS;
    let maxPerTopic = 5;
    try {
      const body = await req.json();
      if (body.topics && Array.isArray(body.topics)) topics = body.topics;
      if (body.maxPerTopic && typeof body.maxPerTopic === 'number') maxPerTopic = Math.min(body.maxPerTopic, 10);
    } catch { /* defaults */ }

    console.log(`Scraping ${topics.length} topics with max ${maxPerTopic} per topic`);

    // Service client for DB operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ========== FETCH EXISTING TITLES FOR DEDUP ==========
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentItems } = await serviceClient
      .from('news_items')
      .select('id, title, tags')
      .gte('published_at', cutoff48h);

    // Build a map of normalized title -> existing item (for merging sources)
    const existingTitleMap = new Map<string, { id: string; tags: string[] }>();
    for (const item of (recentItems || [])) {
      const norm = normalizeTitle(item.title);
      if (!existingTitleMap.has(norm)) {
        existingTitleMap.set(norm, { id: item.id, tags: item.tags || [] });
      }
    }

    console.log(`Loaded ${existingTitleMap.size} unique recent titles for dedup`);

    // ========== SCRAPE & PROCESS ==========
    const seenNormTitles = new Set<string>(); // in-batch dedup
    const newArticles: Array<Record<string, unknown>> = [];
    const mergeUpdates: Array<{ id: string; newSourceUrl: string }> = [];
    let skippedDupes = 0;
    let skippedNoLocation = 0;
    let skippedBadUrl = 0;

    for (const topic of topics) {
      try {
        const articles = await scrapeGoogleNewsRss(topic);
        
        for (const article of articles.slice(0, maxPerTopic)) {
          const normTitle = normalizeTitle(article.title);
          
          // In-batch dedup
          if (seenNormTitles.has(normTitle)) { skippedDupes++; continue; }
          seenNormTitles.add(normTitle);

          // OSINT relevance
          if (!isOsintRelevant(article.title, article.summary)) continue;

          // Check against DB titles
          const existingMatch = existingTitleMap.get(normTitle);
          if (existingMatch) {
            // Merge: append source URL to existing item's tags if not already there
            if (!existingMatch.tags.includes(article.link)) {
              mergeUpdates.push({ id: existingMatch.id, newSourceUrl: article.link });
            }
            skippedDupes++;
            continue;
          }

          // Location extraction – REJECT 0,0
          const location = extractLocation(article.title + ' ' + article.summary);
          if (location.lat === 0 && location.lon === 0) {
            skippedNoLocation++;
            continue;
          }

          // URL resolution – try multiple strategies to get the actual article URL
          let finalUrl = '';
          
          // Strategy 1: Try base64 decoding of Google News URL
          finalUrl = decodeGoogleNewsUrl(article.link) || '';
          
          // Strategy 2: Try HTTP resolution (follows redirects to actual article)
          if (!finalUrl || finalUrl.length < 30) {
            const resolved = await resolveUrl(article.link);
            if (resolved && resolved.length > 30) finalUrl = resolved;
          }
          
          // Strategy 3: Use source URL from RSS if it's a full URL (not just domain)
          if ((!finalUrl || finalUrl.length < 30) && article.sourceUrl && article.sourceUrl.length > 30) {
            finalUrl = article.sourceUrl;
          }

          // Final fallback: keep Google link (will show blocked page but better than nothing)
          if (!finalUrl || !finalUrl.startsWith('http')) {
            finalUrl = article.link;
            if (!finalUrl.startsWith('http')) {
              skippedBadUrl++;
              continue;
            }
          }

          const category = classifyCategory(article.title, article.summary);
          const threatLevel = determineThreatLevel(article.title, article.summary);
          const { credibility, score } = calculateSourceCredibility(article.source);
          const actorType = determineActorType(article.title + ' ' + article.summary);
          let publishedAt: string;
          try { publishedAt = new Date(article.published).toISOString(); } catch { publishedAt = new Date().toISOString(); }

          const tags = [topic.split(' ')[0], category, location.region].filter(Boolean);

          newArticles.push({
            title: article.title.substring(0, 500),
            summary: (article.summary || article.title).substring(0, 2000),
            url: finalUrl,
            source: article.source.substring(0, 200),
            country: location.country,
            region: location.region,
            lat: location.lat,
            lon: location.lon,
            category,
            threat_level: threatLevel,
            confidence_level: threatLevel === 'critical' ? 'breaking' : 'developing',
            confidence_score: score,
            source_credibility: credibility,
            actor_type: actorType,
            published_at: publishedAt,
            user_id: userId,
            tags,
          });
        }

        // Rate limiting between topics
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error scraping topic "${topic}":`, error);
        continue;
      }
    }

    console.log(`Processed: ${newArticles.length} new, ${skippedDupes} dupes, ${skippedNoLocation} no-location, ${skippedBadUrl} bad-url`);

    // ========== MERGE SOURCE URLS INTO EXISTING ITEMS ==========
    if (mergeUpdates.length > 0) {
      for (const merge of mergeUpdates) {
        try {
          // Fetch current tags and append
          const { data: current } = await serviceClient
            .from('news_items')
            .select('tags')
            .eq('id', merge.id)
            .single();
          
          if (current) {
            const updatedTags = [...(current.tags || []), `source:${merge.newSourceUrl}`];
            await serviceClient
              .from('news_items')
              .update({ tags: updatedTags })
              .eq('id', merge.id);
          }
        } catch { /* skip failed merges */ }
      }
      console.log(`Merged ${mergeUpdates.length} source URLs into existing items`);
    }

    // ========== INSERT NEW ARTICLES ==========
    if (newArticles.length > 0) {
      const { error: insertError } = await serviceClient
        .from('news_items')
        .insert(newArticles);

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: insertError.message, scraped: newArticles.length, inserted: 0 }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Inserted ${newArticles.length} new articles`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Inserted ${newArticles.length} new, merged ${mergeUpdates.length} sources, skipped ${skippedDupes} dupes, ${skippedNoLocation} no-location, ${skippedBadUrl} bad-url`,
        scraped: newArticles.length + skippedDupes + skippedNoLocation + skippedBadUrl,
        inserted: newArticles.length,
        duplicates: skippedDupes,
        merged: mergeUpdates.length,
        skipped_no_location: skippedNoLocation,
        skipped_bad_url: skippedBadUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Scraper error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
