#!/bin/bash

# Setup script for Rental Portal - Configures environment variables and services
# Usage: ./setup-env.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_step "Rental Portal Environment Setup"
echo ""

# Check if .env file exists
if [ -f .env ]; then
    print_warning ".env file already exists. Creating backup..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    print_success "Backup created"
fi

# Copy example file
print_step "Creating .env file from template..."
cp .env.example .env
print_success ".env file created"

echo ""
print_step "Generating secure JWT secrets..."
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Update JWT secrets in .env
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|g" .env
    sed -i '' "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|g" .env
else
    # Linux
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|g" .env
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|g" .env
fi

print_success "JWT secrets generated and configured"

echo ""
print_step "Service Configuration Guide"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📧 Email Service (Resend) - FREE 3,000 emails/month"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Go to: https://resend.com/signup"
echo "2. Create account (no credit card required)"
echo "3. Verify your email"
echo "4. Go to API Keys: https://resend.com/api-keys"
echo "5. Create new API key"
echo "6. Copy the key and update .env:"
echo "   RESEND_API_KEY=re_xxxxx"
echo ""
echo "For testing, use: EMAIL_FROM=noreply@resend.dev"
echo "For production, add and verify your domain"
echo ""

read -p "Press Enter to continue..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💳 Stripe Payment Processing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Go to: https://dashboard.stripe.com/register"
echo "2. Create account"
echo "3. Get test API keys from: https://dashboard.stripe.com/test/apikeys"
echo "4. Update .env:"
echo "   STRIPE_SECRET_KEY=sk_test_xxxxx"
echo "   STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx"
echo ""
echo "5. Set up webhook endpoint:"
echo "   URL: http://localhost:3000/payments/webhook"
echo "   Events: payment_intent.succeeded, payment_intent.payment_failed"
echo "6. Copy webhook secret to .env:"
echo "   STRIPE_WEBHOOK_SECRET=whsec_xxxxx"
echo ""

read -p "Press Enter to continue..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  Cloudflare R2 Storage (Optional) - FREE 10GB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For MVP: Local storage is sufficient (already configured)"
echo "For production:"
echo ""
echo "1. Go to: https://dash.cloudflare.com/sign-up"
echo "2. Navigate to R2 Object Storage"
echo "3. Create bucket: rental-portal-uploads"
echo "4. Generate API token in Account -> R2 API Tokens"
echo "5. Update .env:"
echo "   R2_ACCOUNT_ID=your_account_id"
echo "   R2_ACCESS_KEY_ID=your_access_key"
echo "   R2_SECRET_ACCESS_KEY=your_secret_key"
echo ""
print_warning "You can skip this for MVP - using local storage"
echo ""

read -p "Press Enter to continue..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Search Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Using PostgreSQL Full-Text Search (no additional setup required)"
echo "Elasticsearch/OpenSearch only needed for production with >10k listings"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Content Moderation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Using bad-words library (no API keys required)"
echo "Automatic profanity, spam, and contact info filtering"
echo ""

echo ""
print_step "Starting Docker services..."
if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
    docker compose up -d postgres redis
    print_success "PostgreSQL and Redis started"
else
    print_warning "Docker not found. Please install Docker and run: docker compose up -d"
fi

echo ""
print_step "Installing dependencies..."
pnpm install

echo ""
print_step "Setting up database..."
cd packages/database
pnpm prisma generate
pnpm prisma migrate deploy 2>/dev/null || pnpm prisma migrate dev --name init
cd ../..
print_success "Database setup complete"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Update .env with your service credentials:"
echo "   - RESEND_API_KEY (required for email)"
echo "   - STRIPE_SECRET_KEY (required for payments)"
echo "   - STRIPE_PUBLISHABLE_KEY (required for payments)"
echo ""
echo "2. Start the development servers:"
echo "   pnpm --filter @rental-portal/api start:dev"
echo "   pnpm --filter @rental-portal/web dev"
echo ""
echo "3. Test the application:"
echo "   ./test-all.sh"
echo ""
echo "4. Access the application:"
echo "   API: http://localhost:3000"
echo "   API Docs: http://localhost:3000/api/docs"
echo "   Web: http://localhost:5173"
echo ""
echo "For detailed setup instructions, see:"
echo "  - QUICK_START.md"
echo "  - FREE_ALTERNATIVES_GUIDE.md"
echo ""
