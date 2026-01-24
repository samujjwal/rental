#!/usr/bin/env bash

# Quick Security Test Script
# Tests common OWASP vulnerabilities without full ZAP scan

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL=${API_URL:-http://localhost:3000}
API_VERSION=${API_VERSION:-v1}
BASE_URL="${API_URL}/api/${API_VERSION}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Quick Security Vulnerability Tests${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${YELLOW}Test ${TOTAL_TESTS}:${NC} ${test_name}"
    
    if eval "${test_command}" | grep -q "${expected_result}"; then
        echo -e "${GREEN}  ✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}  ✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

echo -e "${YELLOW}1. SQL Injection Tests${NC}"
echo "Testing common SQL injection patterns..."
echo ""

# Test SQL injection in query parameters
run_test "SQL Injection - Query Parameter" \
    "curl -s -o /dev/null -w '%{http_code}' '${BASE_URL}/listings?search=test'\'' OR '\''1'\''='\''1'" \
    "400\|404\|403"

# Test SQL injection in authentication
run_test "SQL Injection - Authentication" \
    "curl -s -o /dev/null -w '%{http_code}' -X POST '${BASE_URL}/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"admin'\'' OR '\''1'\''='\''1\",\"password\":\"test\"}'" \
    "400\|401"

echo -e "${YELLOW}2. XSS (Cross-Site Scripting) Tests${NC}"
echo "Testing XSS attack vectors..."
echo ""

# Test XSS in query parameters
run_test "XSS - Query Parameter" \
    "curl -s '${BASE_URL}/search?q=<script>alert(1)</script>' | grep -v '<script>'" \
    ""

# Test XSS in POST body
run_test "XSS - POST Body" \
    "curl -s -X POST '${BASE_URL}/auth/signup' -H 'Content-Type: application/json' -d '{\"name\":\"<script>alert(1)</script>\",\"email\":\"test@test.com\"}' | grep -v '<script>'" \
    ""

echo -e "${YELLOW}3. Authentication & Authorization Tests${NC}"
echo "Testing authentication bypass attempts..."
echo ""

# Test accessing protected endpoint without token
run_test "No Authentication Token" \
    "curl -s -o /dev/null -w '%{http_code}' '${BASE_URL}/bookings'" \
    "401"

# Test accessing protected endpoint with invalid token
run_test "Invalid Authentication Token" \
    "curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer invalid_token' '${BASE_URL}/bookings'" \
    "401"

# Test accessing admin endpoint as regular user (requires setup)
echo -e "${YELLOW}  Note: Admin authorization test requires user setup${NC}"

echo -e "${YELLOW}4. Rate Limiting Tests${NC}"
echo "Testing rate limit protection..."
echo ""

# Test rate limiting with rapid requests
echo "Sending 20 rapid requests..."
RATE_LIMIT_HIT=false
for i in {1..20}; do
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/auth/login")
    if [ "$STATUS" = "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    echo -e "${GREEN}  ✓ PASS - Rate limiting is working${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}  ✗ FAIL - Rate limiting not triggered${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

echo -e "${YELLOW}5. CORS Tests${NC}"
echo "Testing CORS configuration..."
echo ""

# Test CORS headers
run_test "CORS Headers Present" \
    "curl -s -I -X OPTIONS '${BASE_URL}/health' -H 'Origin: http://evil.com'" \
    "Access-Control-Allow-Origin"

# Test CORS with malicious origin
run_test "CORS Rejects Unauthorized Origins" \
    "curl -s -I -X OPTIONS '${BASE_URL}/bookings' -H 'Origin: http://evil.com' | grep 'Access-Control-Allow-Origin' | grep -v 'http://evil.com'" \
    ""

echo -e "${YELLOW}6. Security Headers Tests${NC}"
echo "Testing security headers..."
echo ""

# Test for security headers
run_test "X-Frame-Options Header" \
    "curl -s -I '${BASE_URL}/health'" \
    "X-Frame-Options\|x-frame-options"

run_test "X-Content-Type-Options Header" \
    "curl -s -I '${BASE_URL}/health'" \
    "X-Content-Type-Options\|x-content-type-options"

run_test "Strict-Transport-Security Header (HTTPS)" \
    "curl -s -I '${BASE_URL}/health'" \
    "Strict-Transport-Security\|strict-transport-security"

echo -e "${YELLOW}7. Input Validation Tests${NC}"
echo "Testing input validation..."
echo ""

# Test extremely long input
run_test "Long Input Rejection" \
    "curl -s -o /dev/null -w '%{http_code}' -X POST '${BASE_URL}/auth/signup' -H 'Content-Type: application/json' -d '{\"name\":\"$(python3 -c 'print(\"A\" * 10000)')\",\"email\":\"test@test.com\"}'" \
    "400"

# Test special characters
run_test "Special Characters Validation" \
    "curl -s -o /dev/null -w '%{http_code}' -X POST '${BASE_URL}/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"../../../../etc/passwd\"}'" \
    "400\|401"

echo -e "${YELLOW}8. File Upload Security Tests${NC}"
echo "Testing file upload validation..."
echo ""

# Test malicious file upload (requires multipart/form-data)
echo -e "${YELLOW}  Note: File upload tests require manual verification${NC}"
echo -e "${YELLOW}  Verify: File type validation, size limits, virus scanning${NC}"
echo ""

echo -e "${YELLOW}9. API Information Disclosure Tests${NC}"
echo "Testing for information leakage..."
echo ""

# Test error messages don't leak sensitive info
run_test "Generic Error Messages" \
    "curl -s -X POST '${BASE_URL}/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"nonexistent@test.com\",\"password\":\"wrong\"}' | grep -v -E 'stack|filepath|line'" \
    ""

# Test for exposed sensitive endpoints
run_test "No Debug Endpoints Exposed" \
    "curl -s -o /dev/null -w '%{http_code}' '${BASE_URL}/debug'" \
    "404"

echo -e "${YELLOW}10. Password Policy Tests${NC}"
echo "Testing password strength requirements..."
echo ""

# Test weak password rejection
run_test "Weak Password Rejection" \
    "curl -s -o /dev/null -w '%{http_code}' -X POST '${BASE_URL}/auth/signup' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"123\",\"name\":\"Test\"}'" \
    "400"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Test Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo ""

if [ ${FAILED_TESTS} -gt 0 ]; then
    echo -e "${RED}⚠️  Some security tests failed!${NC}"
    echo "Review failed tests and fix security vulnerabilities."
    exit 1
else
    echo -e "${GREEN}✓ All security tests passed${NC}"
    exit 0
fi
