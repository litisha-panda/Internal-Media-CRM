-- Migration: add_meeting_contact_fields.sql
-- Purpose  : Add contact designation and email columns to the meetings table.
-- Risk     : Low — additive only. IF NOT EXISTS guards make it safe to re-run.
--            No existing rows are modified; both columns are nullable.
-- DO NOT RUN without DBA sign-off.

-- ─── 1. meetings.designation ─────────────────────────────────────────────────
-- Job title / role of the contact being met (e.g. "Marketing Head", "CMO").
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT NULL;

COMMENT ON COLUMN meetings.designation
  IS 'Job title or designation of the contact person for this meeting (nullable).';

-- ─── 2. meetings.contact_email ────────────────────────────────────────────────
-- Email address of the contact being met. Stored for follow-up reference.
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT NULL;

COMMENT ON COLUMN meetings.contact_email
  IS 'Email address of the contact person for this meeting (nullable).';
