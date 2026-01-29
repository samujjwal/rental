# External Services Setup Guide

## Resend + Stripe + Local MinIO (S3-Compatible)

**Created:** January 27, 2026  
**Services:** Email (Resend), Payments (Stripe), File Storage (MinIO)  
**Time to Complete:** 30-45 minutes

---

## 🎯 Overview

We'll set up three essential services:

1. **Resend** - Email delivery (free tier: 3,000 emails/month)
2. **Stripe** - Payment processing (test mode - no charges)
3. **MinIO** - Local S3-compatible storage (Docker container)

---

## 1. 📧 Resend Email Service (10 minutes)

### Step 1.1: Create Resend Account

```bash
# Open in browser:
https://resend.com/signup
```

1. Sign up with your email (no credit card required)
2. Verify your email address
3. Complete the onboarding

### Step 1.2: Get API Key

1. Go to **API Keys** in the dashboard: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Name: `rental-portal-development`
4. Permission: **Full Access**
5. Click **Create**
6. **Copy the API key** (starts with `re_`) - you won't see it again!

### Step 1.3: Configure Environment

```bash
# Update apps/api/.env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=onboarding@resend.dev
```

**Note:** With free tier, you can only send from `onboarding@resend.dev`. For custom domain emails, you'll need to verify your domain.

### Step 1.4: Test Email Service

Create test file: `apps/api/test-email.js`

```javascript
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 'your_key_here');

(async function () {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'your-email@example.com', // Change to your email
      subject: 'Test Email from Rental Portal',
      html: '<strong>It works!</strong> Your email service is configured correctly.',
    });

    console.log('✅ Email sent successfully!');
    console.log('Email ID:', data.id);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
})();
```

```bash
# Install resend package
cd apps/api
npm install resend

# Run test (update your email address in the file first!)
node test-email.js
```

✅ **Expected Result:** You should receive a test email within seconds.

---

## 2. 💳 Stripe Payment Service (15 minutes)

### Step 2.1: Create Stripe Account

```bash
# Open in browser:
https://dashboard.stripe.com/register
```

1. Sign up with your email
2. Complete business information (use test data for development)
3. Activate your account

### Step 2.2: Get Test API Keys

1. In Stripe Dashboard, ensure you're in **Test Mode** (toggle in top-right)
2. Go to **Developers** → **API keys**: https://dashboard.stripe.com/test/apikeys
3. Copy both keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`) - click "Reveal test key"

### Step 2.3: Set Up Webhook (for local development)

We'll use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI (on Linux)
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_2.15.0_linux_x86_64.tar.gz
tar -xvf stripe_2.15.0_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/

# Or on macOS
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Start webhook forwarding (keep this running in a separate terminal)
stripe listen --forward-to localhost:3400/api/v1/payments/webhook

# This will output a webhook signing secret (whsec_...)
# Copy this secret!
```

### Step 2.4: Configure Environment

```bash
# Update apps/api/.env
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PLATFORM_FEE_PERCENTAGE=10
```

### Step 2.5: Test Stripe Integration

```bash
# Start your API server
cd apps/api
pnpm dev

# In another terminal, test the payment endpoint
curl -X POST http://localhost:3400/api/v1/payments/test \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd"
  }'
```

✅ **Expected Result:** Should return a payment intent with status "requires_payment_method"

### Step 2.6: Test Stripe Connect (for marketplace payouts)

```bash
# Test creating a Connect account
curl -X POST http://localhost:3400/api/v1/users/connect-account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "test-owner@example.com"
  }'
```

### Test Cards

Use these test card numbers in Stripe test mode:

| Card Number         | Description             |
| ------------------- | ----------------------- |
| 4242 4242 4242 4242 | Success                 |
| 4000 0000 0000 0002 | Declined                |
| 4000 0000 0000 9995 | Insufficient funds      |
| 4000 0025 0000 3155 | Requires authentication |

**Expiry:** Any future date  
**CVC:** Any 3 digits  
**ZIP:** Any 5 digits

---

## 3. 🗄️ MinIO (Local S3-Compatible Storage) (10 minutes)

MinIO is a high-performance, S3-compatible object storage server. Perfect for local development!

### Step 3.1: Add MinIO to Docker Compose

Create file: `docker-compose.local.yml`

```yaml
version: '3.8'

services:
  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    container_name: rental-minio
    ports:
      - '9000:9000' # API
      - '9001:9001' # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - rental-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 20s
      retries: 3

  # MinIO Client (for bucket creation)
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin123;
      /usr/bin/mc mb myminio/rental-portal-uploads --ignore-existing;
      /usr/bin/mc anonymous set public myminio/rental-portal-uploads;
      exit 0;
      "
    networks:
      - rental-network

volumes:
  minio_data:
    driver: local

networks:
  rental-network:
    external: true
```

### Step 3.2: Start MinIO

```bash
# Create network if it doesn't exist
docker network create rental-network 2>/dev/null || true

# Start MinIO
docker-compose -f docker-compose.local.yml up -d

# Check if running
docker ps | grep minio
```

### Step 3.3: Access MinIO Console

```bash
# Open in browser:
http://localhost:9001

# Login credentials:
Username: minioadmin
Password: minioadmin123
```

You should see the MinIO console with your bucket "rental-portal-uploads" already created!

### Step 3.4: Configure Environment

```bash
# Update apps/api/.env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_S3_BUCKET=rental-portal-uploads
AWS_S3_ENDPOINT=http://localhost:9000
CDN_URL=http://localhost:9000/rental-portal-uploads
```

### Step 3.5: Update S3 Client Configuration

Update `apps/api/src/common/upload/upload.service.ts`:

```typescript
// Find the S3Client initialization and add endpoint configuration
this.s3Client = new S3Client({
  region: this.configService.get('AWS_REGION'),
  endpoint: this.configService.get('AWS_S3_ENDPOINT') || undefined, // Add this
  forcePathStyle: true, // Add this for MinIO
  credentials: {
    accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
  },
});
```

### Step 3.6: Test File Upload

Create test file: `apps/api/test-upload.js`

```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin123',
  },
});

async function testUpload() {
  try {
    const command = new PutObjectCommand({
      Bucket: 'rental-portal-uploads',
      Key: 'test/hello.txt',
      Body: 'Hello from Rental Portal!',
      ContentType: 'text/plain',
    });

    const response = await s3Client.send(command);
    console.log('✅ File uploaded successfully!');
    console.log('URL: http://localhost:9000/rental-portal-uploads/test/hello.txt');
  } catch (error) {
    console.error('❌ Error uploading file:', error);
  }
}

testUpload();
```

```bash
# Run test
node test-upload.js

# Check if file exists
curl http://localhost:9000/rental-portal-uploads/test/hello.txt
```

---

## 4. ⚙️ Complete Environment Configuration

### Step 4.1: Update .env File

Create/update `apps/api/.env` with all your actual values:

```bash
cd apps/api

# If .env doesn't exist, copy from example
cp .env.example .env

# Now edit it with your values
nano .env  # or use your preferred editor
```

Your complete `.env` should look like:

```dotenv
# Application
NODE_ENV=development
PORT=3400
FRONTEND_URL=http://localhost:3401
CORS_ORIGINS=http://localhost:3401,http://localhost:3400

# Database (from Docker)
DATABASE_URL="postgresql://rental_user:rental_password@localhost:3432/rental_portal?schema=public"

# Redis (from Docker)
REDIS_HOST=localhost
REDIS_PORT=3479
REDIS_PASSWORD=
REDIS_TTL=3600

# JWT (generate secure secrets)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Stripe (YOUR ACTUAL KEYS)
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PLATFORM_FEE_PERCENTAGE=10

# MinIO (Local S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_S3_BUCKET=rental-portal-uploads
AWS_S3_ENDPOINT=http://localhost:9000
CDN_URL=http://localhost:9000/rental-portal-uploads

# Resend Email (YOUR ACTUAL KEY)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=onboarding@resend.dev

# Optional services (can leave as-is for now)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FCM_SERVER_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4
MODERATION_CONFIDENCE_THRESHOLD=0.75

# Elasticsearch (from Docker)
ELASTICSEARCH_NODE=http://localhost:3492
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# Security
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT=100
```

### Step 4.2: Update Frontend Environment

Create/update `apps/web/.env`:

```bash
cd apps/web

# Create .env if it doesn't exist
cat > .env << 'EOF'
API_URL=http://localhost:3400/api/v1
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF
```

Replace `pk_test_...` with your actual Stripe publishable key.

---

## 5. 🧪 Comprehensive Testing

### Step 5.1: Start All Services

```bash
# Terminal 1: Docker services
docker-compose up -d
docker-compose -f docker-compose.local.yml up -d

# Wait for all services to be healthy
docker ps

# Terminal 2: API Server
cd apps/api
pnpm dev

# Terminal 3: Web Server
cd apps/web
pnpm dev

# Terminal 4: Stripe Webhook (if testing payments)
stripe listen --forward-to localhost:3400/api/v1/payments/webhook
```

### Step 5.2: Test Each Service

#### Test Email (Resend)

```bash
curl -X POST http://localhost:3400/api/v1/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email",
    "text": "This is a test email from Rental Portal"
  }'
```

#### Test Payment (Stripe)

```bash
# Create a test payment intent
curl -X POST http://localhost:3400/api/v1/payments/test \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "usd"
  }'
```

#### Test File Upload (MinIO)

```bash
# Upload a test image (replace with actual image path)
curl -X POST http://localhost:3400/api/v1/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/test-image.jpg" \
  -F "type=listing"
```

### Step 5.3: Test Complete User Flow

1. **Sign Up:** http://localhost:3401/auth/signup
2. **Check email** for verification link
3. **Login:** http://localhost:3401/auth/login
4. **Create listing** with photo upload
5. **Search** for listings
6. **Create booking** and complete payment

---

## 6. 📝 Configuration Updates Needed in Code

### Update Upload Service for MinIO

Edit `apps/api/src/common/upload/upload.service.ts`:

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucket: string;
  private cdnUrl: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('AWS_S3_BUCKET');
    this.cdnUrl = this.configService.get('CDN_URL');

    const endpoint = this.configService.get('AWS_S3_ENDPOINT');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      endpoint: endpoint || undefined, // Use MinIO endpoint if provided
      forcePathStyle: !!endpoint, // Required for MinIO
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  // ... rest of the service
}
```

### Update Configuration Service

Edit `apps/api/src/common/config/configuration.ts`:

```typescript
export default () => ({
  // ... other config

  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      endpoint: process.env.AWS_S3_ENDPOINT, // Add this
    },
    cdnUrl: process.env.CDN_URL,
  },

  // Add Resend configuration
  email: {
    provider: 'resend',
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  },

  // ... rest of config
});
```

---

## 7. ✅ Verification Checklist

After setup, verify each service:

- [ ] **Resend Email**
  - [ ] API key configured in .env
  - [ ] Test email sent successfully
  - [ ] Received email in inbox

- [ ] **Stripe Payments**
  - [ ] Test API keys configured
  - [ ] Publishable key in frontend .env
  - [ ] Webhook secret configured
  - [ ] Stripe CLI forwarding webhooks
  - [ ] Test payment intent created

- [ ] **MinIO Storage**
  - [ ] Docker container running
  - [ ] Can access console at http://localhost:9001
  - [ ] Bucket "rental-portal-uploads" exists
  - [ ] Test file uploaded successfully
  - [ ] Can access uploaded file via URL

- [ ] **Integration**
  - [ ] All services start without errors
  - [ ] API connects to all services
  - [ ] Frontend connects to API
  - [ ] Complete user flow works

---

## 8. 🐛 Troubleshooting

### Email Issues

**Problem:** "Invalid API key"

```bash
# Verify API key format
echo $RESEND_API_KEY
# Should start with "re_"

# Test directly with curl
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_your_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "test@example.com",
    "subject": "Test",
    "html": "<p>Test</p>"
  }'
```

### Stripe Issues

**Problem:** "No API key provided"

```bash
# Check if keys are loaded
cd apps/api
node -e "require('dotenv').config(); console.log(process.env.STRIPE_SECRET_KEY)"
```

**Problem:** Webhook signature verification failed

```bash
# Ensure Stripe CLI is running
stripe listen --forward-to localhost:3400/api/v1/payments/webhook

# Copy the webhook secret it provides to .env
```

### MinIO Issues

**Problem:** Cannot access MinIO console

```bash
# Check if container is running
docker ps | grep minio

# Check logs
docker logs rental-minio

# Restart if needed
docker-compose -f docker-compose.local.yml restart minio
```

**Problem:** Upload fails with "Access Denied"

```bash
# Set bucket policy to public (for development)
docker exec rental-minio mc anonymous set public myminio/rental-portal-uploads
```

---

## 9. 🚀 Next Steps

After successful setup:

1. **Run Full Test Suite**

   ```bash
   cd apps/api
   pnpm test
   ```

2. **Test Complete User Flows**
   - User registration with email verification
   - Listing creation with photo upload
   - Booking with payment processing

3. **Monitor Services**
   - Check API logs for errors
   - Monitor Stripe dashboard for test payments
   - Check MinIO console for uploaded files

4. **Deploy to Staging** (when ready)
   - Replace MinIO with AWS S3
   - Update Resend to use custom domain
   - Switch Stripe to live mode (with caution)

---

## 📚 Additional Resources

- **Resend Docs:** https://resend.com/docs
- **Stripe Test Cards:** https://stripe.com/docs/testing
- **MinIO Docs:** https://min.io/docs/minio/linux/index.html
- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli

---

## 🎉 Success!

You now have all three essential services configured:

- ✅ Email delivery (Resend)
- ✅ Payment processing (Stripe)
- ✅ File storage (MinIO)

Your development environment is ready for full-stack testing!

**Next:** Follow the [COMPREHENSIVE_VALIDATION_PLAN.md](./COMPREHENSIVE_VALIDATION_PLAN.md) to validate all features.
