/**
 * If a URL is a Google News tracking link, create a Google search URL
 * for the article title + source so users can find the original article.
 */
export function getViewableUrl(url: string, title: string, source: string): string {
  if (
    url.includes('news.google.com/rss/articles/') ||
    url.includes('news.google.com/articles/') ||
    url.includes('news.google.com/')
  ) {
    // Strip the trailing "- SourceName" from the title for a cleaner search
    const cleanTitle = title.replace(/\s*[-–—]\s*[^-–—]+$/, '').trim();
    return `https://www.google.com/search?q=${encodeURIComponent(`"${cleanTitle}" ${source}`)}`;
  }
  return url;
}

/**
 * Extract real source URLs stored in the tags array (prefixed with "source:")
 * and return the first non-Google one, or fall back to getViewableUrl.
 */
export function getBestSourceUrl(url: string, title: string, source: string, tags: string[]): string {
  // First check if tags contain a resolved real source URL
  const sourceTags = tags
    .filter((t) => t.startsWith('source:'))
    .map((t) => t.replace('source:', ''));

  const realUrl = sourceTags.find(
    (u) => !u.includes('news.google.com') && u.startsWith('http')
  );

  if (realUrl) return realUrl;

  // If the main URL is already a real URL (not Google News), use it
  if (!url.includes('news.google.com')) return url;

  // Fall back to Google search
  return getViewableUrl(url, title, source);
}
