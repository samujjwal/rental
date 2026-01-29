#!/bin/bash

# Universal Rental Portal - Quick Validation Script
# This script performs rapid checks on the most critical features

set -e

echo "🚀 Universal Rental Portal - Quick Validation"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# 1. Check Dependencies
echo "📦 Checking Dependencies..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    pass "Node.js installed: $NODE_VERSION"
else
    fail "Node.js not found"
fi

if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    pass "pnpm installed: $PNPM_VERSION"
else
    fail "pnpm not found"
fi

if command -v docker &> /dev/null; then
    pass "Docker installed"
else
    warn "Docker not found (optional for local development)"
fi

echo ""

# 2. Check Project Structure
echo "📁 Checking Project Structure..."
[ -f "package.json" ] && pass "Root package.json exists" || fail "Root package.json missing"
[ -d "apps/api" ] && pass "Backend API directory exists" || fail "Backend API missing"
[ -d "apps/web" ] && pass "Frontend web directory exists" || fail "Frontend web missing"
[ -d "packages/database" ] && pass "Database package exists" || fail "Database package missing"
[ -f "docker-compose.yml" ] && pass "Docker Compose config exists" || fail "Docker Compose missing"

echo ""

# 3. Check Environment Configuration
echo "🔧 Checking Environment Configuration..."
if [ -f "apps/api/.env" ]; then
    pass "API .env file exists"
    
    # Check critical env vars
    if grep -q "DATABASE_URL" apps/api/.env; then
        pass "DATABASE_URL configured"
    else
        fail "DATABASE_URL not found in .env"
    fi
    
    if grep -q "JWT_SECRET" apps/api/.env; then
        pass "JWT_SECRET configured"
    else
        fail "JWT_SECRET not found in .env"
    fi
    
    if grep -q "STRIPE_SECRET_KEY" apps/api/.env; then
        if grep -q "STRIPE_SECRET_KEY=sk_test_" apps/api/.env || grep -q "STRIPE_SECRET_KEY=sk_live_" apps/api/.env; then
            pass "Stripe keys configured"
        else
            warn "Stripe keys not configured (needed for payments)"
        fi
    else
        warn "Stripe keys not found (needed for payments)"
    fi
else
    fail "API .env file not found (copy from .env.example)"
fi

echo ""

# 4. Check Docker Services
echo "🐳 Checking Docker Services..."
if command -v docker &> /dev/null; then
    if docker ps | grep -q "rental-postgres"; then
        pass "PostgreSQL container running"
    else
        warn "PostgreSQL container not running (run: docker-compose up -d)"
    fi
    
    if docker ps | grep -q "rental-redis"; then
        pass "Redis container running"
    else
        warn "Redis container not running (run: docker-compose up -d)"
    fi
    
    if docker ps | grep -q "rental-elasticsearch"; then
        pass "Elasticsearch container running"
    else
        warn "Elasticsearch container not running (optional)"
    fi
fi

echo ""

# 5. Check Node Modules
echo "📚 Checking Dependencies Installation..."
if [ -d "node_modules" ]; then
    pass "Root dependencies installed"
else
    warn "Root dependencies not installed (run: pnpm install)"
fi

if [ -d "apps/api/node_modules" ]; then
    pass "API dependencies installed"
else
    warn "API dependencies not installed (run: pnpm install)"
fi

if [ -d "apps/web/node_modules" ]; then
    pass "Web dependencies installed"
else
    warn "Web dependencies not installed (run: pnpm install)"
fi

echo ""

# 6. Check Database
echo "🗄️  Checking Database..."
if [ -f "packages/database/prisma/schema.prisma" ]; then
    pass "Prisma schema exists"
    
    # Check if Prisma client is generated
    if [ -d "node_modules/.prisma/client" ]; then
        pass "Prisma client generated"
    else
        warn "Prisma client not generated (run: cd packages/database && npx prisma generate)"
    fi
else
    fail "Prisma schema not found"
fi

echo ""

# 7. Check TypeScript Configuration
echo "📘 Checking TypeScript Configuration..."
[ -f "apps/api/tsconfig.json" ] && pass "API tsconfig.json exists" || fail "API tsconfig.json missing"
[ -f "apps/web/tsconfig.json" ] && pass "Web tsconfig.json exists" || fail "Web tsconfig.json missing"

echo ""

# 8. Check Routes Configuration
echo "🛣️  Checking Routes..."
if [ -f "apps/web/app/routes.ts" ]; then
    pass "Frontend routes configuration exists"
    ROUTE_COUNT=$(grep -c "route(" apps/web/app/routes.ts || echo "0")
    pass "Found $ROUTE_COUNT route definitions"
else
    fail "Frontend routes configuration missing"
fi

echo ""

# 9. Check API Endpoints (if server is running)
echo "🌐 Checking API Server..."
API_URL="http://localhost:3400"
if curl -s --connect-timeout 2 "$API_URL/health" > /dev/null 2>&1; then
    pass "API server is running at $API_URL"
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s "$API_URL/health")
    if echo "$HEALTH_RESPONSE" | grep -q "ok\|healthy\|status"; then
        pass "Health endpoint responding"
    else
        warn "Health endpoint returned unexpected response"
    fi
else
    warn "API server not running at $API_URL (start with: cd apps/api && pnpm dev)"
fi

echo ""

# 10. Check Web Server
echo "🖥️  Checking Web Server..."
WEB_URL="http://localhost:3401"
if curl -s --connect-timeout 2 "$WEB_URL" > /dev/null 2>&1; then
    pass "Web server is running at $WEB_URL"
else
    warn "Web server not running at $WEB_URL (start with: cd apps/web && pnpm dev)"
fi

echo ""

# 11. Check Git
echo "📝 Checking Git Repository..."
if [ -d ".git" ]; then
    pass "Git repository initialized"
    
    # Check for uncommitted changes
    if [ -z "$(git status --porcelain)" ]; then
        pass "Working directory clean"
    else
        warn "Uncommitted changes present"
    fi
    
    BRANCH=$(git branch --show-current)
    pass "Current branch: $BRANCH"
else
    warn "Not a git repository"
fi

echo ""

# 12. Check Test Files
echo "🧪 Checking Tests..."
API_TEST_COUNT=$(find apps/api/src -name "*.spec.ts" 2>/dev/null | wc -l)
if [ "$API_TEST_COUNT" -gt 0 ]; then
    pass "Found $API_TEST_COUNT test files in API"
else
    warn "No test files found in API"
fi

WEB_TEST_COUNT=$(find apps/web -name "*.test.tsx" -o -name "*.test.ts" 2>/dev/null | wc -l)
if [ "$WEB_TEST_COUNT" -gt 0 ]; then
    pass "Found $WEB_TEST_COUNT test files in Web"
else
    warn "No test files found in Web"
fi

echo ""

# Summary
echo "=============================================="
echo "📊 Validation Summary"
echo "=============================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed!${NC} Your project is ready to run."
        echo ""
        echo "To start the development servers:"
        echo "  1. docker-compose up -d        # Start services"
        echo "  2. cd apps/api && pnpm dev     # Start API (port 3400)"
        echo "  3. cd apps/web && pnpm dev     # Start Web (port 3401)"
    else
        echo -e "${YELLOW}⚠ Some warnings detected.${NC} Review warnings above and fix if needed."
        echo ""
        echo "Common fixes:"
        echo "  - Run 'pnpm install' to install dependencies"
        echo "  - Run 'docker-compose up -d' to start services"
        echo "  - Copy 'apps/api/.env.example' to 'apps/api/.env' and configure"
    fi
else
    echo -e "${RED}✗ Some checks failed.${NC} Fix the errors above before continuing."
    echo ""
    echo "Common fixes:"
    echo "  - Ensure you're in the project root directory"
    echo "  - Run 'pnpm install' to install dependencies"
    echo "  - Check that all required files are present"
fi

echo ""
echo "For detailed validation, see: COMPREHENSIVE_VALIDATION_PLAN.md"
echo ""

exit $FAILED
