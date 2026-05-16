## Integrated AI Intelligence Pipeline

Add a 9-stage AI enrichment pipeline that runs on every ingested article, with outputs surfaced on intel cards, a per-country Travel Advisory page, and an incident cluster layer on the map.

### Pipeline (one edge function: `enrich-intel`)

Triggered automatically after each `news_items` insert (via DB trigger → `pg_net` → edge function, batched every 60s).

1. **Language translation** — Detect non-English title/summary, translate to English via Lovable AI (`google/gemini-3-flash-preview`). Original preserved in `original_language` / `original_title`.
2. **Geo entity extraction** — LLM extracts `{city, country, lat, lon, region}` from title+body. Overrides current RSS-level geocoding when more specific.
3. **Threat extraction** — Structured output: `threat_type`, `actors[]`, `targets[]`, `weapons[]`, `casualties` (if any).
4. **Severity scoring** — 0–100 numeric + categorical (`low/elevated/high/critical`) based on impact, scope, casualties, escalation potential. Replaces current heuristic.
5. **AI summarization** — 2-sentence analyst-grade summary stored in `ai_summary` (raw RSS snippet kept as `summary`).
6. **NLP engine** — Reuses the same Gemini call (single combined structured-output request covering steps 2–5 to save credits).
7. **Incident clustering** — After enrichment, group items within 50km + 48h + same threat_type into an `incident_id` (hash of normalized title prefix + geohash + day). Backend job; populates `incidents` table.
8. **Automated ingestion** — Existing cron stays; new trigger fans out unenriched rows to `enrich-intel` in batches of 10.
9. **AI-generated travel advisories** — Nightly cron + on-demand: aggregates last-30-day enriched intel per country, generates structured advisory (`overall_risk`, `key_threats[]`, `regions_to_avoid[]`, `recommendations[]`, `narrative`). Stored in `country_advisories`, regenerated when severity shifts.

### Database changes (one migration)

- `news_items` add: `ai_summary`, `original_title`, `original_language`, `severity_score int`, `threat_type`, `actors text[]`, `targets text[]`, `casualties jsonb`, `incident_id uuid`, `enriched_at timestamptz`.
- New `incidents` table: `id, title, threat_type, country, city, lat, lon, severity_max, item_count, first_seen, last_seen, summary`.
- New `country_advisories` table: `country, risk_level, risk_score, key_threats jsonb, recommendations jsonb, narrative text, generated_at, valid_until`.
- Trigger `news_items_after_insert` → `pg_net.http_post` to `enrich-intel`.
- pg_cron: `cluster-incidents` every 10 min, `generate-advisories` nightly.

### Surfaces

- **Intel cards (`NewsFeed.tsx`, `NewsDetail.tsx`)** — Show `ai_summary` (fallback to raw), severity score chip (color-coded 0–100), threat_type badge, "Translated from X" pill when applicable.
- **Map (`IntelMap.tsx` + `CrisisMap.tsx`)** — When markers share an `incident_id`, render a single pulsing cluster marker sized by `item_count`; click opens drawer listing all linked articles.
- **Travel Advisory page** — New route `/advisory/:country` (and index `/advisories`). Auto-generated brief: risk gauge, key threats, regions to avoid, recommendations, narrative, source intel list. Links from country watchlist, map country click, and Clients page.

### Edge functions

- `enrich-intel` — combined structured-output call (Zod schema). Idempotent via `enriched_at IS NULL` check.
- `cluster-incidents` — DB-side SQL function callable from cron; LLM only used to title clusters.
- `generate-advisories` — per country, one Gemini call producing structured JSON.

### Cost / safety

- Single combined LLM call per article (~1 request) instead of 5 separate ones.
- Skip enrichment for items older than 48h or already enriched.
- Gemini Flash preview (cheap). Per-country advisory uses Gemini Flash too.
- All AI outputs presented natively (no "AI Analysis" branding, per memory).

### Out of scope (this iteration)

- Per-user advisory personalization
- Re-translation into client's native language (English only for now)
- Manual override UI for severity (analysts can already edit news rows)

If this looks right I'll start with the migration, then `enrich-intel`, then the UI surfaces.