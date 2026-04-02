import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sessions = pgTable("otv_sessions", {
  token:     text("token").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Session    = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
