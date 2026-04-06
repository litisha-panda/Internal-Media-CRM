import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * In-app notifications.
 * Created by the governance engine and workflow routes.
 * Never mutated except `read` flag set to true by the recipient.
 *
 * type examples:
 *   "task_assigned" | "task_due_soon" | "task_overdue"
 *   "deal_at_risk" | "deal_awaiting_approval"
 *   "target_approved" | "target_rejected" | "target_needs_approval"
 *   "ir_raised" | "ir_accepted" | "ir_resolved" | "ir_escalated"
 *   "attendance_absent"
 */
export const notifications = pgTable("notifications", {
  id:         text("id").primaryKey(),
  userId:     text("user_id").notNull(),
  type:       text("type").notNull(),
  title:      text("title").notNull(),
  body:       text("body"),
  entityType: text("entity_type"),
  entityId:   text("entity_id"),
  read:       boolean("read").notNull().default(false),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Notification    = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
