#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-local-db.sh  —  One-time local database setup
#
# Run this ONCE after cloning the repo:
#   chmod +x setup-local-db.sh
#   ./setup-local-db.sh
#
# What it does:
#   1. Creates the otv_crm_local PostgreSQL database (if it doesn't exist)
#   2. Applies the Drizzle schema (pnpm run push in lib/db)
#   3. Writes .env files for the API server
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="otv_crm_local"
DB_USER="${PGUSER:-$(whoami)}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DATABASE_URL="postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

API_ENV="$REPO_ROOT/artifacts/api-server/.env"

echo "═══════════════════════════════════════════"
echo "  OTV CRM — Local DB Setup"
echo "═══════════════════════════════════════════"

# ── 1. Create database ────────────────────────────────────────────────────────
echo ""
echo "Step 1/3: Creating database '$DB_NAME' ..."
if psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres \
     -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" \
     | grep -q 1 2>/dev/null; then
  echo "  ✓ Database '$DB_NAME' already exists, skipping."
else
  psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres \
    -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  echo "  ✓ Database '$DB_NAME' created."
fi

# ── 2. Write .env for api-server ──────────────────────────────────────────────
echo ""
echo "Step 2/3: Writing $API_ENV ..."
if [ -f "$API_ENV" ]; then
  echo "  ✓ .env already exists, skipping (delete it to regenerate)."
else
  cat > "$API_ENV" <<EOF
# ── Local development environment ──────────────────────────────────────────
DATABASE_URL=${DATABASE_URL}
PORT=3000
NODE_ENV=development

# Fill in your Anthropic key to enable RO parser / AI features
ANTHROPIC_API_KEY=

# Zoho integration (optional)
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
EOF
  echo "  ✓ .env written."
fi

# ── 3. Push Drizzle schema ────────────────────────────────────────────────────
echo ""
echo "Step 3/3: Applying Drizzle schema ..."
cd "$REPO_ROOT/lib/db"
DATABASE_URL="$DATABASE_URL" pnpm run push --accept-data-loss 2>&1 | tail -20
echo "  ✓ Schema applied."

echo ""
echo "═══════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Start the stack:  ./dev.sh"
echo "    2. Seed demo users:  ./dev.sh db:seed"
echo "       (API server must be running for seed)"
echo ""
echo "  Demo login (after seeding):"
echo "    URL:      http://localhost:5173"
echo "    Email:    admin@odishatv.com"
echo "    Password: demo123"
echo "═══════════════════════════════════════════"
