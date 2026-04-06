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
- **Frontend**: React/Vite single-page application
- **Backend**: Express.js API server
- **Database**: Drizzle ORM with PostgreSQL (Replit built-in DB)
- **Build Tool**: Vite

### Data Persistence
A hybrid PostgreSQL architecture is used with normalized tables for core entities (e.g., `otv_users`, `deals`, `revenue_entries`) and a generic JSONB blob store (`app_state` table) for secondary entities. `deals` are never deleted but updated, and `revenue_entries` are immutable.

### API Routes
All API routes are prefixed with `/api/` and cover modules like Authentication, Admin, Targets, Revenue, Deals, Touchpoints, and Tasks.

### Frontend State Management
- **Dual-layer Pattern for Core Entities**: Seven core entities use `useApiEntityState()` for fetching, caching (localStorage), optimistic updates, and polling.
- **`usePersistedState` for Secondary Entities**: Other entities use `usePersistedState` with a generic `/api/state/:key` blob store.

### UI/UX Design
The platform uses a consistent soft light-mode palette ("Slate Day") with specific color definitions. "Meeting" terminology has been replaced with "Touchpoint" across the application.

### Governance Engine
A backend scheduler (5-minute tick, Asia/Kolkata IST) automates five workflows:
- **IR Escalation Hops**: Internal Requests (IRs) escalate through predefined roles after SLA breaches.
- **Stalled Deal Flagging**: Flags open deals with no contact for 7+ days as `atRisk`.
- **Attendance Records (composite)**: At 23:30 IST, checks for daily touchpoints and planned activities for sales reps and region heads.
- **Task Overdue Flagging**: Sets tasks as "Overdue" when past their `dueDate`.
- **Task Reminders**: Notifies assignees 24 hours before a task's due date.

### IST Date Utilities
All backend date/time operations must use the provided `artifacts/api-server/src/lib/date.ts` module for consistency with Asia/Kolkata IST.

### Ownership Validation
`resolveOwnership(user, body)` enforces on-behalf authorization for write operations, ensuring correct `repId`, `region`, and `name` based on user roles (SALES REP, REGION HEAD, Admin/Elevated).

### Target Allocations
A new `target_allocations` table provides normalized line items for target submissions, enabling SQL-level aggregations.

### Daily Plans
A new `daily_plans` table allows upserting plans per user per date, critical for governance checks.

### Task Workflow
Generic `PATCH /api/tasks/:id` has been replaced with specific endpoints for status updates, rescheduling, reassigning, and adding notes, enhancing control and auditability.

### IR Lifecycle
Generic `PATCH /api/internal-requests/:id` has been removed. All state transitions (accept, resolve, reject, withdraw) are now handled via dedicated `POST` endpoints, with `routedToRole` or ADMIN privileges required for actions.

### Activity Ledger
An append-only `activityLog` table tracks key actions across the system, providing an audit trail for elevated roles.

### Notifications
A new `notifications` table and helper `createNotification()` manage user notifications, with endpoints for fetching, marking as read, and getting unread counts.

### Centralized KPI API
A single source of truth for all dashboard KPIs is provided through dedicated `GET /api/kpi/*` endpoints, supporting various aggregation levels (rep, region, system-wide) and calculating `achieved`, `target`, `pipeline`, and `gap` metrics.

### Shared Domain Constants
All domain enums and constants are centralized in `lib/db/src/constants.ts` for consistent data types and logic across the application.

### Idempotency Protection
- **Revenue entries**: Support an optional `idempotencyKey` to prevent duplicate submissions.
- **Target submissions**: Prevent multiple active submissions for the same rep+quarter.

### Hierarchy-Aware Approvals
Target approvals now include hierarchy checks (e.g., Region Head can only approve submissions from their own region). IR state transitions are strictly governed by `routedToRole`.

### Typed IR Workflows
`irSubtype` is now a validated field with predefined types, and `slaHours` are derived from the department on the backend, not client-supplied.

### Canonical Role Names
The system uses predefined canonical role names like `"SALES REP"`, `"REGION HEAD"`, etc.

### Feature Specifications
- **Role-Based Views**: Seven distinct roles have customized views.
- **Sales Workflow**: Features include logging touchpoints, deal auto-escalation, multi-step deal approval based on value, a "11:30 PM rule" for daily planning, and a multi-step target approval process.
- **Admin Controls**: Dynamic configuration of approval thresholds, SLA hours, inactivity escalation, and user/client management.
- **Data Management**: Admin users can manage reps and clients, and perform bulk imports.
- **Key Architectural Notes**: `ACHIEVED` revenue exclusively from `revenueEntries`, derived `pipelineAmount`, immutable `revenueEntries`, and the use of `DEAL_STAGES` constant.
- **Support Request workflow**: Dedicated "Support Needed" section in the touchpoint log form creates Internal Requests with specific types, priorities, and due dates, visible in various war rooms.

### UI Nav Structure (post-polish)
- **Sales Rep** — sidebar section "DAILY WORK": My Plan → My Pipeline → Revenue Log → Tasks → Target → Requests → HR Report. Lands on `my-plan`. Two full-width quick CTAs at the top of My Plan: "+ Log Touchpoint" (amber) and "+ Add Deal" (blue).
- **Region Head** — sidebar split into 3 sections: **MY TEAM** (Dashboard, Team Meetings, War Room, Pipeline) · **MY WORK** (My Plan, Approvals, My Tasks, Requests) · **REPORTS** (Escalations, Team Report, My HR). Lands on `rh-dashboard` (heading: DASHBOARD).
- **Demo email format**: All RH accounts use dot format — `rh.north@odishatv.com`, `rh.south@odishatv.com`, `rh.east@odishatv.com`, `rh.west@odishatv.com`, `rh.central@odishatv.com`, `rh.national@odishatv.com`. Password for all demo accounts: `demo123`.
- **OTVApp.tsx** is ~14,500+ lines — use `edit` with precise context strings; use `code_execution` for large block replacements.

## External Dependencies

- **PostgreSQL Database**: Used for all persistent data storage, integrated via Drizzle ORM.
- **Zoho CRM Sandbox**: Used for live client and agency lookups. Integration points include "Add Deal," "Add Client Target," and "Revenue Log" forms. The system provides graceful fallback to free text entry if the Zoho API is unreachable.
- **Anthropic API**: Used for AI-related functionalities.