# Pending Database Migrations

> **Status: NONE of these have been applied to the database.**
> A DBA must review and run each file manually on the target PostgreSQL database before the features that depend on them will work correctly.

---

## Migration Files

### 1. `annual_target_schema.sql`
**Purpose:** Replaces per-quarter target submissions with annual records per rep/agency/client/brand row, carrying Q1–Q4 breakdown targets.
**Required for:** Annual target plan uploads via PlanUploadModal. The backend `/api/targets` route uses the new `quarter = 'Annual-{year}'` format.
**Risk:** Schema change to `target_submissions` table. Run on a snapshot first. Backward-compatible read path exists but write path assumes new columns.
**DBA action required:** Review column additions, check existing rows, then apply.

---

### 2. `client_accounts_status.sql`
**Purpose:** Adds `status`, `approvedAt`, and `approvedBy` columns to the `client_accounts` table so accounts can be approved before use in meetings and revenue log.
**Required for:** The `POST /api/client-accounts/:id/approve` endpoint (added in this release). Until this migration is run, the approve endpoint will update `updatedAt` only (safe no-op).
**Risk:** Additive only (new columns with defaults). Low risk.
**DBA action required:** Apply whenever client account approval workflow is to be activated.

---

### 3. `add_fk_constraints.sql`
**Purpose:** Adds foreign key constraints between core tables (`deals → target_submissions`, `revenue_entries → deals`, `touchpoints → deals`, etc.) for referential integrity.
**Required for:** Data integrity only — no application feature depends on this directly. Includes pre-flight SELECT checks before each ALTER TABLE. If any orphan rows exist, the constraint will fail safely.
**Risk:** Medium. Run the pre-flight checks first (they are embedded at the top of the file). If any check returns rows, clean up those orphans before applying constraints.
**DBA action required:** Run pre-flight checks first, fix any orphans, then apply.

---

### 4. `fix_004_tasks_created_at_to_timestamp.sql`
**Purpose:** Converts `tasks.created_at` from `TEXT` to `TIMESTAMPTZ`. Existing ISO-8601 strings are cast automatically; NULL values remain NULL.
**Required for:** Correct sorting and date arithmetic on tasks. App currently writes ISO-8601 strings so the cast should succeed for all new rows.
**Risk:** Low if all existing `created_at` values are valid ISO-8601. Run `SELECT id, created_at FROM tasks WHERE created_at !~ '^\d{4}-\d{2}-\d{2}' LIMIT 10;` to check for malformed values before applying.
**DBA action required:** Verify no non-ISO strings exist, then apply.

---

### 5. `fix_005_backfill_revenue_quarter.sql`
**Purpose:** Backfills `quarter` on `revenue_entries` rows where `quarter IS NULL` and a `date` is present. Uses OTV fiscal calendar (April–March year start).
**Required for:** KPI calculations that group by quarter. New revenue entries always include a quarter, but historical rows may be missing it.
**Risk:** Low. Only updates NULL rows. Verify fiscal calendar mapping in the script matches OTV's actual quarters before running.
**DBA action required:** Confirm fiscal year logic, then apply.

---

## File Referenced But Not Yet Written

### `add_missing_columns.sql`
**Status: FILE DOES NOT EXIST YET.**
This migration was referenced in the audit but has not been created. If specific columns are missing from the live database (e.g., fields that exist in the Drizzle schema but were never migrated), a DBA should run `SELECT column_name FROM information_schema.columns WHERE table_name = '<table>';` against each table to identify gaps, then write this migration accordingly.

---

## How to Apply

```bash
# Connect to the PostgreSQL database
psql $DATABASE_URL

# Apply a single migration (example)
\i migrations/fix_004_tasks_created_at_to_timestamp.sql

# Or pipe it directly
psql $DATABASE_URL < migrations/fix_004_tasks_created_at_to_timestamp.sql
```

**Recommended order if applying all at once:**
1. `fix_004_tasks_created_at_to_timestamp.sql` — low risk, no dependencies
2. `fix_005_backfill_revenue_quarter.sql` — low risk, no dependencies
3. `client_accounts_status.sql` — additive, low risk
4. `annual_target_schema.sql` — schema change, review carefully
5. `add_fk_constraints.sql` — run pre-flight checks first
