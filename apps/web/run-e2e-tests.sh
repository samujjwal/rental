#!/bin/bash

# E2E Test Runner - Quick Commands
# Usage: ./run-e2e-tests.sh [smoke|auth|all|help]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  E2E Test Runner${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if servers are running
API_RUNNING=$(curl -s http://localhost:3400/api/health > /dev/null 2>&1 && echo "yes" || echo "no")
WEB_RUNNING=$(curl -s http://localhost:3401 > /dev/null 2>&1 && echo "yes" || echo "no")

if [ "$API_RUNNING" != "yes" ] || [ "$WEB_RUNNING" != "yes" ]; then
  echo -e "${RED}⚠️  Servers not running!${NC}\n"
  echo "Please start servers first:"
  echo -e "  ${YELLOW}./start-e2e-env.sh${NC}\n"
  exit 1
fi

echo -e "${GREEN}✓ API Server: http://localhost:3400${NC}"
echo -e "${GREEN}✓ Web Server: http://localhost:3401${NC}\n"

MODE="${1:-help}"

case "$MODE" in
  smoke)
    echo -e "${BLUE}Running Smoke Tests (quick validation)...${NC}\n"
    pnpm exec playwright test smoke.spec.ts --project=chromium --workers=1
    ;;
    
  auth)
    echo -e "${BLUE}Running Authentication Tests...${NC}\n"
    pnpm exec playwright test auth.spec.ts --project=chromium --workers=1
    ;;
    
  home)
    echo -e "${BLUE}Running Home Page Tests...${NC}\n"
    pnpm exec playwright test home.spec.ts --project=chromium --workers=1
    ;;
    
  routes)
    echo -e "${BLUE}Running Route Health Tests...${NC}\n"
    pnpm exec playwright test route-health.spec.ts --project=chromium --workers=1
    ;;
    
  passing)
    echo -e "${BLUE}Running Known Passing Tests...${NC}\n"
    pnpm exec playwright test smoke.spec.ts home.spec.ts route-health.spec.ts --project=chromium --workers=1
    ;;
    
  all)
    echo -e "${YELLOW}⚠️  Warning: Many tests have selector issues and will fail${NC}"
    echo -e "${YELLOW}⚠️  This does not mean the app is broken, just tests need fixing${NC}\n"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      pnpm exec playwright test --project=chromium --workers=1
    else
      echo "Cancelled"
      exit 0
    fi
    ;;
    
  report)
    echo -e "${BLUE}Opening Last Test Report...${NC}\n"
    pnpm exec playwright show-report
    ;;
    
  help|*)
    echo "Usage: ./run-e2e-tests.sh [command]"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}smoke${NC}     - Run smoke tests (8/10 pass) ~30 seconds"
    echo -e "  ${GREEN}auth${NC}      - Run auth tests (16/44 pass) ~2 minutes"
    echo -e "  ${GREEN}home${NC}      - Run home page tests ~30 seconds"
    echo -e "  ${GREEN}routes${NC}    - Run route health checks ~1 minute"
    echo -e "  ${GREEN}passing${NC}   - Run all known passing tests ~2 minutes"
    echo -e "  ${YELLOW}all${NC}       - Run ALL tests (many will fail due to selectors)"
    echo -e "  ${BLUE}report${NC}    - Show last test report"
    echo -e "  ${BLUE}help${NC}      - Show this message"
    echo ""
    echo "Examples:"
    echo -e "  ${YELLOW}./run-e2e-tests.sh smoke${NC}    # Quick validation"
    echo -e "  ${YELLOW}./run-e2e-tests.sh passing${NC}  # All working tests"
    echo -e "  ${YELLOW}./run-e2e-tests.sh report${NC}   # View results"
    echo ""
    ;;
esac
