#!/bin/bash

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e"${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Starting E2E Test Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR"
API_DIR="$SCRIPT_DIR/../api"

# Check if servers are already running
API_RUNNING=$(curl -s http://localhost:3400/api/health 2>/dev/null && echo "yes" || echo "no")
WEB_RUNNING=$(curl -s http://localhost:3401 2>/dev/null && echo "yes" || echo "no")

if [ "$API_RUNNING" = "yes" ] && [ "$WEB_RUNNING" = "yes" ]; then
  echo -e "${GREEN}✓${NC} API server already running on port 3400"
  echo -e "${GREEN}✓${NC} Web server already running on port 3401"
  echo -e "\n${GREEN}Both servers are running! Ready for E2E tests.${NC}\n"
  exit 0
fi

# Function to check if a port is in use
port_in_use() {
  lsof -i:"$1" >/dev/null 2>&1
}

# Start API server if not running
if [ "$API_RUNNING" = "no" ]; then
  echo -e "${YELLOW}⚠${NC} API server not running. Starting..."
  
  if port_in_use 3400; then
    echo -e "${RED}✗${NC} Port 3400 is in use but not responding. Please check:"
    echo "  lsof -i:3400"
    exit 1
  fi
  
  cd "$API_DIR" || exit 1
  echo -e "${BLUE}→${NC} Starting API server (pnpm dev)..."
  pnpm dev > /tmp/api-server.log 2>&1 &
  API_PID=$!
  echo "$API_PID" > /tmp/api-server.pid
  cd "$WEB_DIR" || exit 1
  
  # Wait for API to be ready
  echo -n "  Waiting for API server"
  for i in {1..30}; do
    if curl -s http://localhost:3400/api/health >/dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      API_READY=true
      break
    fi
    echo -n "."
    sleep 1
  done
  
  if [ -z "$API_READY" ]; then
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}Failed to start API server after 30s${NC}"
    echo "Check logs: tail -f /tmp/api-server.log"
    exit 1
  fi
  
  echo -e "${GREEN}✓${NC} API server running on http://localhost:3400 (PID: $API_PID)"
else
  echo -e "${GREEN}✓${NC} API server already running on port 3400"
fi

# Start web server if not running
if [ "$WEB_RUNNING" = "no" ]; then
  echo -e "${YELLOW}⚠${NC} Web server not running. Starting..."
  
  if port_in_use 3401; then
    echo -e "${RED}✗${NC} Port 3401 is in use but not responding. Please check:"
    echo "  lsof -i:3401"
    exit 1
  fi
  
  echo -e "${BLUE}→${NC} Starting web server (pnpm dev)..."
  pnpm dev > /tmp/web-server.log 2>&1 &
  WEB_PID=$!
  echo "$WEB_PID" > /tmp/web-server.pid
  
  # Wait for web to be ready
  echo -n "  Waiting for web server"
  for i in {1..30}; do
    if curl -s http://localhost:3401 >/dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      WEB_READY=true
      break
    fi
    echo -n "."
    sleep 1
  done
  
  if [ -z "$WEB_READY" ]; then
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}Failed to start web server after 30s${NC}"
    echo "Check logs: tail -f /tmp/web-server.log"
    exit 1
  fi
  
  echo -e "${GREEN}✓${NC} Web server running on http://localhost:3401 (PID: $WEB_PID)"
else
  echo -e "${GREEN}✓${NC} Web server already running on port 3401"
fi

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  E2E Test Environment Ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "Services running:"
echo -e "  • API:  ${BLUE}http://localhost:3400${NC}"
echo -e " • Web:  ${BLUE}http://localhost:3401${NC}"
echo ""
echo "Server logs:"
echo -e "  • API:  ${YELLOW}tail -f /tmp/api-server.log${NC}"
echo -e "  • Web:  ${YELLOW}tail -f /tmp/web-server.log${NC}"
echo ""
echo "To stop servers:"
echo -e "  ${YELLOW}kill $(cat /tmp/api-server.pid 2>/dev/null) $(cat /tmp/web-server.pid 2>/dev/null)${NC}"
echo ""
echo -e "${GREEN}Ready to run E2E tests:${NC}"
echo -e "  ${BLUE}./run-tests.sh${NC}"
echo ""
