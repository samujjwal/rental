#!/bin/bash

# =============================================================================
# USE EXISTING TEST INFRASTRUCTURE - NO EXTERNAL SERVICES NEEDED
# =============================================================================
# This script uses the project's existing test setup which has proper mocking
# for external services like Redis and database.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Header
echo -e "${PURPLE}============================================================================${NC}"
echo -e "${PURPLE}     USING EXISTING TEST INFRASTRUCTURE${NC}"
echo -e "${PURPLE}============================================================================${NC}"
echo ""

# Function to print section header
print_section() {
    echo -e "\n${BLUE}============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================================${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_section "RUNNING TESTS WITH EXISTING INFRASTRUCTURE"

print_info "The project has existing test configurations with proper mocking."
print_info "No external services (Redis/DB) required - tests use mocks!"
echo ""

cd apps/api

# Run the existing test suite which has proper mocking
print_info "Running: pnpm exec jest --config=jest.config.js --testPathPattern='100percent' --coverage"

if pnpm exec jest --config=jest.config.js \
    --testPathPattern="100percent" \
    --coverage \
    --coverageDirectory=coverage/100percent \
    --verbose; then
    print_success "All 100% coverage tests passed!"
else
    print_error "Some tests failed. Check output above."
    cd ../..
    exit 1
fi

cd ../..

print_section "COVERAGE RESULTS"

if [ -f "apps/api/coverage/100percent/coverage-summary.json" ]; then
    print_success "Coverage report generated!"
    print_info "HTML Report: apps/api/coverage/100percent/index.html"
    
    # Display coverage summary if jq is available
    if command -v jq &> /dev/null; then
        echo ""
        echo "Coverage Summary:"
        jq -r '.total | "Lines: \(.lines.pct)%, Functions: \(.functions.pct)%, Branches: \(.branches.pct)%, Statements: \(.statements.pct)%"' apps/api/coverage/100percent/coverage-summary.json
    fi
else
    print_info "Coverage report location: apps/api/coverage/100percent/"
fi

echo ""
echo -e "${PURPLE}============================================================================${NC}"
echo -e "${PURPLE}     100% COVERAGE TEST EXECUTION COMPLETE${NC}"
echo -e "${PURPLE}============================================================================${NC}"

exit 0
