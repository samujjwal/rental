#!/bin/bash
# Quick status check for external services setup

echo "=== External Services Status ==="
echo ""

# Check .env files
echo "📄 Environment Files:"
if [ -f "apps/api/.env" ]; then
    echo "  ✅ apps/api/.env exists"
else
    echo "  ❌ apps/api/.env missing - Run: cp apps/api/.env.example apps/api/.env"
fi

if [ -f "apps/web/.env" ]; then
    echo "  ✅ apps/web/.env exists"
else
    echo "  ❌ apps/web/.env missing - Run: cp apps/web/.env.example apps/web/.env"
fi

echo ""

# Check MinIO
echo "📦 MinIO (Local S3):"
if docker ps | grep -q minio; then
    echo "  ✅ MinIO is running"
    echo "     Console: http://localhost:9001"
    echo "     Username: minioadmin"
    echo "     Password: minioadmin123"
else
    echo "  ❌ MinIO not running"
    echo "     Start: docker-compose -f docker-compose.minio.yml up -d"
fi

echo ""

# Check API keys
echo "🔑 API Keys Configuration:"
if [ -f "apps/api/.env" ]; then
    if grep -q "^RESEND_API_KEY=re_" apps/api/.env; then
        echo "  ✅ Resend API key configured"
    else
        echo "  ⚠️  Resend API key needs setup"
        echo "     Get key: https://resend.com/api-keys"
    fi

    if grep -q "^STRIPE_SECRET_KEY=sk_test_" apps/api/.env; then
        echo "  ✅ Stripe secret key configured"
    else
        echo "  ⚠️  Stripe secret key needs setup"
        echo "     Get keys: https://dashboard.stripe.com/test/apikeys"
    fi

    if grep -q "^AWS_S3_ENDPOINT=http://localhost:9000" apps/api/.env; then
        echo "  ✅ MinIO endpoint configured"
    else
        echo "  ⚠️  MinIO endpoint needs configuration"
    fi
else
    echo "  ❌ apps/api/.env not found"
fi

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Setup Resend (5 min): https://resend.com/signup"
echo "   - Get API key from https://resend.com/api-keys"
echo "   - Add to apps/api/.env: RESEND_API_KEY=re_your_key"
echo ""
echo "2. Setup Stripe (5 min): https://dashboard.stripe.com/register"
echo "   - Get test keys from https://dashboard.stripe.com/test/apikeys"
echo "   - Add to apps/api/.env and apps/web/.env"
echo ""
echo "3. Start MinIO: docker-compose -f docker-compose.minio.yml up -d"
echo ""
echo "4. Start development: pnpm dev"
echo ""
echo "📖 Full guide: See SERVICES_QUICKSTART.md"
