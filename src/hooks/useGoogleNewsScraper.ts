import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScrapeResult {
  success: boolean;
  message: string;
  scraped: number;
  inserted: number;
  duplicates?: number;
  error?: string;
}

interface ScrapeOptions {
  topics?: string[];
  maxPerTopic?: number;
}

export function useGoogleNewsScraper() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ScrapeResult | null>(null);
  const { toast } = useToast();

  const scrapeNews = useCallback(async (options?: ScrapeOptions): Promise<ScrapeResult | null> => {
    setIsLoading(true);
    setLastResult(null);

    try {
      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to use the news scraper',
          variant: 'destructive',
        });
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-google-news`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(options || {}),
        }
      );

      const result: ScrapeResult = await response.json();
      setLastResult(result);

      if (result.success) {
        toast({
          title: 'Scrape Complete',
          description: result.message,
        });
      } else {
        toast({
          title: 'Scrape Failed',
          description: result.error || 'Could not complete scrape',
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      console.error('Scraper error:', error);
      const errorResult: ScrapeResult = {
        success: false,
        message: 'Scrape failed',
        scraped: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      setLastResult(errorResult);
      
      toast({
        title: 'Scrape Error',
        description: errorResult.error,
        variant: 'destructive',
      });
      
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    scrapeNews,
    isLoading,
    lastResult,
  };
}
