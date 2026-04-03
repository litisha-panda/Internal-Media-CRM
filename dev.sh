#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# dev.sh  —  One-command local development startup
#
# Usage:
#   ./dev.sh          Start both API server and frontend (runs concurrently)
#   ./dev.sh api      Start API server only
#   ./dev.sh ui       Start frontend only
#   ./dev.sh db:push  Push Drizzle schema to local DB (run once after clone)
#   ./dev.sh db:seed  Seed demo users (run once after db:push)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ENV="$REPO_ROOT/artifacts/api-server/.env"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install it: npm install -g pnpm" >&2
  exit 1
fi

if [ ! -f "$API_ENV" ]; then
  echo "ERROR: $API_ENV not found. Run setup-local-db.sh first." >&2
  exit 1
fi

# Load env for this shell so drizzle-kit and api-server both pick it up
set -a
# shellcheck source=/dev/null
source "$API_ENV"
set +a

# ── Sub-commands ──────────────────────────────────────────────────────────────
CMD="${1:-all}"

run_api() {
  echo "▶  Starting API server on http://localhost:${PORT:-3000} ..."
  cd "$REPO_ROOT/artifacts/api-server"
  NODE_ENV=development pnpm run dev
}

run_ui() {
  echo "▶  Starting frontend on http://localhost:5173 ..."
  cd "$REPO_ROOT/artifacts/otv-platform"
  pnpm run dev:local
}

case "$CMD" in
  api)
    run_api
    ;;
  ui)
    run_ui
    ;;
  db:push)
    echo "▶  Pushing Drizzle schema to $DATABASE_URL ..."
    cd "$REPO_ROOT/lib/db"
    pnpm run push
    echo "✓  Schema applied."
    ;;
  db:seed)
    echo "▶  Seeding demo users ..."
    curl -s -X POST "http://localhost:${PORT:-3000}/api/auth/seed-demo" \
      -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || \
    curl -s -X POST "http://localhost:${PORT:-3000}/api/auth/seed-demo" \
      -H "Content-Type: application/json"
    echo ""
    echo "✓  Done. All demo accounts use password: demo123"
    ;;
  all)
    # Run both concurrently. Ctrl+C kills both.
    echo "▶  Starting API + Frontend concurrently..."
    echo "   API  → http://localhost:${PORT:-3000}"
    echo "   UI   → http://localhost:5173"
    echo "   Press Ctrl+C to stop both."
    echo ""

    # Use a simple background-job approach that cleans up on exit
    cleanup() {
      echo ""
      echo "Stopping..."
      kill 0 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    (run_api) &
    # Give the API server 3 seconds to start before the UI tries to proxy
    sleep 3
    (run_ui) &
    wait
    ;;
  *)
    echo "Unknown command: $CMD"
    echo "Usage: $0 [all|api|ui|db:push|db:seed]"
    exit 1
    ;;
esac
