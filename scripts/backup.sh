#!/usr/bin/env bash

set -Eeuo pipefail

ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing environment file: $ENV_FILE"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required to create a database backup"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set in $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/${ENVIRONMENT}-backup-$(date +%Y%m%d-%H%M%S).sql"

pg_dump "$DATABASE_URL" >"$BACKUP_FILE"
gzip -f "$BACKUP_FILE"

find "$BACKUP_DIR" -name "${ENVIRONMENT}-backup-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: ${BACKUP_FILE}.gz"
