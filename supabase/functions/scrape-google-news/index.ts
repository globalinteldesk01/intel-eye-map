import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required Supabase environment variables.");
}

const OSINT_TOPICS = [
  "military conflict breaking news",
  "terrorism attack threat",
  "civil unrest protests",
  "coup government overthrow",
  "diplomatic crisis international",
  "sanctions embargo",
  "missile strike bombing",
  "humanitarian crisis emergency",
  "border conflict tension",
  "cyber attack infrastructure",
];

type NewsCategory =
  | "security"
  | "diplomacy"
  | "economy"
  | "conflict"
  | "humanitarian"
  | "technology";

type ThreatLevel = "low" | "elevated" | "high" | "critical";
type ConfidenceLevel = "verified" | "developing" | "breaking";
type SourceCredibility = "high" | "medium" | "low";
type ActorType = "state" | "non-state" | "organization";

type ExtractedLocation = {
  country: string;
  region: string;
  lat: number | null;
  lon: number | null;
};

type RawArticle = {
  title: string;
  link: string;
  sourceUrl: string;
  source: string;
  summary: string;
  published: string;
};

type NewsInsert = {
  title: string;
  summary: string;
  url: string;
  source: string;
  country: string;
  region: string;
  lat: number | null;
  lon: number | null;
  category: NewsCategory;
  threat_level: ThreatLevel;
  confidence_level: ConfidenceLevel;
  confidence_score: number;
  source_credibility: SourceCredibility;
  actor_type: ActorType;
  published_at: string;
  user_id: string;
  tags: string[];
};

const MULTI_WORD_LOCATIONS: Array<{
  keywords: string[];
  country: string;
  lat: number;
  lon: number;
  region: string;
}> = [
  { keywords: ["khan younis", "khan yunis"], country: "Palestine", lat: 31.3462, lon: 34.3061, region: "Middle East" },
  { keywords: ["rafah crossing", "rafah border"], country: "Palestine", lat: 31.2747, lon: 34.2475, region: "Middle East" },
  { keywords: ["south china sea"], country: "China", lat: 14.5, lon: 115.0, region: "East Asia" },
  { keywords: ["red sea"], country: "Yemen", lat: 15.5, lon: 40.0, region: "Middle East" },
  { keywords: ["west bank"], country: "Palestine", lat: 31.95, lon: 35.25, region: "Middle East" },
  { keywords: ["golan heights"], country: "Syria", lat: 33.1, lon: 35.8, region: "Middle East" },
  { keywords: ["strait of hormuz", "hormuz strait"], country: "Iran", lat: 26.6, lon: 56.3, region: "Middle East" },
  { keywords: ["suez canal"], country: "Egypt", lat: 30.45, lon: 32.35, region: "North Africa" },
  { keywords: ["bab el mandeb", "bab al-mandab"], country: "Yemen", lat: 12.58, lon: 43.33, region: "Middle East" },
  { keywords: ["black sea"], country: "Ukraine", lat: 43.5, lon: 34.0, region: "Eastern Europe" },
  { keywords: ["taiwan strait"], country: "Taiwan", lat: 24.0, lon: 119.5, region: "East Asia" },
  { keywords: ["horn of africa"], country: "Somalia", lat: 8.0, lon: 48.0, region: "East Africa" },
  { keywords: ["sahel region"], country: "Mali", lat: 15.0, lon: 0.0, region: "West Africa" },
  { keywords: ["cape town"], country: "South Africa", lat: -33.9249, lon: 18.4241, region: "Southern Africa" },
  { keywords: ["addis ababa"], country: "Ethiopia", lat: 9.0222, lon: 38.7469, region: "East Africa" },
  { keywords: ["tel aviv"], country: "Israel", lat: 32.0853, lon: 34.7818, region: "Middle East" },
  { keywords: ["new delhi"], country: "India", lat: 28.6139, lon: 77.2090, region: "South Asia" },
  { keywords: ["kuala lumpur"], country: "Malaysia", lat: 3.1390, lon: 101.6869, region: "Southeast Asia" },
  { keywords: ["hong kong"], country: "China", lat: 22.3193, lon: 114.1694, region: "East Asia" },
  { keywords: ["buenos aires"], country: "Argentina", lat: -34.6037, lon: -58.3816, region: "South America" },
  { keywords: ["abu dhabi"], country: "UAE", lat: 24.4539, lon: 54.3773, region: "Middle East" },
  { keywords: ["rio de janeiro"], country: "Brazil", lat: -22.9068, lon: -43.1729, region: "South America" },
  { keywords: ["sri lanka"], country: "Sri Lanka", lat: 6.9271, lon: 79.8612, region: "South Asia" },
  { keywords: ["north korea"], country: "North Korea", lat: 39.0392, lon: 125.7625, region: "East Asia" },
  { keywords: ["south korea"], country: "South Korea", lat: 37.5665, lon: 126.9780, region: "East Asia" },
  { keywords: ["south africa"], country: "South Africa", lat: -25.7461, lon: 28.1881, region: "Southern Africa" },
  { keywords: ["saudi arabia"], country: "Saudi Arabia", lat: 24.7136, lon: 46.6753, region: "Middle East" },
  { keywords: ["united states", "u.s.", "u.s"], country: "United States", lat: 38.9072, lon: -77.0369, region: "North America" },
  { keywords: ["united kingdom", "u.k.", "u.k"], country: "United Kingdom", lat: 51.5074, lon: -0.1278, region: "Western Europe" },
  { keywords: ["burkina faso"], country: "Burkina Faso", lat: 12.3714, lon: -1.5197, region: "West Africa" },
  { keywords: ["czech republic", "czechia"], country: "Czech Republic", lat: 50.0755, lon: 14.4378, region: "Eastern Europe" },
  { keywords: ["democratic republic of congo", "drc congo"], country: "Democratic Republic of Congo", lat: -4.4419, lon: 15.2663, region: "Central Africa" },
];

const CITY_DATABASE: Record<string, { country: string; lat: number; lon: number; region: string }> = {
  kyiv: { country: "Ukraine", lat: 50.4501, lon: 30.5234, region: "Eastern Europe" },
  kiev: { country: "Ukraine", lat: 50.4501, lon: 30.5234, region: "Eastern Europe" },
  kharkiv: { country: "Ukraine", lat: 49.9935, lon: 36.2304, region: "Eastern Europe" },
  odesa: { country: "Ukraine", lat: 46.4825, lon: 30.7233, region: "Eastern Europe" },
  odessa: { country: "Ukraine", lat: 46.4825, lon: 30.7233, region: "Eastern Europe" },
  donetsk: { country: "Ukraine", lat: 48.0159, lon: 37.8029, region: "Eastern Europe" },
  luhansk: { country: "Ukraine", lat: 48.574, lon: 39.3078, region: "Eastern Europe" },
  lviv: { country: "Ukraine", lat: 49.8397, lon: 24.0297, region: "Eastern Europe" },
  mariupol: { country: "Ukraine", lat: 47.0958, lon: 37.5494, region: "Eastern Europe" },
  zaporizhzhia: { country: "Ukraine", lat: 47.8388, lon: 35.1396, region: "Eastern Europe" },
  kherson: { country: "Ukraine", lat: 46.6354, lon: 32.6169, region: "Eastern Europe" },
  crimea: { country: "Ukraine", lat: 44.9521, lon: 34.1024, region: "Eastern Europe" },
  donbas: { country: "Ukraine", lat: 48.3, lon: 38.0, region: "Eastern Europe" },
  dnipro: { country: "Ukraine", lat: 48.4647, lon: 35.0462, region: "Eastern Europe" },
  sumy: { country: "Ukraine", lat: 50.9077, lon: 34.7981, region: "Eastern Europe" },
  moscow: { country: "Russia", lat: 55.7558, lon: 37.6173, region: "Eastern Europe" },
  kremlin: { country: "Russia", lat: 55.752, lon: 37.6175, region: "Eastern Europe" },
  grozny: { country: "Russia", lat: 43.3187, lon: 45.6919, region: "Eastern Europe" },
  "st petersburg": { country: "Russia", lat: 59.9311, lon: 30.3609, region: "Eastern Europe" },
  belgorod: { country: "Russia", lat: 50.5997, lon: 36.5882, region: "Eastern Europe" },
  gaza: { country: "Palestine", lat: 31.5, lon: 34.47, region: "Middle East" },
  rafah: { country: "Palestine", lat: 31.2969, lon: 34.2475, region: "Middle East" },
  jerusalem: { country: "Israel", lat: 31.7683, lon: 35.2137, region: "Middle East" },
  "tel aviv": { country: "Israel", lat: 32.0853, lon: 34.7818, region: "Middle East" },
  haifa: { country: "Israel", lat: 32.794, lon: 34.9896, region: "Middle East" },
  beirut: { country: "Lebanon", lat: 33.8938, lon: 35.5018, region: "Middle East" },
  damascus: { country: "Syria", lat: 33.5138, lon: 36.2765, region: "Middle East" },
  aleppo: { country: "Syria", lat: 36.2021, lon: 37.1343, region: "Middle East" },
  idlib: { country: "Syria", lat: 35.9306, lon: 36.6339, region: "Middle East" },
  tehran: { country: "Iran", lat: 35.6892, lon: 51.389, region: "Middle East" },
  isfahan: { country: "Iran", lat: 32.6546, lon: 51.668, region: "Middle East" },
  baghdad: { country: "Iraq", lat: 33.3152, lon: 44.3661, region: "Middle East" },
  mosul: { country: "Iraq", lat: 36.335, lon: 43.1189, region: "Middle East" },
  basra: { country: "Iraq", lat: 30.5085, lon: 47.7804, region: "Middle East" },
  erbil: { country: "Iraq", lat: 36.1912, lon: 44.0091, region: "Middle East" },
  ankara: { country: "Turkey", lat: 39.9334, lon: 32.8597, region: "Middle East" },
  istanbul: { country: "Turkey", lat: 41.0082, lon: 28.9784, region: "Middle East" },
  riyadh: { country: "Saudi Arabia", lat: 24.7136, lon: 46.6753, region: "Middle East" },
  jeddah: { country: "Saudi Arabia", lat: 21.4858, lon: 39.1925, region: "Middle East" },
  sanaa: { country: "Yemen", lat: 15.3694, lon: 44.191, region: "Middle East" },
  aden: { country: "Yemen", lat: 12.7855, lon: 45.0187, region: "Middle East" },
  marib: { country: "Yemen", lat: 15.4544, lon: 45.3261, region: "Middle East" },
  ramallah: { country: "Palestine", lat: 31.9038, lon: 35.2034, region: "Middle East" },
  nablus: { country: "Palestine", lat: 32.2211, lon: 35.2544, region: "Middle East" },
  jenin: { country: "Palestine", lat: 32.4607, lon: 35.3027, region: "Middle East" },
  "khan younis": { country: "Palestine", lat: 31.3462, lon: 34.3061, region: "Middle East" },
  doha: { country: "Qatar", lat: 25.2854, lon: 51.531, region: "Middle East" },
  dubai: { country: "UAE", lat: 25.2048, lon: 55.2708, region: "Middle East" },
  muscat: { country: "Oman", lat: 23.588, lon: 58.3829, region: "Middle East" },
  amman: { country: "Jordan", lat: 31.9454, lon: 35.9284, region: "Middle East" },
  cairo: { country: "Egypt", lat: 30.0444, lon: 31.2357, region: "North Africa" },
  tripoli: { country: "Libya", lat: 32.8872, lon: 13.1913, region: "North Africa" },
  benghazi: { country: "Libya", lat: 32.1194, lon: 20.0868, region: "North Africa" },
  khartoum: { country: "Sudan", lat: 15.5007, lon: 32.5599, region: "North Africa" },
  mogadishu: { country: "Somalia", lat: 2.0469, lon: 45.3182, region: "East Africa" },
  nairobi: { country: "Kenya", lat: -1.2921, lon: 36.8219, region: "East Africa" },
  lagos: { country: "Nigeria", lat: 6.5244, lon: 3.3792, region: "West Africa" },
  abuja: { country: "Nigeria", lat: 9.0579, lon: 7.4951, region: "West Africa" },
  johannesburg: { country: "South Africa", lat: -26.2041, lon: 28.0473, region: "Southern Africa" },
  pretoria: { country: "South Africa", lat: -25.7461, lon: 28.1881, region: "Southern Africa" },
  bamako: { country: "Mali", lat: 12.6392, lon: -8.0029, region: "West Africa" },
  ouagadougou: { country: "Burkina Faso", lat: 12.3714, lon: -1.5197, region: "West Africa" },
  niamey: { country: "Niger", lat: 13.5116, lon: 2.1254, region: "West Africa" },
  kinshasa: { country: "Democratic Republic of Congo", lat: -4.4419, lon: 15.2663, region: "Central Africa" },
  goma: { country: "Democratic Republic of Congo", lat: -1.6785, lon: 29.2285, region: "Central Africa" },
  kabul: { country: "Afghanistan", lat: 34.5553, lon: 69.2075, region: "Central Asia" },
  islamabad: { country: "Pakistan", lat: 33.6844, lon: 73.0479, region: "South Asia" },
  karachi: { country: "Pakistan", lat: 24.8607, lon: 67.0011, region: "South Asia" },
  lahore: { country: "Pakistan", lat: 31.5204, lon: 74.3587, region: "South Asia" },
  beijing: { country: "China", lat: 39.9042, lon: 116.4074, region: "East Asia" },
  shanghai: { country: "China", lat: 31.2304, lon: 121.4737, region: "East Asia" },
  taipei: { country: "Taiwan", lat: 25.033, lon: 121.5654, region: "East Asia" },
  pyongyang: { country: "North Korea", lat: 39.0392, lon: 125.7625, region: "East Asia" },
  seoul: { country: "South Korea", lat: 37.5665, lon: 126.978, region: "East Asia" },
  tokyo: { country: "Japan", lat: 35.6762, lon: 139.6503, region: "East Asia" },
  yangon: { country: "Myanmar", lat: 16.8661, lon: 96.1951, region: "Southeast Asia" },
  naypyidaw: { country: "Myanmar", lat: 19.7633, lon: 96.0785, region: "Southeast Asia" },
  bangkok: { country: "Thailand", lat: 13.7563, lon: 100.5018, region: "Southeast Asia" },
  hanoi: { country: "Vietnam", lat: 21.0278, lon: 105.8342, region: "Southeast Asia" },
  manila: { country: "Philippines", lat: 14.5995, lon: 120.9842, region: "Southeast Asia" },
  jakarta: { country: "Indonesia", lat: -6.2088, lon: 106.8456, region: "Southeast Asia" },
  dhaka: { country: "Bangladesh", lat: 23.8103, lon: 90.4125, region: "South Asia" },
  colombo: { country: "Sri Lanka", lat: 6.9271, lon: 79.8612, region: "South Asia" },
  kathmandu: { country: "Nepal", lat: 27.7172, lon: 85.324, region: "South Asia" },
  mumbai: { country: "India", lat: 19.076, lon: 72.8777, region: "South Asia" },
  kashmir: { country: "India", lat: 34.0837, lon: 74.7973, region: "South Asia" },
  washington: { country: "United States", lat: 38.9072, lon: -77.0369, region: "North America" },
  caracas: { country: "Venezuela", lat: 10.4806, lon: -66.9036, region: "South America" },
  bogota: { country: "Colombia", lat: 4.711, lon: -74.0721, region: "South America" },
  "mexico city": { country: "Mexico", lat: 19.4326, lon: -99.1332, region: "North America" },
  lima: { country: "Peru", lat: -12.0464, lon: -77.0428, region: "South America" },
  santiago: { country: "Chile", lat: -33.4489, lon: -70.6693, region: "South America" },
  london: { country: "United Kingdom", lat: 51.5074, lon: -0.1278, region: "Western Europe" },
  paris: { country: "France", lat: 48.8566, lon: 2.3522, region: "Western Europe" },
  berlin: { country: "Germany", lat: 52.52, lon: 13.405, region: "Western Europe" },
  rome: { country: "Italy", lat: 41.9028, lon: 12.4964, region: "Western Europe" },
  madrid: { country: "Spain", lat: 40.4168, lon: -3.7038, region: "Western Europe" },
  warsaw: { country: "Poland", lat: 52.2297, lon: 21.0122, region: "Eastern Europe" },
  bucharest: { country: "Romania", lat: 44.4268, lon: 26.1025, region: "Eastern Europe" },
  budapest: { country: "Hungary", lat: 47.4979, lon: 19.0402, region: "Eastern Europe" },
  prague: { country: "Czech Republic", lat: 50.0755, lon: 14.4378, region: "Eastern Europe" },
  athens: { country: "Greece", lat: 37.9838, lon: 23.7275, region: "Southern Europe" },
  belgrade: { country: "Serbia", lat: 44.8176, lon: 20.4633, region: "Eastern Europe" },
  pristina: { country: "Kosovo", lat: 42.6026, lon: 20.903, region: "Eastern Europe" },
  sarajevo: { country: "Bosnia", lat: 43.8563, lon: 18.4131, region: "Eastern Europe" },
  bratislava: { country: "Slovakia", lat: 48.1486, lon: 17.1077, region: "Eastern Europe" },
  houthi: { country: "Yemen", lat: 15.3694, lon: 44.191, region: "Middle East" },
  hezbollah: { country: "Lebanon", lat: 33.8547, lon: 35.8623, region: "Middle East" },
  hamas: { country: "Palestine", lat: 31.5, lon: 34.47, region: "Middle East" },
  taliban: { country: "Afghanistan", lat: 34.5553, lon: 69.2075, region: "Central Asia" },
  isis: { country: "Syria", lat: 35.0, lon: 38.0, region: "Middle East" },
  isil: { country: "Syria", lat: 35.0, lon: 38.0, region: "Middle East" },
  "boko haram": { country: "Nigeria", lat: 11.8469, lon: 13.16, region: "West Africa" },
  "al shabaab": { country: "Somalia", lat: 2.0469, lon: 45.3182, region: "East Africa" },
  "al-shabaab": { country: "Somalia", lat: 2.0469, lon: 45.3182, region: "East Africa" },
  wagner: { country: "Russia", lat: 55.7558, lon: 37.6173, region: "Eastern Europe" },
};

const COUNTRY_DATABASE: Record<string, { lat: number; lon: number; region: string }> = {
  nigeria: { lat: 9.082, lon: 8.6753, region: "West Africa" },
  palestine: { lat: 31.9522, lon: 35.2332, region: "Middle East" },
  israel: { lat: 31.0461, lon: 34.8516, region: "Middle East" },
  ukraine: { lat: 48.3794, lon: 31.1656, region: "Eastern Europe" },
  russia: { lat: 55.7558, lon: 37.6173, region: "Eastern Europe" },
  syria: { lat: 34.8021, lon: 38.9968, region: "Middle East" },
  iran: { lat: 35.6892, lon: 51.389, region: "Middle East" },
  china: { lat: 39.9042, lon: 116.4074, region: "East Asia" },
  india: { lat: 28.6139, lon: 77.209, region: "South Asia" },
  taiwan: { lat: 25.033, lon: 121.5654, region: "East Asia" },
  yemen: { lat: 15.3694, lon: 44.191, region: "Middle East" },
  iraq: { lat: 33.3152, lon: 44.3661, region: "Middle East" },
  afghanistan: { lat: 34.5553, lon: 69.2075, region: "Central Asia" },
  pakistan: { lat: 33.6844, lon: 73.0479, region: "South Asia" },
  lebanon: { lat: 33.8938, lon: 35.5018, region: "Middle East" },
  turkey: { lat: 39.9334, lon: 32.8597, region: "Middle East" },
  ethiopia: { lat: 9.145, lon: 40.4897, region: "East Africa" },
  sudan: { lat: 15.5007, lon: 32.5599, region: "North Africa" },
  libya: { lat: 32.8872, lon: 13.1913, region: "North Africa" },
  myanmar: { lat: 19.7633, lon: 96.0785, region: "Southeast Asia" },
  venezuela: { lat: 10.4806, lon: -66.9036, region: "South America" },
  mexico: { lat: 19.4326, lon: -99.1332, region: "North America" },
  philippines: { lat: 14.5995, lon: 120.9842, region: "Southeast Asia" },
  somalia: { lat: 2.0469, lon: 45.3182, region: "East Africa" },
  kenya: { lat: -1.2921, lon: 36.8219, region: "East Africa" },
  mali: { lat: 12.6392, lon: -8.0029, region: "West Africa" },
  niger: { lat: 13.5116, lon: 2.1254, region: "West Africa" },
  egypt: { lat: 30.0444, lon: 31.2357, region: "North Africa" },
  morocco: { lat: 33.9716, lon: -6.8498, region: "North Africa" },
  algeria: { lat: 36.7538, lon: 3.0588, region: "North Africa" },
  tunisia: { lat: 36.8065, lon: 10.1815, region: "North Africa" },
  jordan: { lat: 31.9454, lon: 35.9284, region: "Middle East" },
  kuwait: { lat: 29.3759, lon: 47.9774, region: "Middle East" },
  bahrain: { lat: 26.0667, lon: 50.5577, region: "Middle East" },
  qatar: { lat: 25.2854, lon: 51.531, region: "Middle East" },
  oman: { lat: 23.588, lon: 58.3829, region: "Middle East" },
  bangladesh: { lat: 23.8103, lon: 90.4125, region: "South Asia" },
  nepal: { lat: 27.7172, lon: 85.324, region: "South Asia" },
  thailand: { lat: 13.7563, lon: 100.5018, region: "Southeast Asia" },
  vietnam: { lat: 21.0278, lon: 105.8342, region: "Southeast Asia" },
  indonesia: { lat: -6.2088, lon: 106.8456, region: "Southeast Asia" },
  malaysia: { lat: 3.139, lon: 101.6869, region: "Southeast Asia" },
  singapore: { lat: 1.3521, lon: 103.8198, region: "Southeast Asia" },
  japan: { lat: 35.6762, lon: 139.6503, region: "East Asia" },
  australia: { lat: -35.2809, lon: 149.13, region: "Oceania" },
  france: { lat: 48.8566, lon: 2.3522, region: "Western Europe" },
  germany: { lat: 52.52, lon: 13.405, region: "Western Europe" },
  italy: { lat: 41.9028, lon: 12.4964, region: "Western Europe" },
  spain: { lat: 40.4168, lon: -3.7038, region: "Western Europe" },
  poland: { lat: 52.2297, lon: 21.0122, region: "Eastern Europe" },
  romania: { lat: 44.4268, lon: 26.1025, region: "Eastern Europe" },
  hungary: { lat: 47.4979, lon: 19.0402, region: "Eastern Europe" },
  greece: { lat: 37.9838, lon: 23.7275, region: "Southern Europe" },
  serbia: { lat: 44.8176, lon: 20.4633, region: "Eastern Europe" },
  kosovo: { lat: 42.6026, lon: 20.903, region: "Eastern Europe" },
  bosnia: { lat: 43.8563, lon: 18.4131, region: "Eastern Europe" },
  croatia: { lat: 45.815, lon: 15.9819, region: "Eastern Europe" },
  canada: { lat: 45.4215, lon: -75.6972, region: "North America" },
  brazil: { lat: -15.8267, lon: -47.9218, region: "South America" },
  argentina: { lat: -34.6037, lon: -58.3816, region: "South America" },
  colombia: { lat: 4.711, lon: -74.0721, region: "South America" },
  chile: { lat: -33.4489, lon: -70.6693, region: "South America" },
  peru: { lat: -12.0464, lon: -77.0428, region: "South America" },
  ecuador: { lat: -0.1807, lon: -78.4678, region: "South America" },
};

const REGION_KEYWORDS: Record<string, { country: string; lat: number; lon: number; region: string }> = {
  "middle east": { country: "Middle East", lat: 29.0, lon: 41.0, region: "Middle East" },
  "middle eastern": { country: "Middle East", lat: 29.0, lon: 41.0, region: "Middle East" },
  "gulf states": { country: "Middle East", lat: 25.0, lon: 51.0, region: "Middle East" },
  "persian gulf": { country: "Iran", lat: 27.0, lon: 51.0, region: "Middle East" },
  "southeast asia": { country: "Southeast Asia", lat: 10.0, lon: 106.0, region: "Southeast Asia" },
  "east africa": { country: "East Africa", lat: 0.0, lon: 37.0, region: "East Africa" },
  "west africa": { country: "West Africa", lat: 10.0, lon: -2.0, region: "West Africa" },
  "north africa": { country: "North Africa", lat: 30.0, lon: 10.0, region: "North Africa" },
  "central asia": { country: "Central Asia", lat: 41.0, lon: 65.0, region: "Central Asia" },
  european: { country: "Europe", lat: 50.0, lon: 10.0, region: "Western Europe" },
  nato: { country: "NATO", lat: 50.8503, lon: 4.3517, region: "Western Europe" },
  kremlin: { country: "Russia", lat: 55.752, lon: 37.6175, region: "Eastern Europe" },
  pentagon: { country: "United States", lat: 38.8719, lon: -77.0563, region: "North America" },
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const removeParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ocid"];
    for (const p of removeParams) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return url.trim();
  }
}

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/news\.google\.com\/rss\/articles\/[^\s<]+/g, " ")
    .replace(/https?:\/\/[^\s<]+/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCleanSummary(description: string, title: string): string {
  let summary = cleanText(description);
  const titleClean = cleanText(title);

  if (!summary || summary.length < 20) {
    return titleClean;
  }

  if (summary.toLowerCase().startsWith(titleClean.toLowerCase())) {
    summary = summary.slice(titleClean.length).replace(/^[:\-–—\s]+/, "").trim();
  }

  if (summary.length < 20) {
    summary = `Intelligence report: ${titleClean}`;
  }

  return summary.slice(0, 2000);
}

function classifyCategory(title: string, summary: string): NewsCategory {
  const text = `${title} ${summary}`.toLowerCase();

  if (/war|military|attack|conflict|strike|combat|offensive|troops|army|invasion|airstrike|bombing|shelling|drone strike|missile/i.test(text)) return "conflict";
  if (/election|vote|political|government|diplomat|summit|treaty|sanction|embassy|bilateral|international relations|ceasefire/i.test(text)) return "diplomacy";
  if (/security|threat|terror|terrorism|extremist|militant|armed group|insurgent|counterterror/i.test(text)) return "security";
  if (/economy|market|trade|inflation|currency|gdp|recession|oil|energy|commodities|shipping|supply chain/i.test(text)) return "economy";
  if (/disaster|earthquake|flood|hurricane|refugee|humanitarian|famine|crisis|evacuation|emergency|aid|cholera|outbreak/i.test(text)) return "humanitarian";
  if (/cyber|hack|data breach|ransomware|malware|digital|technology|infrastructure attack|satellite|telecom/i.test(text)) return "technology";

  return "security";
}

function determineThreatLevel(title: string, summary: string): ThreatLevel {
  const text = `${title} ${summary}`.toLowerCase();

  if (/killed|dead|massacre|coup|war declared|nuclear|bombing|mass casualty|invasion|genocide|hostages killed/i.test(text)) return "critical";
  if (/injured|conflict|protest|crisis|hostage|attack|strike|violence|clashes|raid|shooting|drone/i.test(text)) return "high";
  if (/dispute|tension|concern|warning|alert|threat|escalation|standoff|military buildup/i.test(text)) return "elevated";

  return "low";
}

function calculateSourceCredibility(source: string): { credibility: SourceCredibility; score: number } {
  const s = source.toLowerCase();

  const high = [
    "bbc",
    "reuters",
    "ap news",
    "associated press",
    "afp",
    "guardian",
    "new york times",
    "washington post",
    "economist",
    "financial times",
    "bloomberg",
    "nikkei",
    "the hindu",
    "indian express",
    "straits times",
    "channel news asia",
    "cna",
    "south china morning post",
    "dw",
    "france24",
  ];

  const medium = [
    "al jazeera",
    "aljazeera",
    "sky news",
    "nbc",
    "abc news",
    "cbs",
    "politico",
    "foreign policy",
    "times of israel",
    "jerusalem post",
    "haaretz",
    "the diplomat",
    "anadolu",
  ];

  if (high.some((v) => s.includes(v))) return { credibility: "high", score: 0.87 };
  if (medium.some((v) => s.includes(v))) return { credibility: "medium", score: 0.73 };
  return { credibility: "low", score: 0.58 };
}

function determineActorType(text: string): ActorType {
  const t = text.toLowerCase();
  if (/government|military|army|navy|air force|official|ministry|president|prime minister|parliament|state media/i.test(t)) return "state";
  if (/rebel|insurgent|militia|terrorist|extremist|guerrilla|faction|armed group|separatist/i.test(t)) return "non-state";
  return "organization";
}

function isOsintRelevant(title: string, summary: string): boolean {
  const text = `${title} ${summary}`.toLowerCase();

  const exclude = [
    "entertainment",
    "celebrity",
    "sports",
    "movie",
    "music",
    "fashion",
    "recipe",
    "lifestyle",
    "shopping",
    "sale",
    "discount",
    "horoscope",
    "lottery",
  ];
  if (exclude.some((kw) => text.includes(kw))) return false;

  const include = [
    "military",
    "conflict",
    "war",
    "attack",
    "bombing",
    "strike",
    "troops",
    "terrorist",
    "terrorism",
    "extremist",
    "militant",
    "insurgent",
    "security",
    "threat",
    "intelligence",
    "espionage",
    "spy",
    "diplomatic",
    "sanctions",
    "embassy",
    "bilateral",
    "summit",
    "protest",
    "unrest",
    "riot",
    "coup",
    "revolution",
    "humanitarian",
    "refugee",
    "crisis",
    "disaster",
    "cyber",
    "hack",
    "breach",
    "infrastructure",
    "missile",
    "nuclear",
    "weapon",
    "drone",
    "border",
    "territory",
    "invasion",
    "occupation",
    "hostage",
    "kidnap",
    "assassination",
    "execution",
    "navy",
    "shipping",
    "airspace",
    "ceasefire",
  ];

  return include.some((kw) => text.includes(kw));
}

function extractLocation(text: string): ExtractedLocation {
  const textLower = text.toLowerCase();

  for (const loc of MULTI_WORD_LOCATIONS) {
    if (loc.keywords.some((kw) => textLower.includes(kw))) {
      return { country: loc.country, region: loc.region, lat: loc.lat, lon: loc.lon };
    }
  }

  for (const [city, data] of Object.entries(CITY_DATABASE)) {
    if (textLower.includes(city)) {
      return { country: data.country, region: data.region, lat: data.lat, lon: data.lon };
    }
  }

  for (const [country, data] of Object.entries(COUNTRY_DATABASE)) {
    if (textLower.includes(country)) {
      return {
        country: country.charAt(0).toUpperCase() + country.slice(1),
        region: data.region,
        lat: data.lat,
        lon: data.lon,
      };
    }
  }

  for (const [keyword, data] of Object.entries(REGION_KEYWORDS)) {
    if (textLower.includes(keyword)) {
      return { country: data.country, region: data.region, lat: data.lat, lon: data.lon };
    }
  }

  return { country: "Unknown", region: "Global", lat: null, lon: null };
}

function confidenceFromThreat(threat: ThreatLevel): ConfidenceLevel {
  if (threat === "critical") return "breaking";
  if (threat === "high") return "developing";
  return "verified";
}

function safeIsoDate(dateValue: string): string {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function decodeGoogleNewsUrl(googleUrl: string): string | null {
  try {
    const match = googleUrl.match(/\/articles\/([^?]+)/);
    if (!match?.[1]) return null;

    let encoded = match[1].replace(/-/g, "+").replace(/_/g, "/");
    while (encoded.length % 4 !== 0) encoded += "=";

    const decoded = atob(encoded);
    const candidates: string[] = [];

    for (let i = 0; i < decoded.length - 4; i++) {
      if (decoded.slice(i, i + 4) === "http") {
        let url = "";
        for (let j = i; j < decoded.length; j++) {
          const code = decoded.charCodeAt(j);
          if (code < 32 || code > 126) break;
          url += decoded[j];
        }
        url = url.replace(/[^a-zA-Z0-9/_\-.~:?#\[\]@!$&'()*+,;=%]+$/, "");
        if (url.startsWith("http")) {
          candidates.push(url);
        }
      }
    }

    const nonGoogle = candidates
      .map(canonicalUrl)
      .filter((u) => {
        try {
          const h = new URL(u).hostname.toLowerCase();
          return !h.includes("google.com") && !h.includes("google.co");
        } catch {
          return false;
        }
      });

    if (!nonGoogle.length) return null;

    nonGoogle.sort((a, b) => b.length - a.length);
    return nonGoogle[0];
  } catch {
    return null;
  }
}

async function resolveUrl(googleUrl: string): Promise<string | null> {
  let controller: AbortController | null = null;
  let timeoutId: number | null = null;

  try {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller?.abort(), 5000) as unknown as number;

    const response = await fetch(googleUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const finalUrl = canonicalUrl(response.url);
    try {
      const h = new URL(finalUrl).hostname.toLowerCase();
      if (finalUrl.startsWith("http") && !h.includes("google.com") && !h.includes("google.co")) {
        return finalUrl;
      }
    } catch {
      // continue
    }

    const html = await response.text();

    const patterns = [
      /data-url="([^"]+)"/i,
      /window\.location\.replace\("([^"]+)"\)/i,
      /window\.location\s*=\s*"([^"]+)"/i,
      /content="0;\s*url=([^"]+)"/i,
      /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i,
    ];

    for (const pattern of patterns) {
      const m = html.match(pattern);
      const found = m?.[1]?.trim();
      if (!found) continue;

      const cleaned = canonicalUrl(found);
      try {
        const h = new URL(cleaned).hostname.toLowerCase();
        if (!h.includes("google.com") && !h.includes("google.co")) {
          return cleaned;
        }
      } catch {
        // ignore
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function getBestArticleUrl(article: RawArticle): Promise<string | null> {
  const decoded = decodeGoogleNewsUrl(article.link);
  if (decoded) return canonicalUrl(decoded);

  const resolved = await resolveUrl(article.link);
  if (resolved) return canonicalUrl(resolved);

  if (article.sourceUrl?.startsWith("http")) {
    try {
      const h = new URL(article.sourceUrl).hostname.toLowerCase();
      if (!h.includes("google.com") && !h.includes("google.co")) {
        return canonicalUrl(article.sourceUrl);
      }
    } catch {
      // ignore
    }
  }

  return null;
}

async function scrapeGoogleNewsRss(query: string): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      console.error(`RSS fetch failed for "${query}" with status ${response.status}`);
      return articles;
    }

    const xml = await response.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const item of items.slice(0, 15)) {
      try {
        const titleMatch =
          item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
          item.match(/<title>(.*?)<\/title>/i);

        const linkMatch = item.match(/<link>(.*?)<\/link>/i);

        const descMatch =
          item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
          item.match(/<description>(.*?)<\/description>/i);

        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);

        const sourceMatch =
          item.match(/<source[^>]*url="([^"]*)"[^>]*>(.*?)<\/source>/i) ||
          item.match(/<source[^>]*>(.*?)<\/source>/i);

        const title = cleanText(titleMatch?.[1] || "");
        const link = linkMatch?.[1]?.trim() || "";
        const sourceUrl = sourceMatch?.[1]?.startsWith?.("http") ? sourceMatch[1].trim() : "";
        const source = cleanText(sourceMatch?.[2] || sourceMatch?.[1] || "Google News");
        const summary = extractCleanSummary(descMatch?.[1] || "", title);
        const published = pubDateMatch?.[1]?.trim() || new Date().toISOString();

        if (title && link) {
          articles.push({
            title,
            link,
            sourceUrl,
            source,
            summary,
            published,
          });
        }
      } catch {
        // skip malformed item
      }
    }
  } catch (error) {
    console.error(`RSS scrape error for "${query}":`, error);
  }

  return articles;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId = "";

    if (isServiceRole) {
      const { data: systemUser, error } = await serviceClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "analyst")
        .limit(1)
        .maybeSingle();

      if (error || !systemUser?.user_id) {
        return new Response(
          JSON.stringify({ success: false, error: "No analyst user found for cron execution" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      userId = systemUser.user_id;
      console.log("Cron execution using analyst user:", userId);
    } else {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser();

      if (authError || !user) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = user.id;
    }

    let topics = [...OSINT_TOPICS];
    let maxPerTopic = 6;

    try {
      const body = await req.json();

      if (Array.isArray(body?.topics) && body.topics.length > 0) {
        topics = body.topics
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) => t.trim())
          .filter(Boolean)
          .slice(0, 25);
      }

      if (typeof body?.maxPerTopic === "number") {
        maxPerTopic = Math.max(1, Math.min(body.maxPerTopic, 12));
      }
    } catch {
      // keep defaults
    }

    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: recentItems, error: recentError } = await serviceClient
      .from("news_items")
      .select("id, title, tags, url")
      .gte("published_at", cutoff48h);

    if (recentError) {
      return new Response(JSON.stringify({ success: false, error: recentError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingTitleMap = new Map<string, { id: string; tags: string[]; url?: string }>();

    for (const item of recentItems || []) {
      const norm = normalizeTitle(item.title || "");
      if (!norm) continue;
      if (!existingTitleMap.has(norm)) {
        existingTitleMap.set(norm, {
          id: item.id,
          tags: Array.isArray(item.tags) ? item.tags : [],
          url: item.url || "",
        });
      }
    }

    const seenNormTitles = new Set<string>();
    const newArticles: NewsInsert[] = [];
    const mergeUpdates: Array<{ id: string; sourceTag: string }> = [];

    let skippedDupes = 0;
    let skippedIrrelevant = 0;
    let skippedBadUrl = 0;

    for (const topic of topics) {
      try {
        const articles = await scrapeGoogleNewsRss(topic);

        for (const article of articles.slice(0, maxPerTopic)) {
          const normTitle = normalizeTitle(article.title);

          if (!normTitle) continue;

          if (seenNormTitles.has(normTitle)) {
            skippedDupes++;
            continue;
          }
          seenNormTitles.add(normTitle);

          if (!isOsintRelevant(article.title, article.summary)) {
            skippedIrrelevant++;
            continue;
          }

          const finalUrl = await getBestArticleUrl(article);
          if (!finalUrl) {
            skippedBadUrl++;
            continue;
          }

          const sourceTag = `source:${finalUrl}`;
          const existingMatch = existingTitleMap.get(normTitle);

          if (existingMatch) {
            if (!existingMatch.tags.includes(sourceTag)) {
              mergeUpdates.push({ id: existingMatch.id, sourceTag });
            }
            skippedDupes++;
            continue;
          }

          const location = extractLocation(`${article.title} ${article.summary}`);
          const category = classifyCategory(article.title, article.summary);
          const threatLevel = determineThreatLevel(article.title, article.summary);
          const credibility = calculateSourceCredibility(article.source);
          const actorType = determineActorType(`${article.title} ${article.summary}`);

          const tagSet = new Set<string>([
            topic.split(" ")[0]?.toLowerCase() || "osint",
            category,
            location.region,
            `country:${location.country}`,
            `credibility:${credibility.credibility}`,
            sourceTag,
          ]);

          newArticles.push({
            title: article.title.slice(0, 500),
            summary: article.summary.slice(0, 2000),
            url: finalUrl,
            source: article.source.slice(0, 200) || "Unknown Source",
            country: location.country,
            region: location.region,
            lat: location.lat,
            lon: location.lon,
            category,
            threat_level: threatLevel,
            confidence_level: confidenceFromThreat(threatLevel),
            confidence_score: credibility.score,
            source_credibility: credibility.credibility,
            actor_type: actorType,
            published_at: safeIsoDate(article.published),
            user_id: userId,
            tags: Array.from(tagSet),
          });
        }

        await delay(400);
      } catch (error) {
        console.error(`Error scraping topic "${topic}":`, error);
      }
    }

    if (mergeUpdates.length > 0) {
      const mergedById = new Map<string, Set<string>>();

      for (const item of mergeUpdates) {
        if (!mergedById.has(item.id)) mergedById.set(item.id, new Set());
        mergedById.get(item.id)!.add(item.sourceTag);
      }

      for (const [id, sourceTags] of mergedById.entries()) {
        try {
          const { data: current, error } = await serviceClient
            .from("news_items")
            .select("tags")
            .eq("id", id)
            .maybeSingle();

          if (error || !current) continue;

          const currentTags = Array.isArray(current.tags) ? current.tags : [];
          const updatedTags = Array.from(new Set([...currentTags, ...Array.from(sourceTags)]));

          await serviceClient
            .from("news_items")
            .update({ tags: updatedTags })
            .eq("id", id);
        } catch {
          // continue
        }
      }
    }

    let inserted = 0;

    if (newArticles.length > 0) {
      const { error: insertError, data } = await serviceClient
        .from("news_items")
        .insert(newArticles)
        .select("id");

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: insertError.message,
            scraped: newArticles.length,
            inserted: 0,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      inserted = data?.length || newArticles.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Inserted ${inserted} new, merged ${mergeUpdates.length} sources, skipped ${skippedDupes} duplicates, ${skippedIrrelevant} irrelevant, ${skippedBadUrl} bad-url`,
        topics_processed: topics.length,
        inserted,
        merged: mergeUpdates.length,
        duplicates: skippedDupes,
        skipped_irrelevant: skippedIrrelevant,
        skipped_bad_url: skippedBadUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Scraper fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
