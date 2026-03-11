#!/usr/bin/env bash

# Production deployment script
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -Eeuo pipefail

ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command not found: $1"
    exit 1
  fi
}

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  log_error "Docker Compose is not installed"
  exit 1
fi

compose() {
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

require_command docker
require_command curl

if [ ! -f "$ENV_FILE" ]; then
  log_error "Environment file not found: $ENV_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log_error "Compose file not found: $COMPOSE_FILE"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not running"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/nginx/ssl/cert.pem" ] || [ ! -f "$PROJECT_ROOT/nginx/ssl/key.pem" ]; then
  log_error "TLS certs are missing. Expected:"
  log_error "  $PROJECT_ROOT/nginx/ssl/cert.pem"
  log_error "  $PROJECT_ROOT/nginx/ssl/key.pem"
  exit 1
fi

log_info "Loading environment from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET" "JWT_REFRESH_SECRET" "FRONTEND_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing_vars+=("$var")
  fi
done

if [ "${#missing_vars[@]}" -gt 0 ]; then
  log_error "Missing required variables in $ENV_FILE: ${missing_vars[*]}"
  exit 1
fi

mkdir -p "$PROJECT_ROOT/backups" "$PROJECT_ROOT/nginx/logs"

if [ "${SKIP_DB_BACKUP:-false}" != "true" ] && command -v pg_dump >/dev/null 2>&1; then
  BACKUP_FILE="$PROJECT_ROOT/backups/backup-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).sql"
  log_info "Creating database backup with pg_dump..."
  if pg_dump "$DATABASE_URL" >"$BACKUP_FILE"; then
    gzip -f "$BACKUP_FILE"
    log_info "Backup created: ${BACKUP_FILE}.gz"
  else
    rm -f "$BACKUP_FILE"
    log_warn "Database backup failed; continuing deployment"
  fi
else
  log_warn "Skipping DB backup (set SKIP_DB_BACKUP=false and install pg_dump to enable)"
fi

cd "$PROJECT_ROOT"

log_info "Building API and Web images..."
compose build --pull

log_info "Running database migrations..."
compose run --rm api pnpm --filter @rental-portal/database migrate:deploy

log_info "Starting services..."
compose up -d api web nginx

log_info "Waiting for health checks..."
max_attempts=30
sleep_seconds=3

for attempt in $(seq 1 "$max_attempts"); do
  api_ok=false
  web_ok=false

  if curl -fsS "http://localhost/api/health" >/dev/null 2>&1; then
    api_ok=true
  fi

  if curl -fsS "http://localhost" >/dev/null 2>&1; then
    web_ok=true
  fi

  if [ "$api_ok" = true ] && [ "$web_ok" = true ]; then
    log_info "Health checks passed"
    break
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    log_error "Health checks failed after ${max_attempts} attempts"
    compose ps
    compose logs --tail=120 api web nginx || true
    exit 1
  fi

  sleep "$sleep_seconds"
done

if [ -n "${SLACK_WEBHOOK:-}" ]; then
  curl -sS -X POST -H "Content-Type: application/json" \
    --data "{\"text\":\"Deployment to ${ENVIRONMENT} succeeded on $(hostname)\"}" \
    "$SLACK_WEBHOOK" >/dev/null || log_warn "Slack notification failed"
fi

echo
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Compose file: $COMPOSE_FILE"
echo "Deployed at: $(date)"
echo "Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "========================================="
echo

log_info "Deployment completed successfully"
