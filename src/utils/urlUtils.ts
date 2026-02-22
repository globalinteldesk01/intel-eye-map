/**
 * If a URL is a Google News tracking link, create a Google search URL
 * for the article title + source so users can find the original article.
 */
export function getViewableUrl(url: string, title: string, source: string): string {
  if (url.includes('news.google.com/rss/articles/') || url.includes('news.google.com/articles/')) {
    const cleanTitle = title.replace(/\s*[-–—]\s*[^-–—]+$/, '').trim();
    return `https://www.google.com/search?q=${encodeURIComponent(`"${cleanTitle}" ${source}`)}`;
  }
  return url;
}
