-- Migration: add_revenue_agency_brand.sql
-- Purpose: Add agency_name and brand columns to revenue_entries.
-- These were silently dropped on insert because the column did not exist.
-- Status: PENDING REVIEW — do not run automatically.
--
-- Run manually after confirming no schema drift:
--   psql $DATABASE_URL -f artifacts/api-server/migrations/add_revenue_agency_brand.sql

ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS agency_name TEXT;
ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS brand       TEXT;
