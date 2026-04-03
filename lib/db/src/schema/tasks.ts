import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── tasks ────────────────────────────────────────────────────────────────────
// Backend-owned task records. Created server-side when a touchpoint's action
// items are routed at POST /api/touchpoints. Also supports manual creation
// (future: Phase 8 frontend cutover).
//
// Status transitions (server-enforced at PATCH /api/tasks/:id/status):
//   Open        → In Progress  (any role with write access)
//   Open        → Done         (any role with write access)
//   In Progress → Done         (any role with write access)
//   In Progress → Open         (reopen — any role with write access)
//   Done        → [terminal]   (no further transitions allowed)
//   Escalated   → can be SET from Open or In Progress by RH / Admin / NSH only
//   Overdue     → set automatically (future scheduled job) or manually by RH/Admin;
//                 Overdue tasks can still be moved to Done or In Progress
//
// Role scoping (GET /api/tasks):
//   SALES REP      — tasks where assigned_by_user_id = me OR assigned_to_user_id = me
//   REGION HEAD    — tasks where region = me.region
//   All other roles — all tasks
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Classification ────────────────────────────────────────────────────────
  // action_type mirrors one of the 5 ACTION_TYPES from the frontend.
  // Values: "Document needed" | "Introduction needed" | "Flag for follow-up"
  //         | "Approval needed" | "Attend a meeting"
  // (Approval needed + Attend a meeting may also produce a task as a secondary record)
  actionType: text("action_type").notNull(),

  title:       text("title").notNull(),
  description: text("description"),
  priority:    text("priority").notNull().default("High"), // "High" | "Normal" | "Low"

  // ── Status ────────────────────────────────────────────────────────────────
  // Valid values: "Open" | "In Progress" | "Done" | "Overdue" | "Escalated"
  status:          text("status").notNull().default("Open"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  statusChangedBy: text("status_changed_by"), // FK to otv_users — who made the last status change

  dueDate: text("due_date"), // ISO YYYY-MM-DD

  // ── Assignment ────────────────────────────────────────────────────────────
  assignedByUserId:  text("assigned_by_user_id").notNull(), // FK to otv_users — rep who created it
  assignedByName:    text("assigned_by_name").notNull(),    // denormalized
  assignedToUserId:  text("assigned_to_user_id"),           // FK to otv_users — nullable (broadcast to dept)
  assignedDept:      text("assigned_dept"),                 // "Self" | "RH" | "NSH" | "Finance" etc.

  // ── Context ───────────────────────────────────────────────────────────────
  clientCompany: text("client_company"),
  dealId:        text("deal_id"),         // FK to deals — nullable
  touchpointId:  text("touchpoint_id"),   // FK to touchpoints — the source touchpoint (nullable for manual tasks)
  fromMeetingLog: boolean("from_meeting_log").notNull().default(false),

  // ── Rep identity (for role scoping) ──────────────────────────────────────
  region: text("region"),  // denormalized from rep — used for RH scope filter
  repId:  integer("rep_id"), // legacy integer — transitional

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Task    = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
