#!/usr/bin/env bash
# Unified Environment Startup Script
# Starts development, test, or production environments with flexible configuration
# Usage: ./scripts/start-env.sh [environment] [action]
#   environment: dev, test, e2e, staging, prod (default: dev)
#   action: start, stop, restart, status, logs (default: start)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.."
source "$PROJECT_ROOT/scripts/lib/config-loader.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_section() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }

# Parse arguments
ENVIRONMENT="${1:-dev}"
ACTION="${2:-start}"

# Validate environment
case "$ENVIRONMENT" in
    dev|test|e2e|staging|prod) ;;
    *) 
        log_error "Invalid environment: $ENVIRONMENT"
        log_info "Valid environments: dev, test, e2e, staging, prod"
        exit 1
        ;;
esac

# Set environment-specific variables
export ENVIRONMENT="$ENVIRONMENT"
export PROJECT_NAME="${PROJECT_NAME:-rental-portal}"

# Load environment file
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
if [[ "$ENVIRONMENT" == "dev" && ! -f "$ENV_FILE" ]]; then
    ENV_FILE="$PROJECT_ROOT/.env"
fi

if [[ -f "$ENV_FILE" ]]; then
    load_env_file "$ENV_FILE"
else
    log_warn "Environment file not found: $ENV_FILE"
fi

# Calculate ports with offsets
OFFSET=$(get_port_offset "$ENVIRONMENT")
export POSTGRES_PORT="${POSTGRES_PORT:-$(calculate_port 5432 $OFFSET)}"
export REDIS_PORT="${REDIS_PORT:-$(calculate_port 6379 $OFFSET)}"
export API_PORT="${API_PORT:-$(calculate_port 3000 $OFFSET)}"
export WEB_PORT="${WEB_PORT:-$(calculate_port 3001 $OFFSET)}"
export MINIO_PORT="${MINIO_PORT:-$(calculate_port 9000 $OFFSET)}"
export MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-$(calculate_port 9001 $OFFSET)}"
export MAILHOG_PORT="${MAILHOG_PORT:-$(calculate_port 8025 $OFFSET)}"

# Set container names with environment prefix
export POSTGRES_CONTAINER="${PROJECT_NAME}-postgres-${ENVIRONMENT}"
export REDIS_CONTAINER="${PROJECT_NAME}-redis-${ENVIRONMENT}"
export MINIO_CONTAINER="${PROJECT_NAME}-minio-${ENVIRONMENT}"
export MAILHOG_CONTAINER="${PROJECT_NAME}-mailhog-${ENVIRONMENT}"

# Determine compose file
case "$ENVIRONMENT" in
    dev)
        COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
        ;;
    test|e2e)
        COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"
        ;;
    staging|prod)
        COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
        ;;
esac

# Check if compose file exists
if [[ ! -f "$COMPOSE_FILE" ]]; then
    log_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi

# Check Docker
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running"
    exit 1
fi

# Compose command wrapper
compose_cmd() {
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Wait for service to be ready
wait_for_service() {
    local service_name="$1"
    local host="$2"
    local port="$3"
    local max_attempts="${4:-30}"
    local sleep_seconds="${5:-2}"
    
    log_info "Waiting for $service_name to be ready..."
    
    for attempt in $(seq 1 "$max_attempts"); do
        if nc -z "$host" "$port" 2>/dev/null; then
            log_info "$service_name is ready"
            return 0
        fi
        
        if [[ "$attempt" -eq "$max_attempts" ]]; then
            log_error "$service_name did not become ready in time"
            return 1
        fi
        
        sleep "$sleep_seconds"
    done
}

# Start infrastructure
start_infrastructure() {
    log_section "Starting $ENVIRONMENT environment"
    print_config
    
    log_info "Starting infrastructure services..."
    compose_cmd up -d
    
    # Wait for services based on environment
    case "$ENVIRONMENT" in
        dev|test|e2e)
            wait_for_service "PostgreSQL" "${POSTGRES_HOST:-localhost}" "$POSTGRES_PORT" 30 2
            wait_for_service "Redis" "${REDIS_HOST:-localhost}" "$REDIS_PORT" 15 2
            ;;
        staging|prod)
            # Production services have health checks
            log_info "Waiting for services to be healthy..."
            sleep 10
            ;;
    esac
    
    # Run migrations for dev/test environments
    if [[ "$ENVIRONMENT" =~ ^(dev|test|e2e)$ ]]; then
        log_info "Running database migrations..."
        cd "$PROJECT_ROOT"
        DATABASE_URL="postgresql://${POSTGRES_USER:-rental_user}:${POSTGRES_PASSWORD:-rental_password}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT}/${POSTGRES_DB:-rental_portal}?schema=public" \
            pnpm --filter @rental-portal/database exec prisma migrate deploy || \
            log_warn "Migration failed or no migrations needed"
    fi
    
    log_info "Environment $ENVIRONMENT started successfully"
    log_info "Services:"
    log_info "  PostgreSQL: ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT}"
    log_info "  Redis: ${REDIS_HOST:-localhost}:${REDIS_PORT}"
    if [[ "$ENVIRONMENT" =~ ^(test|e2e)$ ]]; then
        log_info "  MinIO: localhost:${MINIO_PORT}"
        log_info "  MinIO Console: localhost:${MINIO_CONSOLE_PORT}"
        log_info "  Mailhog: localhost:${MAILHOG_PORT}"
    fi
}

# Stop infrastructure
stop_infrastructure() {
    log_info "Stopping $ENVIRONMENT environment..."
    compose_cmd down --remove-orphans
    log_info "Environment $ENVIRONMENT stopped"
}

# Restart infrastructure
restart_infrastructure() {
    stop_infrastructure
    start_infrastructure
}

# Show status
show_status() {
    log_info "Status for $ENVIRONMENT environment:"
    compose_cmd ps
}

# Show logs
show_logs() {
    local service="${3:-}"
    if [[ -n "$service" ]]; then
        compose_cmd logs -f "$service"
    else
        compose_cmd logs -f
    fi
}

# Main execution
case "$ACTION" in
    start)
        start_infrastructure
        ;;
    stop)
        stop_infrastructure
        ;;
    restart)
        restart_infrastructure
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$@"
        ;;
    *)
        log_error "Invalid action: $ACTION"
        log_info "Valid actions: start, stop, restart, status, logs"
        exit 1
        ;;
esac
