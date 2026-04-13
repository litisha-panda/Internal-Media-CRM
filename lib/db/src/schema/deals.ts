import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Deals — no hard delete; use stage="Lost" or status="Archived".
 * pipeline_amount is NEVER stored — it is derived at read time:
 *   pipeline_amount = amount × STAGE_PROB[stage] / 100
 */
export const deals = pgTable("deals", {
  id:                    text("id").primaryKey(),
  repId:                 integer("rep_id").notNull(),
  repName:               text("rep_name"),
  region:                text("region"),
  clientCompany:         text("client_company").notNull(),
  clientAccountId:       text("client_account_id"),
  contactName:           text("contact_name"),
  designation:           text("designation"),
  contactLevel:          text("contact_level"),
  phone:                 text("phone"),
  email:                 text("email"),
  dealType:              text("deal_type"),
  stage:                 text("stage").default("Prospect"),
  outcome:               text("outcome").default("Prospect"),
  amount:                integer("amount").default(0),
  targetAmount:          integer("target_amount").default(0),
  lossReason:            text("loss_reason"),
  priority:              text("priority").default("Regular"),
  quarter:               text("quarter"),
  notes:                 text("notes"),
  nextStep:              text("next_step"),
  nextStepDate:          text("next_step_date"),
  agencyName:            text("agency_name"),
  lastContact:           text("last_contact"),
  lastDealMeetingDate:   text("last_deal_meeting_date"),
  atRisk:                boolean("at_risk").default(false),
  awaitingApproval:      text("awaiting_approval"),
  awaitingApprovalSince: text("awaiting_approval_since"),
  reqs:                  jsonb("reqs").$type<any[]>().default([]),
  auditLog:              jsonb("audit_log").$type<any[]>().default([]),
  createdAt:             timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const clientAccounts = pgTable("client_accounts", {
  id:                  text("id").primaryKey(),
  clientName:          text("client_name").notNull(),
  repId:               integer("rep_id").notNull(),
  region:              text("region"),
  fiscalYear:          text("fiscal_year").default("FY26"),
  annualTarget:        integer("annual_target").default(0),
  currentStage:        text("current_stage").default("Prospect"),
  lastContactDate:     text("last_contact_date"),
  lastDealMeetingDate: text("last_deal_meeting_date"),
  createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Deal           = typeof deals.$inferSelect;
export type NewDeal        = typeof deals.$inferInsert;
export type ClientAccount    = typeof clientAccounts.$inferSelect;
export type NewClientAccount = typeof clientAccounts.$inferInsert;
