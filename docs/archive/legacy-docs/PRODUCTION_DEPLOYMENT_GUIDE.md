# Production Deployment Guide

This repo ships with two deployment modes:

1. **MVP single-VM** (Postgres + Redis + API + Web + Nginx + Certbot on one host)
2. **Production compose** (API + Web + Nginx, with external DB/Redis)

## Prerequisites

- Linux VM with Docker Engine and Docker Compose plugin (or `docker-compose`)
- Domain DNS pointed to the VM public IP
- Ports `80` and `443` open
- Node is **not** required on host for deployment scripts

## Option A: MVP single-VM (recommended for first launch)

1. Prepare environment:

```bash
cd /path/to/rental
cp .env.mvp.example .env.mvp
```

2. Edit `.env.mvp` and set at minimum:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DOMAIN_NAME`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`

3. Deploy:

```bash
sudo pnpm run deploy:mvp -- yourdomain.com
```

Optional flags:

- `INCLUDE_WWW=true sudo pnpm run deploy:mvp -- yourdomain.com`
- `SEED_DB=true sudo pnpm run deploy:mvp -- yourdomain.com`

4. Verify:

```bash
curl -f http://localhost/api/health
curl -f https://yourdomain.com
```

## Option B: Production compose (external DB/Redis)

1. Prepare environment:

```bash
cd /path/to/rental
cp .env.production.example .env.production
```

2. Edit `.env.production` and set at minimum:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGINS`

3. Place TLS files for nginx:

- `nginx/ssl/cert.pem`
- `nginx/ssl/key.pem`

4. Deploy:

```bash
pnpm run deploy:prod
```

5. Verify:

```bash
curl -f http://localhost/api/health
curl -f http://localhost
```

## Useful operations

MVP logs:

```bash
docker compose -f docker-compose.mvp.yml --env-file .env.mvp logs -f
```

Production logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f
```

Run MVP backup manually:

```bash
pnpm run backup:mvp
```

Run production backup manually:

```bash
pnpm run backup:prod
```
