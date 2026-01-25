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
elif [ -f docker-compose.yml ]; then
    docker compose -f docker-compose.yml up -d postgres redis
    echo -e "${GREEN}✓ Infrastructure started.${NC}"
else
    echo -e "${RED}Error: docker-compose configuration not found!${NC}"
    exit 1
fi

# 3. Wait for Database to be ready
echo -e "\n${BLUE}==> Waiting for PostgreSQL to be ready...${NC}"
max_attempts=30
attempt=0
# Docker Compose v2 adds a -1 suffix to container names
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep rental-postgres | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
    POSTGRES_CONTAINER="rental-postgres"
fi

while [ $attempt -lt $max_attempts ]; do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U rental_user -d rental_portal > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo -e "${YELLOW}Waiting for database... ($attempt/$max_attempts)${NC}"
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}Error: Database failed to become ready in time.${NC}"
    exit 1
fi

# 4. Run Database Migrations
echo -e "\n${BLUE}==> Applying Database Migrations...${NC}"
cd packages/database
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-generate
cd ../..


# 5. Start Applications
echo -e "\n${BLUE}==> Starting Applications (API & Web)...${NC}"
echo -e "${GREEN}✓ API will be available at: http://localhost:3400${NC}"
echo -e "${GREEN}✓ Web will be available at: http://localhost:3401${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}\n"

npm run dev
