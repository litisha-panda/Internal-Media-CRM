import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── target_clients ──────────────────────────────────────────────────────────
// Child rows of a target_submission. Each row is one client/deal-type target
// line item in the rep's submission plan.
//
// target_amount: the rep's stated target for this client line — stored in whole
// rupees. This is a planning figure, not an annual profile field (hence the name
// is target_amount, not annual_target). The total across all rows must equal
// target_submissions.total_target for the parent submission.
export const targetClients = pgTable("target_clients", {
  id:           text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  submissionId: text("submission_id").notNull(),
  clientName:   text("client_name").notNull(),
  dealType:     text("deal_type").notNull(),
  targetAmount: integer("target_amount").notNull(),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TargetClient    = typeof targetClients.$inferSelect;
export type NewTargetClient = typeof targetClients.$inferInsert;
