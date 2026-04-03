import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── target_submissions ──────────────────────────────────────────────────────
// One row per submission. Status advances through the approval chain.
// frozen_quota is set exactly once — on CRO approval — and never changes after.
// add-opportunity entries have is_additional_rev_op=true and bypass the chain.
//
// Identity hierarchy:
//   rep_user_id    (text, FK → otv_users.id)   ← PRIMARY IDENTITY ANCHOR
//   submitted_by_user_id (text, FK → otv_users.id)  ← who clicked Submit (usually = rep_user_id)
//   rep_id         (integer, nullable)          ← TRANSITIONAL ONLY — legacy integer compat
//   rep_name       (text)                       ← denormalized for convenience, not authority
//   region         (text)                       ← denormalized for convenience, not authority
//     (rep_name and region are derived from otv_users at write time for read-performance;
//      source of truth is always the otv_users row pointed to by rep_user_id)
export const targetSubmissions = pgTable("target_submissions", {
  id:                 text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Identity (source of truth) ─────────────────────────────────────────────
  // Primary owner: the sales rep this submission belongs to.
  repUserId:          text("rep_user_id").notNull(),

  // Who submitted the form (= repUserId in self-service; may differ if future admin-assist flow)
  submittedByUserId:  text("submitted_by_user_id").notNull(),
  submittedByRole:    text("submitted_by_role").notNull(),

  // ── Denormalized convenience fields (not authority) ────────────────────────
  // Written once at creation from otv_users; never updated independently.
  repName:            text("rep_name").notNull(),
  region:             text("region").notNull(),

  // ── Transitional compat field ──────────────────────────────────────────────
  // Legacy integer repId from the old frontend USER_ROLES array.
  // Kept only to join with localStorage deals during Phase 8 cutover.
  // Will be dropped or made fully nullable after Phase 8.
  repId:              integer("rep_id"),

  // ── Temporal scope ─────────────────────────────────────────────────────────
  quarter:            text("quarter").notNull(),
  fiscalYear:         text("fiscal_year").notNull(),

  // ── Approval state ─────────────────────────────────────────────────────────
  // Status: Pending RH | Pending NSH | Pending Strategy | Pending CRO | Approved | Rejected
  status:             text("status").notNull().default("Pending RH"),

  // ── Monetary amounts (whole rupees) ────────────────────────────────────────
  totalTarget:        integer("total_target").notNull(),

  // Set ONLY on CRO approval. Never changes after that.
  // add-opportunity submissions have this null (they carry their own total_target,
  // but no CRO-frozen quota — they are a separate revenue object, not a quota change).
  frozenQuota:        integer("frozen_quota"),

  // ── add-opportunity marker ─────────────────────────────────────────────────
  // True for submissions created via add-opportunity after a quota freeze.
  // These are auto-approved and do NOT go through the approval chain.
  // They must NEVER be mixed with official frozen_quota totals in backend logic.
  isAdditionalRevOp:  boolean("is_additional_rev_op").notNull().default(false),

  // UUID of the Approved+frozen parent submission this opportunity extends (nullable).
  parentSubmissionId: text("parent_submission_id"),

  // ── Audit log ──────────────────────────────────────────────────────────────
  // Array of { step, byUserId, byName, byRole, at, action, note }
  approvalLog:        jsonb("approval_log").notNull().default(sql`'[]'::jsonb`),

  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TargetSubmission    = typeof targetSubmissions.$inferSelect;
export type NewTargetSubmission = typeof targetSubmissions.$inferInsert;
