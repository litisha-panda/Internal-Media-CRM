-- Migration: invite_tokens.sql
-- Purpose  : Create the invite_tokens table used by the admin-only invite link mechanism.
--            Replaces open self-signup — users may only register via a valid invite link.
-- Risk     : Low — new table only. No existing tables or rows are modified.
--            IF NOT EXISTS guard makes it safe to re-run.
-- DO NOT RUN without DBA sign-off.

CREATE TABLE IF NOT EXISTS invite_tokens (
  token       TEXT        PRIMARY KEY,               -- UUID v4, generated server-side
  email       TEXT        NOT NULL,                  -- intended recipient email
  created_by  TEXT        NOT NULL,                  -- user_id of the admin who issued it
  used_at     TIMESTAMPTZ DEFAULT NULL,              -- NULL = unused; set on successful signup
  expires_at  TIMESTAMPTZ NOT NULL,                  -- creation time + 72 hours
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE invite_tokens IS
  'One row per invite link issued by an admin. Token is single-use and expires after 72 hours.';

COMMENT ON COLUMN invite_tokens.token      IS 'UUID v4 token — embedded in the invite URL as ?invite=<token>.';
COMMENT ON COLUMN invite_tokens.email      IS 'Email address the invite was sent to. Pre-filled on the signup form.';
COMMENT ON COLUMN invite_tokens.created_by IS 'user_id (otv_users.id) of the ADMIN who created this invite.';
COMMENT ON COLUMN invite_tokens.used_at    IS 'Timestamp when the token was consumed on signup. NULL = still valid.';
COMMENT ON COLUMN invite_tokens.expires_at IS '72 hours after created_at. Token is rejected if NOW() > expires_at.';

-- Index for fast lookup by token (already indexed as PK, but explicit for clarity)
-- Index to allow fast cleanup of old tokens
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_email      ON invite_tokens (email);
