import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", {
  id:           serial("id").primaryKey(),
  timestamp:    timestamp("timestamp", { withTimezone: true }).defaultNow(),
  actorId:      text("actor_id"),
  action:       text("action").notNull(),
  targetUserId: text("target_user_id"),
  details:      text("details"),
});

export type AuditLogEntry    = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
