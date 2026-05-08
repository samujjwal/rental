---
status: canonical
owner: engineering
last_reviewed: 2026-05-08
source_of_truth: true
---

# Deployment Guide

This document is the canonical summary of supported deployment modes.

## Supported Modes

### MVP Single-VM

Deploy Postgres, Redis, API, web, Nginx, and supporting services on one host.

Use when:

- launching an initial production-like environment quickly
- operating on one Linux VM
- accepting an all-in-one deployment footprint

### Production Compose

Deploy API, web, and Nginx with external database and Redis services.

Use when:

- infrastructure services are managed externally
- the application layer is deployed separately from stateful services

### Kubernetes

For large-scale, cloud-native deployments with auto-scaling and self-healing capabilities.

## Prerequisites

- Linux host with Docker Engine and Docker Compose plugin
- DNS pointed to the host
- ports `80` and `443` open
- correctly populated environment files
- SSL certificates (for production)

## Pre-Deployment Checklist

### Configuration
- [ ] All environment variables configured in `.env.production`
- [ ] JWT secrets generated (64+ characters)
- [ ] Database credentials set
- [ ] Redis credentials set
- [ ] SSL certificates obtained and configured
- [ ] CORS origins configured
- [ ] Payment gateway configured (Stripe)
- [ ] Email service configured (Resend/SendGrid)
- [ ] Object storage configured (DigitalOcean Spaces/AWS S3)
- [ ] Sentry DSN configured for error tracking

### Security
- [ ] Firewall rules configured
- [ ] SSL/TLS certificates valid
- [ ] Database access restricted
- [ ] API rate limiting enabled
- [ ] Security headers configured
- [ ] CSRF protection enabled
- [ ] Input validation enabled

### Database
- [ ] Database backups configured
- [ ] Migration scripts tested
- [ ] Database indexes optimized
- [ ] Connection pooling configured

## Common Commands

```bash
# MVP deployment
pnpm run deploy:mvp -- yourdomain.com

# Production compose deployment
pnpm run deploy:prod

# Backups
pnpm run backup:mvp
pnpm run backup:prod
```

## Verification

After deployment, verify at minimum:

- API health endpoint responds
- web app responds
- environment variables are loaded correctly
- payment, email, storage, and auth configuration are valid for the environment

## Monitoring & Maintenance

### Health Checks
```bash
# API health check
curl https://yourdomain.com/api/health

# Web health check
curl https://yourdomain.com
```

### Log Monitoring
```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api
```

### Backup Strategy
```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backup (crontab)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

## Update Procedure

### Rolling Update
```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Rolling restart (zero downtime)
docker compose -f docker-compose.prod.yml up -d --no-deps --build api
docker compose -f docker-compose.prod.yml up -d --no-deps --build web

# Run migrations
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate:deploy
```

## Rollback Procedures

```bash
# View previous images
docker images | grep rental

# Rollback to previous version
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Rollback database
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @rental-portal/database migrate resolve
```

## Related Docs

- [`integrations.md`](integrations.md)
- [`../operations/runbooks.md`](../operations/runbooks.md)
- [`developer-guide.md`](developer-guide.md)
