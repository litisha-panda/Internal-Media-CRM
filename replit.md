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

### Feature Specifications
- **Role-Based Views**: Six distinct roles (Sales Rep, Region Head, National Sales Head, Sales Strategy, CRO, Admin, Digi Ops) each have a customized view and navigation.
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