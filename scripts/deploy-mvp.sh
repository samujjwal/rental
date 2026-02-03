#!/bin/bash

# MVP Deployment Script for Single VM
# Usage: ./scripts/deploy-mvp.sh [domain]

set -e

DOMAIN=${1:-yourdomain.com}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (use sudo)"
    exit 1
fi

cd "$PROJECT_ROOT"

log_section "MVP Deployment for $DOMAIN"

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if .env.mvp exists
if [ ! -f "$PROJECT_ROOT/.env.mvp" ]; then
    log_error ".env.mvp file not found!"
    log_info "Copy .env.mvp.example to .env.mvp and configure it"
    exit 1
fi

# Load environment variables
export $(cat "$PROJECT_ROOT/.env.mvp" | grep -v '^#' | xargs)

# Validate required variables
required_vars=("POSTGRES_PASSWORD" "JWT_SECRET" "DOMAIN_NAME")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable $var is not set!"
        exit 1
    fi
done

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running!"
    exit 1
fi

log_info "Pre-deployment checks passed ✓"

# Create necessary directories
log_info "Creating directories..."
mkdir -p nginx/ssl nginx/logs backups

# Generate SSL certificates
log_section "Setting up SSL with Let's Encrypt"

# Stop existing nginx if running
docker stop gharbatai-nginx 2>/dev/null || true

# Get initial certificate
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log_info "Obtaining SSL certificate for $DOMAIN..."
    
    # Create temporary nginx for certbot
    docker run -d --name temp-nginx \
        -p 80:80 \
        -v "$PROJECT_ROOT/nginx/temp.conf:/etc/nginx/nginx.conf:ro" \
        nginx:alpine
    
    # Wait for nginx to start
    sleep 5
    
    # Get certificate
    docker run --rm \
        -v "/etc/letsencrypt:/etc/letsencrypt" \
        -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
        -v "$PROJECT_ROOT/nginx/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # Stop temporary nginx
    docker stop temp-nginx
    docker rm temp-nginx
    
    log_info "SSL certificate obtained ✓"
else
    log_info "SSL certificate already exists"
fi

# Update nginx configuration with domain
sed "s/\${DOMAIN_NAME}/$DOMAIN/g" "$PROJECT_ROOT/nginx/mvp.conf" > "$PROJECT_ROOT/nginx/nginx.conf"

# Deploy application
log_section "Deploying Application"

# Stop existing services
log_info "Stopping existing services..."
docker-compose -f docker-compose.mvp.yml down 2>/dev/null || true

# Pull latest images
log_info "Pulling latest images..."
docker-compose -f docker-compose.mvp.yml pull

# Build application
log_info "Building application..."
docker-compose -f docker-compose.mvp.yml build --no-cache

# Start services
log_info "Starting services..."
DOMAIN_NAME=$DOMAIN docker-compose -f docker-compose.mvp.yml up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 30

# Check service health
log_info "Checking service health..."

for service in postgres redis api web; do
    if docker-compose -f docker-compose.mvp.yml ps $service | grep -q "Up (healthy)"; then
        log_info "$service is healthy ✓"
    else
        log_warn "$service might not be ready yet"
    fi
done

# Run database migrations
log_info "Running database migrations..."
docker-compose -f docker-compose.mvp.yml exec -T api npx prisma migrate deploy

# Seed database if needed
log_info "Checking if database needs seeding..."
if ! docker-compose -f docker-compose.mvp.yml exec -T api npx prisma db seed --preview 2>/dev/null; then
    log_info "Database seeding not needed or failed"
fi

# Health checks
log_section "Health Checks"

# Check web application
if curl -f http://localhost > /dev/null 2>&1; then
    log_info "Web application is responding ✓"
else
    log_error "Web application is not responding"
fi

# Check API
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    log_info "API is responding ✓"
else
    log_error "API is not responding"
fi

# Check HTTPS
if curl -f https://$DOMAIN > /dev/null 2>&1; then
    log_info "HTTPS is working ✓"
else
    log_warn "HTTPS might not be working yet"
fi

# Setup backup script
log_section "Setting up Backups"

# Create backup script
cat > "$PROJECT_ROOT/scripts/backup-mvp.sh" << 'EOF'
#!/bin/bash

# MVP Backup Script
BACKUP_DIR="/home/deploy/gharbatai-rentals/backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec gharbatai-postgres pg_dump -U postgres gharbatai > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "backup-*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF

chmod +x "$PROJECT_ROOT/scripts/backup-mvp.sh"

# Setup cron job for backups
(crontab -l 2>/dev/null; echo "0 2 * * * cd $PROJECT_ROOT && ./scripts/backup-mvp.sh") | crontab -

log_info "Backup schedule configured ✓"

# Setup log rotation
log_info "Setting up log rotation..."
cat > /etc/logrotate.d/gharbatai-mvp << 'EOF'
/home/deploy/gharbatai-rentals/nginx/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        docker-compose -f /home/deploy/gharbatai-rentals/docker-compose.mvp.yml kill -s USR1 nginx
    endscript
}
EOF

log_info "Log rotation configured ✓"

# Display deployment info
log_section "Deployment Complete"

echo ""
echo "========================================="
echo "MVP Deployment Summary"
echo "========================================="
echo "Domain: $DOMAIN"
echo "Deployed at: $(date)"
echo "Environment: Production"
echo "Backup Schedule: Daily at 2 AM"
echo "========================================="
echo ""
echo "Services:"
echo "  - Web: http://localhost (port 3000)"
echo "  - API: http://localhost/api (port 3001)"
echo "  - Database: PostgreSQL (port 5432)"
echo "  - Redis: Redis (port 6379)"
echo "  - Nginx: Reverse proxy (ports 80, 443)"
echo ""
echo "Useful Commands:"
echo "  - View logs: docker-compose -f docker-compose.mvp.yml logs -f [service]"
echo "  - Restart: docker-compose -f docker-compose.mvp.yml restart [service]"
echo "  - Backup: ./scripts/backup-mvp.sh"
echo "  - Update: git pull && ./scripts/deploy-mvp.sh $DOMAIN"
echo ""
echo "========================================="

log_info "✅ MVP deployment completed successfully!"

# Send notification (optional)
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 MVP deployment completed for $DOMAIN\"}" \
        "$SLACK_WEBHOOK"
fi
