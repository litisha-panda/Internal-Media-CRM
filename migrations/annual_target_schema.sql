-- ─── Annual Target Schema Migration ──────────────────────────────────────────
-- Generated: 2026-04-13
-- Purpose  : Replace per-quarter target submissions with annual records that
--            carry Q1, Q2, Q3, Q4 targets per rep/agency/client/brand row.
--
-- DO NOT RUN without DBA review.
-- Apply with: psql $DATABASE_URL -f migrations/annual_target_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add new columns to target_submissions
ALTER TABLE target_submissions
  ADD COLUMN IF NOT EXISTS agency_name   TEXT,
  ADD COLUMN IF NOT EXISTS client_name   TEXT,
  ADD COLUMN IF NOT EXISTS brand_name    TEXT,
  ADD COLUMN IF NOT EXISTS year          INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  ADD COLUMN IF NOT EXISTS q1_target     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q2_target     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q3_target     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q4_target     NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Step 2: Add generated column for annual total (requires PostgreSQL 12+)
ALTER TABLE target_submissions
  ADD COLUMN IF NOT EXISTS annual_target NUMERIC(15, 2)
    GENERATED ALWAYS AS (
      COALESCE(q1_target, 0) + COALESCE(q2_target, 0) +
      COALESCE(q3_target, 0) + COALESCE(q4_target, 0)
    ) STORED;

-- Step 3: Migrate existing quarterly rows
--   Each old quarter row → set the matching Q column from total_target.
--   Existing rows that used quarter = 'Annual-YYYY' (new format) are skipped
--   because their Q values are already set via the application layer.
UPDATE target_submissions
  SET
    q1_target = CASE WHEN quarter = 'Q1' THEN COALESCE(total_target, 0) ELSE q1_target END,
    q2_target = CASE WHEN quarter = 'Q2' THEN COALESCE(total_target, 0) ELSE q2_target END,
    q3_target = CASE WHEN quarter = 'Q3' THEN COALESCE(total_target, 0) ELSE q3_target END,
    q4_target = CASE WHEN quarter = 'Q4' THEN COALESCE(total_target, 0) ELSE q4_target END,
    year      = CASE
                  WHEN quarter IN ('Q1','Q2','Q3','Q4') THEN 2026
                  ELSE year
                END
  WHERE quarter IN ('Q1','Q2','Q3','Q4');

-- Step 4: Populate agency_name and client_name from the clients JSONB array
--   (picks the first element from the JSONB array for the primary client)
UPDATE target_submissions
  SET
    client_name = (clients -> 0 ->> 'clientName'),
    agency_name = (clients -> 0 ->> 'zohoAccountId')
  WHERE clients IS NOT NULL
    AND jsonb_array_length(clients) > 0
    AND client_name IS NULL;

-- Step 5: Drop old columns ONLY after verifying the data migration above.
--   Uncomment and run as a separate step after QA:
--
-- ALTER TABLE target_submissions
--   DROP COLUMN IF EXISTS quarter,
--   DROP COLUMN IF EXISTS clients,
--   DROP COLUMN IF EXISTS total_target;
