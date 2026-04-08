#!/bin/bash

# =============================================================================
# PROJECT-SPECIFIC 100% COVERAGE TEST RUNNER
# =============================================================================
# This script uses the project's existing Jest infrastructure to run
# the 100% coverage tests we've created.
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

# Timestamp
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Header
echo -e "${PURPLE}============================================================================${NC}"
echo -e "${PURPLE}     PROJECT-SPECIFIC 100% COVERAGE TEST RUNNER${NC}"
echo -e "${PURPLE}============================================================================${NC}"
echo -e "${CYAN}Started at: $TIMESTAMP${NC}"
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

# Check Node.js and npm
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed or not in PATH"
    exit 1
fi

print_section "ENVIRONMENT VERIFICATION"

NODE_VERSION=$(node --version)
PNPM_VERSION=$(pnpm --version)
print_info "Node.js version: $NODE_VERSION"
print_info "pnpm version: $PNPM_VERSION"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    pnpm install --silent
    print_success "Dependencies installed"
fi

# Clean previous coverage data
print_section "CLEANING PREVIOUS COVERAGE DATA"

rm -rf apps/api/coverage/
rm -rf apps/api/.nyc_output/
find apps/api -name "*.lcov" -delete 2>/dev/null || true
find apps/api -name "coverage.json" -delete 2>/dev/null || true

print_success "Previous coverage data cleaned"

# Create Jest configuration for our 100% coverage tests
print_section "CREATING JEST CONFIGURATION FOR 100% COVERAGE"

cat > apps/api/jest.100percent.config.json << 'EOF'
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src"],
  "testMatch": [
    "**/auth.service.100percent.working.spec.ts",
    "**/bookings.service.100percent.final.spec.ts",
    "**/admin.service.100percent.spec.ts",
    "**/field-encryption.service.100percent.spec.ts",
    "**/cache.service.100percent.spec.ts",
    "**/events.service.100percent.spec.ts",
    "**/fx.service.100percent.spec.ts",
    "**/storage.service.100percent.spec.ts"
  ],
  "collectCoverage": true,
  "coverageDirectory": "coverage/100percent",
  "coverageReporters": ["text", "lcov", "html", "json", "clover"],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    }
  },
  "verbose": true,
  "setupFilesAfterEnv": ["<rootDir>/jest.setup.100percent.js"],
  "transformIgnorePatterns": [
    "node_modules/(?!(.*\\.mjs$))"
  ],
  "globals": {
    "ts-jest": {
      "tsconfig": "tsconfig.json"
    }
  }
}
EOF

# Create Jest setup file
cat > apps/api/jest.setup.100percent.js << 'EOF'
// Global Jest setup for 100% coverage tests
global.describe = global.describe || require('jest').describe;
global.test = global.test || require('jest').test;
global.it = global.it || require('jest').it;
global.expect = global.expect || require('jest').expect;
global.beforeEach = global.beforeEach || require('jest').beforeEach;
global.afterEach = global.afterEach || require('jest').afterEach;
global.beforeAll = global.beforeAll || require('jest').beforeAll;
global.afterAll = global.afterAll || require('jest').afterAll;
global.jest = global.jest || require('jest');

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});
EOF

print_success "Jest configuration created for 100% coverage tests"

# Run tests using the project's Jest infrastructure
print_section "RUNNING 100% COVERAGE TESTS"

print_info "Running 100% coverage tests using project's Jest infrastructure..."

cd apps/api

if pnpm exec jest --config=jest.100percent.config.json --no-cache; then
    print_success "All 100% coverage tests passed successfully!"
else
    print_error "Some tests failed. Check the output above for details."
    cd ..
    exit 1
fi

cd ..

# Generate coverage summary
print_section "COVERAGE ANALYSIS"

if [ -f "apps/api/coverage/100percent/coverage-summary.json" ]; then
    print_info "Coverage Summary:"
    
    # Try to parse and display coverage summary
    if command -v jq &> /dev/null; then
        echo "Lines Coverage: $(jq -r '.total.lines.pct' apps/api/coverage/100percent/coverage-summary.json)%"
        echo "Functions Coverage: $(jq -r '.total.functions.pct' apps/api/coverage/100percent/coverage-summary.json)%"
        echo "Branches Coverage: $(jq -r '.total.branches.pct' apps/api/coverage/100percent/coverage-summary.json)%"
        echo "Statements Coverage: $(jq -r '.total.statements.pct' apps/api/coverage/100percent/coverage-summary.json)%"
        
        # Check if 100% coverage achieved
        LINES_COVERAGE=$(jq -r '.total.lines.pct' apps/api/coverage/100percent/coverage-summary.json)
        FUNCTIONS_COVERAGE=$(jq -r '.total.functions.pct' apps/api/coverage/100percent/coverage-summary.json)
        BRANCHES_COVERAGE=$(jq -r '.total.branches.pct' apps/api/coverage/100percent/coverage-summary.json)
        STATEMENTS_COVERAGE=$(jq -r '.total.statements.pct' apps/api/coverage/100percent/coverage-summary.json)
        
        if [[ "$LINES_COVERAGE" == "100" && "$FUNCTIONS_COVERAGE" == "100" && "$BRANCHES_COVERAGE" == "100" && "$STATEMENTS_COVERAGE" == "100" ]]; then
            print_success "🎯 100% COVERAGE ACHIEVED!"
        else
            print_warning "Coverage not at 100%. Review coverage reports."
        fi
    else
        print_info "Install jq to see detailed coverage summary"
        print_info "Coverage report available at: apps/api/coverage/100percent/index.html"
    fi
else
    print_error "Coverage summary not found"
fi

# Count test files and test cases
print_section "TEST STATISTICS"

TOTAL_TEST_FILES=$(find apps/api/src -name "*.100percent.spec.ts" | wc -l)
print_info "Total 100% coverage test files: $TOTAL_TEST_FILES"

TOTAL_TEST_CASES=$(grep -r "test(" apps/api/src --include="*.100percent.spec.ts" | wc -l)
print_info "Total test cases: $TOTAL_TEST_CASES"

# Check coverage reports
print_section "COVERAGE REPORTS"

if [ -d "apps/api/coverage/100percent" ]; then
    print_success "Coverage reports generated:"
    print_info "HTML Report: apps/api/coverage/100percent/index.html"
    print_info "LCOV Report: apps/api/coverage/100percent/lcov.info"
    print_info "JSON Report: apps/api/coverage/100percent/coverage-summary.json"
    print_info "Clover Report: apps/api/coverage/100percent/clover.xml"
    
    if [ -f "apps/api/coverage/100percent/index.html" ]; then
        print_info "Open apps/api/coverage/100percent/index.html in your browser to view detailed coverage"
    fi
else
    print_error "No coverage directory found"
fi

# Final summary
print_section "FINAL SUMMARY"

print_success "100% Coverage Test Execution Complete!"
print_info "Execution completed at: $(date)"

# Generate summary report
cat > PROJECT_100_PERCENT_COVERAGE_SUMMARY.md << EOF
# Project-Specific 100% Coverage Execution Summary

## Execution Details
- **Started**: $TIMESTAMP
- **Completed**: $(date)
- **Method**: Project-specific Jest execution

## Test Statistics
- **Total Test Files**: $TOTAL_TEST_FILES
- **Total Test Cases**: $TOTAL_TEST_CASES

## Coverage Reports
- **HTML Report**: apps/api/coverage/100percent/index.html
- **LCOV Report**: apps/api/coverage/100percent/lcov.info
- **JSON Report**: apps/api/coverage/100percent/coverage-summary.json

## Services Tested
1. Auth Service - auth.service.100percent.working.spec.ts
2. Bookings Service - bookings.service.100percent.final.spec.ts
3. Admin Service - admin.service.100percent.spec.ts
4. Field Encryption Service - field-encryption.service.100percent.spec.ts
5. Cache Service - cache.service.100percent.spec.ts
6. Events Service - events.service.100percent.spec.ts
7. FX Service - fx.service.100percent.spec.ts
8. Storage Service - storage.service.100percent.spec.ts

## Status
✅ **PROJECT-SPECIFIC TEST EXECUTION COMPLETE**
🎯 **TARGET: 100% COVERAGE ACHIEVEMENT**

## Next Steps
1. Review coverage reports for detailed results
2. Address any remaining test failures
3. Integrate with CI/CD pipeline
4. Deploy to production with confidence
EOF

print_success "Summary report generated: PROJECT_100_PERCENT_COVERAGE_SUMMARY.md"

echo -e "\n${PURPLE}============================================================================${NC}"
echo -e "${PURPLE}     PROJECT-SPECIFIC 100% COVERAGE EXECUTION - COMPLETE${NC}"
echo -e "${PURPLE}============================================================================${NC}"
echo -e "${CYAN}Next: Review coverage reports and celebrate 100% coverage! 🎉${NC}"
echo -e "${CYAN}Target: 100% test coverage across all services 🎯${NC}"
echo ""

exit 0
