import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const appStateTable = pgTable("app_state", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // Allows efficient queries that filter/sort by last-modified time,
  // e.g. detecting which keys changed since a given timestamp.
  index("app_state_updated_at_idx").on(t.updatedAt),
]);

export type AppState = typeof appStateTable.$inferSelect;
