import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Activity Ledger — append-only audit trail for all significant workflow events.
 * Never update or delete rows. Only INSERT.
 *
 * action examples:
 *   deal.created | deal.stage_changed | deal.at_risk_flagged
 *   revenue.entry_created | revenue.entry_reversed
 *   target.submitted | target.approved | target.rejected
 *   task.created | task.completed | task.overdue_flagged
 *   ir.raised | ir.accepted | ir.resolved | ir.escalated
 *   attendance.absent | attendance.present
 */
export const activityLog = pgTable("activity_log", {
  id:         text("id").primaryKey(),
  userId:     text("user_id"),
  userName:   text("user_name"),
  userRole:   text("user_role"),
  region:     text("region"),
  action:     text("action").notNull(),
  entityType: text("entity_type"),
  entityId:   text("entity_id"),
  meta:       jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ActivityLogEntry    = typeof activityLog.$inferSelect;
export type NewActivityLogEntry = typeof activityLog.$inferInsert;
