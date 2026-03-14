#!/usr/bin/env bash
# run-e2e.sh — One-command E2E test runner for local development
#
# Usage:
#   ./run-e2e.sh                         # Run the core web E2E suite (chromium)
#   ./run-e2e.sh full                    # Run the full web E2E suite (chromium)
#   ./run-e2e.sh state-action-matrix     # Run single spec by name fragment
#   ./run-e2e.sh --headed                # Run with visible browser
#   STRIPE_TEST_BYPASS=false ./run-e2e   # Use real Stripe test keys
#
# Prerequisites:
#   1. Docker running (for Postgres + Redis)
#   2. pnpm install done at workspace root
#   3. apps/api/.env exists (copy from .env.e2e or .env.example)
#
# The script will:
#   a) Start E2E infra containers (postgres-e2e + redis-e2e)
#   b) Wait for them to be healthy
#   c) Run Prisma migrations against the E2E database
#   d) Seed the E2E database with test users
#   e) Launch Playwright (which starts API + web servers via webServer config)
#   f) Tear down containers on exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Configuration ─────────────────────────────────────────────────────────────
export STRIPE_TEST_BYPASS="${STRIPE_TEST_BYPASS:-true}"
export BASE_URL="${BASE_URL:-http://localhost:3401}"
export E2E_API_URL="${E2E_API_URL:-http://localhost:3400/api}"

COMPOSE_FILE="docker-compose.e2e.yml"
E2E_DB_URL="postgresql://rental_user:rental_password@localhost:3433/rental_portal_e2e?schema=public"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "\033[0;34m[e2e]\033[0m $*"; }
success() { echo -e "\033[0;32m[e2e]\033[0m $*"; }
warn()    { echo -e "\033[0;33m[e2e]\033[0m $*"; }
error()   { echo -e "\033[0;31m[e2e]\033[0m $*" >&2; }

cleanup() {
  info "Stopping E2E infra containers…"
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Start infra ───────────────────────────────────────────────────────
info "Starting E2E infrastructure (Postgres + Redis)…"
docker compose -f "$COMPOSE_FILE" up -d

info "Waiting for Postgres to be healthy…"
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres-e2e \
       pg_isready -U rental_user -d rental_portal_e2e &>/dev/null; then
    success "Postgres ready."
    break
  fi
  [[ $i -eq 30 ]] && { error "Postgres did not become healthy in time."; exit 1; }
  sleep 1
done

info "Waiting for Redis to be healthy…"
for i in $(seq 1 15); do
  if docker compose -f "$COMPOSE_FILE" exec -T redis-e2e redis-cli ping &>/dev/null; then
    success "Redis ready."
    break
  fi
  [[ $i -eq 15 ]] && { error "Redis did not become healthy in time."; exit 1; }
  sleep 1
done

# ── Step 2: Migrate E2E database ──────────────────────────────────────────────
info "Running Prisma migrations against E2E database…"
DATABASE_URL="$E2E_DB_URL" \
  pnpm --filter @rental-portal/database exec prisma migrate deploy 2>&1 | tail -5 || {
  warn "Migration failed — trying 'prisma db push' as fallback (for dev schemas)…"
  DATABASE_URL="$E2E_DB_URL" \
    pnpm --filter @rental-portal/database exec prisma db push --skip-generate 2>&1 | tail -5
}
success "Database schema up to date."

# ── Step 3: Seed test users ────────────────────────────────────────────────────
info "Seeding E2E database with test users…"
DATABASE_URL="$E2E_DB_URL" \
  pnpm --filter @rental-portal/database exec prisma db seed 2>&1 | tail -5 || {
  warn "Seed failed or seed script not found — global-setup.ts will attempt auto-seed via API."
}

# ── Step 4: Run Playwright ────────────────────────────────────────────────────
info "Launching Playwright E2E suite…"
info "  STRIPE_TEST_BYPASS=$STRIPE_TEST_BYPASS"
info "  BASE_URL=$BASE_URL"
info "  E2E_API_URL=$E2E_API_URL"

cd apps/web

# Default to Chromium unless the caller chose a project explicitly.
if [[ " $* " != *" --project "* ]] && [[ " $* " != *"--project="* ]]; then
  export PLAYWRIGHT_DEFAULT_PROJECT="chromium"
fi

# Pass all script arguments through to the grouped Playwright runner.
pnpm exec node ./scripts/run-playwright-suite.mjs "$@"
