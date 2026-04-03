import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── revenue_entries ──────────────────────────────────────────────────────────
// Append-only ledger of actual revenue booked.
//
// GOLDEN RULE: ACHIEVED = SUM(amount) over this table, scoped by rep/quarter/FY.
// Never read achieved from deal stage, pipeline amounts, or any other source.
//
// Immutability rules:
//   • amount, invoice_ref, rep identity, date — written once, NEVER updated.
//   • notes — the only field that may be PATCH-ed after creation.
//   • Corrections are made via POST /:id/reverse, which creates a new row
//     with is_reversal=true and a negative amount (offsetting the original).
//     The original row is left intact in the ledger.
//
// Achieved calculation:
//   ACHIEVED = SUM(amount) for all entries in scope (positive normal entries
//   plus negative reversal entries cancel out naturally — no special exclusion
//   logic needed).
export const revenueEntries = pgTable("revenue_entries", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Rep identity (same anchor pattern as target_submissions) ───────────────
  // rep_user_id is the PRIMARY identity anchor — UUID FK to otv_users.id.
  // rep_id (integer) is the legacy transitional field only (drops at Phase 8).
  // rep_name / region are denormalized convenience copies written once at insert.
  repUserId:        text("rep_user_id").notNull(),
  repName:          text("rep_name").notNull(),
  region:           text("region").notNull(),
  repId:            integer("rep_id"),              // transitional — nullable

  // ── Client ────────────────────────────────────────────────────────────────
  clientCompany:    text("client_company").notNull(),
  zohoAccountId:    text("zoho_account_id"),        // optional Zoho CRM link
  clientAccountId:  text("client_account_id"),      // optional FK to otv_clientAccounts
  dealId:           text("deal_id"),                // optional FK to deals (localStorage during Phase 8)

  // ── Revenue classification ────────────────────────────────────────────────
  dealType:         text("deal_type").notNull(),    // "Linear TV" | "IPs" | "Digital" | "Media Solutions" | "Integrated Packages"
  channel:          text("channel"),                // e.g. "OTV", "OTV HD"

  // ── Financials — IMMUTABLE after creation ─────────────────────────────────
  // Stored in whole rupees.
  // Normal entries: amount > 0.
  // Reversal entries: amount < 0 (system-created negative offset of the original).
  amount:           integer("amount").notNull(),

  invoiceRef:       text("invoice_ref"),            // PO / RO reference — immutable after creation

  // ── Temporal scope — IMMUTABLE after creation ─────────────────────────────
  date:             text("date").notNull(),          // ISO YYYY-MM-DD — the booking date
  quarter:          text("quarter").notNull(),       // e.g. "Q1 FY26"
  fiscalYear:       text("fiscal_year").notNull(),   // e.g. "FY26"

  // ── The ONLY mutable field ────────────────────────────────────────────────
  notes:            text("notes"),

  // ── Reversal metadata ─────────────────────────────────────────────────────
  // is_reversal = true means this row is a system-created negative offset.
  // reversal_of_id points to the original entry being cancelled.
  // reversal entries are created ONLY via POST /:id/reverse — never manually.
  isReversal:       boolean("is_reversal").notNull().default(false),
  reversalOfId:     text("reversal_of_id"),         // ID of the entry this reverses (nullable on normal entries)
  reversedByUserId: text("reversed_by_user_id"),    // user who triggered the reversal

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdByUserId:  text("created_by_user_id").notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RevenueEntry    = typeof revenueEntries.$inferSelect;
export type NewRevenueEntry = typeof revenueEntries.$inferInsert;
