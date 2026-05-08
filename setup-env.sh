#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

green='\033[0;32m'
yellow='\033[1;33m'
blue='\033[0;34m'
red='\033[0;31m'
nc='\033[0m'

log_step() {
  echo -e "${blue}==>${nc} $1"
}

log_ok() {
  echo -e "${green}✓${nc} $1"
}

log_warn() {
  echo -e "${yellow}!${nc} $1"
}

log_error() {
  echo -e "${red}✗${nc} $1"
}

show_usage() {
  echo "Usage: $0 <action>"
  echo
  echo "Actions:"
  echo "  setup   - Set up local environment files (default)"
  echo "  clean   - Remove all .env files"
  echo "  reset   - Clean and re-setup environment files"
  echo "  status  - Show status of environment files"
  echo
  echo "Examples:"
  echo "  $0 setup    # Set up environment"
  echo "  $0 clean    # Remove environment files"
  echo "  $0 reset    # Reset environment"
  echo "  $0 status   # Check environment status"
}

copy_if_missing() {
  local source="$1"
  local target="$2"

  if [ -f "$target" ]; then
    log_warn "Keeping existing $target"
    return 1
  fi

  cp "$source" "$target"
  log_ok "Created $target from $source"
  return 0
}

upsert_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local temp_file

  temp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "$file" >"$temp_file"

  mv "$temp_file" "$file"
}

random_base64() {
  openssl rand -base64 32 | tr -d '\n'
}

random_hex() {
  openssl rand -hex 64 | tr -d '\n'
}

cd "$ROOT_DIR"

# Parse action argument
ACTION="${1:-setup}"

case "$ACTION" in
  setup)
    log_step "Preparing local environment files"

    root_created=false
    api_created=false
    web_created=false

    if copy_if_missing ".env.example" ".env"; then
      root_created=true
    fi

    if copy_if_missing "apps/api/.env.example" "apps/api/.env"; then
      api_created=true
    fi

    if copy_if_missing "apps/web/.env.example" "apps/web/.env"; then
      web_created=true
    fi

    if [ "$root_created" = true ]; then
      upsert_env_value ".env" "JWT_SECRET" "$(random_base64)"
      upsert_env_value ".env" "JWT_REFRESH_SECRET" "$(random_base64)"
      upsert_env_value ".env" "SESSION_SECRET" "$(random_base64)"
      log_ok "Generated secure defaults in .env"
    fi

    if [ "$api_created" = true ]; then
      upsert_env_value "apps/api/.env" "JWT_SECRET" "$(random_hex)"
      log_ok "Generated secure API JWT secret"
    fi

    if [ "$web_created" = true ]; then
      upsert_env_value "apps/web/.env" "VITE_API_URL" "http://localhost:3400"
      log_ok "Configured web API URL"
    fi

    log_step "Installing workspace dependencies"
    pnpm install

    log_step "Generating Prisma client"
    pnpm run db:generate

    echo
    echo "Local setup is ready."
    echo
    echo "Next steps:"
    echo "  1. pnpm run dev:full"
    echo "  2. pnpm run test"
    echo "  3. pnpm run deploy:prod        # when production env is ready"
    echo
    echo "Optional:"
    echo "  - pnpm run services:up         # start infra without launching the apps"
    echo "  - pnpm run services:storage:up    # start MinIO"
    echo "  - pnpm run db:seed                # seed local data"
    echo "  - pnpm run test:all               # run the full test pass"
    ;;

  clean)
    log_step "Removing environment files"

    files_to_remove=(
      ".env"
      "apps/api/.env"
      "apps/web/.env"
      ".env.test"
      ".env.e2e"
    )

    removed_count=0
    for file in "${files_to_remove[@]}"; do
      if [ -f "$file" ]; then
        rm "$file"
        log_ok "Removed $file"
        ((removed_count++))
      else
        log_warn "$file does not exist"
      fi
    done

    echo
    if [ "$removed_count" -gt 0 ]; then
      log_ok "Removed $removed_count environment file(s)"
    else
      log_warn "No environment files to remove"
    fi
    ;;

  reset)
    log_step "Resetting environment files"
    "$0" clean
    echo
    "$0" setup
    ;;

  status)
    log_step "Environment file status"

    files_to_check=(
      ".env"
      "apps/api/.env"
      "apps/web/.env"
    )

    for file in "${files_to_check[@]}"; do
      if [ -f "$file" ]; then
        log_ok "$file exists"
      else
        log_error "$file missing"
      fi
    done
    ;;

  -h|--help|help)
    show_usage
    exit 0
    ;;

  *)
    log_error "Unknown action: $ACTION"
    echo
    show_usage
    exit 1
    ;;
esac
