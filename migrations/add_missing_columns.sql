-- Migration: add_missing_columns.sql
-- Purpose  : Add columns identified as missing from the live database schema.
-- Risk     : Low — additive only (IF NOT EXISTS guards on every statement).
--            Safe to run on a live database; no existing data is modified.
-- DO NOT RUN without DBA sign-off.

-- ─── 1. target_allocations.agency_name ───────────────────────────────────────
-- Stores the advertising agency that brokered this allocation, if any.
-- Nullable because direct-client deals have no agency.
ALTER TABLE target_allocations
  ADD COLUMN IF NOT EXISTS agency_name TEXT DEFAULT NULL;

COMMENT ON COLUMN target_allocations.agency_name
  IS 'Advertising agency associated with this target allocation (nullable — omit for direct-client deals).';

-- ─── 2. target_allocations.brand_name ────────────────────────────────────────
-- Stores the specific brand within a client that this allocation targets.
-- Nullable because some deals are at client level, not brand level.
ALTER TABLE target_allocations
  ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT NULL;

COMMENT ON COLUMN target_allocations.brand_name
  IS 'Brand within the client company targeted by this allocation (nullable — omit when deal is at client level).';

-- ─── 3. otv_users.reporting_manager ──────────────────────────────────────────
-- Free-text name of the user's direct reporting manager.
-- Used for display and escalation chain labelling only — not a FK.
ALTER TABLE otv_users
  ADD COLUMN IF NOT EXISTS reporting_manager TEXT DEFAULT NULL;

COMMENT ON COLUMN otv_users.reporting_manager
  IS 'Display name of the direct reporting manager for this user. Not a foreign key — used for labelling only.';
