-- ─── Foreign Key Constraints Migration ───────────────────────────────────────
-- Generated: 2026-04-13
-- Purpose  : Add FK constraints between core tables for referential integrity.
--
-- DO NOT RUN without DBA review.
-- Apply with: psql $DATABASE_URL -f migrations/add_fk_constraints.sql
--
-- IMPORTANT: Run ONLY after verifying that all referenced rows exist
--            (e.g., no orphaned repId values). Use the pre-flight queries below.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Pre-flight checks ─────────────────────────────────────────────────────────
-- Run these queries BEFORE applying the constraints. Each must return 0 rows.

-- 1. Meetings with userId not in otv_users:
--    SELECT m.id FROM meetings m LEFT JOIN otv_users u ON m.user_id = u.id WHERE u.id IS NULL;

-- 2. Revenue entries with repId not in otv_users:
--    SELECT r.id FROM revenue_entries r LEFT JOIN otv_users u ON CAST(r.rep_id AS TEXT) = CAST(u.id AS TEXT) WHERE r.rep_id IS NOT NULL AND u.id IS NULL;

-- 3. Deals with repId not in otv_users:
--    SELECT d.id FROM deals d LEFT JOIN otv_users u ON CAST(d.rep_id AS TEXT) = CAST(u.id AS TEXT) WHERE d.rep_id IS NOT NULL AND u.id IS NULL;

-- 4. Tasks with assignedToUserId not in otv_users:
--    SELECT t.id FROM tasks t LEFT JOIN otv_users u ON t.assigned_to_user_id = u.id WHERE t.assigned_to_user_id IS NOT NULL AND u.id IS NULL;

-- 5. Target allocations with submissionId not in target_submissions:
--    SELECT a.id FROM target_allocations a LEFT JOIN target_submissions s ON a.submission_id = s.id WHERE s.id IS NULL;

-- ── FK Constraints ────────────────────────────────────────────────────────────

ALTER TABLE meetings
  ADD CONSTRAINT fk_meetings_user_id
  FOREIGN KEY (user_id) REFERENCES otv_users(id)
  ON DELETE RESTRICT;

ALTER TABLE revenue_entries
  ADD CONSTRAINT fk_revenue_entries_rep_id
  FOREIGN KEY (rep_id) REFERENCES otv_users(id)
  ON DELETE RESTRICT;

ALTER TABLE deals
  ADD CONSTRAINT fk_deals_rep_id
  FOREIGN KEY (rep_id) REFERENCES otv_users(id)
  ON DELETE RESTRICT;

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_assigned_to_user_id
  FOREIGN KEY (assigned_to_user_id) REFERENCES otv_users(id)
  ON DELETE SET NULL;

ALTER TABLE target_allocations
  ADD CONSTRAINT fk_target_allocations_submission_id
  FOREIGN KEY (submission_id) REFERENCES target_submissions(id)
  ON DELETE CASCADE;
