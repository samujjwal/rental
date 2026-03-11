#!/bin/bash

# 🎭 AUTOMATED PLAYWRIGHT TEST RUNNER
# Runs E2E tests with proper service management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEST_RESULTS_DIR="./test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PLAYWRIGHT_REPORT="$TEST_RESULTS_DIR/playwright-test-report-$TIMESTAMP.md"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Initialize report
cat > "$PLAYWRIGHT_REPORT" << EOF
# 🎭 Playwright E2E Test Report
## GharBatai Nepal Rental Portal - End-to-End Testing

**Generated:** $(date)
**Test ID:** $TIMESTAMP

---

## 📊 E2E Test Results

EOF

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=""

# Helper functions
log_test_result() {
    local test_name="$1"
    local status="$2"
    local duration="$3"
    local details="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ $test_name PASSED${NC} (${duration}s)"
        TEST_RESULTS="$TEST_RESULTS$test_name:PASS:$duration\n"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ $test_name FAILED${NC} (${duration}s)"
        TEST_RESULTS="$TEST_RESULTS$test_name:FAIL:$duration\n"
    fi
    
    if [ -n "$details" ]; then
        echo "   $details"
    fi
    
    # Add to report
    echo "### $test_name" >> "$PLAYWRIGHT_REPORT"
    echo "- **Status**: $status" >> "$PLAYWRIGHT_REPORT"
    echo "- **Duration**: ${duration}s" >> "$PLAYWRIGHT_REPORT"
    if [ -n "$details" ]; then
        echo "- **Details**: $details" >> "$PLAYWRIGHT_REPORT"
    fi
    echo "" >> "$PLAYWRIGHT_REPORT"
}

check_services() {
    echo -e "${BLUE}🔍 Checking service availability...${NC}"
    
    # Check if API is running
    if curl -s http://localhost:3400/api/listings > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API Server is running${NC}"
    else
        echo -e "${YELLOW}⚠️ API Server not running, starting...${NC}"
        cd apps/api && npm run dev > /dev/null 2>&1 &
        API_PID=$!
        sleep 10
        
        if curl -s http://localhost:3400/api/listings > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API Server started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start API Server${NC}"
            return 1
        fi
        cd ../..
    fi
    
    # Check if Web is running
    if curl -s http://localhost:3401 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Web Frontend is running${NC}"
    else
        echo -e "${YELLOW}⚠️ Web Frontend not running, starting...${NC}"
        cd apps/web && npm run dev > /dev/null 2>&1 &
        WEB_PID=$!
        sleep 10
        
        if curl -s http://localhost:3401 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Web Frontend started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start Web Frontend${NC}"
            return 1
        fi
        cd ../..
    fi
    
    return 0
}

cleanup_services() {
    echo -e "${BLUE}🧹 Cleaning up services...${NC}"
    
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Stopped API Server${NC}"
    fi
    
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Stopped Web Frontend${NC}"
    fi
}

run_playwright_test() {
    local test_name="$1"
    local test_files="$2"
    local description="$3"
    
    echo -e "${PURPLE}🎭 Running $test_name...${NC}"
    echo "Description: $description"
    echo "Files: $test_files"
    echo ""
    
    local start_time=$(date +%s)
    
    cd apps/web
    
    # Run Playwright tests
    mkdir -p "$TEST_RESULTS_DIR/playwright-$TIMESTAMP"
    if npx playwright test $test_files --config=playwright.local.config.ts --reporter=line,html --output-dir="$TEST_RESULTS_DIR/playwright-$TIMESTAMP" 2>&1 | tee "$TEST_RESULTS_DIR/playwright-$test_name-$TIMESTAMP.log"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_test_result "$test_name" "PASS" "$duration" "All E2E tests passed"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_test_result "$test_name" "FAIL" "$duration" "Some E2E tests failed - check logs"
    fi
    
    cd ../..
    echo ""
}

echo -e "${PURPLE}🎭 AUTOMATED PLAYWRIGHT TEST SUITE${NC}"
echo -e "${CYAN}GharBatai Nepal Rental Portal - End-to-End Testing${NC}"
echo ""
echo "Started at: $(date)"
echo "Playwright report: $PLAYWRIGHT_REPORT"
echo ""

# Check and start services if needed
if ! check_services; then
    echo -e "${RED}❌ Failed to start required services${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🎭 Phase 1: Core E2E Tests${NC}"

# Core user journeys
run_playwright_test "Authentication Flows" \
    "e2e/auth.spec.ts" \
    "Login, registration, password recovery"

run_playwright_test "User Dashboard" \
    "e2e/renter-dashboard.spec.ts e2e/owner-dashboard.spec.ts" \
    "Dashboard functionality and navigation"

run_playwright_test "Booking Journey" \
    "e2e/renter-booking-journey.spec.ts" \
    "Complete booking workflow"

run_playwright_test "Search & Browse" \
    "e2e/search-browse.spec.ts e2e/home.spec.ts" \
    "Property search and browsing"

echo -e "${YELLOW}🎭 Phase 2: Advanced E2E Tests${NC}"

run_playwright_test "Admin Flows" \
    "e2e/admin-flows.spec.ts e2e/test-admin-basic.spec.ts" \
    "Admin functionality and management"

run_playwright_test "Owner Features" \
    "e2e/owner-listings.spec.ts e2e/test-owner-login.spec.ts" \
    "Property owner workflows"

run_playwright_test "User Interactions" \
    "e2e/favorites.spec.ts e2e/messages.spec.ts e2e/disputes.spec.ts" \
    "Favorites, messaging, and dispute resolution"

run_playwright_test "Payments & Reviews" \
    "e2e/payments-reviews-notifications.spec.ts" \
    "Payment processing and review system"

echo -e "${YELLOW}🎭 Phase 3: Quality Assurance${NC}"

run_playwright_test "Responsive Design" \
    "e2e/responsive-accessibility.spec.ts" \
    "Mobile, tablet, desktop compatibility"

run_playwright_test "Portal Consistency" \
    "e2e/portal-layout-consistency.spec.ts" \
    "UI consistency across pages"

run_playwright_test "Route Health" \
    "e2e/route-health.spec.ts" \
    "All routes accessibility and functionality"

run_playwright_test "Smoke Tests" \
    "e2e/smoke.spec.ts" \
    "Critical path validation"

# Cleanup services
cleanup_services

# Generate final summary
echo -e "${CYAN}📊 Generating Playwright test summary...${NC}"

cat >> "$PLAYWRIGHT_REPORT" << EOF

---

## 📈 Overall Results

- **Total Test Suites**: $TOTAL_TESTS
- **Passed**: $PASSED_TESTS
- **Failed**: $FAILED_TESTS
- **Success Rate**: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%

---

## 📋 Test-by-Test Results

EOF

# Add detailed results
echo -e "$TEST_RESULTS" | while IFS= read -r line; do
    if [ -n "$line" ]; then
        IFS=':' read -r name status duration <<< "$line"
        echo "#### $name" >> "$PLAYWRIGHT_REPORT"
        if [ "$status" = "PASS" ]; then
            echo "- **Status**: ✅ PASSED" >> "$PLAYWRIGHT_REPORT"
        else
            echo "- **Status**: ❌ FAILED" >> "$PLAYWRIGHT_REPORT"
        fi
        echo "- **Duration**: ${duration}s" >> "$PLAYWRIGHT_REPORT"
        echo "" >> "$PLAYWRIGHT_REPORT"
    fi
done

# Add recommendations
if [ $FAILED_TESTS -eq 0 ]; then
    cat >> "$PLAYWRIGHT_REPORT" << EOF

---

## 🎉 E2E Tests Perfect!

All E2E test suites passed successfully. The user interface and workflows are functioning correctly.

**Validated:**
- User authentication flows
- Complete booking journeys
- Admin and owner workflows
- Responsive design across devices
- Payment and review systems
- Route accessibility

**Next Steps:**
1. Deploy to staging for final validation
2. Monitor production user journeys
3. Set up scheduled E2E test runs

EOF
else
    cat >> "$PLAYWRIGHT_REPORT" << EOF

---

## ⚠️ E2E Issues Detected

$FAILED_TESTS E2E test suite(s) failed. Review the detailed logs and fix identified issues.

**Immediate Actions Required:**
1. Review failed test logs in $TEST_RESULTS_DIR/
2. Check for UI changes that broke tests
3. Verify test data and environment setup
4. Update selectors and test expectations

EOF
fi

# Add test artifacts
cat >> "$PLAYWRIGHT_REPORT" << EOF

---

## 📁 Test Artifacts

Generated E2E test outputs:

EOF

find "$TEST_RESULTS_DIR" -name "*playwright*$TIMESTAMP*" -type f | while read file; do
    echo "- $(basename "$file")" >> "$PLAYWRIGHT_REPORT"
done

cat >> "$PLAYWRIGHT_REPORT" << EOF

---

**Playwright E2E test suite completed**
**Generated at:** $(date)

EOF

# Final summary
echo ""
echo -e "${PURPLE}🎭 PLAYWRIGHT E2E TEST SUITE COMPLETED${NC}"
echo ""
echo -e "${CYAN}📊 Results Summary:${NC}"
echo "- Total Test Suites: $TOTAL_TESTS"
echo "- Passed: $PASSED_TESTS"
echo "- Failed: $FAILED_TESTS"
echo "- Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
echo ""
echo -e "${CYAN}📄 Reports Generated:${NC}"
echo "- Playwright Report: $PLAYWRIGHT_REPORT"
echo "- Test Logs: $TEST_RESULTS_DIR/playwright-*-$TIMESTAMP.log"
echo "- HTML Report: Available via Playwright HTML reporter"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL E2E TESTS PASSED! User workflows are working perfectly.${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS E2E TEST SUITES FAILED. Review logs and fix issues.${NC}"
    exit 1
fi
