#!/usr/bin/env bash
# Flexible Test Runner with Concise Reporting
# Runs tests for different environments and types with flexible reporting
# Usage: ./scripts/run-tests.sh [test-type] [environment] [options]
#   test-type: unit, integration, e2e, all, coverage, security, performance
#   environment: dev, test, e2e (default: test)
#   options: --verbose, --watch, --debug, --reporter=<format>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PROJECT_ROOT/lib/config-loader.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[TEST]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_section() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }
log_result() { echo -e "${CYAN}[RESULT]${NC} $*"; }

# Parse arguments
TEST_TYPE="${1:-all}"
ENVIRONMENT="${2:-test}"
shift 2 || true

# Parse options
VERBOSE=false
WATCH=false
DEBUG=false
REPORTER="default"

for arg in "$@"; do
    case "$arg" in
        --verbose) VERBOSE=true ;;
        --watch) WATCH=true ;;
        --debug) DEBUG=true ;;
        --reporter=*) REPORTER="${arg#--reporter=}" ;;
        *) log_warn "Unknown option: $arg" ;;
    esac
done

# Validate test type
case "$TEST_TYPE" in
    unit|integration|e2e|all|coverage|security|performance) ;;
    *)
        log_error "Invalid test type: $TEST_TYPE"
        log_info "Valid types: unit, integration, e2e, all, coverage, security, performance"
        exit 1
        ;;
esac

# Set environment
export ENVIRONMENT="$ENVIRONMENT"

# Load environment file
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
if [[ "$ENVIRONMENT" == "dev" && ! -f "$ENV_FILE" ]]; then
    ENV_FILE="$PROJECT_ROOT/.env"
fi

if [[ -f "$ENV_FILE" ]]; then
    load_env_file "$ENV_FILE"
fi

# Calculate ports
OFFSET=$(get_port_offset "$ENVIRONMENT")
export POSTGRES_PORT="${POSTGRES_PORT:-$(calculate_port 5432 $OFFSET)}"
export REDIS_PORT="${REDIS_PORT:-$(calculate_port 6379 $OFFSET)}"
export API_PORT="${API_PORT:-$(calculate_port 3000 $OFFSET)}"
export WEB_PORT="${WEB_PORT:-$(calculate_port 3001 $OFFSET)}"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
START_TIME=$(date +%s)

# Print test header
print_test_header() {
    log_section "Running $TEST_TYPE tests ($ENVIRONMENT environment)"
    print_config
    echo -e "Started at: $(date)"
    echo ""
}

# Print test summary
print_test_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    echo ""
    log_section "Test Summary"
    log_result "Total Tests: $TOTAL_TESTS"
    log_result "Passed: ${GREEN}$PASSED_TESTS${NC}"
    log_result "Failed: ${RED}$FAILED_TESTS${NC}"
    log_result "Skipped: ${YELLOW}$SKIPPED_TESTS${NC}"
    log_result "Duration: ${duration}s"
    echo ""
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_info "All tests passed! ✓"
        return 0
    else
        log_error "Some tests failed ✗"
        return 1
    fi
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run API tests
    log_info "Running API unit tests..."
    if pnpm --filter @rental-portal/api run test; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    
    # Run Web tests
    log_info "Running Web unit tests..."
    if pnpm --filter @rental-portal/web run test; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    cd "$PROJECT_ROOT/apps/api"
    
    if pnpm run test:e2e; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Run E2E tests
run_e2e_tests() {
    log_info "Running E2E tests..."
    
    cd "$PROJECT_ROOT/apps/web"
    
    if pnpm run test:e2e; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Run coverage tests
run_coverage_tests() {
    log_info "Running coverage tests..."
    
    cd "$PROJECT_ROOT"
    
    if pnpm run test:coverage; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    
    # Print coverage summary if available
    if [[ -f "coverage/coverage-summary.json" ]]; then
        log_info "Coverage report generated in coverage/"
    fi
}

# Run security tests
run_security_tests() {
    log_info "Running security tests..."
    
    cd "$PROJECT_ROOT/apps/api"
    
    if pnpm run test:security; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    cd "$PROJECT_ROOT"
    
    if pnpm run test:load; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Main execution
print_test_header

case "$TEST_TYPE" in
    unit)
        run_unit_tests
        ;;
    integration)
        run_integration_tests
        ;;
    e2e)
        run_e2e_tests
        ;;
    coverage)
        run_coverage_tests
        ;;
    security)
        run_security_tests
        ;;
    performance)
        run_performance_tests
        ;;
    all)
        # Run unit tests only by default to avoid hanging
        # To run all tests, specify each type explicitly
        run_unit_tests
        log_info "Note: To run integration, e2e, security, and performance tests, specify them explicitly"
        ;;
esac

print_test_summary
