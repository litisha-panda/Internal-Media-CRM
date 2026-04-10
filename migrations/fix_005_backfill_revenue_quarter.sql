-- Migration: fix_005_backfill_revenue_quarter.sql
-- Purpose: Backfill quarter for existing revenue entries where quarter IS NULL
--          and a date value is present. Uses OTV fiscal calendar (April start).
-- HUMAN REVIEW REQUIRED: verify fiscal year logic matches OTV's calendar
--   before running. Do not run if quarter data was intentionally omitted.

BEGIN;

UPDATE revenue_entries
SET quarter = CASE
  WHEN EXTRACT(MONTH FROM date::DATE) BETWEEN 4 AND 6  THEN 'Q1 FY' || RIGHT((EXTRACT(YEAR FROM date::DATE)::INT + 1)::TEXT, 2)
  WHEN EXTRACT(MONTH FROM date::DATE) BETWEEN 7 AND 9  THEN 'Q2 FY' || RIGHT((EXTRACT(YEAR FROM date::DATE)::INT + 1)::TEXT, 2)
  WHEN EXTRACT(MONTH FROM date::DATE) BETWEEN 10 AND 12 THEN 'Q3 FY' || RIGHT((EXTRACT(YEAR FROM date::DATE)::INT + 1)::TEXT, 2)
  ELSE                                                       'Q4 FY' || RIGHT((EXTRACT(YEAR FROM date::DATE)::INT)::TEXT, 2)
END
WHERE quarter IS NULL
  AND date IS NOT NULL
  AND date ~ '^\d{4}-\d{2}-\d{2}';

COMMIT;
