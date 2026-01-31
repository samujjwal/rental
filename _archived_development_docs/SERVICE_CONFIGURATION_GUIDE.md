# Service Configuration Guide

This guide provides step-by-step instructions for configuring external services for the Rental Portal.

## Quick Setup (5 minutes)

Run the automated setup script:

```bash
./setup-env.sh
```

This will:

- Create `.env` file from template
- Generate secure JWT secrets
- Guide you through service configuration
- Start Docker services
- Set up the database

## Manual Configuration

If you prefer to configure manually or need detailed instructions:

### 1. Email Service - Resend (REQUIRED)

**Cost:** FREE - 3,000 emails/month  
**Time:** 2 minutes  
**Priority:** P0 (Critical)

#### Setup Steps:

1. **Create Account**

   ```
   https://resend.com/signup
   ```

   - No credit card required
   - Verify your email address

2. **Get API Key**

   ```
   https://resend.com/api-keys
   ```

   - Click "Create API Key"
   - Name: "Rental Portal Development"
   - Permission: "Full Access"
   - Copy the key (starts with `re_`)

3. **Update .env**

   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
   EMAIL_FROM=noreply@resend.dev
   ```

   For production with custom domain:

   ```bash
   EMAIL_FROM=noreply@yourdomain.com
   ```

   (You'll need to verify domain in Resend dashboard)

4. **Test Email Service**
   ```bash
   curl -X POST http://localhost:3000/auth/test-email \
     -H "Content-Type: application/json" \
     -d '{"email":"your-email@example.com"}'
   ```

**Limits:**

- Free: 3,000 emails/month
- 100 emails/day
- Upgrade: $20/month for 50,000 emails

---

### 2. Payment Processing - Stripe (REQUIRED)

**Cost:** Transaction fees only (no monthly fee)  
**Time:** 5 minutes  
**Priority:** P0 (Critical)

#### Setup Steps:

1. **Create Account**

   ```
   https://dashboard.stripe.com/register
   ```

2. **Get Test API Keys**

   ```
   https://dashboard.stripe.com/test/apikeys
   ```

   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)

3. **Update .env**

   ```bash
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
   ```

4. **Set Up Webhook**

   ```
   https://dashboard.stripe.com/test/webhooks
   ```

   - Click "Add endpoint"
   - Endpoint URL: `http://localhost:3000/payments/webhook`
   - Events to send:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
     - `customer.subscription.updated`
   - Copy webhook signing secret

5. **Add Webhook Secret to .env**

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```

6. **Configure Stripe Connect** (for owner payouts)

   ```
   https://dashboard.stripe.com/settings/connect
   ```

   - Enable Express accounts
   - Configure branding
   - Set up payout schedule

7. **Test Payment Flow**
   ```bash
   # Use test card: 4242 4242 4242 4242
   # Any future expiry date, any CVC
   ```

**Fees:**

- 2.9% + $0.30 per successful charge
- No monthly fees
- International cards: +1.5%

---

### 3. File Storage - Cloudflare R2 (OPTIONAL)

**Cost:** FREE - 10GB storage  
**Time:** 5 minutes  
**Priority:** P2 (Can use local storage)

For MVP, local storage is sufficient. Configure R2 for production:

#### Setup Steps:

1. **Create Cloudflare Account**

   ```
   https://dash.cloudflare.com/sign-up
   ```

2. **Enable R2**
   - Navigate to R2 in dashboard
   - Accept terms and conditions

3. **Create Bucket**
   - Name: `rental-portal-uploads`
   - Location: Auto (or choose closest region)

4. **Generate API Token**

   ```
   Account → R2 → Manage R2 API Tokens → Create API Token
   ```

   - Permissions: Object Read & Write
   - TTL: Never expire (or set expiry)
   - Copy Account ID, Access Key ID, and Secret Access Key

5. **Update .env**

   ```bash
   R2_ACCOUNT_ID=your_account_id_here
   R2_ACCESS_KEY_ID=your_access_key_id_here
   R2_SECRET_ACCESS_KEY=your_secret_access_key_here
   R2_BUCKET_NAME=rental-portal-uploads
   R2_PUBLIC_URL=https://pub-your-account-id.r2.dev/rental-portal-uploads
   ```

6. **Configure Public Access** (optional)
   - In R2 bucket settings → Public Access
   - Enable if you want direct file access
   - Configure custom domain for production

**Development:** Leave empty to use local storage

```bash
# .env for development
R2_ACCOUNT_ID=
# Files stored in ./uploads directory
```

**Limits:**

- Free: 10GB storage
- 1 million Class A operations/month
- 10 million Class B operations/month

---

### 4. Database - PostgreSQL

**Cost:** FREE (self-hosted)  
**Time:** Already configured via Docker  
**Priority:** P0 (Critical)

#### Verify Database:

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Connect to database
psql postgresql://rental_user:rental_pass@localhost:5434/rental_db

# Run migrations
cd packages/database
pnpm prisma migrate deploy
```

---

### 5. Cache - Redis

**Cost:** FREE (self-hosted)  
**Time:** Already configured via Docker  
**Priority:** P0 (Critical)

#### Verify Redis:

```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
redis-cli -h localhost -p 6382 ping
# Should return: PONG
```

---

### 6. Content Moderation (CONFIGURED)

**Cost:** FREE  
**Time:** 0 minutes (already configured)  
**Priority:** ✅ Complete

Uses `bad-words` library - no API keys needed.

Features:

- Profanity filtering
- Spam detection
- Contact information blocking
- Pattern-based moderation

---

### 7. Search - PostgreSQL Full-Text Search (CONFIGURED)

**Cost:** FREE  
**Time:** 0 minutes (already configured)  
**Priority:** ✅ Complete

Using PostgreSQL `tsvector` for full-text search.

#### Upgrade to Elasticsearch (Optional - Production)

Only needed for >10,000 listings:

```bash
# Docker Compose
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  elasticsearch:8.11.0

# Update .env
ELASTICSEARCH_NODE=http://localhost:9200
```

---

## Environment Variables Reference

### Required for MVP

```bash
# Database
DATABASE_URL=postgresql://rental_user:rental_pass@localhost:5434/rental_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6382

# JWT (auto-generated by setup-env.sh)
JWT_SECRET=your-generated-secret
JWT_REFRESH_SECRET=your-generated-secret

# Email (REQUIRED)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@resend.dev

# Payments (REQUIRED)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Optional for MVP

```bash
# File Storage (uses local by default)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# SMS (skip for MVP)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=

# Push Notifications (skip for MVP)
# FIREBASE_PROJECT_ID=
# FIREBASE_PRIVATE_KEY=
# FIREBASE_CLIENT_EMAIL=
```

---

## Testing Configuration

After configuration, test all services:

```bash
# Run complete test suite
./test-all.sh

# Test individual services
curl http://localhost:3000/health

# Test email
curl -X POST http://localhost:3000/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Test file upload
curl -X POST http://localhost:3000/upload/test \
  -F "file=@test-image.jpg"

# Test Stripe
curl -X POST http://localhost:3000/payments/test \
  -H "Content-Type: application/json" \
  -d '{"amount":1000}'
```

---

## Troubleshooting

### Email not sending

1. **Check API key**

   ```bash
   echo $RESEND_API_KEY
   # Should return: re_xxxxx
   ```

2. **Verify domain** (production only)
   - Go to Resend dashboard → Domains
   - Ensure DNS records are configured
   - Status should be "Verified"

3. **Check logs**
   ```bash
   # API logs
   pnpm --filter @rental-portal/api start:dev
   # Look for "Email sent successfully" or error messages
   ```

### Stripe webhook not working

1. **Test webhook locally** with Stripe CLI

   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe

   # Forward webhooks to local
   stripe listen --forward-to localhost:3000/payments/webhook

   # Trigger test event
   stripe trigger payment_intent.succeeded
   ```

2. **Verify webhook secret**
   ```bash
   echo $STRIPE_WEBHOOK_SECRET
   # Should return: whsec_xxxxx
   ```

### File upload failing

1. **Check storage configuration**

   ```bash
   # For local storage
   ls -la ./uploads
   # Should exist and be writable

   # For R2
   echo $R2_ACCOUNT_ID
   # Should return your account ID
   ```

2. **Test upload endpoint**
   ```bash
   curl -X POST http://localhost:3000/upload/test \
     -F "file=@test.jpg" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

## Production Checklist

Before deploying to production:

- [ ] All `.env` variables configured
- [ ] Email domain verified in Resend
- [ ] Stripe account activated (not test mode)
- [ ] Stripe webhook configured with production URL
- [ ] R2 bucket configured with public access
- [ ] Database backups configured
- [ ] Redis persistence enabled
- [ ] JWT secrets are unique and secure
- [ ] CORS origins updated for production domain
- [ ] SSL/TLS certificates configured
- [ ] Monitoring and logging enabled

---

## Cost Summary

### Free Tier Limits

| Service            | Free Tier          | Cost After Limit            |
| ------------------ | ------------------ | --------------------------- |
| Resend             | 3,000 emails/month | $20/mo for 50k              |
| Stripe             | No limit           | 2.9% + $0.30/txn            |
| Cloudflare R2      | 10GB storage       | $0.015/GB/month             |
| PostgreSQL         | Self-hosted        | $0 (AWS RDS $15/mo)         |
| Redis              | Self-hosted        | $0 (AWS ElastiCache $15/mo) |
| Content Moderation | Unlimited          | $0                          |
| Search             | Unlimited          | $0                          |

**Total MVP Cost:** $0/month (assuming <3k emails, <10GB storage)

---

## Next Steps

1. **Run setup script:** `./setup-env.sh`
2. **Configure required services:** Resend + Stripe
3. **Test the application:** `./test-all.sh`
4. **Start development:** `pnpm dev`
5. **Read deployment guide:** `PRODUCTION_DEPLOYMENT_GUIDE.md`

For detailed implementation examples, see `FREE_ALTERNATIVES_GUIDE.md`.
