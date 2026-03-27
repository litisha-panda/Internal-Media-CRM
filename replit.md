# OTV CRM — Sales Command Center

Internal sales management platform for Odisha Television Network. Private, not for external use.

## Stack

- `artifacts/otv-platform/src/pages/OTVApp.tsx` — entire frontend, ~10,800 lines, single React/Vite component
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
`otv_ipProposals`, `otv_properties`, `otv_liveRoles`, `otv_pendingUsers`, `otv_adminConfig`, `otv_savedROs`

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

## Deployment

- Frontend: static build (`pnpm --filter @workspace/otv-platform run build`), serves from `artifacts/otv-platform/dist/public`
- API Server: Node.js, `artifacts/api-server/dist/index.mjs`, needs `DATABASE_URL` + `ANTHROPIC_API_KEY`
- DB: Replit PostgreSQL, schema in `lib/db/src/schema/`, push with `cd lib/db && pnpm run push`

## Key architectural notes

- `usePersistedState` is the only state primitive — modifying it changes all sync behaviour
- Task model: `assignedToUserId` (USER_ROLES id), `assignedTo` (numeric repId). Filter must check BOTH.
- `openSelfTask()` helper opens task modal pre-filled for current user with `selfTaskMode=true`
- RO Parser features are explicitly excluded from all work
