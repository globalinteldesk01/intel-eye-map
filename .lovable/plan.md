
# Global Intel Desk Platform - Comprehensive Audit & Remediation Plan

## Executive Summary

After a thorough system-wide audit of the Global Intel Desk OSINT platform, I've identified the current system status and areas requiring attention. The platform has a solid foundation with working core components, but several workflows need optimization and some features are incomplete or disconnected.

---

## Current System Status

### Working Components
| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | Operational | Proper tables, triggers, RLS policies in place |
| Authentication | Operational | Email/password auth with Supabase |
| Real-time Subscriptions | Operational | News items and notifications update live |
| Cron Scheduler | Operational | 5-minute scrape + hourly cleanup running |
| Google News Scraper | Operational | AI-enhanced with deduplication |
| IntelMap Visualization | Operational | Leaflet with clustering, heatmaps |
| News Feed Sidebar | Operational | Chronological with search |
| Timeline Page | Operational | Transforms news to timeline events |
| Notification System | Operational | 254 unread notifications exist |
| Comments System | Operational | Analyst collaboration on intel items |

### Issues Identified

**STEP 1 - System Diagnosis Results:**

1. **No Recent Data Ingestion**
   - Query shows 0 items in last hour despite 5-min cron running
   - Database shows news from Jan 27-29, suggesting scraper may have stalled or all new articles are duplicates

2. **Notifications Backlog**
   - 254 unread notifications accumulating (no auto-cleanup for read notifications)

3. **Missing UI Components**
   - `WatchlistManager` and `AlertRulesManager` components exist but are NOT rendered in Dashboard
   - `ExecutiveDashboard` component exists but is NOT rendered anywhere
   - `AIAnalysisPanel` exists but was removed from NewsDetail (per user request)

4. **Disconnected Workflows**
   - Alert Rules created by users don't trigger notifications (rules table exists, but no trigger evaluates them)
   - No supervisor approval workflow implemented
   - No version tracking for intel items
   - No task assignment system

---

## Remediation Plan

### STEP 2 - Intel Fetching Engine

**Current State:**
- 5-minute Google News scraper via pg_cron (working)
- Hourly data cleanup for 3-day retention (working)
- Deduplication by URL + title similarity (working)
- AI-powered categorization via Lovable AI (working)

**Required Fixes:**

1. **Add Fetch Failure Alerting**
   - Modify `scrape-google-news` to log success/failure counts
   - Create database function to check scrape health
   - Trigger analyst notification if 3+ consecutive failures

2. **Expand OSINT Topics for Global Coverage**
   - Current topics focus on conflict/terror
   - Add regional feeds: Africa, South America, Southeast Asia
   - Add topic diversity: sanctions, elections, infrastructure

3. **Add Auto-Retry Logic**
   - Implement exponential backoff for failed RSS fetches
   - Store failed URLs for retry queue

4. **Timestamp Normalization**
   - Already handled via `published_at` field with ISO format

**Files to Modify:**
- `supabase/functions/scrape-google-news/index.ts`

---

### STEP 3 - Analyst Workflow Repair

**Current State:**
- Manual intel submission via IntelSpreadsheet (working)
- Comments per intel item (working)
- Basic delete capability (working)

**Missing Features to Implement:**

1. **Add Intel Edit Capability**
   - Create `EditNewsDialog` component
   - Wire to `updateNewsItem` hook function (already exists)

2. **Add Supervisor Approval Workflow**
   - Add `is_approved` and `approved_by` columns to `news_items`
   - Create approval UI in NewsDetail
   - Filter unapproved items from client views

3. **Add Version Tracking**
   - Create `news_item_versions` table
   - Store previous versions before updates
   - Add version history UI

4. **Add Priority/Task Assignment**
   - Add `priority` and `assigned_to` columns
   - Create task assignment dropdown
   - Add analyst activity log table

5. **Integrate Missing Manager Components**
   - Render `WatchlistManager` in Dashboard
   - Render `AlertRulesManager` in Dashboard
   - Connect filters to WatchlistManager

**Files to Create/Modify:**
- `src/components/EditNewsDialog.tsx` (new)
- `src/pages/Dashboard.tsx`
- `src/components/NewsDetail.tsx`
- Database migration for new columns

---

### STEP 4 - Intelligence Channeling

**Current State:**
- Notifications trigger for ALL new intel (via `notify_new_intel` trigger)
- Real-time updates via Supabase subscriptions

**Missing Features to Implement:**

1. **Wire Alert Rules to Notification System**
   - Create trigger: `evaluate_alert_rules`
   - On news_item INSERT, check each active alert_rule
   - If conditions match, create targeted notification

2. **Regional Board Routing**
   - Create regional views/filters in Dashboard
   - Add quick-filter tabs for regions

3. **Push Notification Integration**
   - Add browser push notification capability
   - Request permission on login
   - Send push for critical alerts

4. **Archive Search Enhancement**
   - Add full-text search index on news_items
   - Implement advanced search page

**Files to Create/Modify:**
- Database function: `evaluate_alert_rules`
- `src/hooks/usePushNotifications.ts` (new)
- `src/components/RegionalFilters.tsx` (new)

---

### STEP 5 - Dashboard Optimization

**Current State:**
- IntelMap with markers, clustering, heatmap toggle
- News feed sidebar with search
- Timeline page separate from dashboard

**Required Fixes:**

1. **Add ExecutiveDashboard View**
   - Component exists but not rendered
   - Add tab/toggle to switch between Map and Executive view

2. **Add Real-time Stats Header**
   - Show live counts: total intel, critical alerts, recent activity
   - Add last-updated timestamp

3. **Add Region Quick Filters**
   - Tab bar for major regions
   - One-click filtering

4. **Risk Heatmap Controls**
   - Heatmap toggle already exists
   - Add legend explaining colors

5. **Activity Tracking**
   - Create `analyst_activity` table
   - Log logins, views, actions

**Files to Modify:**
- `src/pages/Dashboard.tsx`
- `src/components/Header.tsx`

---

### STEP 6 - Data Integrity & Security

**Current State:**
- RLS enabled on all tables (verified)
- Analyst role enforced
- JWT validation on edge functions

**Enhancements:**

1. **Analyst Activity Logs**
   - Create `activity_logs` table
   - Record significant actions
   - Add cleanup after 30 days

2. **Automated Backups**
   - Already covered by Lovable Cloud (Supabase daily backups)

3. **Error Recovery**
   - Add try-catch wrappers throughout hooks
   - Implement toast-based error reporting (already exists)

**Database Changes:**
- Create `activity_logs` table

---

### STEP 7 - Performance Optimization

**Current State:**
- React Query for data fetching
- Real-time subscriptions efficient
- Console shows 20/23 items plotted (3 filtered for invalid coords)

**Optimizations:**

1. **Query Optimization**
   - Add indexes on frequently queried columns
   - Implement pagination for news feed (currently loads all)

2. **Background Job Efficiency**
   - Scraper already uses batched inserts
   - Add rate limiting for AI calls

3. **API Efficiency**
   - Edge functions already use streaming for AI
   - Consider caching for frequently accessed data

4. **Page Load Speed**
   - Lazy load timeline page
   - Implement skeleton loading (already present)

**Database Changes:**
- Add indexes on `published_at`, `threat_level`, `region`

---

### STEP 8 - Integration & Testing Points

**Critical Workflows to Verify:**

1. **Intel Submission Flow**
   - Analyst submits via IntelSpreadsheet
   - Item appears in news feed in real-time
   - Notifications trigger for all analysts
   - Map marker appears at correct location

2. **Alert Rule Flow** (needs implementation)
   - Analyst creates alert rule
   - New intel matching conditions arrives
   - Targeted notification created
   - Toast displayed in real-time

3. **Approval Flow** (needs implementation)
   - Intel submitted as "pending"
   - Supervisor reviews and approves
   - Status updates visible to all

4. **Collaboration Flow**
   - Analyst adds comment
   - Other analysts see in real-time
   - Comment appears in intel detail

---

## Implementation Priority

### Phase 1 - Critical Fixes (Immediate)
1. Wire WatchlistManager and AlertRulesManager to Dashboard UI
2. Add ExecutiveDashboard toggle to Dashboard
3. Investigate scraper not producing recent data
4. Add notification cleanup for old read notifications

### Phase 2 - Core Workflow Completion
1. Implement alert rule evaluation trigger
2. Add intel edit capability
3. Add regional quick-filter tabs
4. Add real-time stats to header

### Phase 3 - Advanced Features
1. Supervisor approval workflow
2. Version tracking
3. Task assignment
4. Push notifications
5. Activity logging

### Phase 4 - Polish & Optimization
1. Add database indexes
2. Implement pagination
3. Full-text search
4. Performance tuning

---

## Summary of Required Changes

| Category | New Files | Modified Files | DB Changes |
|----------|-----------|----------------|------------|
| Analyst Workflow | 1 | 3 | 2 migrations |
| Intel Channeling | 2 | 2 | 1 trigger |
| Dashboard | 0 | 2 | 0 |
| Security/Logging | 0 | 1 | 1 table |
| Performance | 0 | 0 | 1 migration |

**Total Estimated Effort:** 15-20 implementation steps across multiple chat sessions

---

## Immediate Next Steps

Upon approval, I will begin with Phase 1:
1. Integrate WatchlistManager and AlertRulesManager into Dashboard
2. Add ExecutiveDashboard view toggle
3. Investigate and fix scraper data flow
4. Add notification cleanup mechanism
