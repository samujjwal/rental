#!/bin/bash

# Production Deployment Script for Gharbatai Rentals
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying to $ENVIRONMENT..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
    log_error ".env.$ENVIRONMENT file not found!"
    exit 1
fi

# Load environment variables
export $(cat "$PROJECT_ROOT/.env.$ENVIRONMENT" | grep -v '^#' | xargs)

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running!"
    exit 1
fi

# Check if required environment variables are set
required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable $var is not set!"
        exit 1
    fi
done

log_info "Pre-deployment checks passed ✓"

# Backup database
log_info "Creating database backup..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
docker-compose -f docker-compose.prod.yml exec -T api npx prisma db pull > "$PROJECT_ROOT/backups/$BACKUP_FILE" || log_warn "Backup failed"

# Pull latest code
log_info "Pulling latest code..."
cd "$PROJECT_ROOT"
git pull origin main

# Build images
log_info "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Run database migrations
log_info "Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

# Deploy with zero downtime
log_info "Deploying services..."

# Start new containers
docker-compose -f docker-compose.prod.yml up -d --no-deps --scale api=2 --scale web=2

# Wait for health checks
log_info "Waiting for health checks..."
sleep 15

# Check API health
if ! curl -f http://localhost/api/health > /dev/null 2>&1; then
    log_error "API health check failed!"
    log_info "Rolling back..."
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d
    exit 1
fi

# Check Web health
if ! curl -f http://localhost > /dev/null 2>&1; then
    log_error "Web health check failed!"
    log_info "Rolling back..."
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d
    exit 1
fi

log_info "Health checks passed ✓"

# Scale down old containers
docker-compose -f docker-compose.prod.yml up -d --no-deps --scale api=1 --scale web=1

# Clean up
log_info "Cleaning up..."
docker system prune -f

# Post-deployment tasks
log_info "Running post-deployment tasks..."

# Clear cache
docker-compose -f docker-compose.prod.yml exec -T api npm run cache:clear || log_warn "Cache clear failed"

# Warm up cache
curl -s http://localhost/api/health > /dev/null

log_info "✅ Deployment completed successfully!"

# Send notification (optional)
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 Deployment to $ENVIRONMENT completed successfully!\"}" \
        "$SLACK_WEBHOOK"
fi

# Display deployment info
echo ""
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Deployed at: $(date)"
echo "Git commit: $(git rev-parse --short HEAD)"
echo "Backup file: $BACKUP_FILE"
echo "========================================="
