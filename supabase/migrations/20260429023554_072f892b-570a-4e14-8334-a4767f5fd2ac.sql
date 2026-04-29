
ALTER TABLE public.crisis_user_settings
  ADD COLUMN IF NOT EXISTS ollama_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ollama_model text DEFAULT 'llama3.2',
  ADD COLUMN IF NOT EXISTS ollama_token text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_travel_analysis jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_travel_analysis_at timestamptz DEFAULT NULL;
