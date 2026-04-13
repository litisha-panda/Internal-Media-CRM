import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Target Client Allocations — normalized line items for target submissions.
 *
 * One row per client per target submission.
 * Replaces the JSONB `clients` array in targetSubmissions as the source of truth
 * for client-level accounting. The parent `totalTarget` field on the submission
 * should always equal the SUM of allocatedAmount across all rows for that submission.
 *
 * This table enables:
 *   - SQL-level channel and dealType breakdowns without parsing JSONB
 *   - Aggregation queries (e.g. SUM per channel, per dealType, per region)
 *   - Audit trail per allocation (immutable after submission is approved)
 */
export const targetAllocations = pgTable("target_allocations", {
  id:              text("id").primaryKey(),
  submissionId:    text("submission_id").notNull(),  // FK → target_submissions.id
  repId:           integer("rep_id"),
  region:          text("region"),
  quarter:         text("quarter"),

  clientName:      text("client_name").notNull(),
  allocatedAmount: integer("allocated_amount").notNull().default(0),
  channel:         text("channel"),          // e.g. "TV Spot", "Sponsorship", "Digital"
  dealType:        text("deal_type"),        // from DEAL_TYPES
  notes:           text("notes"),

  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TargetAllocation    = typeof targetAllocations.$inferSelect;
export type NewTargetAllocation = typeof targetAllocations.$inferInsert;
