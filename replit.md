# OTV CRM — Sales Command Center

## Overview
This project is an internal sales management platform for Odisha Television Network, designed to streamline sales operations from lead to revenue. It enables sales representatives to manage their pipeline, log client interactions, plan future meetings, and submit sales targets for approval. The platform provides managers with real-time insights into team performance, compliance, escalations, and revenue forecasting. The system supports six distinct roles, each with a tailored application view, facilitating a comprehensive workflow for sales, regional, national, and executive leadership, including integration with Zoho CRM for client and agency lookups.

## User Preferences
- I prefer clear and concise communication.
- I appreciate high-level summaries before diving into details.
- When suggesting changes, please explain the "why" behind them.
- Focus on delivering functional code iteratively.
- For major architectural changes or decisions, please ask for approval first.
- Do not make changes to the RO Parser block (`view === "ro-parser"`) and all related engine functions.

## System Architecture

### Core Technologies
- **Frontend**: React/Vite single-page application (`artifacts/otv-platform/src/pages/OTVApp.tsx`)
- **Backend**: Express.js API server (`artifacts/api-server/`) on port 8080
- **Database**: Drizzle ORM with PostgreSQL (Replit built-in DB)
- **Build Tool**: Vite

### Data Persistence
A hybrid PostgreSQL architecture is used:
- **Normalized Tables**: Serve as the source of truth for core business entities like `otv_users`, `deals`, `client_accounts`, `touchpoints`, `revenue_entries`, `target_submissions`, `tasks`, and `internal_requests`.
  - `deals` are never deleted; instead, their `stage` is updated to "Lost," "Archived," or "Cancelled." `pipelineAmount` is derived at read-time.
  - `revenue_entries` are immutable, with corrections handled via reversal entries.
- **`app_state` table**: A generic JSONB blob store for secondary entities.

### API Routes
All API routes are prefixed with `/api/` and include modules for Authentication, Admin, Targets, Revenue, Deals, Touchpoints, and Tasks.

### Frontend State Management
- **Dual-layer Pattern for Core Entities**: Seven core entities (`deals`, `tasks`, `internalReqs`, `targetSubs`, `revenueEntries`, `clientAccounts`, `touchpoints`) use `useApiEntityState()`.
  - This hook fetches data from the API on mount, uses `localStorage` as a stale-while-revalidate cache, performs immediate API updates (POST/PATCH) with optimistic local updates, and polls the API every 30 seconds for real-time consistency.
  - Optimistic updates are used with immediate POST/PATCH requests, and `loading` and `syncError` states manage UI feedback.
- **`usePersistedState` for Secondary Entities**: Other entities like `otv_plans`, `otv_wplans`, `otv_meetings`, `otv_att`, `otv_absence`, `otv_savedROs`, `otv_properties`, `otv_ipProposals`, `otv_reps`, and `otv_masterClients` use `usePersistedState` with a generic `/api/state/:key` blob store.

### UI/UX Design
- **Theme**: A soft light-mode palette ("Slate Day") is consistently applied across the platform.
  - **Color Palette**: `bg:#f0f4f9`, `surface:#ffffff`, `s2:#e8eef7`, `s3:#dde5f0`, `border:#c8d3e5`, `accent:#c47d00` (amber), `text:#18243a` (dark navy), `dim:#4d5e78`, `muted:#8a97ae`.
  - The theme constants are defined in `OTVApp.tsx` and `artifacts/otv-platform/src/utils.ts`.

### Governance Engine (`artifacts/api-server/src/governance.ts`)
A backend scheduler (5-minute tick, **Asia/Kolkata IST wall-clock time**) handles five automated workflows:
- **IR Escalation Hops**: After SLA breach (dept-derived hours), IRs advance along `ESC_CHAIN = ["Region Head","NSH","Sales Strategy","CRO"]` every 12h. State stored in `routedToRole`, `escalatedAt`, `escDept`, `escHistory`. Fires `createNotification()` and `logActivity()` on each hop.
- **Stalled Deal Flagging**: Sets `atRisk = true` on open deals with 7+ days since last `lastContact`. Logs to activity ledger.
- **Attendance Records (composite)**: At 23:30 IST, checks **both** SALES REP and REGION HEAD users for: (a) touchpoint logged today AND (b) daily plan created for tomorrow via `dailyPlans` table. Status is `present`/`partial`/`absent`. Sends notification on partial or absent.
- **Task Overdue Flagging**: Sets task `status = "Overdue"` when `dueDate < today` and status is still Open/In Progress. Notifies assignee.
- **Task Reminders**: Sends notification 24h before due date to the assignee.

### IST Date Utilities (`artifacts/api-server/src/lib/date.ts`)
All date/time operations in the backend must use this module:
- `todayIST()` — YYYY-MM-DD in Asia/Kolkata
- `hourIST()`, `minuteIST()` — wall-clock hour/minute in IST
- `isAttendanceWindow()` — true from 23:30–23:59 IST
- `hoursSince()`, `daysSince()` — elapsed time helpers
- `nowISO()` — current UTC ISO timestamp for DB writes

### Ownership Validation (`artifacts/api-server/src/lib/ownership.ts`)
`resolveOwnership(user, body)` — enforces on-behalf authorization for all write operations. Returns `{ repId, region, name, isSelfAction }`.
- **SALES REP**: always session data; body values ignored entirely
- **REGION HEAD**: body.repId required; must be an active SALES REP in RH's own region (DB-validated). Cross-region → 403.
- **Admin/Elevated + body.repId provided**: repId must resolve to a real user in DB. Unknown repId → 400 (no silent fallback).
- **Admin/Elevated + no body.repId**: self-action, uses session user's own repId/region. Callers guard against `owner.repId === null` for tables with `NOT NULL` constraint.
- Wired into: deals POST, revenue POST, touchpoints POST, client-accounts POST.
- Touchpoints, deals, and revenue entries all guard: if `owner.repId` is null after resolution → explicit 400 with clear message.

### Target Allocations (`lib/db/src/schema/target_allocations.ts`, `GET /api/targets/:id/allocations`)
New `target_allocations` table — normalized line items for target submissions. One row per client per submission. Columns: `id, submissionId, repId, region, quarter, clientName, zohoAccountId, allocatedAmount, channel, dealType, notes, createdAt`. Written atomically with the parent `targetSubmissions` row on POST `/api/targets`. The `clients` JSONB array on the parent row is kept for backward compatibility but `target_allocations` is the source of truth for accounting. Enables SQL-level channel/dealType aggregations without parsing JSONB.

### Daily Plans (`lib/db/src/schema/daily_plans.ts`, `GET|POST /api/daily-plans`)
New `daily_plans` table — upsert per user per date. One record per userId+planDate (unique constraint). Contains `items` (JSONB), `itemCount`, `planDate` (YYYY-MM-DD for the day being planned for). Governance checks this table for compliance. Team view at `GET /api/daily-plans/team` (RH+ scoped).

### Task Workflow (Tightened)
Generic `PATCH /api/tasks/:id` removed. Replaced with specific endpoints:
- `PATCH /api/tasks/:id/status` — assignee, assigner, ADMIN/RH only
- `PATCH /api/tasks/:id/reschedule` — assigner, ADMIN/RH only
- `PATCH /api/tasks/:id/reassign` — assigner, ADMIN/RH only
- `PATCH /api/tasks/:id/note` — any party with access

### IR Lifecycle (Governed)
Generic `PATCH /api/internal-requests/:id` removed. All state transitions via:
- `POST /api/internal-requests/:id/accept` — routedToRole or ADMIN
- `POST /api/internal-requests/:id/resolve` — routedToRole or ADMIN
- `POST /api/internal-requests/:id/reject` — routedToRole or ADMIN
- `POST /api/internal-requests/:id/withdraw` — original raiser or ADMIN only
- `PATCH /api/internal-requests/:id/note` — any party (notes only)

### Activity Ledger (`lib/db/src/schema/activity_log.ts`)
Append-only audit trail. New `activityLog` table with columns: `id, userId, userName, userRole, region, action, entityType, entityId, meta (JSONB), createdAt`. Helper: `artifacts/api-server/src/lib/activityLog.ts` → `logActivity()`. Visible at `GET /api/activity-log` (elevated roles only). Key actions logged: `deal.created`, `revenue.entry_created`, `revenue.entry_reversed`, `target.submitted`, `target.approved`, `target.rejected`, `task.created`, `task.completed`, `task.overdue_flagged`, `ir.raised`, `ir.accepted`, `ir.resolved`, `ir.escalated`, `attendance.absent`.

### Notifications (`lib/db/src/schema/notifications.ts`)
New `notifications` table: `id, userId, type, title, body, entityType, entityId, read, createdAt`. Helper: `artifacts/api-server/src/lib/notifications.ts` → `createNotification()`. Routes: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/mark-all-read`.

### Centralized KPI API (`artifacts/api-server/src/routes/kpi.ts`)
Single source of truth for all dashboard KPIs. All screens must use these endpoints:
- `GET /api/kpi/rep` — own rep metrics (SALES REP only)
- `GET /api/kpi/rep/:repId` — any rep's metrics (RH+)
- `GET /api/kpi/region/:region` — regional roll-up (RH of that region, SALES HEAD+)
- `GET /api/kpi/system` — system-wide (SALES HEAD, STRATEGY, CRO, ADMIN)
- Response: `{ achieved, target, pipeline, gap, overdueTasks, attendanceRate, attPresent, attAbsent, attTotal }`
- Formulas: `ACHIEVED = SUM(revenueEntries WHERE isReversed=false AND reversalOf IS NULL)`, `PIPELINE = SUM(amount × STAGE_PROB[stage] / 100)`, `GAP = target − achieved − pipeline`

### Shared Domain Constants (`lib/db/src/constants.ts`)
Single source of truth for all domain enums. Exported from `@workspace/db`. Key exports: `ROLES`, `REGIONS`, `DEAL_STAGES`, `STAGE_PROB`, `CLOSED_STAGES`, `DEAL_TYPES`, `PRIORITY_LEVELS`, `TASK_STATUSES`, `IR_DEPTS`, `DEPT_TO_ROLE`, `DEPT_SLA_HOURS`, `IR_SUBTYPES`, `IR_STATUSES`, `TARGET_APPROVAL_CHAIN`, `TARGET_NEXT_STATUS`, `QUARTERS`, `TOUCHPOINT_TYPES`.

### Idempotency Protection
- **Revenue entries**: Optional `idempotencyKey` field (unique constraint in DB). API returns 409 if same key submitted twice.
- **Target submissions**: API rejects second active (non-Rejected) submission for same rep+quarter with 409 and `existingId` pointer.

### Hierarchy-Aware Approvals
- **Target approvals**: `canApprove()` now checks REGION HEAD can only approve submissions from **their own region** (not just role match). Returns structured `{ ok, reason }`.
- **IR accept/resolve/reject**: Dedicated `POST /api/internal-requests/:id/accept|resolve|reject` endpoints. Only the `routedToRole` or ADMIN may act. General `PATCH` cannot be used to bypass.

### Typed IR Workflows
- `irSubtype` field added to `internalRequests`: `"Support Request" | "Deal Escalation" | "Override Request" | "Attendance Exception" | "Other"`. Validated and defaulted on backend — client cannot supply arbitrary subtypes.
- `slaHours` is now **derived from `dept`** on backend (not client-supplied): Sales Strategy=48h, CRO=72h, Finance=96h, Legal=120h, etc. Defined in `DEPT_SLA_HOURS` constant.

### Canonical Role Names
`"SALES REP" | "REGION HEAD" | "SALES HEAD" | "CRO" | "SALES STRATEGY" | "DIGI OPS" | "ADMIN"` — `"NATIONAL SALES HEAD"` does not exist in the system.

### Feature Specifications
- **Role-Based Views**: Seven distinct roles (Sales Rep, Region Head, Sales Head, Sales Strategy, CRO, Admin, Digi Ops) each have a customized view and navigation.
- **Sales Workflow**:
  - Reps log meetings, which update deal `lastContact` and trigger automated approvals.
  - Deals auto-escalate after 14 days of no contact.
  - An approval chain for deals involves NSH and CXO based on deal value.
  - A strict "11:30 PM rule" ensures reps log daily meetings and plan for the next day.
  - Targets follow a multi-step approval process: Rep → RH → NSH → Strategy → CRO.
- **Admin Controls**: The admin panel allows for dynamic configuration of approval thresholds, SLA hours, inactivity escalation days, and management of sales reps and client master lists.
- **Data Management**: Admin users can add/edit/remove sales reps and clients, and perform bulk imports via CSV/Excel.
- **Key Architectural Notes**:
  - `ACHIEVED` revenue is exclusively calculated from `revenueEntries`.
  - `pipelineAmount` is always derived.
  - `revenueEntries` are immutable except for notes.
  - `DEAL_STAGES` constant is used for deal states.
  - Escalation engine tracks `atRisk` clients and triggers alerts.
  - Client account threads provide a comprehensive view of client interactions.
  - Action items are routed based on their type to tasks, internal requests, or plans.
  - A pre-launch gate for reps is managed via `platformLive` in `adminConfig`.
  - Sales Rep default landing page is `my-plan` (not `target-submit`).
  - "Meeting" terminology replaced with "Touchpoint" in all user-facing labels throughout the app.
  - Touchpoint log form auto-creates a task when `nextSteps` plain text is filled but no structured `nextStepItems` action exists.
  - Revenue Tracker includes a "Revenue Report" tab with month/client/channel/region breakdowns sourced exclusively from `revenueEntries` (reversals excluded).
  - Pipeline Gap metric (`Target − Achieved − Active Pipeline`) is surfaced in: My Plan (target summary strip), RH War Room (metric strip below header), and General War Room (all non-RH/non-NSH roles). NSH War Room already had a comprehensive GAP dashboard.
  - **Support Request workflow**: Touchpoint log form has a dedicated "Support Needed" section (dept: Sales Strategy, Digi Ops, CRO, Finance, Marketing, Legal, Other) that creates an Internal Request of `type: "Support Request"` with `priority`, `dueDate`, and `notes`. IR inbox (dept recipients) can Accept, Add Note, Mark Done, or Reject requests. Open Support Requests surface in: My Plan (rep's open SRs panel), RH War Room (region SRs panel), NSH War Room (system-wide SRs panel), and General War Room (system-wide SRs panel).
  - `internalRequests` schema extended with: `priority` (text, default "Medium"), `dueDate` (text), `notes` (text), `acceptedAt` (text).
  - `irStatusFilter` now includes "Accepted" and "Rejected" pills.

## External Dependencies

- **PostgreSQL Database**: Used for all persistent data storage, integrated via Drizzle ORM.
- **Zoho CRM Sandbox**: Used for live client and agency lookups.
  - **Environment Variables**: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`.
  - **Base URL**: `https://crmsandbox.zoho.in/crm/v2`.
  - **API Endpoints**: `/api/zoho/clients?q=` and `/api/zoho/agencies?q=` for server-side searches.
  - **Integration Points**: Used in "Add Deal," "Add Client Target," and "Revenue Log" forms.
  - **Graceful Fallback**: If Zoho API is unreachable, the system allows free text entry to prevent workflow blocking.
- **Anthropic API**: Used for AI-related functionalities.
  - **Environment Variable**: `ANTHROPIC_API_KEY`.