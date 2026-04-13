#!/usr/bin/env bash
# Unified Coverage Test Runner
# Consolidates all coverage testing scenarios into a single script
#
# Usage:
#   ./scripts/test/run-coverage.sh [mode] [options]
#
# Modes:
#   full       - Run 100% coverage tests (comprehensive)
#   direct     - Run direct Jest coverage (fast, bypasses TS compilation)
#   project    - Run project-specific coverage (uses existing infrastructure)
#   fast       - Run fast coverage with minimal reporters
#
# Options:
#   --verbose   - Show detailed output
#   --watch     - Run in watch mode
#   --silent    - Minimal output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[COVERAGE]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_section() { echo -e "\n${PURPLE}=== $1 ===${NC}\n"; }

# Parse arguments
MODE="${1:-project}"
shift || true

VERBOSE=false
WATCH=false
SILENT=false

for arg in "$@"; do
    case "$arg" in
        --verbose) VERBOSE=true ;;
        --watch) WATCH=true ;;
        --silent) SILENT=true ;;
        *) log_warn "Unknown option: $arg" ;;
    esac
done

# Calculate start time
START_TIME=$(date +%s)

# ============================================================================
# MODE: FULL (Comprehensive 100% coverage)
# ============================================================================
run_full_coverage() {
    log_section "Running Comprehensive 100% Coverage Tests"
    
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    LOG_FILE="./test-coverage-$(date +%Y%m%d_%H%M%S).log"
    
    log_info "Started at: $TIMESTAMP"
    log_info "Log file: $LOG_FILE"
    
    cd "$PROJECT_ROOT"
    
    # Run storage service tests (100% coverage)
    log_info "Running storage service 100% coverage tests..."
    cd apps/api
    pnpm jest --config=jest.100percent.config.js \
        --coverage --coverageReporters=text-summary 2>&1 | tee -a "$PROJECT_ROOT/$LOG_FILE"
    
    # Run direct coverage tests
    log_info "Running direct coverage tests..."
    pnpm jest --config=jest.direct.config.js --silent 2>&1 | tee -a "$PROJECT_ROOT/$LOG_FILE"
    
    cd "$PROJECT_ROOT"
    
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    log_section "Coverage Complete"
    log_info "Duration: ${duration}s"
    log_info "Log saved to: $LOG_FILE"
}

# ============================================================================
# MODE: DIRECT (Fast, bypasses TS compilation)
# ============================================================================
run_direct_coverage() {
    log_section "Running Direct Jest Coverage (Fast)"
    
    cd "$PROJECT_ROOT/apps/api"
    
    local jest_args="--config=jest.direct.config.js --coverage"
    
    if [[ "$SILENT" == "true" ]]; then
        jest_args="$jest_args --silent --coverageReporters=text-summary"
    elif [[ "$VERBOSE" == "false" ]]; then
        jest_args="$jest_args --coverageReporters=text-summary"
    fi
    
    if [[ "$WATCH" == "true" ]]; then
        jest_args="$jest_args --watch"
    fi
    
    pnpm jest $jest_args
}

# ============================================================================
# MODE: PROJECT (Uses existing infrastructure)
# ============================================================================
run_project_coverage() {
    log_section "Running Project-Specific Coverage"
    
    cd "$PROJECT_ROOT"
    
    # Run combined config for comprehensive coverage
    log_info "Running API tests with coverage..."
    cd apps/api
    
    local jest_args="--config=jest.combined.config.js --coverage"
    
    if [[ "$SILENT" == "true" ]]; then
        jest_args="$jest_args --silent"
    fi
    
    if [[ "$WATCH" == "true" ]]; then
        jest_args="$jest_args --watch"
    fi
    
    pnpm jest $jest_args
}

# ============================================================================
# MODE: FAST (Minimal reporters, quick feedback)
# ============================================================================
run_fast_coverage() {
    log_section "Running Fast Coverage Tests"
    
    log_info "Backend Tests (excluding chaos/e2e)..."
    cd "$PROJECT_ROOT/apps/api"
    
    pnpm jest \
        --testPathIgnorePatterns='chaos|e2e|expansion' \
        --maxWorkers=4 \
        --testTimeout=10000 \
        --silent \
        --coverage \
        --coverageReporters=text-summary \
        --coverageDirectory=coverage-fast
    
    log_info "Frontend Tests..."
    cd "$PROJECT_ROOT/apps/web"
    pnpm vitest run --reporter=verbose --coverage
    
    log_section "Fast Coverage Complete"
    log_info "Reports:"
    log_info "  - Backend: apps/api/coverage-fast"
    log_info "  - Frontend: apps/web/html"
}

# ============================================================================
# MAIN
# ============================================================================

case "$MODE" in
    full)
        run_full_coverage
        ;;
    direct)
        run_direct_coverage
        ;;
    project)
        run_project_coverage
        ;;
    fast)
        run_fast_coverage
        ;;
    *)
        log_error "Invalid mode: $MODE"
        echo "Valid modes: full, direct, project, fast"
        exit 1
        ;;
esac

# Print final summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_section "Summary"
log_info "Coverage run completed in ${DURATION}s"
