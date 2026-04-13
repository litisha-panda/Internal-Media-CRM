-- ─── Client Account Approval Status Migration ────────────────────────────────
-- Generated: 2026-04-13
-- Purpose  : Add status column to client_accounts so accounts can be approved
--            before being used in meetings and revenue log.
--
-- DO NOT RUN without DBA review.
-- Apply with: psql $DATABASE_URL -f migrations/client_accounts_status.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add status column with default "approved" so existing accounts are
--         not broken (legacy accounts are auto-approved).
ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Step 2: Add approved_at / approved_by tracking
ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by  TEXT;

-- Step 3: Any new accounts created after this migration default to 'pending'
--   — change the column default:
-- ALTER TABLE client_accounts ALTER COLUMN status SET DEFAULT 'pending';
--   Run this ONLY after the UI is updated to require approval for new accounts.

-- Step 4: Index for fast filtering by status
CREATE INDEX IF NOT EXISTS idx_client_accounts_status
  ON client_accounts (status);
