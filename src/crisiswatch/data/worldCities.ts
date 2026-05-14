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

export const ALL_CITIES = all;
export const CITY_AUTOCOMPLETE = sortedByPop.slice(0, 1500);