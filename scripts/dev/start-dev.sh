#!/usr/bin/env bash
# Development Startup Script
# Ensures infrastructure containers are running before starting dev servers
# Usage: ./scripts/dev/start-dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.."

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

# Check Docker
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running"
    exit 1
fi

# Check if containers are running
check_containers() {
    local redis_running=$(docker ps --filter "name=rental-redis-dev" --filter "status=running" --format "{{.Names}}" | wc -l)
    local postgres_running=$(docker ps --filter "name=rental-postgres-dev" --filter "status=running" --format "{{.Names}}" | wc -l)
    
    if [[ "$redis_running" -eq 0 ]] || [[ "$postgres_running" -eq 0 ]]; then
        return 1
    fi
    return 0
}

# Start containers
start_containers() {
    log_section "Starting infrastructure containers"
    
    cd "$PROJECT_ROOT"
    
    log_info "Starting Redis and PostgreSQL..."
    docker-compose -f docker-compose.dev.yml up -d redis postgres
    
    log_info "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL on port 3432..."
    for i in {1..30}; do
        if nc -z localhost 3432 2>/dev/null; then
            log_info "PostgreSQL is ready"
            break
        fi
        if [[ $i -eq 30 ]]; then
            log_error "PostgreSQL did not become ready in time"
            exit 1
        fi
        sleep 2
    done
    
    # Wait for Redis
    log_info "Waiting for Redis on port 3479..."
    for i in {1..15}; do
        if nc -z localhost 3479 2>/dev/null; then
            log_info "Redis is ready"
            break
        fi
        if [[ $i -eq 15 ]]; then
            log_error "Redis did not become ready in time"
            exit 1
        fi
        sleep 2
    done
    
    log_info "Infrastructure containers started successfully"
    log_info "  PostgreSQL: localhost:3432"
    log_info "  Redis: localhost:3479"
}

# Main execution
log_section "Development Environment Setup"

if check_containers; then
    log_info "Infrastructure containers are already running"
else
    log_warn "Infrastructure containers are not running"
    start_containers
fi

log_section "Starting development servers"
cd "$PROJECT_ROOT"
turbo run dev
