#!/bin/bash

# MVP Backup Script
# Creates automated backups of database and uploads

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
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
if [ -f "$PROJECT_ROOT/.env.mvp" ]; then
    export $(cat "$PROJECT_ROOT/.env.mvp" | grep -v '^#' | xargs)
else
    log_error ".env.mvp file not found!"
    exit 1
fi

log_info "Starting backup process..."

# Backup PostgreSQL
log_info "Backing up PostgreSQL database..."
DB_BACKUP_FILE="$BACKUP_DIR/postgres-backup-$DATE.sql"

if docker exec gharbatai-postgres pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-gharbatai} > "$DB_BACKUP_FILE"; then
    gzip "$DB_BACKUP_FILE"
    log_info "PostgreSQL backup completed: $(basename "$DB_BACKUP_FILE.gz")"
else
    log_error "PostgreSQL backup failed!"
    exit 1
fi

# Backup Redis (optional)
log_info "Backing up Redis data..."
REDIS_BACKUP_FILE="$BACKUP_DIR/redis-backup-$DATE.rdb"

if docker exec gharbatai-redis redis-cli BGSAVE && sleep 5; then
    docker cp gharbatai-redis:/data/dump.rdb "$REDIS_BACKUP_FILE"
    gzip "$REDIS_BACKUP_FILE"
    log_info "Redis backup completed: $(basename "$REDIS_BACKUP_FILE.gz")"
else
    log_warn "Redis backup failed or not needed"
fi

# Backup application files (uploads, configs)
log_info "Backing up application files..."
APP_BACKUP_FILE="$BACKUP_DIR/app-backup-$DATE.tar.gz"

tar -czf "$APP_BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='*.log' \
    -C "$PROJECT_ROOT" \
    nginx/ssl \
    .env.mvp \
    scripts/

log_info "Application backup completed: $(basename "$APP_BACKUP_FILE")"

# Upload to cloud storage (if configured)
if [ -n "$BACKUP_S3_BUCKET" ] && [ -n "$BACKUP_S3_KEY" ]; then
    log_info "Uploading backups to cloud storage..."
    
    # Install AWS CLI if not present
    if ! command -v aws &> /dev/null; then
        log_info "Installing AWS CLI..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf awscliv2.zip
    fi
    
    # Configure AWS CLI
    aws configure set aws_access_key_id "$BACKUP_S3_KEY"
    aws configure set aws_secret_access_key "$BACKUP_S3_SECRET"
    aws configure set default.region "${DO_SPACES_REGION:-nyc3}"
    aws configure set default.s3.endpoint_url "${DO_SPACES_ENDPOINT:-https://nyc3.digitaloceanspaces.com}"
    
    # Upload files
    for file in "$BACKUP_DIR"/*-$DATE.*; do
        if [ -f "$file" ]; then
            aws s3 cp "$file" "s3://$BACKUP_S3_BUCKET/$(basename "$file")"
            log_info "Uploaded $(basename "$file") to cloud storage"
        fi
    done
else
    log_warn "Cloud backup not configured"
fi

# Clean up old backups
log_info "Cleaning up old backups..."
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Remove local backups older than retention period
find "$BACKUP_DIR" -name "backup-*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*-backup-*.gz" -mtime +$RETENTION_DAYS -delete

# Clean up cloud backups (if configured)
if [ -n "$BACKUP_S3_BUCKET" ]; then
    # Delete files older than retention period
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    aws s3 ls "s3://$BACKUP_S3_BUCKET/" | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}' | tr -d '-')
        FILE_NAME=$(echo "$line" | awk '{print $4}')
        
        if [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
            aws s3 rm "s3://$BACKUP_S3_BUCKET/$FILE_NAME"
            log_info "Deleted old cloud backup: $FILE_NAME"
        fi
    done
fi

# Create backup summary
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.gz" | wc -l)

echo ""
echo "========================================="
echo "Backup Summary"
echo "========================================="
echo "Date: $(date)"
echo "Total Size: $BACKUP_SIZE"
echo "Backup Files: $BACKUP_COUNT"
echo "Retention: $RETENTION_DAYS days"
echo "========================================="

# Verify backup integrity
log_info "Verifying backup integrity..."
for file in "$BACKUP_DIR"/*-$DATE.*.gz; do
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
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Backup completed for $(hostname) - Size: $BACKUP_SIZE\"}" \
        "$SLACK_WEBHOOK"
fi
