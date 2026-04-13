#!/usr/bin/env bash

# Unified Backup Script
# Creates automated backups of database and uploads
# Usage: ./scripts/backup/backup.sh [environment] [mode]
#   environment: production, mvp (default: production)
#   mode: full (includes app files), minimal (database only) (default: full)

set -Eeuo pipefail

ENVIRONMENT="${1:-production}"
MODE="${2:-full}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.."
BACKUP_DIR="$PROJECT_ROOT/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load environment variables
if [ "$ENVIRONMENT" = "mvp" ]; then
    ENV_FILE="$PROJECT_ROOT/.env.mvp"
    DB_CONTAINER="${POSTGRES_CONTAINER:-gharbatai-postgres}"
    REDIS_CONTAINER="${REDIS_CONTAINER:-gharbatai-redis}"
else
    ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [[ "$ENVIRONMENT" == "dev" && ! -f "$ENV_FILE" ]]; then
        ENV_FILE="$PROJECT_ROOT/.env"
    fi
    DB_CONTAINER="${POSTGRES_CONTAINER:-rental-postgres}"
    REDIS_CONTAINER="${REDIS_CONTAINER:-rental-redis}"
fi

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

set -a
source "$ENV_FILE"
set +a

log_info "Starting backup process for $ENVIRONMENT environment ($MODE mode)..."

# Backup PostgreSQL
log_info "Backing up PostgreSQL database..."
DB_BACKUP_FILE="$BACKUP_DIR/postgres-backup-${ENVIRONMENT}-$DATE.sql"

if [ -n "${DATABASE_URL:-}" ]; then
    if command -v pg_dump >/dev/null 2>&1; then
        pg_dump "$DATABASE_URL" >"$DB_BACKUP_FILE"
        gzip "$DB_BACKUP_FILE"
        log_info "PostgreSQL backup completed: $(basename "$DB_BACKUP_FILE.gz")"
    else
        log_warn "pg_dump not found, skipping database backup"
    fi
elif docker exec "$DB_CONTAINER" pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-gharbatai}" >"$DB_BACKUP_FILE" 2>/dev/null; then
    gzip "$DB_BACKUP_FILE"
    log_info "PostgreSQL backup completed: $(basename "$DB_BACKUP_FILE.gz")"
else
    log_error "PostgreSQL backup failed!"
    exit 1
fi

# Backup Redis (optional, only in full mode)
if [ "$MODE" = "full" ]; then
    log_info "Backing up Redis data..."
    REDIS_BACKUP_FILE="$BACKUP_DIR/redis-backup-${ENVIRONMENT}-$DATE.rdb"

    if docker exec "$REDIS_CONTAINER" redis-cli BGSAVE && sleep 5 2>/dev/null; then
        docker cp "$REDIS_CONTAINER":/data/dump.rdb "$REDIS_BACKUP_FILE" 2>/dev/null || true
        if [ -f "$REDIS_BACKUP_FILE" ]; then
            gzip "$REDIS_BACKUP_FILE"
            log_info "Redis backup completed: $(basename "$REDIS_BACKUP_FILE.gz")"
        else
            log_warn "Redis backup skipped (file not found)"
        fi
    else
        log_warn "Redis backup skipped"
    fi

    # Backup application files (uploads, configs)
    log_info "Backing up application files..."
    APP_BACKUP_FILE="$BACKUP_DIR/app-backup-${ENVIRONMENT}-$DATE.tar.gz"

    tar -czf "$APP_BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='backups' \
        --exclude='*.log' \
        -C "$PROJECT_ROOT" \
        nginx/ssl \
        "$ENV_FILE" \
        scripts/ 2>/dev/null || log_warn "Application backup skipped"

    if [ -f "$APP_BACKUP_FILE" ]; then
        log_info "Application backup completed: $(basename "$APP_BACKUP_FILE")"
    fi

    # Upload to cloud storage (if configured)
    if [ -n "${BACKUP_S3_BUCKET:-}" ] && [ -n "${BACKUP_S3_KEY:-}" ]; then
        log_info "Uploading backups to cloud storage..."

        if ! command -v aws &> /dev/null; then
            log_warn "AWS CLI not installed, skipping cloud upload"
        else
            aws configure set aws_access_key_id "$BACKUP_S3_KEY"
            aws configure set aws_secret_access_key "${BACKUP_S3_SECRET:-}"
            aws configure set default.region "${DO_SPACES_REGION:-nyc3}"
            aws configure set default.s3.endpoint_url "${DO_SPACES_ENDPOINT:-https://nyc3.digitaloceanspaces.com}"

            for file in "$BACKUP_DIR"/*-${ENVIRONMENT}-$DATE.*; do
                if [ -f "$file" ]; then
                    aws s3 cp "$file" "s3://$BACKUP_S3_BUCKET/$(basename "$file")" 2>/dev/null || log_warn "Failed to upload $(basename "$file")"
                    log_info "Uploaded $(basename "$file") to cloud storage"
                fi
            done
        fi
    fi
fi

# Clean up old backups
log_info "Cleaning up old backups..."
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

find "$BACKUP_DIR" -name "*-${ENVIRONMENT}-backup-*.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*-${ENVIRONMENT}-*.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

# Clean up cloud backups (if configured)
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws &> /dev/null; then
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)
    aws s3 ls "s3://$BACKUP_S3_BUCKET/" 2>/dev/null | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}' | tr -d '-')
        FILE_NAME=$(echo "$line" | awk '{print $4}')

        if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "${CUTOFF_DATE:-0}" ] 2>/dev/null; then
            aws s3 rm "s3://$BACKUP_S3_BUCKET/$FILE_NAME" 2>/dev/null || true
            log_info "Deleted old cloud backup: $FILE_NAME"
        fi
    done
fi

# Create backup summary
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*-${ENVIRONMENT}-*.gz" 2>/dev/null | wc -l || echo "0")

echo ""
echo "========================================="
echo "Backup Summary"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Mode: $MODE"
echo "Date: $(date)"
echo "Total Size: $BACKUP_SIZE"
echo "Backup Files: $BACKUP_COUNT"
echo "Retention: $RETENTION_DAYS days"
echo "========================================="

# Verify backup integrity
log_info "Verifying backup integrity..."
for file in "$BACKUP_DIR"/*-${ENVIRONMENT}-$DATE.*.gz; do
    if [ -f "$file" ]; then
        if gzip -t "$file" 2>/dev/null; then
            log_info "$(basename "$file") - OK"
        else
            log_error "$(basename "$file") - CORRUPTED"
        fi
    fi
done

log_info "✅ Backup process completed successfully!"

# Send notification (optional)
if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Backup completed for $ENVIRONMENT on $(hostname) - Size: $BACKUP_SIZE\"}" \
        "$SLACK_WEBHOOK" 2>/dev/null || true
fi
