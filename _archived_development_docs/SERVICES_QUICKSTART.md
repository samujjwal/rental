# 🚀 External Services - 15 Minute Setup Guide

Get Resend (email), Stripe (payments), and MinIO (file storage) running in 15 minutes.

---

## ⚡ Step 1: Environment Files (30 seconds)

```bash
# Copy environment templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

---

## 📦 Step 2: MinIO (Local S3) - 2 minutes

MinIO provides S3-compatible storage without needing AWS. It's already configured!

### Start MinIO:

```bash
docker-compose -f docker-compose.minio.yml up -d
```

### Verify:

```bash
docker ps | grep minio
# Should show minio running on ports 9000 and 9001
```

### Access Console:

- **URL:** http://localhost:9001
- **Username:** `minioadmin`
- **Password:** `minioadmin123`

### ✅ Configuration (already in .env):

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_S3_BUCKET=rental-portal-uploads
AWS_S3_ENDPOINT=http://localhost:9000
```

**MinIO is done!** No additional steps needed.

---

## 📧 Step 3: Resend (Email) - 5 minutes

### A. Create Account

1. Visit https://resend.com/signup
2. Sign up (free: 3,000 emails/month)
3. Verify your email

### B. Get API Key

1. Go to https://resend.com/api-keys
2. Click **"Create API Key"**
3. Name: `rental-portal-dev`
4. Permissions: **Full Access**
5. Copy the key (starts with `re_...`)

### C. Update .env

Edit `apps/api/.env`:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_YOUR_ACTUAL_KEY_HERE
EMAIL_FROM=onboarding@resend.dev
```

**Note:** Use `onboarding@resend.dev` as sender until you verify your domain.

### D. Test

Start your API:

```bash
pnpm dev
```

Test sending an email (replace with your email):

```bash
curl -X POST http://localhost:3400/api/auth/send-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

Check https://resend.com/emails to see sent emails.

---

## 💳 Step 4: Stripe (Payments) - 5 minutes

### A. Create Account

1. Visit https://dashboard.stripe.com/register
2. Sign up (no credit card needed)
3. Skip onboarding (use test mode)

### B. Get API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy **Publishable key** (`pk_test_...`)
3. Copy **Secret key** (`sk_test_...`)

### C. Update .env Files

**Backend** (`apps/api/.env`):

```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_leave_for_now
```

**Frontend** (`apps/web/.env`):

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
```

### D. Test

Create a payment intent:

```bash
curl -X POST http://localhost:3400/api/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}'
```

You should get a response with `client_secret`.

---

## ✅ Verification

Run these checks:

```bash
# 1. MinIO running?
docker ps | grep minio

# 2. Environment files exist?
ls apps/api/.env apps/web/.env

# 3. API keys configured?
grep "RESEND_API_KEY\|STRIPE_SECRET_KEY\|AWS_S3_ENDPOINT" apps/api/.env

# 4. Start everything
pnpm dev
```

Visit:

- **API:** http://localhost:3400/api
- **Frontend:** http://localhost:3401
- **MinIO Console:** http://localhost:9001

---

## 🐛 Common Issues

### MinIO won't start

```bash
# Check port conflicts
lsof -i :9000
lsof -i :9001

# Restart
docker-compose -f docker-compose.minio.yml down
docker-compose -f docker-compose.minio.yml up -d
```

### Resend not working

- API key must start with `re_`
- Free tier: Only send to your verified email
- Use `onboarding@resend.dev` as sender
- Check dashboard: https://resend.com/emails

### Stripe errors

- Use **test** keys (`sk_test_`, `pk_test_`)
- Not live keys (`sk_live_`, `pk_live_`)
- Test card: `4242 4242 4242 4242` (any expiry/CVV)

---

## 🎯 Quick Reference

| Service    | Dashboard                    | Purpose      | Cost           |
| ---------- | ---------------------------- | ------------ | -------------- |
| **MinIO**  | http://localhost:9001        | File storage | Free (local)   |
| **Resend** | https://resend.com           | Emails       | 3K/month free  |
| **Stripe** | https://dashboard.stripe.com | Payments     | Test mode free |

---

## 🧪 Test Features

### Upload File

```bash
curl -X POST http://localhost:3400/api/upload \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@image.jpg"
```

### Send Email

```bash
curl -X POST http://localhost:3400/api/notifications/email \
  -H "Content-Type: application/json" \
  -d '{"to": "user@example.com", "subject": "Test", "body": "Hello!"}'
```

### Create Payment

```bash
curl -X POST http://localhost:3400/api/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "currency": "usd"}'
```

Use test card in UI: **4242 4242 4242 4242**

---

## ✨ You're Ready!

All three services are now configured. Start the app:

```bash
pnpm dev
```

You can now:

- ✅ Upload listing photos and documents
- ✅ Send verification and notification emails
- ✅ Process booking payments and refunds

Happy coding! 🚀
