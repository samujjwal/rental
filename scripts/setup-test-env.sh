#!/bin/bash

# Test Environment Setup Script
# This script sets up all required services for testing

set -e

echo "🚀 Setting up test environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker is running${NC}"
}

# Function to start infrastructure services
start_infrastructure() {
    echo -e "${YELLOW}📦 Starting infrastructure services...${NC}"
    
    # Start MinIO, PostgreSQL, Redis, and Mailhog
    docker-compose -f docker-compose.test.yml up -d minio postgres redis mailhog
    
    # Wait for services to be healthy
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    sleep 10
    
    # Create MinIO bucket
    docker-compose -f docker-compose.test.yml up --no-deps create-bucket
    
    echo -e "${GREEN}✓ Infrastructure services are ready${NC}"
}

# Function to stop infrastructure services
stop_infrastructure() {
    echo -e "${YELLOW}🛑 Stopping infrastructure services...${NC}"
    docker-compose -f docker-compose.test.yml down
    echo -e "${GREEN}✓ Infrastructure services stopped${NC}"
}

# Function to setup test database
setup_database() {
    echo -e "${YELLOW}🗄️ Setting up test database...${NC}"
    
    # Wait for PostgreSQL to be ready
    until docker exec rental-postgres-test pg_isready -U test > /dev/null 2>&1; do
        echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
        sleep 2
    done
    
    echo -e "${GREEN}✓ Test database is ready${NC}"
}

# Function to display service URLs
show_urls() {
    echo ""
    echo -e "${GREEN}🌐 Test Environment URLs:${NC}"
    echo "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
    echo "  Mailhog UI: http://localhost:8025"
    echo "  PostgreSQL: localhost:5433"
    echo "  Redis: localhost:6379"
    echo ""
    echo -e "${GREEN}📋 Environment Configuration:${NC}"
    echo "  Environment file: apps/api/.env.test"
    echo "  S3 Bucket: test-bucket"
    echo "  Database: rental_test"
    echo ""
}

# Main execution
case "${1:-start}" in
    start)
        check_docker
        start_infrastructure
        setup_database
        show_urls
        echo -e "${GREEN}🎉 Test environment is ready!${NC}"
        echo "Run tests with: cd apps/api && npm test"
        ;;
    stop)
        stop_infrastructure
        echo -e "${GREEN}✅ Test environment stopped${NC}"
        ;;
    restart)
        stop_infrastructure
        check_docker
        start_infrastructure
        setup_database
        show_urls
        echo -e "${GREEN}🎉 Test environment restarted!${NC}"
        ;;
    status)
        docker-compose -f docker-compose.test.yml ps
        ;;
    logs)
        docker-compose -f docker-compose.test.yml logs -f
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
