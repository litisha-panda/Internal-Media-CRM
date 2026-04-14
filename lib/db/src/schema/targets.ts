import { pgTable, text, integer, jsonb, timestamp, numeric } from "drizzle-orm/pg-core";

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
  // Monthly breakdown columns (Indian FY: April–March)
  april:           numeric("april",     { precision: 15, scale: 2 }).notNull().default("0"),
  may:             numeric("may",       { precision: 15, scale: 2 }).notNull().default("0"),
  june:            numeric("june",      { precision: 15, scale: 2 }).notNull().default("0"),
  july:            numeric("july",      { precision: 15, scale: 2 }).notNull().default("0"),
  august:          numeric("august",    { precision: 15, scale: 2 }).notNull().default("0"),
  september:       numeric("september", { precision: 15, scale: 2 }).notNull().default("0"),
  october:         numeric("october",   { precision: 15, scale: 2 }).notNull().default("0"),
  november:        numeric("november",  { precision: 15, scale: 2 }).notNull().default("0"),
  december:        numeric("december",  { precision: 15, scale: 2 }).notNull().default("0"),
  january:         numeric("january",   { precision: 15, scale: 2 }).notNull().default("0"),
  february:        numeric("february",  { precision: 15, scale: 2 }).notNull().default("0"),
  march:           numeric("march",     { precision: 15, scale: 2 }).notNull().default("0"),
});

export type TargetSubmission    = typeof targetSubmissions.$inferSelect;
export type NewTargetSubmission = typeof targetSubmissions.$inferInsert;
