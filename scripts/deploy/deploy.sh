#!/usr/bin/env bash

# Unified Deployment Script
# Deploys application to production or MVP environment
# Usage: sudo ./scripts/deploy/deploy.sh [domain] [mode]
#   domain: yourdomain.com (required for MVP mode)
#   mode: mvp, production (default: production)

set -Eeuo pipefail

MODE="${2:-production}"
DOMAIN="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.."

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

# Determine compose file and environment
if [ "$MODE" = "mvp" ]; then
  COMPOSE_FILE="$PROJECT_ROOT/docker-compose.mvp.yml"
  ENV_FILE="$PROJECT_ROOT/.env.mvp"
  NGINX_TEMPLATE="$PROJECT_ROOT/nginx/mvp.conf"
  NGINX_RENDERED="$PROJECT_ROOT/nginx/mvp.generated.conf"
  TEMP_NGINX_CONF="$PROJECT_ROOT/nginx/temp.conf"
  TEMP_NGINX_CONTAINER="rental-certbot-temp-nginx"

  if [ -z "$DOMAIN" ]; then
    log_error "Domain is required for MVP deployment"
    log_info "Usage: sudo ./scripts/deploy/deploy.sh yourdomain.com mvp"
    exit 1
  fi
else
  COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
  ENV_FILE="$PROJECT_ROOT/.env.production"
fi

compose() {
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

require_command docker
require_command curl
require_command sed

if [ ! -f "$ENV_FILE" ]; then
  log_error "Missing file: $ENV_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log_error "Missing file: $COMPOSE_FILE"
  exit 1
fi

if [ "$MODE" = "mvp" ] && [ ! -f "$NGINX_TEMPLATE" ]; then
  log_error "Missing file: $NGINX_TEMPLATE"
  exit 1
fi

if [ "$MODE" = "mvp" ] && [ ! -f "$TEMP_NGINX_CONF" ]; then
  log_error "Missing file: $TEMP_NGINX_CONF"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not running"
  exit 1
fi

log_info "Loading environment from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

# Validate required variables
if [ "$MODE" = "mvp" ]; then
  required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "JWT_REFRESH_SECRET")
else
  required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET" "JWT_REFRESH_SECRET" "FRONTEND_URL")
fi

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

# MVP-specific SSL setup
if [ "$MODE" = "mvp" ]; then
  log_section "SSL Certificate Setup"
  
  LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@$DOMAIN}"
  INCLUDE_WWW="${INCLUDE_WWW:-false}"

  log_info "Rendering nginx config..."
  sed "s/\${DOMAIN_NAME}/$DOMAIN/g" "$NGINX_TEMPLATE" >"$NGINX_RENDERED"

  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
    log_info "Existing certificate found for $DOMAIN"
  else
    log_info "No certificate found. Requesting a new Let's Encrypt certificate..."

    compose stop nginx >/dev/null 2>&1 || true
    docker rm -f "$TEMP_NGINX_CONTAINER" >/dev/null 2>&1 || true

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
      docker rm -f "$TEMP_NGINX_CONTAINER" >/dev/null 2>&1 || true
      log_error "Failed to obtain Let's Encrypt certificate"
      exit 1
    fi

    docker rm -f "$TEMP_NGINX_CONTAINER" >/dev/null 2>&1 || true
    log_info "Certificate created for $DOMAIN"
  fi
else
  if [ ! -f "$PROJECT_ROOT/nginx/ssl/cert.pem" ] || [ ! -f "$PROJECT_ROOT/nginx/ssl/key.pem" ]; then
    log_error "TLS certs are missing. Expected:"
    log_error "  $PROJECT_ROOT/nginx/ssl/cert.pem"
    log_error "  $PROJECT_ROOT/nginx/ssl/key.pem"
    exit 1
  fi
fi

cd "$PROJECT_ROOT"

log_section "Deploying Services ($MODE mode)"

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

if [ "$MODE" = "mvp" ] && curl -fsS "https://$DOMAIN" >/dev/null 2>&1; then
  log_info "HTTPS is reachable"
elif [ "$MODE" = "mvp" ]; then
  log_warn "HTTPS is not reachable yet (DNS propagation or firewall may still be pending)"
fi

# MVP-specific automation
if [ "$MODE" = "mvp" ]; then
  log_section "Backup Automation"

  if [ ! -f "$PROJECT_ROOT/scripts/backup/backup.sh" ]; then
    log_error "Missing backup script: $PROJECT_ROOT/scripts/backup/backup.sh"
    exit 1
  fi

  chmod +x "$PROJECT_ROOT/scripts/backup/backup.sh"

  (crontab -l 2>/dev/null | grep -v "scripts/backup/backup.sh" || true; \
    echo "0 2 * * * cd $PROJECT_ROOT && ./scripts/backup/backup.sh mvp >> $PROJECT_ROOT/backups/backup-cron.log 2>&1") | crontab -

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
fi

echo
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo "Mode: $MODE"
if [ "$MODE" = "mvp" ]; then
  echo "Domain: $DOMAIN"
fi
echo "Deployed at: $(date)"
echo "Compose file: $COMPOSE_FILE"
echo "Useful commands:"
echo "  - View logs: ${COMPOSE_CMD[*]} -f $COMPOSE_FILE --env-file $ENV_FILE logs -f [service]"
echo "  - Restart:   ${COMPOSE_CMD[*]} -f $COMPOSE_FILE --env-file $ENV_FILE restart [service]"
if [ "$MODE" = "mvp" ]; then
  echo "  - Backup:    $PROJECT_ROOT/scripts/backup/backup.sh mvp"
fi
echo "========================================="
echo

log_info "Deployment completed successfully"

if [ -n "${SLACK_WEBHOOK:-}" ]; then
  curl -sS -X POST -H "Content-Type: application/json" \
    --data "{\"text\":\"Deployment to $MODE succeeded on $(hostname)\"}" \
    "$SLACK_WEBHOOK" >/dev/null || log_warn "Slack notification failed"
fi
