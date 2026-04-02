# OTV CRM — Sales Command Center

Internal sales management platform for Odisha Television Network. Private, not for external use.

## Stack

- `artifacts/otv-platform/src/pages/OTVApp.tsx` — entire frontend, ~11,600+ lines, single React/Vite component
- `artifacts/api-server/` — Express API server at `/api`, port 8080
- `lib/db/` — Drizzle ORM + PostgreSQL (Replit built-in DB)
- Build tool: Vite. One secret: `ANTHROPIC_API_KEY`

## Data Persistence — PostgreSQL via API

All shared state lives in the `app_state` table (key TEXT PRIMARY KEY, value JSONB). 
The `usePersistedState` hook in OTVApp.tsx syncs every collection to the server:
- On mount: fetches latest from `/api/state/:key` (overrides localStorage with server data)
- On change: debounces 1s then writes to server via PUT `/api/state/:key`
- Polls every 20s to pick up changes from other users (skips if user recently wrote)
- Falls back to localStorage if server unreachable

Collections synced: `otv_deals`, `otv_tasks`, `otv_targetSubs`, `otv_meetings`, `otv_plans`,
`otv_wplans`, `otv_internalReqs`, `otv_att`, `otv_absence`, `otv_revenueEntries`,
`otv_ipProposals`, `otv_properties`, `otv_liveRoles`, `otv_pendingUsers`, `otv_adminConfig`,
`otv_savedROs`, `otv_reps` (sales rep master, editable by Admin), `otv_masterClients` (client master list)

## What it does

Sales pipeline management for OTV's sales team. Reps log daily client meetings, plan tomorrow's meetings, track deals, and submit targets for approval. Managers see live team status, compliance, escalations, and revenue forecasting.

## 6 roles — each sees a different app

Sales Rep → Region Head (RH) → National Sales Head (NSH) → Sales Strategy → CRO → Admin. Digi Ops is a parallel role. Login goes straight to role-based view. Demo accounts on login screen need no password.

## Core workflows

- Rep logs meeting → deal `lastContact` updates → if approval needed, flags to correct person automatically
- Deals auto-escalate to NSH after 14 days no contact (configurable)
- Approval chain: Rep flags → NSH approves → CXO for deals ≥₹3Cr
- 11:30 PM rule: reps must log today's meetings AND plan tomorrow's or system marks them absent
- Targets submitted by reps, approved Rep → RH → NSH → Strategy → CRO

## Admin controls (no code needed)

Admin can change approval thresholds, SLA hours, inactivity escalation days from the Admin panel.

**Data Management screen** (Admin → DATA → Data Management):
- **Sales Reps tab**: Add new reps, edit name/region/role/target inline, activate/deactivate without code. Changes are persisted in `otv_reps` and visible to all users instantly.
- **Clients tab**: Add/edit/remove master client list. Stored in `otv_masterClients`.
- **Bulk Import tab**: Upload CSV/Excel for deals, targets, revenue, properties (existing flow).

## Deployment

- Frontend: static build (`pnpm --filter @workspace/otv-platform run build`), serves from `artifacts/otv-platform/dist/public`
- API Server: Node.js, `artifacts/api-server/dist/index.mjs`, needs `DATABASE_URL` + `ANTHROPIC_API_KEY`
- DB: Replit PostgreSQL, schema in `lib/db/src/schema/`, push with `cd lib/db && pnpm run push`

## UI Theme — Light Mode ("Slate Day")

The entire platform uses a soft light-mode palette defined in two places (must be kept in sync):
- `OTVApp.tsx` line ~491: `const C = { ... }`
- `artifacts/otv-platform/src/utils.ts` line 1: `export const C = { ... }`

Current palette: `bg:#f0f4f9`, `surface:#ffffff`, `s2:#e8eef7`, `s3:#dde5f0`, `border:#c8d3e5`, `accent:#c47d00` (amber), `text:#18243a` (dark navy), `dim:#4d5e78`, `muted:#8a97ae`

## Zoho CRM Integration

Live client/agency lookup against Zoho CRM sandbox. Credentials: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (env secrets). Base URL: `https://crmsandbox.zoho.in/crm/v2`.

- **API endpoints** (server-side, credentials never exposed to browser):
  - `GET /api/zoho/clients?q=` — searches Zoho Accounts module, returns `{id, name}[]`
  - `GET /api/zoho/agencies?q=` — same module, for agency lookup
- **`ZohoSearchInput` component** (`artifacts/otv-platform/src/components/ZohoSearchInput.tsx`): debounced live search (300ms), requires 3+ chars, shows green ✓ badge when a Zoho ID is confirmed, shows orange fallback warning when Zoho is down.
- **Integrated in 3 places**:
  1. Add Deal form — Client Company (Zoho clients) + Agency Name (Zoho agencies)
  2. Add Client Target modal — Client Name (Zoho clients)
  3. Revenue Log — select from rep's existing deals (Zoho ID auto-populated)
- **`zohoAccountId`** stored on: `deals`, `clientAccounts`, `revenueEntries`, `targetSubs.clients`
- **`zohoAgencyId`** stored on: `deals`
- **Revenue matching**: prefers `zohoAccountId` equality over name string when both sides have an ID; falls back to `clientCompany` name for legacy records
- **Graceful fallback**: if Zoho API unreachable, field reverts to free text with warning — reps are never blocked

## Key architectural notes

- `usePersistedState` is the only state primitive — modifying it changes all sync behaviour
- Task model: `assignedToUserId` (USER_ROLES id), `assignedTo` (numeric repId). Filter must check BOTH.
- `openSelfTask()` helper opens task modal pre-filled for current user with `selfTaskMode=true`
- RO Parser features are explicitly excluded from all work
- Plan edit state: `planEditId` (string|null) + `planEditForm` ({time,clientAgencyName,contactName,phone,agenda,pitchType}) — controls inline edit form on future plan chips
- All `<input type="date">` elements carry `min="2020-01-01" max="2099-12-31"` to prevent 6-digit years
- Sales Strategy nav has "Approval Settings" (view `strategy-config`) — edits adminConfig.approvalThresholds, inactivityDaysRisk, inactivityDaysEscalate, slaHours
- ACHIEVED calculation: always sourced from `revenueEntries` (never from deal.amount + outcome). No auto-stub on deal close.

## Bug Fixes Applied (Session)

### `qMatch` — "FY26 Annual" deals visible in quarterly filter
`qMatch` now returns `true` for entries with `q === "FY26 Annual"` regardless of `filterQ`.
This fixes: Revenue Tracker showing empty deal tables and ACHIEVED = 0 when target submissions
were approved as "FY26 Annual" deals but `filterQ` is set to a specific quarter (Q1–Q4).

### My Plan — non-rep roles no longer see all plans
Introduced `myPlanRepId = myRepId ?? user_role?.id`.
- For reps: `myRepId` (number) — unchanged
- For RH/NSH/etc.: `user_role.id` string (e.g. "rh_north") — was `null` before, causing `(null ? ... : true)` to show ALL plans
- All 4 plan filters (todayPlans, tmrwPlans, calendar dayPlans, day-view dvPlans) updated
- `autoCreatedFrom !== "action-item"` exclusion added to all My Plan filters
- `doAddPlan()` now uses `myPlanRepId` for the plan's `repId` field

### IPs tab — deals pipeline metrics added for management roles
When any deals with `dealType: "IPs"` exist in `visibleDeals`, the IPs tab now shows:
- TARGET / ACHIEVED / SHORTFALL / % COMPLETE cards (same structure as Linear TV tab)
- Per-deal breakdown table with client, rep, target, achieved, shortfall, stage, next step
- A horizontal rule separating this from the existing IP Catalog / inventory section

## Parts 1–13 Implementation Status

All 13 parts of the CRM spec are now implemented:

- **T001 (Parts 1+3 — Data model + Deal stages)**: `DEAL_STAGES` constant, `oColor` updated, `clientAccounts` + `touchpoints` persisted state, one-time migration useEffect from deals/meetings, `pipelineAmount` + `lossReason` on deals, `mapLegacyOutcome` for backward compat.
- **T002 (Part 5 — Dashboard numbers)**: `getAchieved/getCommitted/getInPlay/getShortfall` helpers. ACHIEVED = revenueEntries only. COMMITTED = clientAccounts at "Mail Confirmed". IN PLAY = "In Discussion"/"Negotiation". 4-number grids in My Targets, War Room, Revenue Tracker.
- **T003 (Part 4 — Escalation engine)**: `atRisk` from clientAccounts (not deals). 7/10/14-day tiered War Room alerts. Trigger 2A (4+ meetings, no stage movement in 30d). Trigger 2B (<15 touchpoints/month). 14d alert includes "Create Task" button for RH My Tasks.
- **T004 (Part 6 — Client account thread)**: `accountThreadOpen`/`accountThreadClient` state. Full modal with 4-number metrics, touchpoint thread (newest first), badges, revenue entries, "+ Add Action Item" per entry.
- **T005 (Part 2 — Action item routing)**: `ACTION_TYPES` array. Routing: Approval→tasks+IR, Attend→plans+task, Document/Intro→tasks+IR, Flag for follow-up→Task only (no IR — personal reminder).
- **T006 (Part 7 — Targets system)**: `platformLive` + `launchDate` in adminConfig. Pre-launch gate for reps. "Additional Revenue Opportunity" label for frozen targets. Admin toggle in System Config.
- **T007 (Part 8 — My Plan behaviour)**: At-risk cards at top of My Plan. Action items due today section. Deadline countdown: 6PM amber, 9PM red, 11PM full-width + "Nothing more to log today" button.
- **T008 (Parts 9+10+11 — Trigger map, role views, regions)**: Relationship TPs don't update `lastDealMeetingDate`. Revenue log auto-sets stage to "RO Received". Revenue Log is 2nd item in rep PLANNING sidebar. IPs tab read-only for reps. No New Package button for reps. "No target set for this category" empty state. Six regions: North, South, East, West, National, Central.
- **T009 (Parts 12+13 — Navigation)**: RO Management card → `dealroreader.replit.app`. `getCRMDefaultView()` routes per role: ADMIN→admin-access, RH→warroom, NSH/CRO/Strategy→warroom, DIGI OPS→digi-deals, SALES REP→my-plan. Reset-All endpoint gated with `role !== "ADMIN"` check.

## Session Bug Fixes

### HomeScreen crash — "meetings is not defined"
The 11 PM fullscreen block was incorrectly placed inside `HomeScreen` where `meetings`, `isRep`, `countdown`, `eodBlockDismissed`, `nothingMoreToday` are undefined. Removed from HomeScreen — the block correctly lives in CROApp's My Plan view.

### getCRMDefaultView — wrong view names
`"rh-war-room"` and `"nsh-war-room"` were returned but no renderer matched them → blank screen for RH and NSH on first login. Fixed to return `"warroom"` for both. Added `"DIGI OPS"` case returning `"digi-deals"`.
