import { parseUtcDate } from '@/utils/time';

// Maps country names (as used in news_items.country) to a representative IANA timezone.
// Used for displaying news timestamps in the country's local time.
const COUNTRY_TZ: Record<string, string> = {
  Afghanistan: 'Asia/Kabul',
  Albania: 'Europe/Tirane',
  Algeria: 'Africa/Algiers',
  Andorra: 'Europe/Andorra',
  Angola: 'Africa/Luanda',
  Argentina: 'America/Argentina/Buenos_Aires',
  Armenia: 'Asia/Yerevan',
  Australia: 'Australia/Sydney',
  Austria: 'Europe/Vienna',
  Azerbaijan: 'Asia/Baku',
  Bahamas: 'America/Nassau',
  Bahrain: 'Asia/Bahrain',
  Bangladesh: 'Asia/Dhaka',
  Barbados: 'America/Barbados',
  Belarus: 'Europe/Minsk',
  Belgium: 'Europe/Brussels',
  Belize: 'America/Belize',
  Benin: 'Africa/Porto-Novo',
  Bhutan: 'Asia/Thimphu',
  Bolivia: 'America/La_Paz',
  'Bosnia and Herzegovina': 'Europe/Sarajevo',
  Botswana: 'Africa/Gaborone',
  Brazil: 'America/Sao_Paulo',
  Brunei: 'Asia/Brunei',
  Bulgaria: 'Europe/Sofia',
  'Burkina Faso': 'Africa/Ouagadougou',
  Burundi: 'Africa/Bujumbura',
  Cambodia: 'Asia/Phnom_Penh',
  Cameroon: 'Africa/Douala',
  Canada: 'America/Toronto',
  'Central African Republic': 'Africa/Bangui',
  Chad: 'Africa/Ndjamena',
  Chile: 'America/Santiago',
  China: 'Asia/Shanghai',
  Colombia: 'America/Bogota',
  Comoros: 'Indian/Comoro',
  Congo: 'Africa/Brazzaville',
  'Costa Rica': 'America/Costa_Rica',
  Croatia: 'Europe/Zagreb',
  Cuba: 'America/Havana',
  Cyprus: 'Asia/Nicosia',
  'Czech Republic': 'Europe/Prague',
  Czechia: 'Europe/Prague',
  'Democratic Republic of the Congo': 'Africa/Kinshasa',
  Denmark: 'Europe/Copenhagen',
  Djibouti: 'Africa/Djibouti',
  'Dominican Republic': 'America/Santo_Domingo',
  Ecuador: 'America/Guayaquil',
  Egypt: 'Africa/Cairo',
  'El Salvador': 'America/El_Salvador',
  'Equatorial Guinea': 'Africa/Malabo',
  Eritrea: 'Africa/Asmara',
  Estonia: 'Europe/Tallinn',
  Eswatini: 'Africa/Mbabane',
  Ethiopia: 'Africa/Addis_Ababa',
  Fiji: 'Pacific/Fiji',
  Finland: 'Europe/Helsinki',
  France: 'Europe/Paris',
  Gabon: 'Africa/Libreville',
  Gambia: 'Africa/Banjul',
  Georgia: 'Asia/Tbilisi',
  Germany: 'Europe/Berlin',
  Ghana: 'Africa/Accra',
  Greece: 'Europe/Athens',
  Guatemala: 'America/Guatemala',
  Guinea: 'Africa/Conakry',
  'Guinea-Bissau': 'Africa/Bissau',
  Guyana: 'America/Guyana',
  Haiti: 'America/Port-au-Prince',
  Honduras: 'America/Tegucigalpa',
  Hungary: 'Europe/Budapest',
  Iceland: 'Atlantic/Reykjavik',
  India: 'Asia/Kolkata',
  Indonesia: 'Asia/Jakarta',
  Iran: 'Asia/Tehran',
  Iraq: 'Asia/Baghdad',
  Ireland: 'Europe/Dublin',
  Israel: 'Asia/Jerusalem',
  Italy: 'Europe/Rome',
  'Ivory Coast': 'Africa/Abidjan',
  Jamaica: 'America/Jamaica',
  Japan: 'Asia/Tokyo',
  Jordan: 'Asia/Amman',
  Kazakhstan: 'Asia/Almaty',
  Kenya: 'Africa/Nairobi',
  Kosovo: 'Europe/Belgrade',
  Kuwait: 'Asia/Kuwait',
  Kyrgyzstan: 'Asia/Bishkek',
  Laos: 'Asia/Vientiane',
  Latvia: 'Europe/Riga',
  Lebanon: 'Asia/Beirut',
  Lesotho: 'Africa/Maseru',
  Liberia: 'Africa/Monrovia',
  Libya: 'Africa/Tripoli',
  Liechtenstein: 'Europe/Vaduz',
  Lithuania: 'Europe/Vilnius',
  Luxembourg: 'Europe/Luxembourg',
  Madagascar: 'Indian/Antananarivo',
  Malawi: 'Africa/Blantyre',
  Malaysia: 'Asia/Kuala_Lumpur',
  Maldives: 'Indian/Maldives',
  Mali: 'Africa/Bamako',
  Malta: 'Europe/Malta',
  Mauritania: 'Africa/Nouakchott',
  Mauritius: 'Indian/Mauritius',
  Mexico: 'America/Mexico_City',
  Moldova: 'Europe/Chisinau',
  Monaco: 'Europe/Monaco',
  Mongolia: 'Asia/Ulaanbaatar',
  Montenegro: 'Europe/Podgorica',
  Morocco: 'Africa/Casablanca',
  Mozambique: 'Africa/Maputo',
  Myanmar: 'Asia/Yangon',
  Namibia: 'Africa/Windhoek',
  Nepal: 'Asia/Kathmandu',
  Netherlands: 'Europe/Amsterdam',
  'New Zealand': 'Pacific/Auckland',
  Nicaragua: 'America/Managua',
  Niger: 'Africa/Niamey',
  Nigeria: 'Africa/Lagos',
  'North Korea': 'Asia/Pyongyang',
  'North Macedonia': 'Europe/Skopje',
  Norway: 'Europe/Oslo',
  Oman: 'Asia/Muscat',
  Pakistan: 'Asia/Karachi',
  Palestine: 'Asia/Gaza',
  Panama: 'America/Panama',
  'Papua New Guinea': 'Pacific/Port_Moresby',
  Paraguay: 'America/Asuncion',
  Peru: 'America/Lima',
  Philippines: 'Asia/Manila',
  Poland: 'Europe/Warsaw',
  Portugal: 'Europe/Lisbon',
  Qatar: 'Asia/Qatar',
  Romania: 'Europe/Bucharest',
  Russia: 'Europe/Moscow',
  Rwanda: 'Africa/Kigali',
  'Saudi Arabia': 'Asia/Riyadh',
  Senegal: 'Africa/Dakar',
  Serbia: 'Europe/Belgrade',
  Seychelles: 'Indian/Mahe',
  'Sierra Leone': 'Africa/Freetown',
  Singapore: 'Asia/Singapore',
  Slovakia: 'Europe/Bratislava',
  Slovenia: 'Europe/Ljubljana',
  Somalia: 'Africa/Mogadishu',
  'South Africa': 'Africa/Johannesburg',
  'South Korea': 'Asia/Seoul',
  'South Sudan': 'Africa/Juba',
  Spain: 'Europe/Madrid',
  'Sri Lanka': 'Asia/Colombo',
  Sudan: 'Africa/Khartoum',
  Suriname: 'America/Paramaribo',
  Sweden: 'Europe/Stockholm',
  Switzerland: 'Europe/Zurich',
  Syria: 'Asia/Damascus',
  Taiwan: 'Asia/Taipei',
  Tajikistan: 'Asia/Dushanbe',
  Tanzania: 'Africa/Dar_es_Salaam',
  Thailand: 'Asia/Bangkok',
  'Timor-Leste': 'Asia/Dili',
  Togo: 'Africa/Lome',
  'Trinidad and Tobago': 'America/Port_of_Spain',
  Tunisia: 'Africa/Tunis',
  Turkey: 'Europe/Istanbul',
  Turkmenistan: 'Asia/Ashgabat',
  Uganda: 'Africa/Kampala',
  Ukraine: 'Europe/Kyiv',
  'United Arab Emirates': 'Asia/Dubai',
  UAE: 'Asia/Dubai',
  'United Kingdom': 'Europe/London',
  UK: 'Europe/London',
  'United States': 'America/New_York',
  USA: 'America/New_York',
  US: 'America/New_York',
  Uruguay: 'America/Montevideo',
  Uzbekistan: 'Asia/Tashkent',
  Vanuatu: 'Pacific/Efate',
  Venezuela: 'America/Caracas',
  Vietnam: 'Asia/Ho_Chi_Minh',
  Yemen: 'Asia/Aden',
  Zambia: 'Africa/Lusaka',
  Zimbabwe: 'Africa/Harare',
};

export function timezoneForCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  return COUNTRY_TZ[country] || COUNTRY_TZ[country.trim()];
}

/** Short timezone abbreviation (e.g. "IST", "EST") for a given date and IANA zone. */
export function tzAbbrev(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date);
    return parts.find(p => p.type === 'timeZoneName')?.value || 'LOCAL';
  } catch {
    return 'LOCAL';
  }
}

/**
 * Format a UTC date as the country's local time, e.g. "May 21, 19:15 IST".
 * Falls back to UTC if no timezone mapping exists.
 */
export function formatLocalForCountry(
  date: Date | string,
  country?: string | null,
  pattern: 'datetime' | 'time' | 'datetime-year' = 'datetime'
): string {
  const d = parseUtcDate(date);
  const tz = timezoneForCountry(country);
  if (!tz) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: pattern === 'time' ? undefined : 'short',
      day: pattern === 'time' ? undefined : 'numeric',
      year: pattern === 'datetime-year' ? 'numeric' : undefined,
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return `${fmt.format(d)} UTC`;
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: pattern === 'time' ? undefined : 'short',
    day: pattern === 'time' ? undefined : 'numeric',
    year: pattern === 'datetime-year' ? 'numeric' : undefined,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${fmt.format(d)} ${tzAbbrev(d, tz)}`;
}

/** Returns YYYY-MM-DD in the country's local timezone (or UTC fallback). */
export function localDayKey(date: Date | string, country?: string | null): string {
  const d = parseUtcDate(date);
  const tz = timezoneForCountry(country) || 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/** Viewer's IANA timezone, resolved from the browser. Falls back to UTC. */
export function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Format a UTC date in the viewer's local timezone (based on the browser
 * locale of whoever is using the dashboard), e.g. "May 22, 09:15 SGT".
 */
export function formatLocalForViewer(
  date: Date | string,
  pattern: 'datetime' | 'time' | 'datetime-year' = 'datetime'
): string {
  const d = parseUtcDate(date);
  const tz = viewerTimezone();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: pattern === 'time' ? undefined : 'short',
    day: pattern === 'time' ? undefined : 'numeric',
    year: pattern === 'datetime-year' ? 'numeric' : undefined,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${fmt.format(d)} ${tzAbbrev(d, tz)}`;
}

/** YYYY-MM-DD in the viewer's local timezone. */
export function viewerDayKey(date: Date | string): string {
  const d = parseUtcDate(date);
  const tz = viewerTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}