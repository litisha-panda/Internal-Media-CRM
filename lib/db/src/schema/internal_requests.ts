import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── internal_requests ────────────────────────────────────────────────────────
// Backend-owned internal request records. Created server-side when a touchpoint
// action item of type "Approval needed" or "Introduction needed" is routed at
// POST /api/touchpoints.
//
// Status transitions (server-enforced):
//   Pending    → In Review   (RH / Admin — any assignment of ownership)
//   Pending    → Resolved    (Admin only — direct fast-track)
//   Pending    → Rejected    (Admin only — direct reject)
//   Pending    → Withdrawn   (Raiser — rep/RH withdraws the original request)
//   In Review  → Resolved    (RH / Admin — requires resolverNote)
//   In Review  → Rejected    (RH / Admin — requires resolverNote)
//   In Review  → Withdrawn   (Raiser — rep/RH withdraws the original request)
//   Resolved   → [terminal]
//   Rejected   → [terminal]
//   Withdrawn  → [terminal]
//
// Dedicated endpoints:
//   PATCH /api/internal-requests/:id/resolve   — moves to Resolved; requires resolverNote
//   PATCH /api/internal-requests/:id/reject    — moves to Rejected; requires resolverNote
//   PATCH /api/internal-requests/:id/withdraw  — moves to Withdrawn (raiser or RH/Admin)
//   PATCH /api/internal-requests/:id/escalate  — creates new Escalation IR at higher dept,
//                                                 marks original Withdrawn
//
// Role scoping (GET /api/internal-requests):
//   SALES REP      — IRs they raised (raised_by_user_id = me)
//   REGION HEAD    — IRs in their region
//   All other roles — all IRs
export const internalRequests = pgTable("internal_requests", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // ── Classification ────────────────────────────────────────────────────────
  // Valid: "Approval needed" | "Introduction needed" | "Document needed"
  // Note: "Document needed" produces BOTH a task and an IR; others produce IR only.
  type:    text("type").notNull(),
  dept:    text("dept"),      // team/dept the request is directed to
  subject: text("subject").notNull(),
  details: text("details"),

  // ── Requester ────────────────────────────────────────────────────────────
  raisedByUserId: text("raised_by_user_id").notNull(), // FK to otv_users
  raisedByName:   text("raised_by_name").notNull(),    // denormalized
  repId:          integer("rep_id"),                    // legacy integer — transitional

  // ── Context ───────────────────────────────────────────────────────────────
  clientCompany: text("client_company"),
  dealId:        text("deal_id"),         // FK to deals — nullable
  touchpointId:  text("touchpoint_id"),   // FK to touchpoints — the source touchpoint

  // ── Rep identity (for role scoping) ──────────────────────────────────────
  region: text("region"),  // denormalized from rep — used for RH scope filter

  // ── Status ────────────────────────────────────────────────────────────────
  // Valid: "Pending" | "In Review" | "Resolved" | "Rejected"
  status:       text("status").notNull().default("Pending"),
  raisedAt:     text("raised_at").notNull(), // ISO YYYY-MM-DD
  slaHours:     integer("sla_hours").notNull().default(48),

  // ── Resolution ────────────────────────────────────────────────────────────
  resolvedAt:    text("resolved_at"),                                     // ISO YYYY-MM-DD
  resolvedBy:    text("resolved_by"),                                     // FK to otv_users
  resolverNote:  text("resolver_note"),                                   // required on resolve/reject

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InternalRequest    = typeof internalRequests.$inferSelect;
export type NewInternalRequest = typeof internalRequests.$inferInsert;
