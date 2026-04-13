#!/usr/bin/env bash
# Centralized Configuration Loader
# This script loads and validates environment-specific configuration
# Usage: source scripts/lib/config-loader.sh

set -eo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default configuration values (can be overridden by environment variables)
DEFAULT_ENV="${ENVIRONMENT:-dev}"
DEFAULT_PROJECT_NAME="${PROJECT_NAME:-rental-portal}"
DEFAULT_POSTGRES_PORT="${POSTGRES_PORT:-5432}"
DEFAULT_REDIS_PORT="${REDIS_PORT:-6379}"
DEFAULT_API_PORT="${API_PORT:-3000}"
DEFAULT_WEB_PORT="${WEB_PORT:-3000}"
DEFAULT_POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
DEFAULT_REDIS_HOST="${REDIS_HOST:-localhost}"
DEFAULT_POSTGRES_DB="${POSTGRES_DB:-rental_portal}"
DEFAULT_POSTGRES_USER="${POSTGRES_USER:-rental_user}"
DEFAULT_POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-rental_password}"
DEFAULT_REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Get port offset for current environment
get_port_offset() {
    local env="${1:-$DEFAULT_ENV}"
    case "$env" in
        dev) echo 0 ;;
        test) echo 1000 ;;
        e2e) echo 2000 ;;
        staging) echo 3000 ;;
        prod) echo 0 ;;
        *) echo 0 ;;
    esac
}

# Calculate actual port with offset
calculate_port() {
    local base_port="$1"
    local offset="${2:-$(get_port_offset)}"
    echo $((base_port + offset))
}

# Load environment file
load_env_file() {
    local env_file="${1:-.env.$DEFAULT_ENV}"
    
    if [[ -f "$env_file" ]]; then
        echo -e "${GREEN}Loading environment from $env_file${NC}"
        set -a
        source "$env_file"
        set +a
    else
        echo -e "${YELLOW}Warning: Environment file not found: $env_file${NC}"
    fi
}

# Validate required environment variables
validate_required_vars() {
    local required_vars=("$@")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo -e "${RED}Error: Missing required environment variables:${NC}"
        printf '  - %s\n' "${missing_vars[@]}"
        echo -e "${RED}Please set these variables in your environment file${NC}"
        return 1
    fi
    
    return 0
}

# Get configuration value with fallback
get_config() {
    local var_name="$1"
    local default_value="${2:-}"
    local value="${!var_name:-$default_value}"
    
    echo "$value"
}

# Print configuration summary
print_config() {
    local env="${ENVIRONMENT:-$DEFAULT_ENV}"
    local offset=$(get_port_offset "$env")
    
    echo -e "${BLUE}=== Configuration Summary ===${NC}"
    echo -e "Environment: ${GREEN}$env${NC}"
    echo -e "Port Offset: ${GREEN}$offset${NC}"
    echo -e "PostgreSQL Port: ${GREEN}$(calculate_port $DEFAULT_POSTGRES_PORT $offset)${NC}"
    echo -e "Redis Port: ${GREEN}$(calculate_port $DEFAULT_REDIS_PORT $offset)${NC}"
    echo -e "API Port: ${GREEN}$(calculate_port $DEFAULT_API_PORT $offset)${NC}"
    echo -e "Web Port: ${GREEN}$(calculate_port $DEFAULT_WEB_PORT $offset)${NC}"
    echo -e "${BLUE}============================${NC}"
}

# Export functions for use in other scripts
export -f get_port_offset
export -f calculate_port
export -f load_env_file
export -f validate_required_vars
export -f get_config
export -f print_config
