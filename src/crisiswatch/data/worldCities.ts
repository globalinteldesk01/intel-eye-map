import raw from './worldCities.json';

// Tuple format: [asciiName, countryCode, lat, lng, population]
type CityTuple = [string, string, number, number, number];

export interface City {
  name: string;
  country: string; // ISO-2
  lat: number;
  lng: number;
  pop: number;
}

const all: City[] = (raw as CityTuple[]).map(([name, country, lat, lng, pop]) => ({
  name,
  country,
  lat,
  lng,
  pop,
}));

// Lowercase name -> best (most populous) match
const byName = new Map<string, City>();
for (const c of all) {
  const key = c.name.toLowerCase();
  const prev = byName.get(key);
  if (!prev || prev.pop < c.pop) byName.set(key, c);
}

// Sorted by population desc — used by NER scan to prefer larger cities first
const sortedByPop = [...all].sort((a, b) => b.pop - a.pop);

// Pre-compiled regex of city names (top N) for quick scan.
// Restrict to cities >= 100k population to limit false positives.
const NER_CITIES = sortedByPop.filter((c) => c.pop >= 100_000 || /[A-Z]/.test(c.name[0] || ''));

export function lookupCity(name: string): City | undefined {
  return byName.get(name.trim().toLowerCase());
}

// Group cities by lowercase name -> all matches (sorted by pop desc)
const byNameAll = new Map<string, City[]>();
for (const c of sortedByPop) {
  const key = c.name.toLowerCase();
  const arr = byNameAll.get(key);
  if (arr) arr.push(c);
  else byNameAll.set(key, [c]);
}

// Common country name -> ISO-2 mapping (extend as needed)
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
  'united states': 'US', 'usa': 'US', 'us': 'US', 'america': 'US',
  'russia': 'RU', 'russian federation': 'RU',
  'china': 'CN', "people's republic of china": 'CN',
  'india': 'IN', 'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK', 'nepal': 'NP',
  'france': 'FR', 'germany': 'DE', 'spain': 'ES', 'italy': 'IT', 'portugal': 'PT', 'netherlands': 'NL',
  'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT', 'poland': 'PL', 'ukraine': 'UA',
  'turkey': 'TR', 'türkiye': 'TR', 'greece': 'GR', 'romania': 'RO', 'hungary': 'HU', 'czech republic': 'CZ', 'czechia': 'CZ',
  'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI', 'ireland': 'IE', 'iceland': 'IS',
  'canada': 'CA', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR', 'chile': 'CL', 'colombia': 'CO', 'peru': 'PE', 'venezuela': 'VE',
  'australia': 'AU', 'new zealand': 'NZ',
  'japan': 'JP', 'south korea': 'KR', 'korea': 'KR', 'north korea': 'KP', 'taiwan': 'TW', 'hong kong': 'HK',
  'singapore': 'SG', 'malaysia': 'MY', 'indonesia': 'ID', 'thailand': 'TH', 'vietnam': 'VN', 'philippines': 'PH', 'cambodia': 'KH', 'laos': 'LA', 'myanmar': 'MM', 'burma': 'MM', 'brunei': 'BN',
  'israel': 'IL', 'palestine': 'PS', 'lebanon': 'LB', 'syria': 'SY', 'iraq': 'IQ', 'iran': 'IR', 'saudi arabia': 'SA',
  'united arab emirates': 'AE', 'uae': 'AE', 'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM', 'yemen': 'YE', 'jordan': 'JO',
  'egypt': 'EG', 'libya': 'LY', 'tunisia': 'TN', 'algeria': 'DZ', 'morocco': 'MA', 'sudan': 'SD', 'south sudan': 'SS',
  'nigeria': 'NG', 'kenya': 'KE', 'ethiopia': 'ET', 'south africa': 'ZA', 'ghana': 'GH', 'uganda': 'UG', 'tanzania': 'TZ', 'somalia': 'SO',
  'afghanistan': 'AF', 'kazakhstan': 'KZ', 'uzbekistan': 'UZ',
};

export function countryNameToIso(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return COUNTRY_NAME_TO_ISO[name.trim().toLowerCase()];
}

export function lookupCityInCountry(name: string, countryIso: string): City | undefined {
  const matches = byNameAll.get(name.trim().toLowerCase());
  if (!matches) return undefined;
  return matches.find((c) => c.country === countryIso);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build one big alternation regex for fast NER. Cap to ~3000 cities.
const NER_LIMIT = 3000;
const nerList = NER_CITIES.slice(0, NER_LIMIT);
const nerLookup = new Map<string, City>();
for (const c of nerList) nerLookup.set(c.name.toLowerCase(), c);
const nerPattern = new RegExp(
  '\\b(' + nerList.map((c) => escapeRegex(c.name)).join('|') + ')\\b',
  'gi'
);

/**
 * Scan free text for the first matching city name. Prefers the most populous
 * match when multiple cities are mentioned.
 */
export function extractCityFromText(text: string | null | undefined): City | undefined {
  if (!text) return undefined;
  const matches = text.match(nerPattern);
  if (!matches) return undefined;
  let best: City | undefined;
  for (const m of matches) {
    const c = nerLookup.get(m.toLowerCase());
    if (c && (!best || c.pop > best.pop)) best = c;
  }
  return best;
}

/**
 * Like extractCityFromText, but if a country hint is provided, prefer cities
 * located in that country when the same name is ambiguous (e.g. London, GB vs London, CA).
 */
export function extractCityWithCountry(
  text: string | null | undefined,
  countryHint?: string | null
): City | undefined {
  if (!text) return undefined;
  const matches = text.match(nerPattern);
  if (!matches) return undefined;
  const iso = countryNameToIso(countryHint || '');
  let best: City | undefined;
  let bestScore = -Infinity;
  for (const m of matches) {
    const lower = m.toLowerCase();
    // Prefer in-country variant when hint is available
    let c: City | undefined;
    if (iso) c = lookupCityInCountry(lower, iso);
    if (!c) c = nerLookup.get(lower);
    if (!c) continue;
    const inCountry = iso && c.country === iso ? 1 : 0;
    const score = inCountry * 1e12 + c.pop;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export const ALL_CITIES = all;
export const CITY_AUTOCOMPLETE = sortedByPop.slice(0, 1500);