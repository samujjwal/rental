#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.dev.yml"

info() {
  echo "[dev] $1"
}

cd "$ROOT_DIR"

info "Starting local infrastructure"
docker compose -f "$COMPOSE_FILE" up -d

info "Waiting for PostgreSQL"
for _ in $(seq 1 30); do
  if docker exec rental-postgres pg_isready -U rental_user -d rental_portal >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec rental-postgres pg_isready -U rental_user -d rental_portal >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready in time"
  exit 1
fi

info "Waiting for Redis"
for _ in $(seq 1 15); do
  if docker exec rental-redis redis-cli ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec rental-redis redis-cli ping >/dev/null 2>&1; then
  echo "Redis did not become ready in time"
  exit 1
fi

info "Generating Prisma client"
pnpm run db:generate

info "Applying local migrations"
pnpm run db:migrate

info "Starting API and web dev servers"
pnpm run dev
