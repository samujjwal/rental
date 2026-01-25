#!/bin/bash

# run-dev.sh
# Universal Run Script for Development Environment
# Starts Docker Infrastructure, Runs Migrations, and Launches Apps via Turbo

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   Rental Portal - Development Start   ${NC}"
echo -e "${BLUE}=======================================${NC}"

# 1. Check for Environment Variables
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found.${NC}"
    if [ -f setup-env.sh ]; then
        echo -e "${BLUE}Running setup-env.sh to generate configuration...${NC}"
        ./setup-env.sh
    else
        echo -e "${RED}Error: setup-env.sh not found. Please create .env manually.${NC}"
        exit 1
    fi
fi

# 2. Start Infrastructure (Postgres, Redis)
echo -e "\n${BLUE}==> Starting Infrastructure Containers...${NC}"
if [ -f docker-compose.dev.yml ]; then
    docker compose -f docker-compose.dev.yml up -d
    echo -e "${GREEN}✓ Infrastructure started.${NC}"
else
    echo -e "${RED}Error: docker-compose.dev.yml not found!${NC}"
    exit 1
fi

# 3. Wait for Database to be ready (Basic check)
echo -e "\n${BLUE}==> Waiting for Database...${NC}"
# Simple sleep is often robust enough for local dev, 
# but could use 'pg_isready' if installed. 
# We'll rely on a small pause and Prisma's connection logic.
sleep 5
echo -e "${GREEN}✓ Proceeding.${NC}"

# 4. Run Database Migrations
echo -e "\n${BLUE}==> Applying Database Migrations...${NC}"
npm run db:migrate

# 5. Start Applications
echo -e "\n${BLUE}==> Starting Applications (API & Web)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"

npm run dev
