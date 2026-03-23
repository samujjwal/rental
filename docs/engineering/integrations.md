# Integrations Guide

This document is the canonical summary of third-party services used by the platform.

## Core Integrations

### Payments

- Stripe for payment flows and webhooks

### Email

- Resend for transactional/auth use cases
- SendGrid for notification-related use cases where still enabled

### Messaging

- Twilio for SMS delivery
- Firebase / FCM for push notifications

### Storage

- S3 or MinIO for local/dev-compatible object storage
- Cloudflare R2 or S3-compatible production storage

### AI And Moderation

- OpenAI-backed moderation or AI features where enabled

### Search

- PostgreSQL search as the baseline
- OpenSearch / Elasticsearch as optional enhancement paths

## Setup Guidance

- start from `.env.example` files at repo root and app level
- keep root and app env files aligned for shared services
- validate webhook and callback URLs against the actual deployed API base URL
- treat integration setup as environment-specific, but document stable variable names here

## Environment Variable Families

- Stripe: payment secret, publishable, and webhook credentials
- Email: provider API keys and sender addresses
- Twilio: account, auth token, and sender number
- Firebase: project and credential fields
- Storage: bucket, region, endpoint, and credentials
- OpenAI: API key and model-selection values
- Search: node URL and auth when an external engine is enabled
