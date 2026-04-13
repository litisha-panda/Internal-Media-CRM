import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * invite_tokens — one row per admin-issued invite link.
 *
 * Token lifecycle:
 *   1. Admin calls POST /auth/invite → row inserted, usedAt = NULL
 *   2. Recipient opens invite URL → GET /auth/invite/:token validates row
 *   3. Recipient completes signup → usedAt set to NOW(), token consumed
 *
 * Expired tokens (NOW() > expiresAt) are rejected even if usedAt is NULL.
 */
export const inviteTokens = pgTable("invite_tokens", {
  token:     text("token").primaryKey(),
  email:     text("email").notNull(),
  createdBy: text("created_by").notNull(),
  usedAt:    timestamp("used_at",    { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InviteToken    = typeof inviteTokens.$inferSelect;
export type NewInviteToken = typeof inviteTokens.$inferInsert;
