import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Touchpoints — immutable log entries.
 * Only `action_items` may be appended/updated (never deleted).
 * Relationship touchpoints do NOT update lastDealMeetingDate on clientAccounts.
 */
export const touchpoints = pgTable("touchpoints", {
  id:                 text("id").primaryKey(),
  clientAccountId:    text("client_account_id"),
  dealId:             text("deal_id"),
  repId:              integer("rep_id").notNull(),
  date:               text("date"),
  time:               text("time"),
  meetingType:        text("meeting_type"),
  touchpointType:     text("touchpoint_type").default("Deal Meeting"),
  contactName:        text("contact_name"),
  contactDesignation: text("contact_designation"),
  contactLevel:       text("contact_level"),
  whatHappened:       text("what_happened"),
  clientFeedback:     text("client_feedback"),
  stageUpdate:        text("stage_update"),
  actionItems:        jsonb("action_items").$type<any[]>().default([]),
  loggedAt:           text("logged_at"),
  loggedLate:         boolean("logged_late").default(false),
  loggedByUserId:     text("logged_by_user_id"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Touchpoint    = typeof touchpoints.$inferSelect;
export type NewTouchpoint = typeof touchpoints.$inferInsert;
