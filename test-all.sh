#!/bin/bash

# Test Execution Script for Universal Rental Portal
# This script runs all tests and generates a comprehensive report

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Start timestamp
START_TIME=$(date +%s)
TEST_RESULTS_DIR="test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TEST_RESULTS_DIR"

print_status "Starting comprehensive test suite..."
print_status "Results will be saved to: $TEST_RESULTS_DIR"
echo ""

# Check if services are running
print_status "Checking if required services are running..."

if ! docker ps | grep -q "postgres"; then
    print_warning "PostgreSQL not running. Starting..."
    docker compose up -d postgres
    sleep 5
fi

if ! docker ps | grep -q "redis"; then
    print_warning "Redis not running. Starting..."
    docker compose up -d redis
    sleep 2
fi

print_success "All required services are running"
echo ""

# Navigate to API directory
cd "$(dirname "$0")/apps/api"

# 1. Unit Tests
print_status "Running unit tests..."
if npm run test -- --coverage --json --outputFile="../../$TEST_RESULTS_DIR/unit-tests.json" > "../../$TEST_RESULTS_DIR/unit-tests.log" 2>&1; then
    print_success "Unit tests passed ✓"
    UNIT_TESTS_PASSED=true
else
    print_error "Unit tests failed ✗"
    print_error "See $TEST_RESULTS_DIR/unit-tests.log for details"
    UNIT_TESTS_PASSED=false
fi
echo ""

# 2. E2E Tests
print_status "Running E2E tests..."
if npm run test:e2e -- --json --outputFile="../../$TEST_RESULTS_DIR/e2e-tests.json" > "../../$TEST_RESULTS_DIR/e2e-tests.log" 2>&1; then
    print_success "E2E tests passed ✓"
    E2E_TESTS_PASSED=true
else
    print_error "E2E tests failed ✗"
    print_error "See $TEST_RESULTS_DIR/e2e-tests.log for details"
    E2E_TESTS_PASSED=false
fi
echo ""

# 3. Linting
print_status "Running linter..."
if npm run lint > "../../$TEST_RESULTS_DIR/lint.log" 2>&1; then
    print_success "Linting passed ✓"
    LINT_PASSED=true
else
    print_error "Linting failed ✗"
    print_error "See $TEST_RESULTS_DIR/lint.log for details"
    LINT_PASSED=false
fi
echo ""

# 4. Type checking
print_status "Running TypeScript type checking..."
if npx tsc --noEmit > "../../$TEST_RESULTS_DIR/typecheck.log" 2>&1; then
    print_success "Type checking passed ✓"
    TYPECHECK_PASSED=true
else
    print_error "Type checking failed ✗"
    print_error "See $TEST_RESULTS_DIR/typecheck.log for details"
    TYPECHECK_PASSED=false
fi
echo ""

# 5. Security audit
print_status "Running security audit..."
if npm audit --audit-level=moderate > "../../$TEST_RESULTS_DIR/security-audit.log" 2>&1; then
    print_success "Security audit passed ✓"
    SECURITY_PASSED=true
else
    print_warning "Security audit found vulnerabilities"
    print_warning "See $TEST_RESULTS_DIR/security-audit.log for details"
    SECURITY_PASSED=false
fi
echo ""

# Navigate back to root
cd ../..

# 6. Load Tests (if available)
if [ -f "apps/api/test/load/search-queries.load.js" ]; then
    print_status "Running load tests (this may take a few minutes)..."
    
    # Start API server in background
    cd apps/api
    npm run start:dev > "../../$TEST_RESULTS_DIR/api-server.log" 2>&1 &
    API_PID=$!
    print_status "API server started (PID: $API_PID)"
    
    # Wait for API to be ready
    print_status "Waiting for API to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            print_success "API is ready"
            break
        fi
        sleep 2
    done
    
    cd test/load
    
    # Run load tests
    if command -v k6 &> /dev/null; then
        print_status "Running search queries load test..."
        k6 run search-queries.load.js > "../../../$TEST_RESULTS_DIR/load-search.log" 2>&1
        
        print_status "Running booking flow load test..."
        k6 run bookings-flow.load.js > "../../../$TEST_RESULTS_DIR/load-bookings.log" 2>&1
        
        print_success "Load tests completed ✓"
        LOAD_TESTS_PASSED=true
    else
        print_warning "k6 not installed. Skipping load tests."
        print_warning "Install k6: https://k6.io/docs/getting-started/installation/"
        LOAD_TESTS_PASSED="skipped"
    fi
    
    # Stop API server
    kill $API_PID 2>/dev/null || true
    
    cd ../../..
else
    print_warning "Load tests not found. Skipping."
    LOAD_TESTS_PASSED="skipped"
fi
echo ""

# Generate summary report
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

print_status "Generating test report..."

cat > "$TEST_RESULTS_DIR/SUMMARY.md" << EOF
# Test Execution Summary

**Date:** $(date)
**Duration:** ${DURATION}s

---

## Results Overview

| Test Suite | Status |
|------------|--------|
| Unit Tests | $([ "$UNIT_TESTS_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED") |
| E2E Tests | $([ "$E2E_TESTS_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED") |
| Linting | $([ "$LINT_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED") |
| Type Checking | $([ "$TYPECHECK_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED") |
| Security Audit | $([ "$SECURITY_PASSED" = true ] && echo "✅ PASSED" || echo "⚠️ WARNINGS") |
| Load Tests | $([ "$LOAD_TESTS_PASSED" = true ] && echo "✅ PASSED" || [ "$LOAD_TESTS_PASSED" = "skipped" ] && echo "⏭️ SKIPPED" || echo "❌ FAILED") |

---

## Detailed Results

### Unit Tests
$([ "$UNIT_TESTS_PASSED" = true ] && echo "All unit tests passed successfully." || echo "Some unit tests failed. Check unit-tests.log for details.")

### E2E Tests
$([ "$E2E_TESTS_PASSED" = true ] && echo "All E2E tests passed successfully." || echo "Some E2E tests failed. Check e2e-tests.log for details.")

### Linting
$([ "$LINT_PASSED" = true ] && echo "No linting errors found." || echo "Linting errors found. Check lint.log for details.")

### Type Checking
$([ "$TYPECHECK_PASSED" = true ] && echo "No type errors found." || echo "Type errors found. Check typecheck.log for details.")

### Security Audit
$([ "$SECURITY_PASSED" = true ] && echo "No security vulnerabilities found." || echo "Security vulnerabilities found. Check security-audit.log for details.")

---

## Next Steps

$(if [ "$UNIT_TESTS_PASSED" = true ] && [ "$E2E_TESTS_PASSED" = true ] && [ "$LINT_PASSED" = true ] && [ "$TYPECHECK_PASSED" = true ]; then
    echo "✅ **All critical tests passed!** Your code is ready for deployment."
    echo ""
    echo "Recommended actions:"
    echo "1. Review test coverage report"
    echo "2. Address any security audit warnings"
    echo "3. Proceed with deployment preparation"
else
    echo "❌ **Some tests failed.** Please address the issues before deployment."
    echo ""
    echo "Required actions:"
    [ "$UNIT_TESTS_PASSED" = false ] && echo "- Fix failing unit tests"
    [ "$E2E_TESTS_PASSED" = false ] && echo "- Fix failing E2E tests"
    [ "$LINT_PASSED" = false ] && echo "- Fix linting errors"
    [ "$TYPECHECK_PASSED" = false ] && echo "- Fix type errors"
    [ "$SECURITY_PASSED" = false ] && echo "- Review and address security vulnerabilities"
fi)

---

## Test Artifacts

All test logs and reports are available in the \`$TEST_RESULTS_DIR\` directory:

- \`unit-tests.log\` - Unit test output
- \`unit-tests.json\` - Unit test results (JSON)
- \`e2e-tests.log\` - E2E test output
- \`e2e-tests.json\` - E2E test results (JSON)
- \`lint.log\` - Linting output
- \`typecheck.log\` - Type checking output
- \`security-audit.log\` - Security audit output
$([ "$LOAD_TESTS_PASSED" != "skipped" ] && echo "- \`load-search.log\` - Search load test results" || echo "")
$([ "$LOAD_TESTS_PASSED" != "skipped" ] && echo "- \`load-bookings.log\` - Booking load test results" || echo "")

---

**Generated by:** test-all.sh
**Report Location:** $TEST_RESULTS_DIR/SUMMARY.md
EOF

print_success "Test report generated: $TEST_RESULTS_DIR/SUMMARY.md"
echo ""

# Display summary
print_status "==================================="
print_status "TEST EXECUTION COMPLETE"
print_status "==================================="
echo ""

if [ "$UNIT_TESTS_PASSED" = true ] && [ "$E2E_TESTS_PASSED" = true ] && [ "$LINT_PASSED" = true ] && [ "$TYPECHECK_PASSED" = true ]; then
    print_success "✓ All critical tests passed!"
    print_success "✓ Code is ready for deployment"
    exit 0
else
    print_error "✗ Some tests failed"
    print_error "✗ Please review the test results and fix issues"
    exit 1
fi
