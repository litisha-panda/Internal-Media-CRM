-- Migration: remove_zoho_columns.sql
-- Purpose: Drop all zoho_account_id and zoho_agency_id columns from the database.
-- These columns were part of the abandoned Zoho CRM integration.
-- Status: PENDING REVIEW — do not run automatically.
--
-- Run manually after confirming no production data depends on these columns:
--   psql $DATABASE_URL -f migrations/remove_zoho_columns.sql

ALTER TABLE deals              DROP COLUMN IF EXISTS zoho_account_id;
ALTER TABLE deals              DROP COLUMN IF EXISTS zoho_agency_id;
ALTER TABLE client_accounts    DROP COLUMN IF EXISTS zoho_account_id;
ALTER TABLE revenue_entries    DROP COLUMN IF EXISTS zoho_account_id;
ALTER TABLE target_allocations DROP COLUMN IF EXISTS zoho_account_id;
