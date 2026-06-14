## Goal
Turn Global Intel Desk into the best place to discover open-source news worldwide: every story arrives in English within seconds, is searchable in one box, and shows how many independent sources are reporting it.

You already have 200+ feeds, dedup, an `enrich-intel` translator, and 1-minute polling. This pass closes the gaps that are stopping that machinery from feeling world-class.

## Scope (this round)

### 1. Translation that actually fires on every item
- New pg trigger on `news_items` insert calls `pg_net` → `enrich-intel` for any row whose language is non-English or whose `ai_summary` is null. Batched every 30s by a small pg_cron job so we don't melt the function.
- `enrich-intel` already produces `translated_title` + `ai_summary` + `original_language`. We confirm it persists into the existing columns and the UI shows `aiSummary` (it does — `useNewsItems` already maps it).
- News feed card swaps in `aiSummary || summary` and shows a small "Translated from {lang}" pill when `originalLanguage !== 'en'`.

### 2. One-box global search (discoverability)
- Add `search_vector tsvector` generated column on `news_items` (title + summary + ai_summary + country + tags) with a GIN index.
- New `search_news_items(q text, limit int)` SQL function (SECURITY DEFINER, scoped to last 30 days, returns ranked rows). RLS-friendly: it only returns columns the analyst can already read.
- Dashboard header: a single search input wired to the function with debounced query. Results replace the feed list when a query is active; clearing returns to the live stream.

### 3. "Breaking Now" rail at the top of the feed
- Compact horizontal strip above the feed: items with `threat_level in ('critical','high')` from the last 60 min, max 8, auto-cycling. Click → opens detail.
- Pure frontend — derived from the existing `newsItems` state, no new tables.

### 4. Corroboration badge
- When a row has an `incident_id` shared by ≥2 other rows in the last 24h, show a "3 sources" chip on the card. Computed once on the client from the loaded feed (cheap, no schema change).

### 5. Source breadth — +50 high-signal global outlets
Add to `RSS_SOURCES` in `fetch-news`:
- LatAm: Folha de S.Paulo, Clarín, El Universal MX, La Nación AR, El Tiempo CO, El Comercio PE, La Tercera CL
- Africa: Daily Maverick, Mail & Guardian, The East African, Premium Times NG, Nation Kenya, Ethiopian Reporter, Punch NG, Hespress, Jeune Afrique
- Asia: Asahi Shimbun EN, Mainichi EN, Korea Herald, Chosun EN, SCMP, Taipei Times, Bangkok Post, Jakarta Post, Manila Bulletin, Dawn (PK), The Hindu, Times of India world
- Europe: Le Monde, Le Figaro, Der Spiegel International, Süddeutsche, El País EN, El Mundo, La Repubblica, ANSA, RAI News, Politico EU, Euractiv, Helsingin Sanomat EN, Aftenposten, SVT World
- Russia/CIS: Meduza EN, Novaya Gazeta Europe, Interfax EN, TASS EN, Kommersant
- Pacific/ANZ: ABC News AU, Sydney Morning Herald World, RNZ Pacific, Stuff World
- North America extra: CBC World, Globe & Mail World, CBS World, NBC World

All flow through the same dedup, translation trigger, and credibility scoring already in place.

## Out of scope (call out for later)
- Public read-only feed (user picked "login required").
- Push notifications to mobile / native apps.
- Saved searches + email digests — natural next pass once #2 lands.
- Entity extraction (people/orgs) UI — `actors`/`targets` already populated but no UI surface yet.

## Technical notes
- Translation trigger: `AFTER INSERT` writes a job marker; pg_cron every 30s grabs the oldest 50 untranslated rows and `net.http_post`s `enrich-intel` with their IDs. Avoids per-row HTTP fan-out and respects gateway rate limits.
- `enrich-intel` already accepts an array of IDs (verified above). We just wire the cron caller.
- `search_vector` uses `to_tsvector('simple', …)` so non-English stems still match before translation completes.
- All new RSS feeds inherit the existing 6s `AbortSignal.timeout` so a slow source can't stall a cycle.
- New migration: generated column + GIN index + `search_news_items` function with `GRANT EXECUTE … TO authenticated`.

## Files touched
- `supabase/migrations/<new>.sql` — tsvector + index + search RPC + translation cron
- `supabase/functions/fetch-news/index.ts` — +50 feeds
- `supabase/functions/enrich-intel/index.ts` — confirm batch-by-IDs entrypoint
- `src/pages/Dashboard.tsx` — search state, breaking rail mount
- `src/components/Header.tsx` — search input
- `src/components/NewsFeed.tsx` / card — translated pill, corroboration chip, breaking rail component (new file)
- `src/hooks/useNewsItems.ts` — expose `searchNewsItems(q)` via the RPC
