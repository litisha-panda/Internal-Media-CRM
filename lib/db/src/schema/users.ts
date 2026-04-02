import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("otv_users", {
  id:            text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  name:          text("name").notNull(),
  email:         text("email").unique().notNull(),
  passwordHash:  text("password_hash").notNull(),
  role:          text("role").notNull(),
  region:        text("region"),
  repId:         integer("rep_id"),
  status:        text("status").notNull().default("pending"),
  needsPwReset:  boolean("needs_pw_reset").notNull().default(false),
  requestedAt:   timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt:    timestamp("approved_at",  { withTimezone: true }),
  approvedBy:    text("approved_by"),
  createdAt:     timestamp("created_at",   { withTimezone: true }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at",   { withTimezone: true }).defaultNow().notNull(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
