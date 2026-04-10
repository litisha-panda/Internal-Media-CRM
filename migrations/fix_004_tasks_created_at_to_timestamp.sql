-- Migration: fix_004_tasks_created_at_to_timestamp.sql
-- Purpose: Convert tasks.created_at from TEXT to TIMESTAMPTZ
-- Safe for rows that have valid ISO-8601 strings; nulls will remain null.
-- HUMAN REVIEW REQUIRED before running: verify no application code
-- writes non-ISO-8601 strings into this column before executing.

BEGIN;

ALTER TABLE tasks
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING CASE
    WHEN created_at IS NULL THEN NULL
    WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::TIMESTAMPTZ
    ELSE NULL
  END;

ALTER TABLE tasks
  ALTER COLUMN created_at SET DEFAULT now();

COMMIT;
