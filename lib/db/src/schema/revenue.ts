import { pgTable, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Revenue entries — IMMUTABLE except `notes`.
 * Corrections are made via reversal entries (negative amount + reversal_of FK).
 * Never update amount, client, rep, or date after creation.
 *
 * idempotencyKey: optional client-supplied key to prevent duplicate submissions.
 * The API rejects (409) a second POST with the same idempotencyKey.
 */
export const revenueEntries = pgTable("revenue_entries", {
  id:             text("id").primaryKey(),
  idempotencyKey: text("idempotency_key"),
  repId:         integer("rep_id").notNull(),
  region:        text("region"),
  clientCompany: text("client_company").notNull(),
  zohoAccountId: text("zoho_account_id"),
  dealType:      text("deal_type"),
  amount:        integer("amount").notNull().default(0),
  invoiceRef:    text("invoice_ref"),
  date:          text("date"),
  quarter:       text("quarter"),
  fiscalYear:    text("fiscal_year").default("FY26"),
  notes:         text("notes"),
  isReversed:    boolean("is_reversed").notNull().default(false),
  reversalOf:    text("reversal_of"),
  dealId:        text("deal_id"),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  unique("revenue_entries_idempotency_key_unique").on(t.idempotencyKey),
]);

export type RevenueEntry    = typeof revenueEntries.$inferSelect;
export type NewRevenueEntry = typeof revenueEntries.$inferInsert;
