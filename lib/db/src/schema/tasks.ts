import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id:               text("id").primaryKey(),
  title:            text("title").notNull(),
  description:      text("description"),
  assignedTo:       text("assigned_to"),
  assignedToUserId: text("assigned_to_user_id"),
  assignedDept:     text("assigned_dept"),
  repId:            integer("rep_id"),
  clientCompany:    text("client_company"),
  priority:         text("priority").default("Medium"),
  status:           text("status").default("Open"),
  dueDate:          text("due_date"),
  createdAt:        text("created_at"),
  assignedBy:       text("assigned_by"),
  assignedByName:   text("assigned_by_name"),
  fromMeetingLog:   boolean("from_meeting_log").default(false),
  actionType:       text("action_type"),
  dealId:           text("deal_id"),
  notes:            text("notes"),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const internalRequests = pgTable("internal_requests", {
  id:           text("id").primaryKey(),
  type:         text("type"),
  dept:         text("dept"),
  /** Canonical backend-owned routing role (derived from dept on creation, never overridden by client). */
  routedToRole: text("routed_to_role"),
  subject:      text("subject").notNull(),
  details:      text("details"),
  raisedBy:     text("raised_by"),
  raisedByName: text("raised_by_name"),
  repId:        integer("rep_id"),
  dealId:       text("deal_id"),
  clientCompany:text("client_company"),
  status:       text("status").default("Pending"),
  raisedAt:     text("raised_at"),
  slaHours:     integer("sla_hours").default(48),
  resolvedAt:   text("resolved_at"),
  resolverNote: text("resolver_note"),
  priority:     text("priority").default("Medium"),
  dueDate:      text("due_date"),
  notes:        text("notes"),
  acceptedAt:   text("accepted_at"),
  /**
   * IR subtype — classifies the nature of the request for typed workflow routing.
   * "Support Request" | "Deal Escalation" | "Override Request" | "Attendance Exception" | "Other"
   */
  irSubtype:    text("ir_subtype").default("Support Request"),
  /** Backend-managed escalation dept (current stop in ESC_CHAIN). */
  escDept:      text("esc_dept"),
  escalatedAt:  text("escalated_at"),
  escHistory:   jsonb("esc_history").$type<any[]>().default([]),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Daily attendance / compliance record created by the governance engine at 23:30 each day. */
export const attendanceRecords = pgTable("attendance_records", {
  id:           text("id").primaryKey(),
  userId:       text("user_id").notNull(),
  userName:     text("user_name"),
  region:       text("region"),
  date:         text("date").notNull(),
  /** "present" | "absent" | "partial" (touchpoint logged but no plan) */
  status:       text("status").notNull().default("absent"),
  /** True if the user logged a touchpoint for this date. */
  touchpointLogged: text("touchpoint_logged").default("no"),  // "yes"|"no"
  /** True if the user created a plan for tomorrow by 23:30. */
  planLogged:   text("plan_logged").default("no"),            // "yes"|"no"
  note:         text("note"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Task                = typeof tasks.$inferSelect;
export type NewTask             = typeof tasks.$inferInsert;
export type InternalRequest     = typeof internalRequests.$inferSelect;
export type NewInternalRequest  = typeof internalRequests.$inferInsert;
export type AttendanceRecord    = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
