

# OSINT Scraper Hardening Plan

## Current Issues Found

1. **Massive duplication**: 52 items with only 19 unique titles -- every article duplicated ~4x because Google News RSS returns different tracking URLs each scrape cycle, defeating URL-based dedup
2. **54% of items have 0,0 coordinates** (28 of 52) -- location extraction fails frequently, producing "Unknown" country with null-island coordinates
3. **No link validation** -- broken/redirect URLs are stored without verification
4. **Cron is already running every 5 minutes** -- this is working, but each run creates duplicates

## Plan

### 1. Fix Duplicate Detection (Critical)

Replace URL-only deduplication with a multi-signal approach in `scrape-google-news/index.ts`:

- **Title similarity check**: Normalize titles (lowercase, strip punctuation, first 60 chars) and compare against items from the last 48 hours in the database
- **Content fingerprint**: Generate a hash from `normalized_title + source + date` to catch same-event articles
- **Multi-source merging**: When a duplicate event is detected from a different source, append the new source URL to the existing item's `tags` array instead of creating a new row
- Clean up existing duplicates via SQL (delete all but the oldest entry per normalized title)

### 2. URL Validation

Add a link validation step before saving:

- Perform a HEAD request (with timeout) to Google News redirect URLs to resolve the final destination URL
- Only store articles where the resolved URL returns HTTP 200
- Store the resolved final URL (not the Google tracking URL) for reliable "View Source" links
- Skip articles where the URL can't be resolved within 3 seconds

### 3. Enhanced Location Extraction

Improve geolocation accuracy to reduce 0,0 coordinates:

- Expand the city-level aliases database significantly (add ~50 more cities: Odesa, Kharkiv, Rafah, Khan Younis, Donetsk, Lviv, Mariupol, Grozny, etc.)
- Add multi-word location matching (e.g., "South China Sea", "Red Sea", "West Bank")
- Add region-based fallback keywords (e.g., "Middle Eastern" maps to a central Middle East coordinate)
- Apply micro-offset (0.01 degrees random) to prevent exact pin stacking
- Reject saving items that still resolve to 0,0 -- skip them entirely rather than polluting the map

### 4. Data Cleanup

Run SQL to fix existing data:

- Delete duplicate rows (keep oldest per normalized title)
- Delete all items with lat=0 and lon=0 (they're not useful on the map)

### Technical Details

**Files modified:**
- `supabase/functions/scrape-google-news/index.ts` -- Major rewrite of dedup logic, add URL resolution, enhance location DB, add 0,0 rejection

**Database changes:**
- One-time cleanup SQL to remove duplicates and 0,0 items (via insert tool, not migration)

**No frontend changes needed** -- the map and sidebar already handle the data correctly; the issues are all in the scraper pipeline quality.

