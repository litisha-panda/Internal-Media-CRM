import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Action item type (embedded in touchpoint, routed server-side) ────────────
export type ActionItem = {
  id:          string;
  actionType:  string;  // "Approval needed" | "Document needed" | "Attend a meeting" | "Introduction needed" | "Flag for follow-up"
  details:     string;
  neededFrom:  string;  // team/person the item is assigned to
  dueDate:     string;  // ISO YYYY-MM-DD
  status:      "Open" | "In Progress" | "Done" | "Overdue" | "Escalated";
  routedTo:    string;  // "tasks" | "internal_reqs" | "plans" — where the server routed it
  routedId?:   string;  // ID of the created record in the destination table
};

// ─── touchpoints ──────────────────────────────────────────────────────────────
// Append-only log of every client interaction.
// NO edits or deletes — corrections are represented by a new correcting entry.
//
// Design rules:
//   • touchpoint_type = "Deal Meeting" → updates BOTH last_deal_meeting_date AND last_contact_date
//     on the linked client_account. The escalation clock runs on last_deal_meeting_date.
//   • All other touchpoint types → update last_contact_date ONLY on client_account.
//     last_deal_meeting_date is NEVER reset by non-Deal-Meeting touchpoints.
//   • stage_update (optional) — if provided for a Deal Meeting, the linked deal's stage
//     is updated using the same controlled transition rules as PATCH /api/deals/:id/stage.
//     Stage updates from non-Deal-Meeting touchpoints are rejected.
//   • action_items — stored as JSONB for durability. Each item is routed server-side:
//       "Approval needed"      → internal_reqs (Phase 7) + tasks
//       "Attend a meeting"     → plans (Phase 7)
//       "Document needed"      → tasks
//       "Introduction needed"  → tasks
//       "Flag for follow-up"   → tasks (self-assigned)
//     During Phase 6, items are appended to app_state arrays (bridge for Phase 7).
//     After Phase 7 tables are built, routing goes directly to the new tables.
export const touchpoints = pgTable("touchpoints", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Parent links ──────────────────────────────────────────────────────────
  clientAccountId: text("client_account_id").notNull(), // FK to client_accounts
  dealId:          text("deal_id"),                      // FK to deals (optional for non-deal touchpoints)

  // ── Rep identity ──────────────────────────────────────────────────────────
  repUserId:  text("rep_user_id").notNull(),  // UUID FK to otv_users — primary anchor
  repName:    text("rep_name").notNull(),      // denormalized
  region:     text("region").notNull(),         // denormalized
  repId:      integer("rep_id"),               // legacy integer — transitional only

  // ── Touchpoint classification ─────────────────────────────────────────────
  // Valid: "Deal Meeting" | "Relationship Touchpoint" | "Cold Call" | "Email/WhatsApp" | "RO Follow-up"
  // Alias: "Relationship" is accepted and stored as "Relationship Touchpoint" for legacy compat.
  touchpointType: text("touchpoint_type").notNull(),

  // meetingType only applies when touchpointType = "Deal Meeting"
  // Valid: "Physical" | "Online" | "Phone Call"
  meetingType: text("meeting_type"),

  // ── Timing ───────────────────────────────────────────────────────────────
  date: text("date").notNull(),  // ISO YYYY-MM-DD — when the touchpoint occurred
  time: text("time"),            // HH:MM — optional time of touchpoint

  // ── Contact ───────────────────────────────────────────────────────────────
  contactName:        text("contact_name"),
  contactDesignation: text("contact_designation"),
  contactLevel:       text("contact_level"),

  // ── Content ───────────────────────────────────────────────────────────────
  whatHappened:   text("what_happened"),   // discussion notes
  clientFeedback: text("client_feedback"),

  // ── Stage update ──────────────────────────────────────────────────────────
  // Only valid for Deal Meeting touchpoints. Validated using the same controlled
  // transition rules as PATCH /api/deals/:id/stage (no free jumps, terminal lock, etc).
  // If provided and the deal stage changes, the deal row is updated atomically.
  stageUpdate:    text("stage_update"),
  lossReason:     text("loss_reason"),  // required when stageUpdate = "Lost"

  // ── Action items ──────────────────────────────────────────────────────────
  // JSONB array of ActionItem objects. Routed server-side at creation.
  // The `routedTo` and `routedId` fields on each item track where the item was sent.
  actionItems: jsonb("action_items").$type<ActionItem[]>().default([]),

  // ── Logging metadata ──────────────────────────────────────────────────────
  loggedAt:       text("logged_at").notNull(),    // HH:MM when the log was submitted
  loggedLate:     boolean("logged_late").notNull().default(false), // logged after 23:30
  loggedByUserId: text("logged_by_user_id").notNull(), // may differ from repUserId if RH logs on behalf

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Touchpoint    = typeof touchpoints.$inferSelect;
export type NewTouchpoint = typeof touchpoints.$inferInsert;
