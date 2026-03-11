#!/usr/bin/env bash

# MVP deployment script for single VM
# Usage:
#   sudo ./scripts/deploy-mvp.sh yourdomain.com
#
# Optional env:
#   INCLUDE_WWW=true         # Include www.<domain> in cert request
#   LETSENCRYPT_EMAIL=...    # Override certbot email
#   SEED_DB=true             # Run DB seed after migrations

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.mvp.yml"
ENV_FILE="$PROJECT_ROOT/.env.mvp"
NGINX_TEMPLATE="$PROJECT_ROOT/nginx/mvp.conf"
NGINX_RENDERED="$PROJECT_ROOT/nginx/mvp.generated.conf"
TEMP_NGINX_CONF="$PROJECT_ROOT/nginx/temp.conf"
TEMP_NGINX_CONTAINER="rental-certbot-temp-nginx"

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

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command not found: $1"
    exit 1
  fi
}

cleanup_temp_nginx() {
  docker rm -f "$TEMP_NGINX_CONTAINER" >/dev/null 2>&1 || true
}

if [ "$EUID" -ne 0 ]; then
  log_error "Please run as root (use sudo)"
  exit 1
fi

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
require_command sed

if [ ! -f "$ENV_FILE" ]; then
  log_error "Missing file: $ENV_FILE"
  log_info "Copy .env.mvp.example to .env.mvp and fill required values"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log_error "Missing file: $COMPOSE_FILE"
  exit 1
fi

if [ ! -f "$NGINX_TEMPLATE" ]; then
  log_error "Missing file: $NGINX_TEMPLATE"
  exit 1
fi

if [ ! -f "$TEMP_NGINX_CONF" ]; then
  log_error "Missing file: $TEMP_NGINX_CONF"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not running"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

DOMAIN="${1:-${DOMAIN_NAME:-}}"
if [ -z "$DOMAIN" ]; then
  log_error "Domain is required"
  log_info "Usage: sudo ./scripts/deploy-mvp.sh yourdomain.com"
  exit 1
fi

LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@$DOMAIN}"
INCLUDE_WWW="${INCLUDE_WWW:-false}"

required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "JWT_REFRESH_SECRET")
missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing_vars+=("$var")
  fi
done
if [ "${#missing_vars[@]}" -gt 0 ]; then
  log_error "Missing required variables in .env.mvp: ${missing_vars[*]}"
  exit 1
fi

cd "$PROJECT_ROOT"

log_section "MVP Deployment for $DOMAIN"

log_info "Preparing directories..."
mkdir -p "$PROJECT_ROOT/nginx/logs" "$PROJECT_ROOT/nginx/www" "$PROJECT_ROOT/backups"
mkdir -p /etc/letsencrypt /var/lib/letsencrypt /var/log/letsencrypt

log_info "Rendering nginx config..."
sed "s/\${DOMAIN_NAME}/$DOMAIN/g" "$NGINX_TEMPLATE" >"$NGINX_RENDERED"

log_section "SSL Certificate Setup"
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
  log_info "Existing certificate found for $DOMAIN"
else
  log_info "No certificate found. Requesting a new Let's Encrypt certificate..."

  compose stop nginx >/dev/null 2>&1 || true
  cleanup_temp_nginx

  docker run -d --name "$TEMP_NGINX_CONTAINER" \
    -p 80:80 \
    -v "$TEMP_NGINX_CONF:/etc/nginx/nginx.conf:ro" \
    -v "$PROJECT_ROOT/nginx/www:/var/www/certbot" \
    nginx:alpine >/dev/null

  sleep 3

  cert_domains=(-d "$DOMAIN")
  if [ "$INCLUDE_WWW" = "true" ]; then
    cert_domains+=(-d "www.$DOMAIN")
  fi

  if ! docker run --rm \
    -v "/etc/letsencrypt:/etc/letsencrypt" \
    -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
    -v "/var/log/letsencrypt:/var/log/letsencrypt" \
    -v "$PROJECT_ROOT/nginx/www:/var/www/certbot" \
    certbot/certbot certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email "$LETSENCRYPT_EMAIL" \
      --agree-tos \
      --no-eff-email \
      "${cert_domains[@]}"; then
    cleanup_temp_nginx
    log_error "Failed to obtain Let's Encrypt certificate"
    exit 1
  fi

  cleanup_temp_nginx
  log_info "Certificate created for $DOMAIN"
fi

log_section "Deploying Services"

log_info "Pulling base images (if available)..."
compose pull postgres redis nginx certbot || true

log_info "Building API and Web images..."
compose build --pull api web

log_info "Starting database services..."
compose up -d postgres redis

log_info "Waiting for database readiness..."
max_attempts=30
for attempt in $(seq 1 "$max_attempts"); do
  if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-gharbatai}" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    log_error "Postgres did not become ready"
    compose logs --tail=120 postgres
    exit 1
  fi
  sleep 2
done

log_info "Running DB migrations..."
compose run --rm api pnpm --filter @rental-portal/database migrate:deploy

if [ "${SEED_DB:-false}" = "true" ]; then
  log_info "Seeding database..."
  compose run --rm api pnpm --filter @rental-portal/database seed || log_warn "Seed failed"
fi

log_info "Starting full stack..."
compose up -d api web nginx certbot

log_section "Health Checks"

for attempt in $(seq 1 40); do
  web_ok=false
  api_ok=false

  if curl -fsS "http://localhost" >/dev/null 2>&1; then
    web_ok=true
  fi

  if curl -fsS "http://localhost/api/health" >/dev/null 2>&1; then
    api_ok=true
  fi

  if [ "$web_ok" = true ] && [ "$api_ok" = true ]; then
    log_info "HTTP health checks passed"
    break
  fi

  if [ "$attempt" -eq 40 ]; then
    log_error "Health checks failed"
    compose ps
    compose logs --tail=150 api web nginx
    exit 1
  fi
  sleep 3
done

if curl -fsS "https://$DOMAIN" >/dev/null 2>&1; then
  log_info "HTTPS is reachable"
else
  log_warn "HTTPS is not reachable yet (DNS propagation or firewall may still be pending)"
fi

log_section "Backup Automation"

cat >"$PROJECT_ROOT/scripts/backup-mvp.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.mvp.yml"
ENV_FILE="$PROJECT_ROOT/.env.mvp"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Docker Compose is not installed"
  exit 1
fi

compose() {
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

set -a
source "$ENV_FILE"
set +a

BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"

mkdir -p "$BACKUP_DIR"

compose exec -T postgres pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-gharbatai}" >"$BACKUP_FILE"
gzip -f "$BACKUP_FILE"

find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "Backup completed: ${BACKUP_FILE}.gz"
EOF

chmod +x "$PROJECT_ROOT/scripts/backup-mvp.sh"

(crontab -l 2>/dev/null | grep -v "scripts/backup-mvp.sh" || true; \
  echo "0 2 * * * cd $PROJECT_ROOT && ./scripts/backup-mvp.sh >> $PROJECT_ROOT/backups/backup-cron.log 2>&1") | crontab -

log_info "Daily backup cron configured (2:00 AM)"

cat >/etc/logrotate.d/gharbatai-mvp <<EOF
$PROJECT_ROOT/nginx/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

log_info "Nginx log rotation configured"

echo
echo "========================================="
echo "MVP Deployment Summary"
echo "========================================="
echo "Domain: $DOMAIN"
echo "Deployed at: $(date)"
echo "Compose file: $COMPOSE_FILE"
echo "Useful commands:"
echo "  - View logs: ${COMPOSE_CMD[*]} -f $COMPOSE_FILE --env-file $ENV_FILE logs -f [service]"
echo "  - Restart:   ${COMPOSE_CMD[*]} -f $COMPOSE_FILE --env-file $ENV_FILE restart [service]"
echo "  - Backup:    $PROJECT_ROOT/scripts/backup-mvp.sh"
echo "========================================="
echo

log_info "MVP deployment completed successfully"
