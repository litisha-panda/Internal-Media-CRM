import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── plans ────────────────────────────────────────────────────────────────────
// Scheduled and auto-created meeting plans for each rep.
// Created by:
//   1. Rep via My Plan "+ Plan Meeting" form (POST /api/plans)
//   2. Auto-created from meeting log next-step / next-meeting / follow-up dates
//   3. Action item routing — "Attend a meeting" type (from POST /api/touchpoints)
//   4. RO reminder buttons in the revenue log modal
//
// Status lifecycle (server-enforced at PATCH /api/plans/:id):
//   Planned → Done | Cancelled | Confirmed | Declined
//   Confirmed → Done | Cancelled
//   Done → [terminal]
//
// Role scoping (GET /api/plans):
//   SALES REP      — plans where rep_id = user.repId OR rep_user_id = user.id
//   REGION HEAD    — plans where region = user.region
//   Global roles   — all plans

export const plans = pgTable("plans", {
  id:                text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Rep identity
  repUserId:         text("rep_user_id"),           // UUID FK to otv_users; null for NSH-level plans
  repName:           text("rep_name"),
  region:            text("region"),
  repId:             integer("rep_id"),              // legacy integer repId for frontend compatibility

  // Meeting details
  date:              text("date").notNull(),          // ISO YYYY-MM-DD
  time:              text("time"),                    // HH:MM
  clientAgencyName:  text("client_agency_name"),
  contactName:       text("contact_name"),
  phone:             text("phone"),
  agenda:            text("agenda"),
  pitchType:         text("pitch_type"),
  meetingType:       text("meeting_type"),            // Physical | Online | Phone Call | Task | Call

  // Status
  status:            text("status").notNull().default("Planned"),
  loggedMeetingId:   text("logged_meeting_id"),       // ID of the meeting record once logged

  // Flags
  isUnplanned:       boolean("is_unplanned").notNull().default(false),
  needsMeet:         boolean("needs_meet").notNull().default(false),

  // Source tracking
  autoCreatedFrom:   text("auto_created_from"),       // action-item | next-step | next-meeting | follow-up | ro-reminder
  assignedByName:    text("assigned_by_name"),
  assignedDept:      text("assigned_dept"),

  // Linkage
  dealId:            text("deal_id"),
  touchpointId:      text("touchpoint_id"),

  // Meeting request fields (for "Attend a meeting" cross-rep assigns)
  requestedBy:       integer("requested_by"),         // repId of the requesting rep
  requestedByName:   text("requested_by_name"),

  // Audit
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Plan    = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
