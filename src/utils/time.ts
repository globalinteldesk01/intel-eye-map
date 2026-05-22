import type { NewsItem } from '@/types/news';

const NORMALIZED_TZ_SUFFIX = /([+-]\d{2})(\d{2})$/;
const SHORT_TZ_SUFFIX = /([+-]\d{2})$/;

/**
 * Parse database/API timestamps consistently across browsers.
 * Supabase usually returns ISO strings, but some sources may contain a space
 * separator or a short timezone suffix such as +00.
 */
export function parseUtcDate(value?: Date | string | number | null): Date {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date(0) : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }
  if (!value) return new Date(0);

  const raw = String(value).trim();
  const normalized = raw
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2')
    .replace(NORMALIZED_TZ_SUFFIX, '$1:$2')
    .replace(SHORT_TZ_SUFFIX, '$1:00');

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function dateTimeValue(value?: Date | string | number | null): number {
  return parseUtcDate(value).getTime();
}

/** Latest-dashboard time: when the intel was received/created, not future source publish time. */
export function getIntelFreshnessDate(item: Pick<NewsItem, 'createdAt' | 'publishedAt'>): Date {
  return parseUtcDate(item.createdAt || item.publishedAt);
}

export function compareIntelNewest(a: Pick<NewsItem, 'createdAt' | 'publishedAt'>, b: Pick<NewsItem, 'createdAt' | 'publishedAt'>): number {
  return getIntelFreshnessDate(b).getTime() - getIntelFreshnessDate(a).getTime();
}