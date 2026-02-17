# External Services Setup

This guide reflects the **current codebase** and consolidates configuration for third‑party services used by the Rental Portal.

## Quick Summary

Required for full production parity:
- Stripe (payments + webhooks)
- Email (Resend for auth/transactional, SendGrid optional for notifications)
- Storage (S3/MinIO for local, Cloudflare R2 or S3 for production)
- SMS (Twilio) and Push (Firebase) if notifications are enabled

Optional / feature‑flagged:
- OpenAI moderation (fallbacks exist)
- Elasticsearch/OpenSearch (PostgreSQL search works without it)

## 1) Stripe

Used by `apps/api` and the web client.

**Environment variables (API):**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

**Environment variables (Web):**
- `VITE_STRIPE_PUBLISHABLE_KEY`

**Notes:**
- Webhooks are handled in `apps/api/src/modules/payments/webhook.controller.ts`.
- Make sure the webhook endpoint points to your API base URL.

## 2) Email

Two email paths exist in the codebase:

1) **Resend (recommended for auth/transactional)**
- Used by `apps/api/src/common/email/resend-email.service.ts`.
- Env vars:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`

2) **SendGrid (notifications module)**
- Used by `apps/api/src/modules/notifications/services/sendgrid.service.ts`.
- Env vars:
  - `SENDGRID_API_KEY`
  - `EMAIL_FROM`

**Optional SMTP path** is still supported by config, but Resend is preferred.

## 3) SMS (Twilio)

Used by `apps/api/src/modules/notifications/services/twilio.service.ts`.

Env vars:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

## 4) Push Notifications (Firebase / FCM)

Used by `apps/api/src/modules/notifications/services/push-notification.service.ts`.

Env vars:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FCM_SERVER_KEY`

## 5) Storage

Two storage paths exist:

**A. AWS S3 / MinIO (local dev)**
- Used by `apps/api/src/common/upload/upload.service.ts` and `apps/api/src/common/storage/s3.service.ts`.
- Env vars:
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_S3_BUCKET`
  - `AWS_S3_ENDPOINT` (MinIO local endpoint, e.g. `http://localhost:9000`)

**B. Cloudflare R2 (production option)**
- Used by `apps/api/src/common/storage/storage.service.ts`.
- Env vars:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`

## 6) Content Moderation (OpenAI)

Optional integration used by `apps/api/src/modules/moderation/services/text-moderation.service.ts`.

Env vars:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4`)
- `MODERATION_CONFIDENCE_THRESHOLD`

## 7) Search (Optional)

PostgreSQL full‑text search is already implemented. Elasticsearch/OpenSearch is optional.

Env vars (if enabled):
- `ELASTICSEARCH_NODE`
- `ELASTICSEARCH_USERNAME`
- `ELASTICSEARCH_PASSWORD`

## Validation Notes

- The API currently reads most settings directly from environment variables via `@nestjs/config`.
- Make sure your `.env` (root) and `apps/api/.env` are aligned with the values above.
- For local development, the provided `.env.example` and `apps/api/.env.example` are the best starting points.

## Recommended Local Setup Order

1. Stripe (test keys)
2. Resend (or SendGrid) for email
3. MinIO for local S3
4. Twilio and Firebase if you need messaging notifications
