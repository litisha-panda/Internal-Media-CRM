import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Revenue entries — IMMUTABLE except `notes`.
 * Corrections are made via reversal entries (negative amount + reversal_of FK).
 * Never update amount, client, rep, or date after creation.
 */
export const revenueEntries = pgTable("revenue_entries", {
  id:            text("id").primaryKey(),
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
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type RevenueEntry    = typeof revenueEntries.$inferSelect;
export type NewRevenueEntry = typeof revenueEntries.$inferInsert;
