import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const targetSubmissions = pgTable("target_submissions", {
  id:              text("id").primaryKey(),
  repId:           integer("rep_id").notNull(),
  repName:         text("rep_name").notNull(),
  region:          text("region"),
  quarter:         text("quarter").notNull(),
  clients:         jsonb("clients").$type<any[]>().notNull().default([]),
  totalTarget:     integer("total_target").notNull().default(0),
  status:          text("status").notNull().default("Pending RH"),
  submittedAt:     text("submitted_at"),
  submittedByName: text("submitted_by_name"),
  submittedByRole: text("submitted_by_role"),
  approvalLog:     jsonb("approval_log").$type<any[]>().notNull().default([]),
  frozenTarget:    integer("frozen_target"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type TargetSubmission    = typeof targetSubmissions.$inferSelect;
export type NewTargetSubmission = typeof targetSubmissions.$inferInsert;
