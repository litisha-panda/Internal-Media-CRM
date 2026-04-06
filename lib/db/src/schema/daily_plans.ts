import { pgTable, text, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Daily Plans — one record per rep per calendar date.
 * Created/updated when a rep (or RH) saves their tomorrow plan.
 * Governance checks this at 23:30 IST as part of compliance.
 *
 * planDate: YYYY-MM-DD (the date being planned FOR, i.e. tomorrow when created)
 * items:    array of plan items e.g. [{clientName, note, type}]
 */
export const dailyPlans = pgTable("daily_plans", {
  id:          text("id").primaryKey(),
  userId:      text("user_id").notNull(),
  repId:       integer("rep_id"),
  userRole:    text("user_role"),
  region:      text("region"),
  planDate:    text("plan_date").notNull(),   // YYYY-MM-DD — the date being planned for
  items:       jsonb("items").$type<any[]>().default([]),
  itemCount:   integer("item_count").default(0),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("daily_plans_user_date_unique").on(t.userId, t.planDate),
]);

export type DailyPlan    = typeof dailyPlans.$inferSelect;
export type NewDailyPlan = typeof dailyPlans.$inferInsert;
