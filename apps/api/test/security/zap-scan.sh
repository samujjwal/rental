#!/usr/bin/env bash

# OWASP ZAP Security Scan Script
# This script automates security testing using OWASP ZAP

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ZAP_PORT=${ZAP_PORT:-8090}
API_URL=${API_URL:-http://localhost:3000}
API_VERSION=${API_VERSION:-v1}
REPORT_DIR="test/security/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/zap-report-${TIMESTAMP}"

# Create report directory
mkdir -p "${REPORT_DIR}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}OWASP ZAP Security Scan${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Target URL:${NC} ${API_URL}"
echo -e "${YELLOW}ZAP Port:${NC} ${ZAP_PORT}"
echo -e "${YELLOW}Report Dir:${NC} ${REPORT_DIR}"
echo ""

# Check if ZAP is installed
if ! command -v zap-cli &> /dev/null; then
    echo -e "${RED}Error: zap-cli is not installed${NC}"
    echo "Install with: pip install zapcli"
    exit 1
fi

# Check if API is running
echo -e "${YELLOW}Checking if API is running...${NC}"
if ! curl -s "${API_URL}/api/${API_VERSION}/health" > /dev/null; then
    echo -e "${RED}Error: API is not running at ${API_URL}${NC}"
    echo "Start the API with: npm run start:dev"
    exit 1
fi
echo -e "${GREEN}✓ API is running${NC}"
echo ""

# Start ZAP daemon
echo -e "${YELLOW}Starting OWASP ZAP daemon on port ${ZAP_PORT}...${NC}"
zap-cli start --start-options "-config api.disablekey=true" -p ${ZAP_PORT} &
ZAP_PID=$!

# Wait for ZAP to start
echo "Waiting for ZAP to initialize..."
for i in {1..30}; do
    if zap-cli -p ${ZAP_PORT} status &> /dev/null; then
        echo -e "${GREEN}✓ ZAP is ready${NC}"
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

# Create new session
echo -e "${YELLOW}Creating new ZAP session...${NC}"
zap-cli -p ${ZAP_PORT} session new

# Open target URL
echo -e "${YELLOW}Opening target URL...${NC}"
zap-cli -p ${ZAP_PORT} open-url "${API_URL}/api/${API_VERSION}"

# Spider the application (passive scan)
echo -e "${YELLOW}Running spider scan...${NC}"
zap-cli -p ${ZAP_PORT} spider "${API_URL}/api/${API_VERSION}"

# Wait for spider to complete
echo "Waiting for spider to complete..."
while zap-cli -p ${ZAP_PORT} spider-status | grep -q "Spider status:"; do
    STATUS=$(zap-cli -p ${ZAP_PORT} spider-status)
    echo "${STATUS}"
    sleep 5
done
echo -e "${GREEN}✓ Spider scan complete${NC}"
echo ""

# Run active scan
echo -e "${YELLOW}Running active security scan...${NC}"
echo "This may take 10-30 minutes depending on API size..."
zap-cli -p ${ZAP_PORT} active-scan -r "${API_URL}/api/${API_VERSION}"

# Wait for active scan to complete
echo "Waiting for active scan to complete..."
while true; do
    STATUS=$(zap-cli -p ${ZAP_PORT} active-scan-status)
    echo "${STATUS}"
    if echo "${STATUS}" | grep -q "100"; then
        break
    fi
    sleep 10
done
echo -e "${GREEN}✓ Active scan complete${NC}"
echo ""

# Generate reports
echo -e "${YELLOW}Generating security reports...${NC}"

# HTML Report
echo "Generating HTML report..."
zap-cli -p ${ZAP_PORT} report -o "${REPORT_FILE}.html" -f html
echo -e "${GREEN}✓ HTML report: ${REPORT_FILE}.html${NC}"

# JSON Report
echo "Generating JSON report..."
zap-cli -p ${ZAP_PORT} report -o "${REPORT_FILE}.json" -f json
echo -e "${GREEN}✓ JSON report: ${REPORT_FILE}.json${NC}"

# XML Report
echo "Generating XML report..."
zap-cli -p ${ZAP_PORT} report -o "${REPORT_FILE}.xml" -f xml
echo -e "${GREEN}✓ XML report: ${REPORT_FILE}.xml${NC}"

# Get alerts summary
echo ""
echo -e "${YELLOW}Security Alerts Summary:${NC}"
zap-cli -p ${ZAP_PORT} alerts

# Check for high-risk alerts
HIGH_RISK=$(zap-cli -p ${ZAP_PORT} alerts -l High | wc -l)
MEDIUM_RISK=$(zap-cli -p ${ZAP_PORT} alerts -l Medium | wc -l)
LOW_RISK=$(zap-cli -p ${ZAP_PORT} alerts -l Low | wc -l)
INFO=$(zap-cli -p ${ZAP_PORT} alerts -l Informational | wc -l)

echo ""
echo -e "${YELLOW}Alert Counts:${NC}"
echo -e "  ${RED}High Risk:${NC} ${HIGH_RISK}"
echo -e "  ${YELLOW}Medium Risk:${NC} ${MEDIUM_RISK}"
echo -e "  ${GREEN}Low Risk:${NC} ${LOW_RISK}"
echo -e "  ${GREEN}Informational:${NC} ${INFO}"

# Shutdown ZAP
echo ""
echo -e "${YELLOW}Shutting down ZAP...${NC}"
zap-cli -p ${ZAP_PORT} shutdown
wait ${ZAP_PID} 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Scan Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Reports saved to: ${REPORT_DIR}"
echo "View HTML report: open ${REPORT_FILE}.html"
echo ""

# Exit with error if high-risk issues found
if [ ${HIGH_RISK} -gt 0 ]; then
    echo -e "${RED}⚠️  WARNING: ${HIGH_RISK} high-risk security issues found!${NC}"
    echo "Review the report and fix these issues before deploying to production."
    exit 1
else
    echo -e "${GREEN}✓ No high-risk security issues found${NC}"
    exit 0
fi
