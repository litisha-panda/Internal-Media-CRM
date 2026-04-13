import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Meetings — one row per scheduled client meeting.
 *
 * Created when a Sales Rep plans a meeting (today or tomorrow).
 * Status transitions: planned → logged | missed | cancelled
 * When logged, touchpointId is set (FK to touchpoints.id).
 *
 * meetingKind:
 *   "PR"         — relationship meeting, lightweight fields only
 *   "ACTIONABLE" — deal/pipeline meeting, full field set
 */
export const meetings = pgTable("meetings", {
  id:             text("id").primaryKey(),
  userId:         text("user_id").notNull(),
  repId:          integer("rep_id"),
  region:         text("region"),

  date:           text("date").notNull(),         // YYYY-MM-DD
  time:           text("time"),                   // HH:MM

  meetingKind:    text("meeting_kind").notNull().default("ACTIONABLE"), // "PR" | "ACTIONABLE"

  agencyName:     text("agency_name"),
  clientName:     text("client_name").notNull().default(""),
  brandName:      text("brand_name"),

  contactName:    text("contact_name"),
  contactPhone:   text("contact_phone"),
  designation:    text("designation"),
  contactEmail:   text("contact_email"),

  mode:           text("mode"),                   // "Physical" | "Online" | "Phone Call"
  actionableType: text("actionable_type"),         // e.g. "Pitch / Introduction"
  agenda:         text("agenda"),

  /** planned | logged | missed | cancelled */
  status:         text("status").notNull().default("planned"),

  /** Set when the rep logs this meeting — links back to the touchpoint created. */
  touchpointId:   text("touchpoint_id"),

  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Meeting    = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
