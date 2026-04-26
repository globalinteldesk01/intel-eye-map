-- Clean up mislocated news items that were defaulted to Washington DC / United States
-- by the previous geolocation fallback. These are identifiable by confidence_score = 0.3.
DELETE FROM public.news_items WHERE confidence_score = 0.3;