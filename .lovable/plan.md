# Protective Monitoring — Unified Module

A single hub in CrisisWatch that continuously matches incoming `crisis_events` against three watch surfaces (saved assets, active travel itineraries, custom geofences) and pushes alerts in-app (toast + feed) and via email.

## 1. Database (migration)

New tables:
- `protective_geofences` — user-defined watch zones
  - `name`, `shape` ('circle' | 'polygon'), `center_lat`, `center_lon`, `radius_km` (nullable), `polygon` (jsonb, GeoJSON), `min_severity` (crisis_severity), `is_active`
- `protective_alerts` — unified alert log fan-out from trigger
  - `user_id`, `event_id` (FK → crisis_events), `source_kind` ('asset' | 'traveler' | 'geofence'), `source_id`, `source_name`, `severity`, `distance_km`, `is_read`, `created_at`
  - Unique (user_id, event_id, source_kind, source_id) to prevent duplicates
- RLS: owner-only CRUD on both tables; analysts can read all alerts.

DB function + trigger on `crisis_events` AFTER INSERT/UPDATE:
- `fanout_protective_alerts()` — for each active asset, geofence, and active `travel_monitors` row whose user’s `crisis_user_settings.min_severity` is met:
  - Compute haversine distance (or point-in-polygon for polygon geofences).
  - Insert into `protective_alerts` (ON CONFLICT DO NOTHING).
  - If user has `notify_email = true` AND email infra is configured, call edge function via `pg_net` to send email.

## 2. Edge Function

- `send-protective-alert-email` — receives `{ alert_id }`, looks up alert + event + user email, enqueues email via existing email queue (or returns 409 `email_not_configured` if infra missing — trigger logs and continues).

## 3. Frontend — `/crisiswatch/protective-monitoring`

`CrisisLayout` page with sidebar nav entry (icon: ShieldAlert). Four tabs:
1. **Live Alerts** — realtime feed of `protective_alerts` (newest first), color-coded by severity, click → opens linked `CrisisEvent` detail. Toast on new insert.
2. **Assets** — embeds existing `CrisisAssets` table (reused component, not duplicated).
3. **Travelers** — list of active `travel_monitors` with severity threshold, countries, cities; link to itinerary builder.
4. **Geofences** — CRUD UI (Leaflet map picker, circle/polygon draw, min-severity selector, active toggle).

Hook: `useProtectiveAlerts()` — initial fetch + Supabase Realtime subscription on `protective_alerts` filtered by `user_id`, sorted desc on every change. Toast on INSERT.

Nav: add to `CrisisLayout.tsx` between "Asset Manager" and "Settings".

## 4. Email channel

Channel exists in `crisis_user_settings.notify_email` already. The trigger only attempts email when the project's email infrastructure is configured. If not yet configured, the in-app + toast path still works and the UI shows a one-time banner offering to set up the email domain.

## Technical notes

- Trigger uses pl/pgsql with inline haversine; for polygon containment use a small ray-casting routine over the GeoJSON coordinates.
- `pg_net` HTTP POST uses the project’s anon URL + service role key from `vault` (same pattern as existing data-retention job).
- No new external API keys required.
- Reuses existing severity colors, `EventDetail` sidebar, `ItineraryMapPicker` (for drawing geofences).

## Files

New:
- `supabase/migrations/<timestamp>_protective_monitoring.sql`
- `supabase/functions/send-protective-alert-email/index.ts`
- `src/crisiswatch/pages/ProtectiveMonitoring.tsx`
- `src/crisiswatch/hooks/useProtectiveAlerts.ts`
- `src/crisiswatch/hooks/useProtectiveGeofences.ts`
- `src/crisiswatch/components/GeofenceEditor.tsx`

Edited:
- `src/App.tsx` (route)
- `src/crisiswatch/components/CrisisLayout.tsx` (nav)
- `src/crisiswatch/types.ts` (new types)
