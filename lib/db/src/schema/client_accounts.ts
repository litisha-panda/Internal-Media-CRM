import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── client_accounts ──────────────────────────────────────────────────────────
// Represents a sales relationship between a rep and a client company.
// One client_account per (repUserId × clientName) pair.
//
// Design rules:
//   • client_account = relationship, not revenue. No commercial/monetary values stored here.
//     Target amounts live in target_submissions. Revenue lives in revenue_entries.
//   • currentStage = the current relationship stage — advanced via this table's PATCH route
//     or automatically when a deal advances. ADMIN can set any stage; reps/RH advance only.
//   • lastDealMeetingDate / lastContactDate are the escalation clock fields.
//     They MUST NOT be set via this route. They are updated exclusively by the
//     touchpoints route (Phase 6). This enforcement is structural — those fields
//     are present on the table (read-only here) but absent from every write path.
//   • annualTarget is intentionally absent — do not add it. Target amounts are
//     owned by target_submissions and linked via targetAmount on target_clients.
export const clientAccounts = pgTable("client_accounts", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Rep identity ──────────────────────────────────────────────────────────
  repUserId:          text("rep_user_id").notNull(),    // UUID FK to otv_users — primary anchor
  repName:            text("rep_name").notNull(),        // denormalized
  region:             text("region").notNull(),           // denormalized
  repId:              integer("rep_id"),                  // legacy integer — transitional only

  // ── Client identity ───────────────────────────────────────────────────────
  clientName:         text("client_name").notNull(),
  zohoAccountId:      text("zoho_account_id"),           // optional Zoho CRM link

  // ── Relationship stage ────────────────────────────────────────────────────
  // Valid values: Prospect | In Discussion | Negotiation | Mail Confirmed | RO Received | Lost
  currentStage:       text("current_stage").notNull().default("Prospect"),

  // ── Escalation clock fields ───────────────────────────────────────────────
  // READ-ONLY from this route. Set exclusively by POST /api/touchpoints (Phase 6).
  // lastDealMeetingDate is reset only by Deal Meeting touchpoints.
  // lastContactDate is reset by any touchpoint type.
  lastContactDate:    text("last_contact_date"),         // ISO YYYY-MM-DD
  lastDealMeetingDate: text("last_deal_meeting_date"),   // ISO YYYY-MM-DD — escalation clock

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdByUserId:    text("created_by_user_id").notNull(),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ClientAccount    = typeof clientAccounts.$inferSelect;
export type NewClientAccount = typeof clientAccounts.$inferInsert;
