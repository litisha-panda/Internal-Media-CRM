import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── deals ────────────────────────────────────────────────────────────────────
// Represents a single revenue opportunity against a client_account.
// One client_account can have multiple deals (e.g. different deal types or quarters).
//
// Design rules:
//   • deal = opportunity, not achieved revenue. ACHIEVED comes from revenue_entries only.
//   • amount = the rep's estimate of the deal value (whole rupees). This is an expected
//     opportunity value only — it does NOT flow into ACHIEVED under any circumstances.
//   • pipelineAmount and targetAmount are intentionally absent. Do not add them.
//     COMMITTED and IN PLAY are derived at query time from deals.amount filtered by stage.
//     targetAmount belongs to target_submissions / target_clients.
//   • stage transitions are controlled server-side. RO Received requires a linked
//     revenue entry. Non-admin roles may not jump stages or regress.
//   • lastDealMeetingDate is absent from this table. It lives on client_accounts
//     and is updated exclusively by the touchpoints route (Phase 6).
//   • lossReason is required when stage is set to "Lost".
export const deals = pgTable("deals", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Parent relationship ───────────────────────────────────────────────────
  clientAccountId:    text("client_account_id").notNull(), // FK to client_accounts

  // ── Rep identity ──────────────────────────────────────────────────────────
  repUserId:          text("rep_user_id").notNull(),    // UUID FK to otv_users — primary anchor
  repName:            text("rep_name").notNull(),        // denormalized
  region:             text("region").notNull(),           // denormalized
  repId:              integer("rep_id"),                  // legacy integer — transitional only

  // ── Client (denormalized from client_account for read performance) ────────
  clientCompany:      text("client_company").notNull(),
  zohoAccountId:      text("zoho_account_id"),

  // ── Deal classification ───────────────────────────────────────────────────
  dealType:           text("deal_type").notNull(),        // Linear TV | IPs | Digital | Media Solutions | Integrated Packages
  quarter:            text("quarter").notNull(),           // e.g. "Q1 FY26"
  priority:           text("priority").notNull().default("Regular"), // Regular | High | Strategic

  // ── Opportunity value ─────────────────────────────────────────────────────
  // Expected deal value in whole rupees. This is an estimate ONLY.
  // It does NOT represent achieved revenue. ACHIEVED = revenue_entries.amount.
  // pipelineAmount and targetAmount are intentionally omitted.
  amount:             integer("amount"),                   // nullable — rep may not know yet

  // ── Stage ─────────────────────────────────────────────────────────────────
  // Valid stages: Prospect | In Discussion | Negotiation | Mail Confirmed | RO Received | Lost
  // RO Received may only be set when a revenue_entry with deal_id = this.id exists.
  // Lost requires lossReason.
  stage:              text("stage").notNull().default("Prospect"),
  lossReason:         text("loss_reason"),                // required when stage = Lost

  // ── Contact details ───────────────────────────────────────────────────────
  contactName:        text("contact_name"),
  designation:        text("designation"),
  contactLevel:       text("contact_level"),
  phone:              text("phone"),
  email:              text("email"),

  // ── Agency ───────────────────────────────────────────────────────────────
  agencyName:         text("agency_name"),
  zohoAgencyId:       text("zoho_agency_id"),

  // ── Planning ─────────────────────────────────────────────────────────────
  nextStep:           text("next_step"),
  nextStepDate:       text("next_step_date"),             // ISO YYYY-MM-DD

  // ── Notes ────────────────────────────────────────────────────────────────
  notes:              text("notes"),

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdByUserId:    text("created_by_user_id").notNull(),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Deal    = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
