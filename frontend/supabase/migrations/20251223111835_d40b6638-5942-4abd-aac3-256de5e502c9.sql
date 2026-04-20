-- Create enums for news item types
CREATE TYPE public.threat_level AS ENUM ('low', 'elevated', 'high', 'critical');
CREATE TYPE public.confidence_level AS ENUM ('verified', 'developing', 'breaking');
CREATE TYPE public.actor_type AS ENUM ('state', 'non-state', 'organization');
CREATE TYPE public.source_credibility AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.news_category AS ENUM ('security', 'diplomacy', 'economy', 'conflict', 'humanitarian', 'technology');

-- Create news_items table
CREATE TABLE public.news_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  source_credibility source_credibility NOT NULL DEFAULT 'medium',
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lat DECIMAL(9,6) NOT NULL,
  lon DECIMAL(9,6) NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  confidence_level confidence_level NOT NULL DEFAULT 'developing',
  threat_level threat_level NOT NULL DEFAULT 'low',
  actor_type actor_type NOT NULL DEFAULT 'organization',
  sub_category TEXT,
  category news_category NOT NULL DEFAULT 'security',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view all news items
CREATE POLICY "Authenticated users can view all news items"
ON public.news_items
FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own news items
CREATE POLICY "Users can insert their own news items"
ON public.news_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own news items
CREATE POLICY "Users can update their own news items"
ON public.news_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own news items
CREATE POLICY "Users can delete their own news items"
ON public.news_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for common queries
CREATE INDEX idx_news_items_published_at ON public.news_items(published_at DESC);
CREATE INDEX idx_news_items_category ON public.news_items(category);
CREATE INDEX idx_news_items_user_id ON public.news_items(user_id);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_news_items_updated_at
  BEFORE UPDATE ON public.news_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for news_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_items;