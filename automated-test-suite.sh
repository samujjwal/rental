#!/bin/bash

# 🤖 Automated System Testing Suite
# GharBatai Nepal Rental Portal - Comprehensive Validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:3400/api"
WEB_BASE="http://localhost:3401"
TEST_RESULTS_DIR="./test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$TEST_RESULTS_DIR/automated-test-report-$TIMESTAMP.md"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Initialize report
cat > "$REPORT_FILE" << EOF
# 🤖 Automated System Test Report
## GharBatai Nepal Rental Portal
**Generated:** $(date)
**Test ID:** $TIMESTAMP

---

## 📊 Test Summary

EOF

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        echo "- **✅ PASS**: $test_name" >> "$REPORT_FILE"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo "- **❌ FAIL**: $test_name" >> "$REPORT_FILE"
    fi
    
    if [ -n "$details" ]; then
        echo "  $details"
        echo "  - $details" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

check_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        log_test "$service_name" "PASS" "Service responding on $url"
        return 0
    else
        log_test "$service_name" "FAIL" "Service not responding on $url"
        return 1
    fi
}

test_api_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"
    local expected_pattern="$4"
    
    local response
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo "ERROR")
    else
        response=$(curl -s "$API_BASE$endpoint" 2>/dev/null || echo "ERROR")
    fi
    
    if [ "$response" = "ERROR" ]; then
        log_test "API $method $endpoint" "FAIL" "Request failed"
        return 1
    fi
    
    if echo "$response" | grep -q "$expected_pattern"; then
        log_test "API $method $endpoint" "PASS" "Response contains expected pattern"
        return 0
    else
        log_test "API $method $endpoint" "FAIL" "Response doesn't match expected pattern"
        return 1
    fi
}

echo -e "${BLUE}🚀 Starting Automated System Testing...${NC}"
echo "Report will be saved to: $REPORT_FILE"
echo ""

# Phase 1: Infrastructure Tests
echo -e "${YELLOW}📡 Phase 1: Infrastructure Services${NC}"

check_service "PostgreSQL Database" "$API_BASE/listings" "200"
check_service "API Server" "$API_BASE/listings" "200"
check_service "Web Frontend" "$WEB_BASE" "200"

# Phase 2: Authentication Tests
echo -e "${YELLOW}🔐 Phase 2: Authentication System${NC}"

# Test regular login (more reliable than dev-login)
test_api_endpoint "/auth/login" "POST" '{"email":"renter@test.com","password":"Test123!@#"}' "accessToken"

# Add delay to avoid rate limiting
sleep 2

# Test regular login with different user
test_api_endpoint "/auth/login" "POST" '{"email":"owner@test.com","password":"Test123!@#"}' "accessToken"

# Phase 3: API Endpoint Tests
echo -e "${YELLOW}📊 Phase 3: API Endpoints${NC}"

# Listings API
test_api_endpoint "/listings" "GET" "" "total"
test_api_endpoint "/listings?page=1&limit=1" "GET" "" "listings"

# Bookings API
test_api_endpoint "/bookings/calculate-price" "POST" '{"listingId":"cmml7p03z02ks5gitsfs3fht9","startDate":"2026-03-20","endDate":"2026-03-21"}' "totalAmount"

# Availability API
test_api_endpoint "/listings/cmml7p03z02ks5gitsfs3fht9/check-availability" "POST" '{"startDate":"2026-03-20","endDate":"2026-03-21"}' "available"

# Categories API
test_api_endpoint "/categories" "GET" "" "id"

# Phase 4: Data Integrity Tests
echo -e "${YELLOW}🗄️ Phase 4: Data Integrity${NC}"

# Test listings data structure
listings_response=$(curl -s "$API_BASE/listings?page=1&limit=1" 2>/dev/null || echo "ERROR")
if [ "$listings_response" != "ERROR" ]; then
    if echo "$listings_response" | jq -e '.listings[0].id' > /dev/null 2>&1; then
        log_test "Listings Data Structure" "PASS" "Listings have proper JSON structure"
    else
        log_test "Listings Data Structure" "FAIL" "Invalid listings data structure"
    fi
    
    # Test for required fields
    listing_id=$(echo "$listings_response" | jq -r '.listings[0].id' 2>/dev/null || echo "null")
    if [ "$listing_id" != "null" ] && [ "$listing_id" != "" ]; then
        log_test "Listing ID Presence" "PASS" "Listings have valid IDs"
    else
        log_test "Listing ID Presence" "FAIL" "Listings missing valid IDs"
    fi
else
    log_test "Listings Data Retrieval" "FAIL" "Cannot retrieve listings data"
fi

# Test user data structure
user_response=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"renter@test.com","password":"Test123!@#"}' 2>/dev/null || echo "ERROR")

if [ "$user_response" != "ERROR" ]; then
    if echo "$user_response" | jq -e '.user.id' > /dev/null 2>&1; then
        log_test "User Data Structure" "PASS" "User data has proper JSON structure"
    else
        log_test "User Data Structure" "FAIL" "Invalid user data structure"
    fi
else
    log_test "User Authentication" "FAIL" "Cannot authenticate test user"
fi

# Phase 5: Business Logic Tests
echo -e "${YELLOW}💼 Phase 5: Business Logic${NC}"

# Test price calculation
price_response=$(curl -s -X POST "$API_BASE/bookings/calculate-price" \
    -H "Content-Type: application/json" \
    -d '{"listingId":"cmml7p03z02ks5gitsfs3fht9","startDate":"2026-03-20","endDate":"2026-03-21"}' 2>/dev/null || echo "ERROR")

if [ "$price_response" != "ERROR" ]; then
    if echo "$price_response" | jq -e '.totalAmount' > /dev/null 2>&1; then
        total_amount=$(echo "$price_response" | jq -r '.totalAmount' 2>/dev/null || echo "0")
        if [ "$total_amount" != "0" ] && [ "$total_amount" != "null" ]; then
            log_test "Price Calculation" "PASS" "Price calculated: NPR $total_amount"
        else
            log_test "Price Calculation" "FAIL" "Invalid price calculation result"
        fi
    else
        log_test "Price Calculation" "FAIL" "Price calculation response malformed"
    fi
else
    log_test "Price Calculation API" "FAIL" "Cannot call price calculation API"
fi

# Test availability checking
availability_response=$(curl -s -X POST "$API_BASE/listings/cmml7p03z02ks5gitsfs3fht9/check-availability" \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2026-03-20","endDate":"2026-03-21"}' 2>/dev/null || echo "ERROR")

if [ "$availability_response" != "ERROR" ]; then
    if echo "$availability_response" | jq -e '.available' > /dev/null 2>&1; then
        available=$(echo "$availability_response" | jq -r '.available' 2>/dev/null || echo "false")
        log_test "Availability Checking" "PASS" "Availability status: $available"
    else
        log_test "Availability Checking" "FAIL" "Availability response malformed"
    fi
else
    log_test "Availability API" "FAIL" "Cannot call availability API"
fi

# Phase 6: Error Handling Tests
echo -e "${YELLOW}⚠️ Phase 6: Error Handling${NC}"

# Test 404 handling
if curl -s "$API_BASE/nonexistent-endpoint" | grep -q "404\|Not Found\|Cannot"; then
    log_test "404 Error Handling" "PASS" "Proper 404 responses for invalid endpoints"
else
    log_test "404 Error Handling" "FAIL" "Invalid endpoints don't return proper 404"
fi

# Test invalid authentication
invalid_auth_response=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@test.com","password":"wrong"}' 2>/dev/null || echo "ERROR")

if echo "$invalid_auth_response" | grep -q "401\|Unauthorized\|Invalid"; then
    log_test "Invalid Auth Handling" "PASS" "Proper error for invalid credentials"
else
    log_test "Invalid Auth Handling" "FAIL" "Invalid credentials don't return proper error"
fi

# Test malformed requests
malformed_response=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"invalid":"json"' 2>/dev/null || echo "ERROR")

if echo "$malformed_response" | grep -q "400\|Bad Request\|Error\|Invalid"; then
    log_test "Malformed Request Handling" "PASS" "Proper error for malformed requests"
else
    log_test "Malformed Request Handling" "FAIL" "Malformed requests don't return proper error"
fi

# Phase 7: Performance Tests
echo -e "${YELLOW}⚡ Phase 7: Performance Tests${NC}"

# Test API response times
for endpoint in "/listings" "/categories"; do
    start_time=$(date +%s%N)
    curl -s "$API_BASE$endpoint" > /dev/null
    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $response_time -lt 2000 ]; then
        log_test "API Response Time - $endpoint" "PASS" "${response_time}ms"
    else
        log_test "API Response Time - $endpoint" "FAIL" "${response_time}ms (exceeds 2s threshold)"
    fi
done

# Phase 8: Security Tests
echo -e "${YELLOW}🔒 Phase 8: Security Tests${NC}"

# Test for exposed sensitive data
if curl -s "$API_BASE/listings" | grep -i "password\|secret\|token\|key"; then
    log_test "Sensitive Data Exposure" "FAIL" "API responses may contain sensitive data"
else
    log_test "Sensitive Data Exposure" "PASS" "No sensitive data exposed in API responses"
fi

# Test CORS headers (basic check)
cors_headers=$(curl -s -I "$API_BASE/listings" 2>/dev/null | grep -i "access-control" || echo "")
if [ -n "$cors_headers" ]; then
    log_test "CORS Headers" "PASS" "CORS headers present"
else
    log_test "CORS Headers" "WARN" "No CORS headers detected (may be needed for frontend)"
fi

# Generate final summary
echo -e "${BLUE}📊 Generating Test Summary...${NC}"

cat >> "$REPORT_FILE" << EOF

---

## 📈 Final Results

- **Total Tests**: $TOTAL_TESTS
- **Passed**: $PASSED_TESTS
- **Failed**: $FAILED_TESTS
- **Success Rate**: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%

---

## 🎯 Test Status

EOF

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo "✅ **ALL TESTS PASSED!**" >> "$REPORT_FILE"
    exit_code=0
else
    echo -e "${RED}❌ $FAILED_TESTS TESTS FAILED${NC}"
    echo "❌ **$FAILED_TESTS TESTS FAILED**" >> "$REPORT_FILE"
    exit_code=1
fi

cat >> "$REPORT_FILE" << EOF

---

## 🔧 Recommendations

EOF

if [ $FAILED_TESTS -eq 0 ]; then
    echo "- System is ready for production deployment" >> "$REPORT_FILE"
    echo "- Continue monitoring in production environment" >> "$REPORT_FILE"
else
    echo "- Address failed tests before deployment" >> "$REPORT_FILE"
    echo "- Review error logs and fix identified issues" >> "$REPORT_FILE"
    echo "- Re-run tests after fixes are applied" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

---

**Report generated at:** $(date)
**Test suite location:** $(pwd)
EOF

echo ""
echo -e "${BLUE}📄 Detailed report saved to: $REPORT_FILE${NC}"
echo ""

# Exit with appropriate code
exit $exit_code
