import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const appStateTable = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppState = typeof appStateTable.$inferSelect;
