#!/bin/bash

# External Services Setup Script
# Sets up Resend, Stripe, and MinIO for local development

set -e

echo "🚀 Rental Portal - External Services Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

prompt() {
    echo -e "${BLUE}?${NC} $1"
}

# Check if .env exists
ENV_FILE="apps/api/.env"
ENV_EXAMPLE="apps/api/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    warn ".env file not found. Creating from example..."
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        success "Created $ENV_FILE from $ENV_EXAMPLE"
    else
        error "$ENV_EXAMPLE not found!"
        exit 1
    fi
fi

echo ""
echo "📋 Service Configuration Checklist"
echo "=================================="
echo ""

# 1. Check Resend
echo "1️⃣  Resend Email Service"
echo "------------------------"

if grep -q "RESEND_API_KEY=re_" "$ENV_FILE" 2>/dev/null; then
    success "Resend API key appears to be configured"
else
    warn "Resend API key not configured"
    echo ""
    info "To set up Resend:"
    echo "  1. Go to: https://resend.com/signup"
    echo "  2. Create account (no credit card needed)"
    echo "  3. Get API key from: https://resend.com/api-keys"
    echo "  4. Update apps/api/.env:"
    echo "     RESEND_API_KEY=re_xxxxxxxxxxxxx"
    echo "     EMAIL_FROM=onboarding@resend.dev"
    echo ""
    prompt "Do you want to configure Resend now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        prompt "Enter your Resend API key (starts with re_):"
        read -r resend_key
        if [[ $resend_key == re_* ]]; then
            sed -i.bak "s|RESEND_API_KEY=.*|RESEND_API_KEY=$resend_key|" "$ENV_FILE"
            sed -i.bak "s|EMAIL_FROM=.*|EMAIL_FROM=onboarding@resend.dev|" "$ENV_FILE"
            success "Resend API key configured!"
        else
            error "Invalid API key format. Should start with 're_'"
        fi
    fi
fi

echo ""

# 2. Check Stripe
echo "2️⃣  Stripe Payment Service"
echo "-------------------------"

if grep -q "STRIPE_SECRET_KEY=sk_test_" "$ENV_FILE" 2>/dev/null; then
    success "Stripe keys appear to be configured"
else
    warn "Stripe keys not configured"
    echo ""
    info "To set up Stripe:"
    echo "  1. Go to: https://dashboard.stripe.com/register"
    echo "  2. Ensure you're in TEST MODE (toggle in top-right)"
    echo "  3. Go to: Developers → API keys"
    echo "  4. Copy both keys:"
    echo "     - Secret key (sk_test_...)"
    echo "     - Publishable key (pk_test_...)"
    echo ""
    prompt "Do you want to configure Stripe now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        prompt "Enter your Stripe SECRET key (starts with sk_test_):"
        read -r stripe_secret
        prompt "Enter your Stripe PUBLISHABLE key (starts with pk_test_):"
        read -r stripe_pub
        
        if [[ $stripe_secret == sk_test_* ]] && [[ $stripe_pub == pk_test_* ]]; then
            sed -i.bak "s|STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=$stripe_secret|" "$ENV_FILE"
            sed -i.bak "s|STRIPE_PUBLISHABLE_KEY=.*|STRIPE_PUBLISHABLE_KEY=$stripe_pub|" "$ENV_FILE"
            success "Stripe keys configured!"
            
            # Also update frontend .env
            if [ ! -f "apps/web/.env" ]; then
                echo "STRIPE_PUBLISHABLE_KEY=$stripe_pub" > apps/web/.env
                echo "API_URL=http://localhost:3400/api/v1" >> apps/web/.env
                success "Created apps/web/.env with Stripe key"
            fi
        else
            error "Invalid key format. Keys should start with 'sk_test_' and 'pk_test_'"
        fi
    fi
fi

echo ""

# 3. Setup MinIO
echo "3️⃣  MinIO Storage (Local S3)"
echo "---------------------------"

if docker ps | grep -q rental-minio; then
    success "MinIO is already running"
else
    warn "MinIO not running. Starting now..."
    
    # Create network if it doesn't exist
    docker network create rental-network 2>/dev/null || true
    
    # Start MinIO
    docker-compose -f docker-compose.minio.yml up -d
    
    # Wait for MinIO to be ready
    echo -n "Waiting for MinIO to start"
    for i in {1..30}; do
        if docker ps | grep -q rental-minio; then
            if curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
                echo ""
                success "MinIO started successfully!"
                break
            fi
        fi
        echo -n "."
        sleep 1
    done
    echo ""
fi

# Configure MinIO in .env
if grep -q "AWS_S3_ENDPOINT=http://localhost:9000" "$ENV_FILE" 2>/dev/null; then
    success "MinIO configuration found in .env"
else
    info "Adding MinIO configuration to .env..."
    sed -i.bak "s|AWS_REGION=.*|AWS_REGION=us-east-1|" "$ENV_FILE"
    sed -i.bak "s|AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=minioadmin|" "$ENV_FILE"
    sed -i.bak "s|AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=minioadmin123|" "$ENV_FILE"
    sed -i.bak "s|AWS_S3_BUCKET=.*|AWS_S3_BUCKET=rental-portal-uploads|" "$ENV_FILE"
    
    # Add endpoint if not exists
    if ! grep -q "AWS_S3_ENDPOINT" "$ENV_FILE"; then
        echo "AWS_S3_ENDPOINT=http://localhost:9000" >> "$ENV_FILE"
        echo "CDN_URL=http://localhost:9000/rental-portal-uploads" >> "$ENV_FILE"
    fi
    
    success "MinIO configuration added to .env"
fi

info "MinIO Console: http://localhost:9001"
info "Credentials: minioadmin / minioadmin123"

echo ""

# 4. Summary
echo "📊 Setup Summary"
echo "================"
echo ""

# Check each service
RESEND_OK=false
STRIPE_OK=false
MINIO_OK=false

if grep -q "RESEND_API_KEY=re_" "$ENV_FILE" 2>/dev/null; then
    success "Resend: Configured"
    RESEND_OK=true
else
    error "Resend: Not configured"
fi

if grep -q "STRIPE_SECRET_KEY=sk_test_" "$ENV_FILE" 2>/dev/null; then
    success "Stripe: Configured"
    STRIPE_OK=true
else
    error "Stripe: Not configured"
fi

if docker ps | grep -q rental-minio; then
    success "MinIO: Running"
    MINIO_OK=true
else
    error "MinIO: Not running"
fi

echo ""

# 5. Next Steps
echo "🎯 Next Steps"
echo "============="
echo ""

if [ "$RESEND_OK" = true ] && [ "$STRIPE_OK" = true ] && [ "$MINIO_OK" = true ]; then
    success "All services configured! You're ready to go!"
    echo ""
    echo "To start development:"
    echo "  1. docker-compose up -d          # Start PostgreSQL, Redis, etc."
    echo "  2. cd apps/api && pnpm dev       # Start API server"
    echo "  3. cd apps/web && pnpm dev       # Start web server"
    echo ""
    echo "For Stripe webhooks (optional):"
    echo "  stripe listen --forward-to localhost:3400/api/v1/payments/webhook"
    echo ""
    echo "📚 See EXTERNAL_SERVICES_QUICKSTART.md for testing instructions"
else
    warn "Some services need configuration"
    echo ""
    if [ "$RESEND_OK" = false ]; then
        echo "❌ Resend: https://resend.com/signup"
    fi
    if [ "$STRIPE_OK" = false ]; then
        echo "❌ Stripe: https://dashboard.stripe.com/register"
    fi
    if [ "$MINIO_OK" = false ]; then
        echo "❌ MinIO: Run 'docker-compose -f docker-compose.minio.yml up -d'"
    fi
    echo ""
    echo "💡 Run this script again after configuring services"
fi

echo ""
echo "📖 Full setup guide: EXTERNAL_SERVICES_QUICKSTART.md"
echo ""

# Clean up backup files
rm -f "$ENV_FILE.bak"
