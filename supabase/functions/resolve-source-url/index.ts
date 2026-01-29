import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if URL looks like a valid article URL (not an image, script, etc.)
function isValidArticleUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  
  // Skip Google domains
  if (url.includes('google.com') || url.includes('gstatic.com') || url.includes('googleapis.com')) {
    return false;
  }
  
  // Skip images, scripts, stylesheets
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)(\?|$)/i.test(url)) {
    return false;
  }
  
  // Skip CDN and image hosting domains
  const skipDomains = [
    'lh3.googleusercontent.com',
    'googleusercontent.com',
    'cloudflare.com',
    'cdn.',
    'static.',
    'assets.',
    'images.',
    'img.',
  ];
  
  for (const domain of skipDomains) {
    if (url.includes(domain)) return false;
  }
  
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not a Google News URL, return as-is
    if (!url.includes('news.google.com')) {
      return new Response(
        JSON.stringify({ resolvedUrl: url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resolving URL:', url.substring(0, 80));

    // Try to follow redirects to get the actual article URL
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      // If redirected to actual article, return that URL
      if (response.url && isValidArticleUrl(response.url)) {
        console.log('Resolved via redirect to:', response.url.substring(0, 80));
        return new Response(
          JSON.stringify({ resolvedUrl: response.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse HTML to find embedded URLs
      const html = await response.text();

      // Strategy 1: Look for data-n-au attribute (contains actual URL)
      const dataAuMatch = html.match(/data-n-au="([^"]+)"/);
      if (dataAuMatch?.[1]) {
        const decoded = dataAuMatch[1].replace(/&amp;/g, '&');
        if (isValidArticleUrl(decoded)) {
          console.log('Resolved via data-n-au:', decoded.substring(0, 80));
          return new Response(
            JSON.stringify({ resolvedUrl: decoded }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Strategy 2: Look for article URL in window.__INITIAL_STATE__ or similar JSON
      const jsonStateMatch = html.match(/"(https?:\/\/(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s"<>]*)?)"[^>]*>.*?<\/a>/);
      if (jsonStateMatch?.[1] && isValidArticleUrl(jsonStateMatch[1])) {
        const cleanUrl = jsonStateMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
        console.log('Resolved via anchor:', cleanUrl.substring(0, 80));
        return new Response(
          JSON.stringify({ resolvedUrl: cleanUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Strategy 3: Find anchor tags with external URLs
      const anchorRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi;
      let anchorMatch;
      while ((anchorMatch = anchorRegex.exec(html)) !== null) {
        const potentialUrl = anchorMatch[1].replace(/&amp;/g, '&');
        if (isValidArticleUrl(potentialUrl)) {
          console.log('Resolved via anchor href:', potentialUrl.substring(0, 80));
          return new Response(
            JSON.stringify({ resolvedUrl: potentialUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Strategy 4: Look for jslog or data attributes with URLs
      const dataUrlMatch = html.match(/data-[a-z-]+="(https?:\/\/(?!news\.google)[^"]+)"/i);
      if (dataUrlMatch?.[1] && isValidArticleUrl(dataUrlMatch[1])) {
        console.log('Resolved via data attr:', dataUrlMatch[1].substring(0, 80));
        return new Response(
          JSON.stringify({ resolvedUrl: dataUrlMatch[1] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
    }

    // If resolution fails, return original - browser will handle the redirect
    console.log('Could not resolve, returning original URL');
    return new Response(
      JSON.stringify({ resolvedUrl: url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resolve URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
