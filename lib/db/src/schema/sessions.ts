import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sessions = pgTable("otv_sessions", {
  token:     text("token").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  // Without this index, DELETE WHERE userId = ? performs a full table scan.
  // At scale (many sessions) this causes table locks on every logout.
  index("otv_sessions_user_id_idx").on(t.userId),
  // Index on expiresAt allows fast pruning of expired sessions in createSession()
  index("otv_sessions_expires_at_idx").on(t.expiresAt),
]);

export type Session    = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
