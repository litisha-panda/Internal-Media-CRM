# Product Requirements Document
## OTV Internal CRM — Sales Intelligence Platform
### Odisha Television Network

---

**Document Version:** 1.0
**Date:** April 2026
**Status:** Active Development
**Owner:** OTV Sales Strategy & Product Team
**Stakeholders:** CRO, National Sales Head, Region Heads, Sales Strategy, IT/Engineering

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Objectives](#3-goals--objectives)
4. [User Personas](#4-user-personas)
5. [Feature Modules & Requirements](#5-feature-modules--requirements)
6. [User Stories](#6-user-stories)
7. [Success Metrics](#7-success-metrics)
8. [Scope](#8-scope)
9. [Technical Architecture](#9-technical-architecture)
10. [Design & UX Requirements](#10-design--ux-requirements)
11. [Timeline & Milestones](#11-timeline--milestones)
12. [Risks & Mitigation](#12-risks--mitigation)
13. [Dependencies & Assumptions](#13-dependencies--assumptions)
14. [Open Questions](#14-open-questions)

---

## 1. Executive Summary

OTV Internal CRM is a centralised, role-gated Sales Intelligence Platform built exclusively for the sales organisation of **Odisha Television Network (OTV)** — one of India's leading regional broadcast media groups. The platform serves the entire commercial sales hierarchy: individual Sales Representatives, Region Heads, National Sales Head, Chief Revenue Officer, Sales Strategy team, and Digital Operations — covering six regions (North, South, East, West, Central, National) across OTV's broadcast and digital portfolio.

The platform consolidates four previously fragmented workflows into a single internal tool: **pipeline tracking**, **daily meeting planning**, **quarterly target setting & approvals**, and **Release Order (RO) processing**. It provides real-time visibility at every management tier — from a Sales Rep's personal action items to the CRO's national revenue health — with AI-powered RO parsing that eliminates manual data entry from agency documents.

The product is accessed exclusively via internal browser (web SPA) with Google and Zoho SSO authentication, backed by a Node.js/PostgreSQL API. It is not a customer-facing product and carries no commercial licensing cost to OTV's clients.

---

## 2. Problem Statement

### Current State — Pain Points

| # | Problem | Impact | Affected Roles |
|---|---------|--------|----------------|
| 1 | Pipeline data scattered across individual spreadsheets, WhatsApp threads, and email | No single source of truth; management has zero real-time visibility into revenue health | All |
| 2 | Release Orders (ROs) from agencies arrive in 8+ inconsistent formats (PDF, Excel, images, Word) | Sales Ops spends 3–5 hours/week manually transcribing RO data into Zoho CRM | Sales Ops, Admin |
| 3 | Daily meeting plans submitted via WhatsApp; no accountability or follow-through tracking | Managers cannot verify if meetings happened; reps not held accountable to 11:30 PM log deadline | Sales Reps, Region Heads |
| 4 | Quarterly target setting is a manual email chain between reps, RHs, NSH, Strategy, and CRO | Target approval cycle takes 2–3 weeks; versions get out of sync | All management |
| 5 | No escalation workflow; at-risk deals flagged informally via phone calls | High-value deals lost with no audit trail | Region Heads, NSH, CRO |
| 6 | HR absence reporting done via paper or WhatsApp; no compliance oversight | Compliance violations go undetected; payroll disputes | HR, Region Heads, NSH |
| 7 | No leaderboard or performance benchmarking; reps have limited visibility of peers | Low competitive motivation; no data-driven incentive planning | Sales Reps, Management |

### Desired Future State

A unified, role-scoped internal platform where every sales activity — from a rep's morning plan to the CRO's quarterly revenue review — is logged, trackable, and actionable, with automated AI processing eliminating manual data entry from agency documents.

---

## 3. Goals & Objectives

### Business Goals

- **Revenue Visibility**: Give management real-time visibility into achieved, committed, in-play, and shortfall revenue across all reps, regions, and channels.
- **Accountability**: Create a daily accountability loop — reps plan meetings, log them by 11:30 PM, managers review; non-compliance is surfaced automatically.
- **Efficiency**: Reduce RO processing time from 3–5 hours/week to under 15 minutes/week via AI-powered parsing.
- **Target Governance**: Implement a structured quarterly target approval workflow (Rep → RH → NSH → Strategy → CRO) that is auditable and versioned.
- **Retention**: Surface at-risk clients (no contact ≥7 days, overdue next steps) before deals are lost.

### Product Objectives (FY26)

| Objective | Key Result |
|-----------|-----------|
| Consolidate all pipeline data | 100% of active deals tracked in platform by Q2 FY26 |
| Automate RO processing | ≥85% parse accuracy across WPP, Madison, Zenith, ENES formats |
| Daily meeting accountability | ≥90% of reps submitting daily meeting logs by end of Q2 FY26 |
| Target workflow adoption | 100% of quarterly targets submitted and approved via platform by Q3 FY26 |
| Management reporting | CRO/NSH can generate complete revenue report in <5 minutes |

---

## 4. User Personas

### Persona 1 — Sales Representative ("Rep")
**Name:** Arjun Mishra
**Role:** Sales Rep, North Region
**Daily workflow:** Logs 4–6 client meetings/day across Linear TV, Digital, and IP inventory. Plans tomorrow's meetings before 11:30 PM. Tracks his pipeline, gets alerts on overdue next steps, submits quarterly targets for RH approval.
**Pain points:** Remembering to log meetings; understanding his shortfall vs. target; waiting on approvals.
**Platform primary views:** My Plan, War Room (personal), Revenue Tracker, My Targets, Tasks.

---

### Persona 2 — Region Head ("RH")
**Name:** Priya Nair
**Role:** Region Head, South Region
**Daily workflow:** Reviews her team of 6 reps' daily plans each morning. Tracks regional pipeline. Approves/escalates at-risk deals. Approves rep target submissions. Files weekly escalation reports to NSH.
**Pain points:** Visibility into which reps are behind; escalating deals that need NSH support; target approval bottlenecks.
**Platform primary views:** War Room (regional), Team's Plan, Revenue Tracker, Approvals, Escalations, RH Targets.

---

### Persona 3 — National Sales Head ("NSH")
**Name:** Vikram Rao
**Role:** National Sales Head
**Daily workflow:** Morning revenue dashboard review across all 6 regions. Approves escalated deals from RHs. Reviews RH target submissions. Tracks compliance across the sales organisation.
**Pain points:** Inconsistent region-level data; no unified view of at-risk national revenue; slow target approval cycle.
**Platform primary views:** War Room (national), Revenue Tracker, Targets, Escalations, Compliance, RH Scorecards, Leaderboard.

---

### Persona 4 — Chief Revenue Officer ("CRO")
**Name:** Darpan Mehta
**Role:** CRO
**Usage:** Weekly/bi-weekly strategic review. Views consolidated national KPIs — achieved vs. target, committed pipeline, at-risk exposure. Final approver on target submissions and high-value escalations.
**Pain points:** Inability to drill from national summary to rep-level detail without multiple calls; no single number for "how are we tracking."
**Platform primary views:** War Room (all regions), Leaderboard, Revenue Tracker, Target Approvals, Strategy Settings.

---

### Persona 5 — Sales Strategy
**Name:** Sachin Patnaik
**Role:** Sales Strategy
**Usage:** Cross-functional visibility across entire sales org. Analyses deal patterns, agency health, channel mix. Configures platform-level settings (quarter, target approval chains).
**Platform primary views:** All views (read-only for most), Strategy Settings, Compliance, Leaderboard.

---

### Persona 6 — Digital Operations ("Digi Ops")
**Name:** Rohan Das
**Role:** Digital Operations
**Usage:** Manages digital revenue pipeline separately — Website, App, Social Media, Direct, Internal, Programmatic channels. Has a scoped Revenue Tracker with digital-only deal types.
**Platform primary views:** Revenue Tracker (digital tabs), War Room (digital KPIs).

---

### Persona 7 — Admin
**Name:** System Admin
**Role:** Platform Administrator
**Usage:** User access management, platform go-live toggle, admin config, data management, user approval for self-registered accounts.
**Platform primary views:** Admin Config, Data Management, User Management.

---

## 5. Feature Modules & Requirements

### Module 1 — Authentication & Access Control

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| AUTH-01 | Google Workspace SSO login (OAuth2) for `@odishatv.com` accounts | P0 |
| AUTH-02 | Zoho CRM SSO login for legacy users | P0 |
| AUTH-03 | Email/password fallback for non-SSO accounts | P1 |
| AUTH-04 | Self-registration with pending-approval state; Admin approves/rejects | P1 |
| AUTH-05 | Role-based access: Admin, Sales Head, CRO, Sales Strategy, NSH, Region Head, Sales Rep, Digi Ops | P0 |
| AUTH-06 | Regional data scoping — RHs see only their region's data; Reps see only their own | P0 |
| AUTH-07 | "Preview as Role" mode for Admin/CRO/CXO — impersonate any user view | P2 |
| AUTH-08 | Session persistence; auto-logout after inactivity | P1 |

---

### Module 2 — War Room (Command Dashboard)

The War Room is the daily entry point for all users. It surfaces personalised KPIs and action items.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| WR-01 | KPI card row: Achieved, Committed, In Play, Shortfall (revenue values with %) | P0 |
| WR-02 | Action items panel: overdue next steps, at-risk clients (≥7 days no contact), blocked approvals, open tasks | P0 |
| WR-03 | At-risk alert: deal flagged if no contact in ≥7 days OR `atRisk` flag set | P0 |
| WR-04 | Progress bar: achieved as % of quarterly target | P0 |
| WR-05 | NSH/CRO view: aggregated national KPIs with region breakdown table | P0 |
| WR-06 | RH view: regional KPIs + per-rep scorecard (plan compliance, meetings logged, at-risk deals) | P0 |
| WR-07 | Pre-launch gate: reps blocked until Admin sets `platformLive = true` | P1 |
| WR-08 | Countdown timer to 11:30 PM meeting log deadline (colour changes red after 9 PM) | P2 |

---

### Module 3 — My Plan (Daily Meeting Planning)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| PLAN-01 | Sales Rep can add Today's and Tomorrow's planned client meetings | P0 |
| PLAN-02 | Each meeting entry: client name, time, agenda, pitch type, meeting type (physical/online/call) | P0 |
| PLAN-03 | "Log Meeting" flow: convert planned meeting into logged meeting with actual outcome, notes, next steps | P0 |
| PLAN-04 | 11:30 PM compliance: system tracks whether rep logged meetings for the day | P0 |
| PLAN-05 | Absence reporting: rep can file "On Leave / WFH / Training" for days with no meetings | P1 |
| PLAN-06 | RH view: see all reps' today/tomorrow plans in a consolidated table | P0 |
| PLAN-07 | NSH view: see all RHs' and Reps' plans | P0 |
| PLAN-08 | Strategy/CRO view: monthly overview across all reps (read-only) | P1 |

---

### Module 4 — Revenue Tracker (Pipeline Management)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| RT-01 | Deal management: add, edit, delete client deals with full metadata | P0 |
| RT-02 | Deal fields: client company, rep, channel, deal type, outcome stage, amount, pipeline amount, agency, contact info, next step, next step date, quarter, priority | P0 |
| RT-03 | Deal stages: Prospect → In Discussion → Negotiation → Mail Confirmed → Not Interested → Lost | P0 |
| RT-04 | Multi-tab view: Accounts, Linear TV, IPs, Digital, Media Solutions, Integrated Packages (or digital tabs for Digi Ops) | P0 |
| RT-05 | Client Accounts view: per-account achieved/committed/in-play/shortfall summary with idle-day indicator | P0 |
| RT-06 | At-risk badge: "COLD Xd" label if no contact in ≥7 days | P0 |
| RT-07 | Quarter filter: view pipeline for Q1/Q2/Q3/Q4 FY26 or annual | P0 |
| RT-08 | Region filter: NSH/CRO/Admin can filter by region | P0 |
| RT-09 | Deal audit log: every change recorded with timestamp and user | P1 |
| RT-10 | Agency search: search Zoho CRM for client/agency accounts (optional integration) | P2 |
| RT-11 | Revenue entry log: record actual revenue confirmed (separate from deal stage) | P0 |

---

### Module 5 — Targets (Quarterly Target Workflow)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| TGT-01 | Rep submits quarterly targets per client: client name, deal type, target amount | P0 |
| TGT-02 | Multi-step approval chain: Rep → Pending RH → Pending NSH → Pending Strategy → Approved | P0 |
| TGT-03 | Each approver can approve, reject (with reason), or request revision | P0 |
| TGT-04 | Approved targets feed into War Room KPI calculations | P0 |
| TGT-05 | RH target submission (RH sets their own regional target) | P1 |
| TGT-06 | NSH can view and approve all region targets in a consolidated table | P0 |
| TGT-07 | Strategy can configure approval chain rules (e.g., skip NSH for small targets) | P2 |
| TGT-08 | Target history: view all submitted/approved/rejected targets with timestamps | P1 |
| TGT-09 | Badge notifications: pending approvals shown in sidebar nav badge count | P0 |

---

### Module 6 — Leaderboard & Scorecards

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| LB-01 | Sales Rep leaderboard: rank by achieved revenue, committed pipeline, meeting count | P0 |
| LB-02 | Region leaderboard: rank regions by achieved %, pipeline health | P0 |
| LB-03 | Rep scorecard: today's meetings, meetings this week, plan compliance %, at-risk count, tasks pending | P0 |
| LB-04 | RH scorecard: regional performance, rep compliance summary | P0 |
| LB-05 | Scoped views: Reps see team leaderboard; RHs see regional; NSH/CRO see national | P0 |

---

### Module 7 — Escalations

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| ESC-01 | Rep/RH can raise escalation on a deal: escalation type, deal reference, notes | P0 |
| ESC-02 | Escalation types: Pricing Approval, Agency Dispute, Contract Delay, Credit Hold, Competitor Threat | P0 |
| ESC-03 | Escalation routing: Rep → RH → NSH → CRO | P0 |
| ESC-04 | Escalation resolution: approver adds resolution note and marks resolved | P0 |
| ESC-05 | Badge count on Escalations nav item showing unresolved count | P0 |
| ESC-06 | Audit trail: full history of escalation with each action timestamped | P1 |

---

### Module 8 — Internal Requests

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| IR-01 | Submit internal requests: proposal support, rate card, custom package, approval | P0 |
| IR-02 | Requests routed to appropriate department (Region Head, NSH, Sales Strategy) | P0 |
| IR-03 | Request status: Pending → In Progress → Resolved / Rejected | P0 |
| IR-04 | Inbox view for approvers: see all pending requests directed to them | P0 |
| IR-05 | Badge count for pending inbound requests | P0 |

---

### Module 9 — Tasks

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| TASK-01 | Create tasks with title, description, due date, assigned rep, client reference | P0 |
| TASK-02 | Task status: To Do → In Progress → Done | P0 |
| TASK-03 | Tasks linked to deals/clients for contextual follow-up | P1 |
| TASK-04 | "Done" quick-action from War Room action items panel | P0 |
| TASK-05 | Badge count for open tasks in sidebar nav | P0 |

---

### Module 10 — HR Reports & Compliance

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| HR-01 | Absence reports: rep files leave/WFH/training for specific dates | P0 |
| HR-02 | Compliance dashboard: RH/NSH see rep meeting compliance (logged vs. planned) per day | P0 |
| HR-03 | Monthly absence summary per rep: leave days, WFH days, training days | P0 |
| HR-04 | NSH/Strategy compliance view: org-wide attendance and compliance heatmap | P1 |
| HR-05 | Export compliance data as CSV | P2 |

---

### Module 11 — RO Management (AI-Powered)

The Release Order parser is the platform's highest-complexity technical module, using Claude AI to extract structured data from unstructured agency documents.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| RO-01 | Accept RO documents in PDF, Excel (.xlsx/.xls), images (JPG/PNG), and CSV formats | P0 |
| RO-02 | AI extraction: client name, agency, channel, FCT (seconds), spots, amount, start/end dates, deal type | P0 |
| RO-03 | Support agency formats: WPP, Madison, Zenith, ENES, and generic | P0 |
| RO-04 | Channel normalisation: map agency channel names to OTV internal channel names (Odisha TV, Tarang, Tarang Music, Alankar, Prarthana) | P0 |
| RO-05 | Time band snapping: snap start/end times to nearest 30-minute broadcast band | P0 |
| RO-06 | Prime time detection: flag FCT in 7 PM – 11 PM window | P1 |
| RO-07 | Non-FCT type support: I Band, L Band, Anchor Mention, Logo Countdown, Aston Countdown, etc. | P1 |
| RO-08 | Zoho-ready export: generate Deal sheet + Breakup sheet in Zoho CRM import format | P0 |
| RO-09 | RO library: save and search all parsed ROs | P1 |
| RO-10 | Parse accuracy target: ≥85% field-level accuracy across top 5 agency formats | P0 |

---

### Module 12 — Global Search

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| SRCH-01 | Topbar search across deals, meetings, and tasks | P1 |
| SRCH-02 | Results grouped by type (DEAL / MTG / TASK) with client and rep context | P1 |
| SRCH-03 | Click-to-navigate: selecting result opens the relevant view and record | P1 |

---

### Module 13 — Admin Configuration

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| ADM-01 | Platform go-live toggle: block reps until admin sets live date | P0 |
| ADM-02 | User approval queue: approve/reject self-registered users with role assignment | P0 |
| ADM-03 | Bulk data import: upload deals/meetings/targets from CSV | P1 |
| ADM-04 | System state reset: reset all data (dev/staging only) | P2 |
| ADM-05 | Launch date configuration: display countdown to sales reps | P1 |

---

## 6. User Stories

### Epic: Daily Sales Accountability

```
US-001: Morning Planning
As a Sales Representative,
I want to add tomorrow's planned client meetings tonight,
So that my Region Head can see my plan and I stay organised.

Acceptance Criteria:
- Can add up to 10 planned meetings for any date
- Each entry requires: client name, time slot, agenda, meeting type
- Planned meetings appear in RH's "Team Plan" view by 10:00 PM
- App shows "Tomorrow's plan submitted" confirmation
```

```
US-002: End-of-day Meeting Log
As a Sales Representative,
I want to log completed meetings with outcomes and next steps,
So that my pipeline is always up to date and I meet the 11:30 PM deadline.

Acceptance Criteria:
- Can convert any planned meeting to "logged" with actual outcome
- Required fields: outcome, notes, next step, next step date
- Countdown timer visible showing time remaining to 11:30 PM
- System flags non-compliance if no meetings logged by 11:30 PM
```

---

### Epic: Revenue Pipeline Management

```
US-003: Deal Entry
As a Sales Representative,
I want to add a new client deal to the Revenue Tracker,
So that my pipeline is tracked and visible to my manager.

Acceptance Criteria:
- Can add deal with all required fields (client, type, amount, stage, quarter)
- Deal appears immediately in my Revenue Tracker view
- Deal contributes to my War Room KPIs (in-play, committed based on stage)
- Deal is visible to my Region Head in their regional view
```

```
US-004: At-Risk Alert
As a Region Head,
I want to see which deals have had no contact for 7+ days,
So that I can proactively follow up or escalate before the deal is lost.

Acceptance Criteria:
- Deals with lastContact ≥ 7 days ago show "COLD Xd" badge in the accounts table
- War Room action items panel lists all at-risk deals for my region
- Clicking an at-risk deal opens the full deal record
- Dismissing the alert snoozes for 24 hours
```

---

### Epic: Target Governance

```
US-005: Target Submission
As a Sales Representative,
I want to submit my quarterly client targets for approval,
So that my revenue target is formally agreed and visible to management.

Acceptance Criteria:
- Can submit targets for multiple clients per quarter
- Each target entry: client name, deal type, target amount (₹ lakh)
- Submitted target shows status "Pending RH" with submission timestamp
- Rep receives confirmation after submission
- Rep can edit targets in "Pending" status before approval
```

```
US-006: Target Approval (Region Head)
As a Region Head,
I want to review and approve my team's quarterly targets,
So that realistic targets are submitted up the chain.

Acceptance Criteria:
- All pending targets for my region appear in Approvals view
- Can approve individual or bulk targets
- Can reject with a mandatory reason (minimum 10 characters)
- Approved targets move to "Pending NSH"; rejected return to rep
- Rep notified of approval/rejection status via badge count
```

---

### Epic: RO Processing

```
US-007: RO Upload and Parse
As a Sales Operations user,
I want to upload an agency Release Order and get structured data automatically,
So that I don't spend hours manually entering data into Zoho CRM.

Acceptance Criteria:
- Can upload PDF, Excel, image, or CSV files up to 50MB
- System returns parsed RO data within 30 seconds for standard formats
- Parsed fields: client, agency, channel, FCT, spots, amount, dates
- Parse confidence score shown per field
- Can edit any parsed field before saving
- Parsed RO exportable as Zoho-ready Excel sheets (Deal + Breakup)
```

---

### Epic: Management Reporting

```
US-008: CRO War Room View
As the Chief Revenue Officer,
I want to see national revenue KPIs (achieved, committed, in-play, shortfall)
broken down by region and sales rep,
So that I can make data-driven decisions in my weekly review.

Acceptance Criteria:
- National KPI cards load within 2 seconds
- Can drill from national → region → rep without page reload
- Quarter filter changes all KPI calculations dynamically
- Export national report as PDF or CSV
- Data reflects same-day deal updates
```

---

## 7. Success Metrics

### North Star Metric
> **% of quarterly revenue target achieved across the full sales organisation by end of each quarter, tracked weekly through the platform.**

### HEART Framework

| Dimension | Metric | Target (Q3 FY26) |
|-----------|--------|-----------------|
| **Happiness** | Monthly user satisfaction score (in-app survey) | ≥4.0 / 5.0 |
| **Engagement** | Daily active users / total active users | ≥75% DAU/MAU |
| **Adoption** | % reps submitting daily meeting logs | ≥90% |
| **Retention** | 90-day retention rate | ≥85% |
| **Task Success** | Target approval cycle time | <5 business days |

### Key Product Metrics

| Metric | Baseline | Target Q2 FY26 | Target Q4 FY26 |
|--------|----------|----------------|----------------|
| Meeting log compliance (reps logging by 11:30 PM) | ~30% (informal) | 70% | 90% |
| RO parse accuracy (field-level) | Manual (0% automated) | 80% | ≥88% |
| At-risk deal response time (from alert to action) | Unknown | <48 hrs | <24 hrs |
| Target approval cycle | 2–3 weeks (email) | 1 week | 3–5 business days |
| Pipeline data completeness (all active deals entered) | ~20% | 80% | 100% |
| Time to generate national revenue report | ~2 hours | 15 min | <5 min |

### Business Impact Metrics

| Metric | Description |
|--------|-------------|
| Revenue at-risk prevented | Value of deals rescued via at-risk alert (vs. prior quarter) |
| RO processing time saved | Hours/week saved on manual RO data entry |
| Pipeline forecast accuracy | Variance between committed pipeline and actual quarter-end revenue |

---

## 8. Scope

### In Scope (FY26)

- ✅ Web SPA (React + Vite) for desktop and mobile browsers
- ✅ Authentication: Google SSO, Zoho SSO, Email/password
- ✅ Role-based access: 8 user roles with regional data scoping
- ✅ War Room KPI dashboard (per-role, personalised)
- ✅ My Plan — daily meeting planning and logging (daily accountability loop)
- ✅ Revenue Tracker — deal pipeline with 6 channel tabs (Linear, Digital, IP, Media Solutions, etc.)
- ✅ Quarterly target submission and multi-step approval workflow (Rep → RH → NSH → Strategy → CRO)
- ✅ Leaderboard and performance scorecards
- ✅ Escalation management with routing
- ✅ Internal requests workflow
- ✅ Tasks management
- ✅ HR compliance (absence reports, meeting compliance tracking)
- ✅ AI-powered RO parser (PDF, Excel, image, CSV → structured data)
- ✅ Zoho-ready RO export (Deal sheet + Breakup sheet)
- ✅ Global search (deals, meetings, tasks)
- ✅ Admin configuration and user approval
- ✅ PostgreSQL-backed persistence (shared state across all users)
- ✅ Real-time state sync via server API

### Out of Scope (FY26)

- ❌ Native mobile apps (iOS / Android) — web-responsive only
- ❌ Zoho CRM direct write-back (RO export is file-based, not API sync)
- ❌ Client/advertiser-facing portal
- ❌ Billing or invoicing module
- ❌ Video/content management for broadcast schedules
- ❌ Push notifications / email notifications (in-app alerts only in FY26)
- ❌ Advanced analytics / BI dashboards with external charting libraries
- ❌ Multi-company support (OTV-only)

### Future Considerations (FY27+)

- Zoho CRM bidirectional API sync (real-time deal push/pull)
- Mobile-native app with offline support
- Email/SMS nudge notifications for compliance
- Advanced forecasting model (ML-based revenue prediction)
- Advertiser self-service portal for RO submission
- Integration with broadcast traffic/scheduling systems

---

## 9. Technical Architecture

### Stack Overview

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Design Font | Plus Jakarta Sans (UI) + DM Mono (data/tables) |
| API Server | Node.js, Express 5, TypeScript |
| Database | PostgreSQL (local: `otv_crm_local`) |
| ORM / Query | Custom SQL via pg driver |
| AI (RO Parser) | Anthropic Claude API (claude-sonnet-4-6) |
| Authentication | Google OAuth2, Zoho OAuth2, JWT sessions |
| File Processing | XLSX.js (CDN, client-side), Anthropic Vision API |
| Hosting (prod) | TBD — Replit/Railway/VPS |

### Data Models (Key Entities)

```
User         — id, name, email, role, region, repId, status
Deal         — id, clientCompany, repId, dealType, outcome, amount, quarter, region, auditLog[]
ClientAccount— id, clientName, repId, annualTarget, currentStage, lastDealMeetingDate, channel
Meeting      — id, repId, date, clientCompany, agenda, outcome, notes, nextStep, status
Plan         — id, repId, date, items[], status
TargetSub    — id, repId, quarter, clients[], status, approvalChain[]
RevenueEntry — id, repId, clientCompany, amount, quarter, fiscalYear
Escalation   — id, repId, dealId, type, status, resolutionNote, timeline[]
Task         — id, title, assignedTo, dueDate, status, clientCompany
AbsenceReport— id, repId, date, type, reason
InternalReq  — id, fromUser, dept, type, status, notes
```

### API Routes (Key Patterns)

```
GET  /api/state/:key        — fetch shared state (deals, meetings, plans, etc.)
PUT  /api/state/:key        — update shared state
POST /api/auth/login        — email/password auth
POST /api/auth/google       — Google OAuth callback
POST /api/ro/parse          — RO document parsing (multipart/form-data)
GET  /api/users             — user list (admin only)
POST /api/users/approve     — approve pending registration
```

### Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| Authentication | JWT sessions, 7-day expiry, HttpOnly cookies |
| Authorisation | Role-based middleware on all API routes |
| Data scoping | API enforces region/rep visibility rules server-side |
| CORS | Allowed origins whitelist (ALLOWED_ORIGIN env var) |
| Rate limiting | 10 req/min on auth routes, 200 req/min on API routes |
| API Keys | Anthropic key stored in server env only (never exposed to client) |
| Input validation | All user inputs validated and sanitised before DB writes |

---

## 10. Design & UX Requirements

### Design System

| Token | Value |
|-------|-------|
| Primary font | Plus Jakarta Sans (400/500/600/700/800) |
| Data font | DM Mono (400/500) |
| Background | `#f8fafc` (slate-50) |
| Surface | `#ffffff` (white) |
| Border | `#e2e8f0` (slate-200) |
| Brand accent | `#d97706` (amber-600) |
| Text primary | `#0f172a` (slate-900) |
| Text secondary | `#64748b` (slate-500) |
| Success | `#16a34a` (green-600) |
| Danger | `#dc2626` (red-600) |
| Info | `#2563eb` (blue-600) |

### Layout

- **Sidebar**: 200px fixed, left-aligned, collapsible on mobile (horizontal tab bar)
- **Topbar**: 48px fixed, OTV brand + global search + quarter/region filter + user profile
- **Content area**: `24px` padding, max-content-width for readability on 1440px+
- **Responsive breakpoints**: 375 / 768 / 1024 / 1440px
- **Spacing rhythm**: 8dp increments (4/8/12/16/20/24/32/48px)

### Component Standards

| Component | Specification |
|-----------|---------------|
| Buttons | 36px min-height, 6px radius, Plus Jakarta Sans 600 |
| KPI cards | 3px top accent border, 12px radius, 16–18px padding |
| Tables | `th` 11px/700/uppercase, `td` 12px DM Mono, 11px row padding |
| Modals | 16px radius, `backdrop-filter: blur(3px)`, 600px max-width |
| Pills/badges | 20px border-radius, 10–11px/700 font |
| Tab navigation | 2.5px bottom-border active state, amber-600 active colour |
| Forms | 1.5px borders, 8px radius, 3px focus ring (`accent18` tint) |

### Accessibility Requirements

- WCAG AA compliance minimum (contrast ratio ≥4.5:1 for normal text)
- All interactive elements have visible focus states
- Form inputs have visible labels (no placeholder-only)
- Status conveyed with both colour and text/icon (not colour alone)
- Keyboard navigation support for all primary flows

### Login Screen

- Dark radial-gradient background (indigo → slate-900) with subtle grid overlay
- White card (20px radius, deep box-shadow)
- Google SSO, Zoho SSO, Email/password options
- 6-role demo access grid for internal testing

---

## 11. Timeline & Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| **M0 — Foundation** | Auth, PostgreSQL setup, base API, login/home screens | ✅ Complete |
| **M1 — Core Pipeline** | Revenue Tracker, Deal CRUD, War Room KPIs | ✅ Complete |
| **M2 — Daily Accountability** | My Plan, Meeting Logs, 11:30 PM compliance | ✅ Complete |
| **M3 — Target Workflow** | Target submission + multi-step approval chain | ✅ Complete |
| **M4 — RO Parser v1** | PDF/Excel/image parsing via Claude AI, Zoho export | ✅ Complete |
| **M5 — Management Layer** | Escalations, NSH/CRO war room, Leaderboard | ✅ Complete |
| **M6 — HR & Compliance** | Absence reports, compliance dashboard | ✅ Complete |
| **M7 — UI Polish** | SaaS visual redesign (fonts, spacing, dark mode, layout) | ✅ Complete (Apr 2026) |
| **M8 — Production Deploy** | Hosting setup, domain, SSL, monitoring | Q2 FY26 |
| **M9 — Adoption Drive** | User onboarding, virtual tour, training sessions | Q2 FY26 |
| **M10 — RO Parser v2** | Improved accuracy, batch processing, RO library | Q3 FY26 |
| **M11 — Zoho Sync** | Bidirectional Zoho CRM API integration | Q4 FY26 (TBC) |

---

## 12. Risks & Mitigation

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Low rep adoption — users revert to WhatsApp for planning | High | High | Virtual tour onboarding, daily nudge from RH, compliance visibility makes non-adoption visible to management |
| R2 | RO parser accuracy below 85% for new agency formats | Medium | Medium | Human review step before save; allow field editing; improve prompts iteratively with real ROs |
| R3 | Data loss — single PostgreSQL instance with no backups | High | Critical | Implement daily automated backups; add replication before production launch |
| R4 | Zoho OAuth token expiry causing SSO failures | Medium | High | Token refresh mechanism; fallback to email login; monitoring alert on OAuth errors |
| R5 | Anthropic API key exposed in client-side code | Low | Critical | Key stored server-side only; never sent to browser; API proxy routes through backend |
| R6 | Browser bundle size (13k+ line component) causes slow initial load | Medium | Medium | Code-split OTVApp.tsx into view-level modules; lazy-load heavy views (RO parser) |
| R7 | Role permission bypass by URL manipulation | Low | High | All data scoping enforced server-side; client-side role checks are UI-only |
| R8 | Concurrent edit conflicts (two users editing same deal) | Low | Medium | Last-write-wins with audit log; future: optimistic locking |

---

## 13. Dependencies & Assumptions

### External Dependencies

| Dependency | Purpose | Owner | Status |
|------------|---------|-------|--------|
| Google Workspace | SSO authentication for `@odishatv.com` | IT / Google | Configured |
| Anthropic Claude API | RO parsing (claude-sonnet-4-6) | Engineering | Active — API key provisioned |
| Zoho CRM OAuth | Zoho SSO + agency/client search | IT / Zoho | Partially configured |
| PostgreSQL | Primary data store | Engineering | Running locally; prod TBD |
| Google Fonts CDN | Plus Jakarta Sans + DM Mono | N/A | CDN dependency |
| XLSX.js CDN | Client-side Excel parsing | N/A | CDN dependency |

### Assumptions

1. All OTV sales staff have `@odishatv.com` Google Workspace accounts
2. The quarterly target cycle aligns to FY26 (Q1–Q4) as configured
3. Management is committed to enforcing daily meeting log compliance (11:30 PM rule)
4. Zoho CRM remains the system of record for client/agency accounts
5. RO documents from top 5 agencies (WPP, Madison, Zenith, ENES, internal) account for ≥80% of volume
6. The platform will be accessed on desktop browsers (Chrome/Safari/Edge) in an office environment
7. A production PostgreSQL server will be provisioned before the M8 deployment

---

## 14. Open Questions

| # | Question | Owner | Priority | Target Resolution |
|---|----------|-------|----------|------------------|
| OQ-1 | What hosting infrastructure will be used for production? (Railway / VPS / Replit deployment) | IT / Engineering | High | Before M8 |
| OQ-2 | Will the RO parser need to support regional language ROs (Odia script)? | Sales Ops | Medium | Q3 FY26 |
| OQ-3 | Should push/email notifications be added for target approvals and escalation updates? | Product / CRO | Medium | Q3 FY26 |
| OQ-4 | Is Zoho CRM direct API sync (bidirectional) a Q4 FY26 commitment or post-FY26? | CRO / IT | High | By M11 planning |
| OQ-5 | Should individual reps be able to see each other's pipelines (within same region)? | Sales Head | Medium | Before M9 |
| OQ-6 | What is the SLA for RO parse turnaround? (currently best-effort ~30s) | Sales Ops | Low | Q3 FY26 |
| OQ-7 | Will there be a mobile-native app requirement for field sales reps? | CRO | Medium | FY27 planning |
| OQ-8 | Who owns user role assignment when a new sales hire joins? HR or the reporting manager? | HR / Sales Ops | Medium | Before M9 |

---

## Appendix A — Channel & Segment Reference

### OTV Broadcast Channels
| Channel | Company |
|---------|---------|
| Odisha TV | Odisha Television Ltd |
| Prarthana | Odisha Television Ltd |
| Tarang | Tarang Broadcasting Company Ltd |
| Tarang Music | Tarang Broadcasting Company Ltd |
| Alankar | Tarang Broadcasting Company Ltd |

### Sales Regions
North · South · East · West · Central · National

### Revenue Segments
Education · Regional Corporate · Private · Government

### Deal Types (Linear TV)
FCT (Film Commercial Time) · I Band · L Band · Anchor Mention · Logo Countdown · Aston Countdown · Coffee Mug · Super Impose · Sponsorship (Title/Co/Associate/Presenting)

---

## Appendix B — User Role Matrix

| Permission | Admin | Sales Head | CRO | Strategy | NSH | Region Head | Sales Rep | Digi Ops |
|------------|:-----:|:----------:|:---:|:--------:|:---:|:-----------:|:---------:|:--------:|
| View all regions | ✓ | ✓ | ✓ | ✓ | ✓ | Own only | Own only | Own only |
| Edit any deal | ✓ | ✓ | — | — | — | Own region | Own deals | Own deals |
| Approve targets | ✓ | ✓ | Final | Strategy | NSH | RH level | — | — |
| View HR compliance | ✓ | ✓ | ✓ | ✓ | ✓ | Own team | Own | Own |
| Admin config | ✓ | — | — | — | — | — | — | — |
| Preview as role | ✓ | — | ✓ | — | — | — | — | — |
| RO parser | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

*Document maintained by OTV Sales Strategy & Engineering. Last updated: April 2026.*
*For questions or revisions, contact the platform team via internal channels.*
